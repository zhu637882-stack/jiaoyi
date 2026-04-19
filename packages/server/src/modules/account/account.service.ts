import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AccountTransaction, TransactionType } from '../../database/entities/account-transaction.entity';
import { WithdrawOrder, WithdrawStatus } from '../../database/entities/withdraw-order.entity';
import { User } from '../../database/entities/user.entity';
import { AuditService } from '../../common/services/audit.service';

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(AccountBalance)
    private accountBalanceRepository: Repository<AccountBalance>,
    @InjectRepository(AccountTransaction)
    private accountTransactionRepository: Repository<AccountTransaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(WithdrawOrder)
    private withdrawOrderRepository: Repository<WithdrawOrder>,
    private dataSource: DataSource,
    private auditService: AuditService,
  ) {}

  async getBalance(userId: string) {
    const balance = await this.accountBalanceRepository.findOne({
      where: { userId },
    });

    if (!balance) {
      // 如果没有余额记录，创建一个
      const newBalance = this.accountBalanceRepository.create({
        userId,
        availableBalance: 0,
        frozenBalance: 0,
        totalProfit: 0,
        totalInvested: 0,
      });
      return this.accountBalanceRepository.save(newBalance);
    }

    return balance;
  }

  async recharge(userId: string, amount: number, description?: string) {
    const balance = await this.accountBalanceRepository.findOne({
      where: { userId },
    });

    if (!balance) {
      throw new NotFoundException('账户不存在');
    }

    const balanceBefore = Number(balance.availableBalance);
    const balanceAfter = balanceBefore + amount;

    // 更新余额
    balance.availableBalance = balanceAfter;
    await this.accountBalanceRepository.save(balance);

    // 创建交易记录
    const transaction = this.accountTransactionRepository.create({
      userId,
      type: TransactionType.RECHARGE,
      amount,
      balanceBefore,
      balanceAfter,
      description: description || '账户充值',
    });
    await this.accountTransactionRepository.save(transaction);

    // 记录审计日志 - 大额充值(>10000)
    if (amount > 10000) {
      await this.auditService.log({
        userId,
        action: 'RECHARGE',
        targetType: 'account',
        targetId: userId,
        detail: {
          amount,
          balanceBefore,
          balanceAfter,
          description: description || '账户充值',
        },
      });
    }

    return {
      balance: await this.getBalance(userId),
      transaction,
    };
  }

  async getTransactions(
    userId: string,
    options: {
      type?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { type, page = 1, pageSize = 10 } = options;

    const queryBuilder = this.accountTransactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.userId = :userId', { userId })
      .orderBy('transaction.createdAt', 'DESC');

    if (type) {
      queryBuilder.andWhere('transaction.type = :type', { type });
    }

    const total = await queryBuilder.getCount();

    const transactions = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return {
      list: transactions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getTransactionStats(userId: string) {
    const balance = await this.getBalance(userId);

    // 获取总充值金额
    const rechargeStats = await this.accountTransactionRepository
      .createQueryBuilder('t')
      .select('SUM(t.amount)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('t.type = :type', { type: TransactionType.RECHARGE })
      .getRawOne();

    // 获取总认购金额
    const subscriptionStats = await this.accountTransactionRepository
      .createQueryBuilder('t')
      .select('SUM(t.amount)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('t.type = :type', { type: TransactionType.SUBSCRIPTION })
      .getRawOne();

    // 从交易记录实时计算总收益（确保与settlements/my/stats一致）
    const profitShareStats = await this.accountTransactionRepository
      .createQueryBuilder('t')
      .select('SUM(t.amount)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('t.type = :type', { type: TransactionType.PROFIT_SHARE })
      .getRawOne();

    const lossShareStats = await this.accountTransactionRepository
      .createQueryBuilder('t')
      .select('SUM(ABS(t.amount))', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('t.type = :type', { type: TransactionType.LOSS_SHARE })
      .getRawOne();

    const totalProfitShare = Number(profitShareStats?.total || 0);
    const totalLossShare = Number(lossShareStats?.total || 0);

    // 净收益 = 分润 - 亏损
    const calculatedNetProfit = Number(
      (totalProfitShare - totalLossShare).toFixed(2),
    );

    return {
      availableBalance: balance.availableBalance,
      frozenBalance: balance.frozenBalance,
      totalProfit: calculatedNetProfit,
      totalInvested: balance.totalInvested,
      totalRecharge: Number(rechargeStats?.total || 0),
      totalSubscription: Number(subscriptionStats?.total || 0),
    };
  }

  /**
   * 提现申请（T+1模式）
   * 客户提交出金申请 → 冻结余额 → 创建出金订单(pending)
   * 管理员次日确认后 → 扣减冻结余额 → 完成出金
   */
  async withdraw(userId: string, amount: number, description?: string, password?: string, bankInfo?: string) {
    // 1. 校验金额 > 0
    if (amount <= 0) {
      throw new BadRequestException('提现金额必须大于0');
    }

    // 2. 金额校验（仅限不超过可用余额，前端已做校验，后端兜底）
    const balance = await this.accountBalanceRepository.findOne({
      where: { userId },
    });
    if (!balance) {
      throw new NotFoundException('账户不存在');
    }
    if (amount > Number(balance.availableBalance)) {
      throw new BadRequestException('提现金额不能超过可用余额');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 3. 查询当前余额并加锁
      let balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        balance = queryRunner.manager.create(AccountBalance, {
          userId,
          availableBalance: 0,
          frozenBalance: 0,
          totalProfit: 0,
          totalInvested: 0,
        });
        await queryRunner.manager.save(balance);
      }

      // 4. 校验金额 <= availableBalance
      const availableBalance = Number(balance.availableBalance);
      if (amount > availableBalance) {
        throw new BadRequestException(`可用余额不足，当前可用余额: ${availableBalance}`);
      }

      // 5. 冻结余额（从可用余额转入冻结余额）
      const balanceBefore = availableBalance;
      const newAvailable = Number((availableBalance - amount).toFixed(2));
      const newFrozen = Number((Number(balance.frozenBalance) + amount).toFixed(2));
      balance.availableBalance = newAvailable;
      balance.frozenBalance = newFrozen;
      await queryRunner.manager.save(balance);

      // 6. 生成出金订单号
      const orderNo = `WD${Date.now()}${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;

      // 7. 创建出金申请订单
      const withdrawOrder = queryRunner.manager.create(WithdrawOrder, {
        userId,
        orderNo,
        amount,
        balanceBefore,
        status: WithdrawStatus.PENDING,
        bankInfo: bankInfo || '',
        description: description || '账户提现申请',
      });
      await queryRunner.manager.save(withdrawOrder);

      // 8. 创建交易流水（冻结状态，金额为负数表示待出金）
      const transaction = queryRunner.manager.create(AccountTransaction, {
        userId,
        type: TransactionType.WITHDRAW,
        amount: -amount,
        balanceBefore,
        balanceAfter: newAvailable,
        description: `提现申请(出金中) - 订单号${orderNo}`,
        relatedOrderId: withdrawOrder.id,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      await this.auditService.log({
        userId,
        action: 'WITHDRAW_APPLY',
        targetType: 'withdraw_order',
        targetId: withdrawOrder.id,
        detail: {
          orderNo,
          amount,
          balanceBefore,
          balanceAfter: newAvailable,
          frozenBalance: newFrozen,
          description: description || '账户提现申请',
        },
      });

      return {
        orderNo,
        status: WithdrawStatus.PENDING,
        amount,
        availableBalance: newAvailable,
        frozenBalance: newFrozen,
        message: '提现申请已提交，预计T+1到账，请等待管理员确认',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 管理员确认出金（银行已打款后操作）
   */
  async approveWithdraw(orderId: string, adminUserId: string, bankTransactionNo?: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(WithdrawOrder, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('出金订单不存在');
      }

      if (order.status !== WithdrawStatus.PENDING) {
        throw new BadRequestException(`出金订单状态为${order.status}，无法确认`);
      }

      // 更新出金订单状态
      order.status = WithdrawStatus.APPROVED;
      order.approvedBy = adminUserId;
      order.approvedAt = new Date();
      order.bankTransactionNo = bankTransactionNo || '';
      await queryRunner.manager.save(order);

      // 扣减冻结余额
      const balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId: order.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (balance) {
        const frozenAmount = Number(order.amount);
        balance.frozenBalance = Number((Number(balance.frozenBalance) - frozenAmount).toFixed(2));
        await queryRunner.manager.save(balance);
      }

      await queryRunner.commitTransaction();

      await this.auditService.log({
        userId: adminUserId,
        action: 'WITHDRAW_APPROVE',
        targetType: 'withdraw_order',
        targetId: orderId,
        detail: {
          orderNo: order.orderNo,
          amount: Number(order.amount),
          targetUserId: order.userId,
          bankTransactionNo: bankTransactionNo || '',
        },
      });

      return { success: true, message: '出金已确认，冻结余额已扣减' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 管理员驳回出金申请
   */
  async rejectWithdraw(orderId: string, adminUserId: string, rejectReason: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(WithdrawOrder, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('出金订单不存在');
      }

      if (order.status !== WithdrawStatus.PENDING) {
        throw new BadRequestException(`出金订单状态为${order.status}，无法驳回`);
      }

      // 更新出金订单状态
      order.status = WithdrawStatus.REJECTED;
      order.approvedBy = adminUserId;
      order.approvedAt = new Date();
      order.rejectReason = rejectReason;
      await queryRunner.manager.save(order);

      // 解冻余额（将冻结余额退回可用余额）
      const balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId: order.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (balance) {
        const frozenAmount = Number(order.amount);
        balance.availableBalance = Number((Number(balance.availableBalance) + frozenAmount).toFixed(2));
        balance.frozenBalance = Number((Number(balance.frozenBalance) - frozenAmount).toFixed(2));
        await queryRunner.manager.save(balance);
      }

      // 创建退回交易流水
      const currentBalance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId: order.userId },
      });
      const transaction = queryRunner.manager.create(AccountTransaction, {
        userId: order.userId,
        type: TransactionType.WITHDRAW,
        amount: Number(order.amount), // 正数表示退回
        balanceBefore: Number(currentBalance?.availableBalance || 0) - Number(order.amount),
        balanceAfter: Number(currentBalance?.availableBalance || 0),
        description: `提现驳回退回 - 订单号${order.orderNo}，原因: ${rejectReason}`,
        relatedOrderId: order.id,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return { success: true, message: '出金申请已驳回，余额已退回' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取出金申请列表（管理员）
   */
  async getWithdrawOrders(status?: string, page = 1, limit = 10) {
    const queryBuilder = this.withdrawOrderRepository
      .createQueryBuilder('wo')
      .leftJoinAndSelect('wo.user', 'user')
      .orderBy('wo.createdAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('wo.status = :status', { status });
    }

    const total = await queryBuilder.getCount();
    const list = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      list: list.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        userId: o.userId,
        username: o.user?.username || '',
        realName: o.user?.realName || '',
        amount: Number(o.amount),
        balanceBefore: Number(o.balanceBefore),
        status: o.status,
        bankInfo: o.bankInfo,
        description: o.description,
        rejectReason: o.rejectReason,
        bankTransactionNo: o.bankTransactionNo,
        approvedBy: o.approvedBy,
        approvedAt: o.approvedAt,
        createdAt: o.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * 获取我的出金申请列表（用户）
   */
  async getMyWithdrawOrders(userId: string, page = 1, limit = 10) {
    const [list, total] = await this.withdrawOrderRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      list: list.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        amount: Number(o.amount),
        balanceBefore: Number(o.balanceBefore),
        status: o.status,
        bankInfo: o.bankInfo,
        description: o.description,
        rejectReason: o.rejectReason,
        createdAt: o.createdAt,
        approvedAt: o.approvedAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * 管理员获取资金总览统计
   */
  async getAdminOverview() {
    // 统计总充值金额
    const rechargeResult = await this.accountTransactionRepository
      .createQueryBuilder('t')
      .select('SUM(t.amount)', 'total')
      .where('t.type = :type', { type: TransactionType.RECHARGE })
      .getRawOne();

    // 统计总提现金额（取绝对值）
    const withdrawResult = await this.accountTransactionRepository
      .createQueryBuilder('t')
      .select('SUM(ABS(t.amount))', 'total')
      .where('t.type = :type', { type: TransactionType.WITHDRAW })
      .getRawOne();

    // 统计总冻结金额
    const frozenResult = await this.accountBalanceRepository
      .createQueryBuilder('b')
      .select('SUM(b.frozenBalance)', 'total')
      .getRawOne();

    // 统计总可用余额
    const availableResult = await this.accountBalanceRepository
      .createQueryBuilder('b')
      .select('SUM(b.availableBalance)', 'total')
      .getRawOne();

    // 统计有余额的用户数（availableBalance > 0 或 frozenBalance > 0）
    const activeUserCount = await this.accountBalanceRepository
      .createQueryBuilder('b')
      .where('b.availableBalance > 0 OR b.frozenBalance > 0')
      .getCount();

    return {
      totalRecharge: Number(rechargeResult?.total || 0),
      totalWithdraw: Number(withdrawResult?.total || 0),
      totalFrozen: Number(frozenResult?.total || 0),
      totalAvailable: Number(availableResult?.total || 0),
      activeUserCount,
    };
  }

  /**
   * 管理员获取所有用户余额列表
   */
  async getAdminBalances(options: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  } = {}) {
    const { page = 1, pageSize = 10, sortBy = 'updatedAt', sortOrder = 'DESC' } = options;

    // 获取所有用户余额，JOIN user 获取用户信息
    const queryBuilder = this.accountBalanceRepository
      .createQueryBuilder('balance')
      .leftJoinAndMapOne(
        'balance.user',
        User,
        'user',
        'user.id = balance.userId',
      );

    // 排序
    const orderField = ['availableBalance', 'frozenBalance', 'totalProfit', 'totalInvested', 'updatedAt'].includes(sortBy)
      ? `balance.${sortBy}`
      : 'balance.updatedAt';
    queryBuilder.orderBy(orderField, sortOrder);

    const total = await queryBuilder.getCount();

    const balances = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return {
      list: balances.map((balance: any) => ({
        userId: balance.userId,
        username: balance.user?.username,
        realName: balance.user?.realName,
        availableBalance: Number(balance.availableBalance),
        frozenBalance: Number(balance.frozenBalance),
        totalProfit: Number(balance.totalProfit),
        totalInvested: Number(balance.totalInvested),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
