import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, Like } from 'typeorm';
import { InvitationCode } from '../../database/entities/invitation-code.entity';
import {
  InvitationRecord,
  InvitationRecordStatus,
} from '../../database/entities/invitation-record.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import {
  AccountTransaction,
  TransactionType,
} from '../../database/entities/account-transaction.entity';
import { User } from '../../database/entities/user.entity';

@Injectable()
export class InvitationService {
  private logger = new Logger(InvitationService.name);

  constructor(
    @InjectRepository(InvitationCode)
    private codeRepository: Repository<InvitationCode>,
    @InjectRepository(InvitationRecord)
    private recordRepository: Repository<InvitationRecord>,
    @InjectRepository(AccountBalance)
    private balanceRepository: Repository<AccountBalance>,
    @InjectRepository(AccountTransaction)
    private txRepository: Repository<AccountTransaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  /**
   * 为用户生成6位唯一邀请码（大写字母+数字）
   * 如果已有邀请码则直接返回
   * 并发安全：捕获唯一约束冲突(23505)，回查返回已有记录
   */
  async generateInvitationCode(userId: string): Promise<InvitationCode> {
    // 检查是否已有邀请码
    const existing = await this.codeRepository.findOne({
      where: { userId },
    });
    if (existing) return existing;

    // 生成唯一邀请码，最多重试10次
    let code: string = this.generateRandomCode(); // 初始化
    let isUnique = false;
    let retries = 0;

    while (!isUnique && retries < 10) {
      code = this.generateRandomCode();
      const found = await this.codeRepository.findOne({ where: { code } });
      if (!found) isUnique = true;
      retries++;
    }

    if (!isUnique) {
      throw new BadRequestException('生成邀请码失败，请重试');
    }

    const invitationCode = this.codeRepository.create({
      userId,
      code,
      usedCount: 0,
    });

    try {
      return await this.codeRepository.save(invitationCode);
    } catch (error: unknown) {
      // 唯一约束冲突(PostgreSQL 23505)：并发插入同一userId，回查返回已有记录
      const err = error as any;
      if (err?.code === '23505') {
        const existingRecord = await this.codeRepository.findOne({
          where: { userId },
        });
        if (existingRecord) return existingRecord;
      }
      throw error;
    }
  }

  /**
   * 生成6位随机邀请码（大写字母+数字）
   */
  private generateRandomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  /**
   * 绑定邀请码（注册时调用）
   * 验证邀请码存在且有效，检查防刷策略
   */
  async applyInvitationCode(
    inviteeUserId: string,
    code: string,
  ): Promise<InvitationRecord> {
    // 1. 验证邀请码存在
    const invitationCode = await this.codeRepository.findOne({
      where: { code: code.toUpperCase() },
    });
    if (!invitationCode) {
      throw new NotFoundException('邀请码不存在');
    }

    // 2. 检查不能自己邀请自己
    if (invitationCode.userId === inviteeUserId) {
      throw new BadRequestException('不能使用自己的邀请码');
    }

    // 3. 检查邀请码是否已满（50人上限）
    if (invitationCode.usedCount >= invitationCode.maxUses) {
      throw new BadRequestException('该邀请码已达使用上限');
    }

    // 4. 检查该用户是否已被邀请过（防刷）
    const existingRecord = await this.recordRepository.findOne({
      where: { inviteeUserId },
    });
    if (existingRecord) {
      throw new BadRequestException('您已被邀请过，不可重复使用邀请码');
    }

    // 5. 检查invitee手机号是否已被邀请过（防刷）
    const inviteeUser = await this.userRepository.findOne({
      where: { id: inviteeUserId },
    });
    if (inviteeUser && inviteeUser.phone) {
      const phoneRecord = await this.recordRepository
        .createQueryBuilder('record')
        .innerJoin(User, 'user', 'user.id = record.inviteeUserId')
        .where('user.phone = :phone', { phone: inviteeUser.phone })
        .getOne();
      if (phoneRecord) {
        throw new BadRequestException('该手机号已被邀请过');
      }
    }

    // 6. 创建邀请记录 & 7. 更新邀请码使用次数（在同一事务内保证一致性）
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 重新在事务内验证邀请码（带悲观锁防止并发超限）
      const txInvitationCode = await queryRunner.manager.findOne(InvitationCode, {
        where: { id: invitationCode.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!txInvitationCode || txInvitationCode.usedCount >= txInvitationCode.maxUses) {
        throw new BadRequestException('该邀请码已达使用上限');
      }

      // 再次检查该用户是否已被邀请过（事务内防并发）
      const txExistingRecord = await queryRunner.manager.findOne(InvitationRecord, {
        where: { inviteeUserId },
      });
      if (txExistingRecord) {
        throw new BadRequestException('您已被邀请过，不可重复使用邀请码');
      }

      const record = queryRunner.manager.create(InvitationRecord, {
        inviterUserId: txInvitationCode.userId,
        inviteeUserId,
        invitationCodeId: txInvitationCode.id,
        status: InvitationRecordStatus.REGISTERED,
      });
      const saved = await queryRunner.manager.save(record);

      txInvitationCode.usedCount += 1;
      await queryRunner.manager.save(txInvitationCode);

      await queryRunner.commitTransaction();
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 验证邀请码有效性
   */
  async validateInvitationCode(code: string): Promise<{
    valid: boolean;
    inviterName?: string;
    remainingUses?: number;
  }> {
    const invitationCode = await this.codeRepository.findOne({
      where: { code: code.toUpperCase() },
      relations: ['user'],
    });

    if (!invitationCode) {
      return { valid: false };
    }

    if (invitationCode.usedCount >= invitationCode.maxUses) {
      return { valid: false, inviterName: invitationCode.user?.username, remainingUses: 0 };
    }

    return {
      valid: true,
      inviterName: invitationCode.user?.realName || invitationCode.user?.username,
      remainingUses: invitationCode.maxUses - invitationCode.usedCount,
    };
  }

  /**
   * 首次认购成功后发放邀请奖励
   * 被邀请人获5元 → availableBalance
   * 邀请人获10元 → frozenBalance（满15人后解冻到availableBalance）
   */
  async processFirstSubscriptionReward(
    userId: string,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    // 快速失败预检查（不作为安全保障，安全保障由事务内悲观锁负责）
    const record = await this.recordRepository.findOne({
      where: {
        inviteeUserId: userId,
        status: InvitationRecordStatus.REGISTERED,
      },
    });

    if (!record) return; // 无有效邀请关系，直接返回

    const useExternalRunner = !!queryRunner;
    const qr = queryRunner || this.dataSource.createQueryRunner();

    if (!useExternalRunner) {
      await qr.connect();
      await qr.startTransaction();
    }

    try {
      // 重新在事务内读取record（悲观锁保护），确保状态一致性
      const txRecord = await qr.manager.findOne(InvitationRecord, {
        where: { id: record.id },
        lock: { mode: 'pessimistic_write' },
      });

      // 安全保障：只有 REGISTERED 状态才能发放奖励（事务内悲观锁保护）
      if (!txRecord || txRecord.status !== InvitationRecordStatus.REGISTERED) {
        this.logger.warn(`邀请奖励跳过：记录不存在或状态非REGISTERED - recordId: ${record.id}, status: ${txRecord?.status}`);
        return;
      }

      // 被邀请人账户（悲观锁）
      const inviteeBalance = await qr.manager.findOne(AccountBalance, {
        where: { userId: txRecord.inviteeUserId },
        lock: { mode: 'pessimistic_write' },
      });

      // 邀请人账户（悲观锁）
      const inviterBalance = await qr.manager.findOne(AccountBalance, {
        where: { userId: txRecord.inviterUserId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!inviteeBalance || !inviterBalance) {
        this.logger.warn(`邀请奖励发放失败：账户不存在 - invitee: ${txRecord.inviteeUserId}, inviter: ${txRecord.inviterUserId}`);
        return;
      }

      // 查询邀请人是否已解锁奖励（满15人后解锁）
      const unlockTxCount = await qr.manager.count(AccountTransaction, {
        where: {
          userId: txRecord.inviterUserId,
          type: TransactionType.INVITATION_REWARD,
          description: Like('%解冻%'),
        },
      });
      const isUnlocked = unlockTxCount > 0;

      // === 被邀请人获5元 → availableBalance（被邀请人奖励不受15人限制）===
      const inviteeReward = Number(txRecord.inviteeReward);
      const inviteeBefore = Number(inviteeBalance.availableBalance);
      inviteeBalance.availableBalance = Number((inviteeBefore + inviteeReward).toFixed(2));
      await qr.manager.save(inviteeBalance);

      // 创建被邀请人交易流水
      const inviteeTx = qr.manager.create(AccountTransaction, {
        userId: txRecord.inviteeUserId,
        type: TransactionType.INVITATION_REWARD,
        amount: inviteeReward,
        balanceBefore: inviteeBefore,
        balanceAfter: Number(inviteeBalance.availableBalance),
        description: `邀请奖励：被邀请人首次认购完成，获得¥${inviteeReward}`,
      });
      await qr.manager.save(inviteeTx);

      // === 邀请人获10元 → 已解锁进availableBalance，未解锁进frozenBalance ===
      const inviterReward = Number(txRecord.inviterReward);

      if (isUnlocked) {
        // 已解锁：奖励直接进availableBalance
        const inviterAvailBefore = Number(inviterBalance.availableBalance);
        inviterBalance.availableBalance = Number((inviterAvailBefore + inviterReward).toFixed(2));
        await qr.manager.save(inviterBalance);

        const inviterTx = qr.manager.create(AccountTransaction, {
          userId: txRecord.inviterUserId,
          type: TransactionType.INVITATION_REWARD,
          amount: inviterReward,
          balanceBefore: inviterAvailBefore,
          balanceAfter: Number(inviterBalance.availableBalance),
          description: `邀请奖励：成功邀请用户首次认购，获得¥${inviterReward}`,
        });
        await qr.manager.save(inviterTx);
      } else {
        // 未解锁：奖励进frozenBalance
        const inviterFrozenBefore = Number(inviterBalance.frozenBalance);
        inviterBalance.frozenBalance = Number((inviterFrozenBefore + inviterReward).toFixed(2));
        await qr.manager.save(inviterBalance);

        // 冻结奖励的流水：balanceBefore/After 使用 frozenBalance（记录冻结余额变化）
        const inviterTx = qr.manager.create(AccountTransaction, {
          userId: txRecord.inviterUserId,
          type: TransactionType.INVITATION_REWARD,
          amount: inviterReward,
          balanceBefore: inviterFrozenBefore,
          balanceAfter: Number(inviterBalance.frozenBalance),
          description: `邀请奖励冻结：成功邀请用户首次认购，¥${inviterReward}进入冻结余额（满15人后解冻）`,
        });
        await qr.manager.save(inviterTx);
      }

      // 更新邀请记录状态
      txRecord.status = InvitationRecordStatus.REWARDED;
      txRecord.rewardedAt = new Date();
      await qr.manager.save(txRecord);

      // === 检查是否满15人，触发解冻 ===
      if (!isUnlocked) {
        const rewardedCount = await qr.manager.count(InvitationRecord, {
          where: {
            inviterUserId: txRecord.inviterUserId,
            status: InvitationRecordStatus.REWARDED,
          },
        });

        // 精确判断：第15人时触发解冻；>= 15 兜底防止并发跳过
        if (rewardedCount >= 15) {
          await this.unlockInvitationRewards(txRecord.inviterUserId, qr);
        }
      }

      if (!useExternalRunner) {
        await qr.commitTransaction();
      }

      this.logger.log(`邀请奖励发放成功：邀请人${txRecord.inviterUserId}获¥${inviterReward}（${isUnlocked ? '可用' : '冻结'}），被邀请人${txRecord.inviteeUserId}获¥${inviteeReward}`);
    } catch (error) {
      if (!useExternalRunner) {
        await qr.rollbackTransaction();
      }
      throw error;
    } finally {
      if (!useExternalRunner) {
        await qr.release();
      }
    }
  }

  /**
   * 解冻邀请奖励：满15人后将所有累计邀请奖励从frozenBalance转到availableBalance
   * 包含防重复解冻机制（通过account_transactions流水记录判断）
   */
  async unlockInvitationRewards(
    userId: string,
    queryRunner: QueryRunner,
  ): Promise<void> {
    // 1. 查询邀请码，检查是否已解锁（防重复）
    const invitationCode = await queryRunner.manager.findOne(InvitationCode, {
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!invitationCode) {
      this.logger.warn(`解冻邀请奖励失败：邀请码不存在 - userId: ${userId}`);
      return;
    }

    // 检查是否已解锁（通过解冻流水记录防重复）
    const hasUnlocked = await queryRunner.manager.count(AccountTransaction, {
      where: {
        userId,
        type: TransactionType.INVITATION_REWARD,
        description: Like('%解冻%'),
      },
    });
    if (hasUnlocked > 0) {
      this.logger.log(`邀请奖励已解锁，跳过 - userId: ${userId}`);
      return;
    }

    // 2. 计算累计邀请奖励 = 该用户作为inviter且status=REWARDED的所有记录的inviterReward之和
    const result = await queryRunner.manager
      .createQueryBuilder(InvitationRecord, 'record')
      .select('SUM(record.inviterReward)', 'totalReward')
      .where('record.inviterUserId = :userId', { userId })
      .andWhere('record.status = :status', { status: InvitationRecordStatus.REWARDED })
      .getRawOne();

    const totalFrozenReward = Number(Number(result?.totalReward || 0).toFixed(2));

    if (totalFrozenReward <= 0) {
      this.logger.warn(`解冻邀请奖励：累计奖励为0 - userId: ${userId}`);
      return;
    }

    // 3. 锁定账户余额并操作
    const balance = await queryRunner.manager.findOne(AccountBalance, {
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!balance) {
      this.logger.warn(`解冻邀请奖励失败：账户不存在 - userId: ${userId}`);
      return;
    }

    const availableBefore = Number(balance.availableBalance);
    const frozenBefore = Number(balance.frozenBalance);

    // 确保冻结余额足够（防御性校验）
    if (frozenBefore < totalFrozenReward) {
      this.logger.warn(`解冻邀请奖励：冻结余额(${frozenBefore})小于累计奖励(${totalFrozenReward})，以冻结余额为准 - userId: ${userId}`);
    }

    const actualUnlock = Math.min(frozenBefore, totalFrozenReward);
    balance.frozenBalance = Number((frozenBefore - actualUnlock).toFixed(2));
    balance.availableBalance = Number((availableBefore + actualUnlock).toFixed(2));
    await queryRunner.manager.save(balance);

    // 4. 创建解冻流水记录
    const unlockTx = queryRunner.manager.create(AccountTransaction, {
      userId,
      type: TransactionType.INVITATION_REWARD,
      amount: actualUnlock,
      balanceBefore: availableBefore,
      balanceAfter: Number(balance.availableBalance),
      description: `邀请满15人，奖励解冻¥${actualUnlock}`,
    });
    await queryRunner.manager.save(unlockTx);

    this.logger.log(`邀请奖励解冻成功：userId=${userId}，解冻金额¥${actualUnlock}，冻结余额${frozenBefore}→${balance.frozenBalance}，可用余额${availableBefore}→${balance.availableBalance}`);
  }

  /**
   * 获取用户邀请统计
   */
  async getInvitationStats(userId: string): Promise<{
    code: string;
    invitedCount: number;
    totalReward: number;
    remainingUses: number;
  }> {
    // 获取邀请码（如果不存在则自动生成）
    let invitationCode = await this.codeRepository.findOne({
      where: { userId },
    });
    if (!invitationCode) {
      invitationCode = await this.generateInvitationCode(userId);
    }

    // 已邀请人数
    const invitedCount = await this.recordRepository.count({
      where: { inviterUserId: userId },
    });

    // 已获奖励总额
    const rewardedRecords = await this.recordRepository.find({
      where: {
        inviterUserId: userId,
        status: InvitationRecordStatus.REWARDED,
      },
    });
    const totalReward = rewardedRecords.reduce(
      (sum, r) => sum + Number(r.inviterReward),
      0,
    );

    // 邀请码剩余可用次数
    const remainingUses = invitationCode.maxUses - invitationCode.usedCount;

    return {
      code: invitationCode.code,
      invitedCount,
      totalReward: Number(totalReward.toFixed(2)),
      remainingUses,
    };
  }

  /**
   * 获取邀请明细列表
   */
  async getInvitationRecords(userId: string): Promise<any[]> {
    const records = await this.recordRepository.find({
      where: { inviterUserId: userId },
      relations: ['invitee'],
      order: { createdAt: 'DESC' },
    });

    return records.map((record) => ({
      id: record.id,
      inviteeName: record.invitee?.realName || record.invitee?.username || '未知用户',
      status: record.status,
      inviterReward: Number(record.inviterReward),
      inviteeReward: Number(record.inviteeReward),
      rewardedAt: record.rewardedAt,
      createdAt: record.createdAt,
    }));
  }

  /**
   * 管理端分页查询所有邀请记录
   */
  async getAdminList(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ list: any[]; pagination: any }> {
    const [records, total] = await this.recordRepository.findAndCount({
      relations: ['inviter', 'invitee', 'invitationCode'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      list: records.map((record) => ({
        id: record.id,
        inviterName: record.inviter?.realName || record.inviter?.username || '未知',
        inviteeName: record.invitee?.realName || record.invitee?.username || '未知',
        inviterUserId: record.inviterUserId,
        inviteeUserId: record.inviteeUserId,
        invitationCode: record.invitationCode?.code,
        status: record.status,
        inviterReward: Number(record.inviterReward),
        inviteeReward: Number(record.inviteeReward),
        rewardedAt: record.rewardedAt,
        createdAt: record.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
