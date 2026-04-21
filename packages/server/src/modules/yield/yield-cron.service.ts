import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Redis from 'ioredis';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AccountTransaction, TransactionType } from '../../database/entities/account-transaction.entity';
import { REDIS_CLIENT } from '../../database/database.module';

// 年化收益率 5%
const ANNUAL_YIELD_RATE = 0.05;
const DAYS_PER_YEAR = 365;

/**
 * 收益定时任务服务
 * 每日 00:00 自动计算并发放用户总资产收益
 */
@Injectable()
export class YieldCronService {
  private readonly logger = new Logger(YieldCronService.name);

  // 分布式锁配置
  private readonly LOCK_TIMEOUT = 600; // 10分钟（秒）

  constructor(
    @InjectRepository(AccountBalance)
    private readonly accountBalanceRepo: Repository<AccountBalance>,
    @InjectRepository(AccountTransaction)
    private readonly accountTransactionRepo: Repository<AccountTransaction>,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  /**
   * 获取分布式锁
   */
  private async acquireLock(lockKey: string): Promise<boolean> {
    const lockValue = Date.now().toString();
    const result = await this.redis.set(
      lockKey,
      lockValue,
      'EX',
      this.LOCK_TIMEOUT,
      'NX',
    );
    return result === 'OK';
  }

  /**
   * 释放分布式锁
   */
  private async releaseLock(lockKey: string): Promise<void> {
    await this.redis.del(lockKey);
  }

  /**
   * 每日 00:00 执行自动收益计算与发放
   * Cron格式：秒 分 时 日 月 周
   */
  @Cron('0 0 0 * * *')
  async handleDailyYieldGeneration() {
    const lockKey = 'cron:lock:daily_yield';

    // 尝试获取分布式锁
    const lockAcquired = await this.acquireLock(lockKey);
    if (!lockAcquired) {
      this.logger.warn('自动收益计算定时任务：未能获取分布式锁，跳过本次执行');
      return;
    }

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    this.logger.log(`开始执行每日自动收益计算，日期：${dateStr}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    const results = {
      processed: 0,
      skipped: 0,
      totalYieldAmount: 0,
      failed: [] as { userId: string; error: string }[],
    };

    try {
      // 查询所有总资产 > 0 的用户
      const balances = await queryRunner.manager.find(AccountBalance, {
        where: {},
      });

      const activeBalances = balances.filter(
        (b) => Number(b.availableBalance) + Number(b.frozenBalance) > 0,
      );

      this.logger.log(`发现 ${activeBalances.length} 个用户有余额，需要计算收益`);

      for (const balance of activeBalances) {
        try {
          await queryRunner.startTransaction();

          const userId = balance.userId;
          const totalAssets = Number(
            (Number(balance.availableBalance) + Number(balance.frozenBalance)).toFixed(2),
          );

          // 日收益 = 总资产 × 5% / 365，保留2位小数
          const dailyYield = Number(
            (totalAssets * ANNUAL_YIELD_RATE / DAYS_PER_YEAR).toFixed(2),
          );

          // 如果收益为0，跳过
          if (dailyYield <= 0) {
            results.skipped++;
            await queryRunner.commitTransaction();
            continue;
          }

          const previousAvailable = Number(balance.availableBalance);
          const newAvailable = Number((previousAvailable + dailyYield).toFixed(2));
          const previousTotalProfit = Number(balance.totalProfit);
          const newTotalProfit = Number((previousTotalProfit + dailyYield).toFixed(2));

          // 更新余额和总收益
          balance.availableBalance = newAvailable;
          balance.totalProfit = newTotalProfit;
          await queryRunner.manager.save(balance);

          // 创建收益流水记录
          const transaction = queryRunner.manager.create(AccountTransaction, {
            userId,
            type: TransactionType.YIELD,
            amount: dailyYield,
            balanceBefore: previousAvailable,
            balanceAfter: newAvailable,
            description: `每日收益发放 (${dateStr})，总资产 ${totalAssets}，日收益 ${dailyYield}`,
          });
          await queryRunner.manager.save(transaction);

          await queryRunner.commitTransaction();

          results.processed++;
          results.totalYieldAmount = Number((results.totalYieldAmount + dailyYield).toFixed(2));
        } catch (error) {
          await queryRunner.rollbackTransaction();
          this.logger.error(
            `用户 ${balance.userId} 收益发放失败：${error.message}`,
            error.stack,
          );
          results.failed.push({ userId: balance.userId, error: error.message });
        }
      }

      this.logger.log(
        `每日自动收益计算完成：成功 ${results.processed} 个，` +
        `跳过 ${results.skipped} 个，` +
        `失败 ${results.failed.length} 个，` +
        `总收益 ${results.totalYieldAmount} 元`,
      );

      return results;
    } catch (error) {
      this.logger.error(`每日自动收益计算执行失败：${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
      await this.releaseLock(lockKey);
    }
  }
}
