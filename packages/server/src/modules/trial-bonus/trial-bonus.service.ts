import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, QueryRunner } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import {
  TrialBonus,
  TrialBonusStatus,
} from '../../database/entities/trial-bonus.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import {
  AccountTransaction,
  TransactionType,
} from '../../database/entities/account-transaction.entity';

@Injectable()
export class TrialBonusService {
  private readonly logger = new Logger(TrialBonusService.name);

  constructor(
    @InjectRepository(TrialBonus)
    private trialBonusRepository: Repository<TrialBonus>,
    @InjectRepository(AccountBalance)
    private accountBalanceRepository: Repository<AccountBalance>,
    @InjectRepository(AccountTransaction)
    private accountTransactionRepository: Repository<AccountTransaction>,
    private dataSource: DataSource,
  ) {}

  /**
   * 为新用户发放体验金（注册后调用）
   * 一人一次，发放后状态为 PENDING
   */
  async grantTrialBonus(userId: string): Promise<TrialBonus> {
    const existing = await this.trialBonusRepository.findOne({
      where: { userId },
    });
    if (existing) {
      this.logger.warn(`用户 ${userId} 已有体验金记录，跳过发放`);
      return existing;
    }

    const trialBonus = this.trialBonusRepository.create({
      userId,
      amount: 20,
      status: TrialBonusStatus.PENDING,
    });
    const saved = await this.trialBonusRepository.save(trialBonus);

    const tx = this.accountTransactionRepository.create({
      userId,
      type: TransactionType.TRIAL_BONUS_GRANT,
      amount: 20,
      balanceBefore: 0,
      balanceAfter: 0,
      description: '新用户注册奖励：体验金¥20',
    });
    await this.accountTransactionRepository.save(tx);

    this.logger.log(`用户 ${userId} 体验金已发放`);
    return saved;
  }

  /**
   * 激活体验金（充值满100元后调用）
   * 可选传入外部 queryRunner 以参与现有事务
   */
  async activateTrialBonus(
    userId: string,
    externalQueryRunner?: QueryRunner,
  ): Promise<TrialBonus | null> {
    const queryRunner = externalQueryRunner || this.dataSource.createQueryRunner();
    const shouldManageTransaction = !externalQueryRunner;

    if (shouldManageTransaction) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }

    try {
      const trialBonus = await queryRunner.manager.findOne(TrialBonus, {
        where: { userId, status: TrialBonusStatus.PENDING },
      });
      if (!trialBonus) {
        this.logger.warn(`用户 ${userId} 无待激活体验金，跳过激活`);
        if (shouldManageTransaction) {
          await queryRunner.commitTransaction();
        }
        return null;
      }

      const balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!balance) {
        this.logger.warn(`用户 ${userId} 账户不存在，跳过体验金激活`);
        if (shouldManageTransaction) {
          await queryRunner.commitTransaction();
        }
        return null;
      }

      if (Number(balance.availableBalance) < 100) {
        this.logger.warn(`用户 ${userId} 可用余额不足100元，无法激活体验金`);
        if (shouldManageTransaction) {
          await queryRunner.commitTransaction();
        }
        return null;
      }

      const activatedAt = new Date();
      const expiresAt = new Date(activatedAt);
      expiresAt.setDate(expiresAt.getDate() + 30);

      trialBonus.status = TrialBonusStatus.ACTIVATED;
      trialBonus.activatedAt = activatedAt;
      trialBonus.expiresAt = expiresAt;
      await queryRunner.manager.save(trialBonus);

      const before = Number(balance.trialBalance || 0);
      balance.trialBalance = Number((before + 20).toFixed(2));
      balance.trialExpiresAt = expiresAt;
      await queryRunner.manager.save(balance);

      const tx = queryRunner.manager.create(AccountTransaction, {
        userId,
        type: TransactionType.TRIAL_BONUS_ACTIVATE,
        amount: 20,
        balanceBefore: before,
        balanceAfter: balance.trialBalance,
        description: '体验金激活：¥20（充值满100元）',
      });
      await queryRunner.manager.save(tx);

      if (shouldManageTransaction) {
        await queryRunner.commitTransaction();
      }

      this.logger.log(`用户 ${userId} 体验金已激活，过期时间：${expiresAt.toISOString()}`);
      return trialBonus;
    } catch (error) {
      if (shouldManageTransaction) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      if (shouldManageTransaction) {
        await queryRunner.release();
      }
    }
  }

  /**
   * 认购时扣减体验金
   * 由 SubscriptionService 的事务调用，传入 queryRunner
   */
  async useTrialBonus(
    userId: string,
    amount: number,
    queryRunner: QueryRunner,
    relatedOrderId?: string,
  ): Promise<number> {
    const balance = await queryRunner.manager.findOne(AccountBalance, {
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!balance) {
      throw new NotFoundException('账户不存在');
    }

    const trialBalance = Number(balance.trialBalance || 0);
    if (trialBalance <= 0) {
      return 0;
    }

    const useAmount = Math.min(amount, trialBalance);
    const before = trialBalance;
    const after = Number((before - useAmount).toFixed(2));

    balance.trialBalance = after;
    await queryRunner.manager.save(balance);

    if (after <= 0) {
      const trialBonus = await queryRunner.manager.findOne(TrialBonus, {
        where: { userId, status: TrialBonusStatus.ACTIVATED },
      });
      if (trialBonus) {
        trialBonus.status = TrialBonusStatus.USED;
        await queryRunner.manager.save(trialBonus);
      }
    }

    const tx = queryRunner.manager.create(AccountTransaction, {
      userId,
      type: TransactionType.TRIAL_BONUS_USE,
      amount: -useAmount,
      balanceBefore: before,
      balanceAfter: after,
      relatedOrderId,
      description: `体验金认购：¥${useAmount.toFixed(2)}`,
    });
    await queryRunner.manager.save(tx);

    this.logger.log(`用户 ${userId} 体验金扣减 ¥${useAmount.toFixed(2)}，剩余 ¥${after.toFixed(2)}`);
    return useAmount;
  }

  /**
   * 产品到期退还时调用
   * 体验金部分变成真钱，退到 availableBalance
   */
  async returnTrialBonus(
    userId: string,
    trialAmount: number,
    queryRunner: QueryRunner,
    relatedOrderId?: string,
  ): Promise<void> {
    if (trialAmount <= 0) return;

    const balance = await queryRunner.manager.findOne(AccountBalance, {
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!balance) {
      throw new NotFoundException('账户不存在');
    }

    const availableBefore = Number(balance.availableBalance);
    const newAvailable = Number((availableBefore + trialAmount).toFixed(2));
    balance.availableBalance = newAvailable;
    await queryRunner.manager.save(balance);

    const tx = queryRunner.manager.create(AccountTransaction, {
      userId,
      type: TransactionType.TRIAL_BONUS_RETURN,
      amount: trialAmount,
      balanceBefore: availableBefore,
      balanceAfter: newAvailable,
      relatedOrderId,
      description: `体验金到期转真钱：¥${trialAmount.toFixed(2)}`,
    });
    await queryRunner.manager.save(tx);

    this.logger.log(`用户 ${userId} 体验金转真钱 ¥${trialAmount.toFixed(2)}`);
  }

  /**
   * 取消认购时恢复体验金
   */
  async restoreTrialBalance(
    userId: string,
    amount: number,
    queryRunner: QueryRunner,
    relatedOrderId?: string,
  ): Promise<void> {
    if (amount <= 0) return;

    const balance = await queryRunner.manager.findOne(AccountBalance, {
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!balance) return;

    const before = Number(balance.trialBalance || 0);
    balance.trialBalance = Number((before + amount).toFixed(2));
    await queryRunner.manager.save(balance);

    const trialBonus = await queryRunner.manager.findOne(TrialBonus, {
      where: { userId, status: TrialBonusStatus.USED },
    });
    if (trialBonus) {
      trialBonus.status = TrialBonusStatus.ACTIVATED;
      await queryRunner.manager.save(trialBonus);
    }

    const tx = queryRunner.manager.create(AccountTransaction, {
      userId,
      type: TransactionType.TRIAL_BONUS_USE,
      amount: amount,
      balanceBefore: before,
      balanceAfter: balance.trialBalance,
      relatedOrderId,
      description: `取消认购恢复体验金：¥${amount.toFixed(2)}`,
    });
    await queryRunner.manager.save(tx);

    this.logger.log(`用户 ${userId} 体验金恢复 ¥${amount.toFixed(2)}`);
  }

  /**
   * 查询某笔订单使用的体验金金额
   */
  async getTrialAmountUsedForOrder(
    userId: string,
    orderId: string,
    queryRunner?: QueryRunner,
  ): Promise<number> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(AccountTransaction)
      : this.accountTransactionRepository;
    const tx = await repo.findOne({
      where: {
        userId,
        type: TransactionType.TRIAL_BONUS_USE,
        relatedOrderId: orderId,
      },
      order: { createdAt: 'DESC' },
    });
    return tx ? Math.abs(Number(tx.amount)) : 0;
  }

  /**
   * 获取用户体验金状态
   */
  async getTrialBonusStatus(userId: string): Promise<{
    hasTrialBonus: boolean;
    status: TrialBonusStatus | null;
    amount: number;
    trialBalance: number;
    activatedAt: Date | null;
    expiresAt: Date | null;
  }> {
    const trialBonus = await this.trialBonusRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const balance = await this.accountBalanceRepository.findOne({
      where: { userId },
    });

    if (!trialBonus) {
      return {
        hasTrialBonus: false,
        status: null,
        amount: 0,
        trialBalance: 0,
        activatedAt: null,
        expiresAt: null,
      };
    }

    return {
      hasTrialBonus: true,
      status: trialBonus.status,
      amount: Number(trialBonus.amount),
      trialBalance: Number(balance?.trialBalance || 0),
      activatedAt: trialBonus.activatedAt,
      expiresAt: trialBonus.expiresAt,
    };
  }

  /**
   * 定时任务：每日凌晨2:00处理过期体验金
   */
  @Cron('0 0 2 * * *')
  async expireTrialBonuses(): Promise<void> {
    this.logger.log('开始处理体验金过期...');
    const now = new Date();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const expiredBonuses = await queryRunner.manager.find(TrialBonus, {
        where: {
          status: TrialBonusStatus.ACTIVATED,
          expiresAt: LessThan(now),
        },
      });

      this.logger.log(`发现 ${expiredBonuses.length} 条过期体验金记录`);

      for (const bonus of expiredBonuses) {
        await queryRunner.startTransaction();
        try {
          bonus.status = TrialBonusStatus.EXPIRED;
          await queryRunner.manager.save(bonus);

          const balance = await queryRunner.manager.findOne(AccountBalance, {
            where: { userId: bonus.userId },
            lock: { mode: 'pessimistic_write' },
          });

          if (balance) {
            const trialBefore = Number(balance.trialBalance || 0);
            if (trialBefore > 0) {
              balance.trialBalance = 0;
              balance.trialExpiresAt = null;
              await queryRunner.manager.save(balance);

              const tx = queryRunner.manager.create(AccountTransaction, {
                userId: bonus.userId,
                type: TransactionType.TRIAL_BONUS_EXPIRE,
                amount: -trialBefore,
                balanceBefore: trialBefore,
                balanceAfter: 0,
                description: `体验金过期回收：¥${trialBefore.toFixed(2)}`,
              });
              await queryRunner.manager.save(tx);
            }
          }

          await queryRunner.commitTransaction();
          this.logger.log(`用户 ${bonus.userId} 体验金已过期处理`);
        } catch (error) {
          await queryRunner.rollbackTransaction();
          this.logger.error(`处理用户 ${bonus.userId} 体验金过期失败`, error);
        }
      }
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 管理员查询所有体验金列表
   */
  async getAllTrialBonuses(
    page = 1,
    limit = 20,
  ): Promise<{ list: any[]; pagination: any }> {
    const [list, total] = await this.trialBonusRepository.findAndCount({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      list: list.map((bonus: any) => ({
        id: bonus.id,
        userId: bonus.userId,
        username: bonus.user?.username,
        realName: bonus.user?.realName,
        amount: Number(bonus.amount),
        status: bonus.status,
        activatedAt: bonus.activatedAt,
        expiresAt: bonus.expiresAt,
        createdAt: bonus.createdAt,
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
