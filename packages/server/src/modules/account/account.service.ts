import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AccountTransaction, TransactionType } from '../../database/entities/account-transaction.entity';

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(AccountBalance)
    private accountBalanceRepository: Repository<AccountBalance>,
    @InjectRepository(AccountTransaction)
    private accountTransactionRepository: Repository<AccountTransaction>,
    private dataSource: DataSource,
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

    // 获取总投资金额
    const fundingStats = await this.accountTransactionRepository
      .createQueryBuilder('t')
      .select('SUM(t.amount)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('t.type = :type', { type: TransactionType.FUNDING })
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

    const interestStats = await this.accountTransactionRepository
      .createQueryBuilder('t')
      .select('SUM(t.amount)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('t.type = :type', { type: TransactionType.INTEREST })
      .getRawOne();

    const totalProfitShare = Number(profitShareStats?.total || 0);
    const totalLossShare = Number(lossShareStats?.total || 0);
    const totalInterest = Number(interestStats?.total || 0);

    // 实时计算的净收益 = 分润 - 亏损 + 利息
    const calculatedNetProfit = Number(
      (totalProfitShare - totalLossShare + totalInterest).toFixed(2),
    );

    return {
      availableBalance: balance.availableBalance,
      frozenBalance: balance.frozenBalance,
      totalProfit: calculatedNetProfit,
      totalInvested: balance.totalInvested,
      totalRecharge: Number(rechargeStats?.total || 0),
      totalFunding: Number(fundingStats?.total || 0),
    };
  }

  /**
   * 提现
   * @param userId 用户ID
   * @param amount 提现金额
   * @param description 描述
   */
  async withdraw(userId: string, amount: number, description?: string) {
    // 1. 校验金额 > 0
    if (amount <= 0) {
      throw new BadRequestException('提现金额必须大于0');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. 查询当前余额并加锁
      let balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        // 如果余额记录不存在，创建一个
        balance = queryRunner.manager.create(AccountBalance, {
          userId,
          availableBalance: 0,
          frozenBalance: 0,
          totalProfit: 0,
          totalInvested: 0,
        });
        await queryRunner.manager.save(balance);
      }

      // 3. 校验金额 <= availableBalance
      const availableBalance = Number(balance.availableBalance);
      if (amount > availableBalance) {
        throw new BadRequestException(`可用余额不足，当前可用余额: ${availableBalance}`);
      }

      // 4. 扣减余额
      const balanceBefore = availableBalance;
      const balanceAfter = Number((balanceBefore - amount).toFixed(2));
      balance.availableBalance = balanceAfter;
      await queryRunner.manager.save(balance);

      // 5. 创建交易流水(type=WITHDRAW, amount为负数表示支出)
      const transaction = queryRunner.manager.create(AccountTransaction, {
        userId,
        type: TransactionType.WITHDRAW,
        amount: -amount, // 提现金额为负数
        balanceBefore,
        balanceAfter,
        description: description || '账户提现',
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return {
        balance: {
          availableBalance: balanceAfter,
          frozenBalance: balance.frozenBalance,
          totalProfit: balance.totalProfit,
          totalInvested: balance.totalInvested,
        },
        transaction: {
          id: transaction.id,
          type: transaction.type,
          amount: -amount, // 返回负数表示支出
          balanceBefore,
          balanceAfter,
          description: transaction.description,
          createdAt: transaction.createdAt,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
