import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { SettlementService } from './settlement.service';
import { REDIS_CLIENT } from '../../database/database.module';

/**
 * 清算定时任务服务
 * 每日23:55自动执行日清日结
 */
@Injectable()
@WebSocketGateway({
  namespace: 'settlements',
  cors: {
    origin: '*',
  },
})
export class SettlementCronService {
  private readonly logger = new Logger(SettlementCronService.name);

  // 分布式锁配置
  private readonly LOCK_TIMEOUT = 600; // 10分钟（秒）

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly settlementService: SettlementService,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  /**
   * 获取分布式锁
   * @param lockKey 锁的key
   * @returns 是否获取成功
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
   * @param lockKey 锁的key
   */
  private async releaseLock(lockKey: string): Promise<void> {
    await this.redis.del(lockKey);
  }

  /**
   * 每日23:55执行自动清算
   * Cron格式：秒 分 时 日 月 周
   */
  @Cron('0 55 23 * * *')
  async handleDailySettlement() {
    const lockKey = 'cron:lock:settlement';

    // 尝试获取分布式锁
    const lockAcquired = await this.acquireLock(lockKey);
    if (!lockAcquired) {
      this.logger.warn('自动清算定时任务：未能获取分布式锁，跳过本次执行');
      return;
    }

    try {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      this.logger.log(`开始执行每日自动清算，日期：${dateStr}`);

      const results = {
        success: [] as string[],
        failed: [] as { drugId: string; error: string }[],
        skipped: [] as string[],
      };

      // 1. 获取所有需要清算的药品（有生效中订单的药品）
      const drugIds = await this.settlementService.getDrugsNeedingSettlement();

      this.logger.log(`发现 ${drugIds.length} 个药品需要清算`);

      // 2. 逐个药品执行清算
      for (const drugId of drugIds) {
        try {
          // 检查当日是否有销售数据
          const hasSales = await this.settlementService.hasDailySales(
            drugId,
            today,
          );

          if (!hasSales) {
            this.logger.log(`药品 ${drugId} 今日无销售数据，跳过清算`);
            results.skipped.push(drugId);
            continue;
          }

          // 执行清算
          const result = await this.settlementService.executeSettlement(
            drugId,
            dateStr,
            false, // 自动清算
          );

          this.logger.log(
            `药品 ${drugId} 清算成功：净利润 ${result.settlement.netProfit}，` +
            `退回本金 ${result.settlement.returnedPrincipal}，` +
            `参与订单 ${result.settlement.settledOrderCount}`,
          );

          results.success.push(drugId);
        } catch (error) {
          this.logger.error(
            `药品 ${drugId} 清算失败：${error.message}`,
            error.stack,
          );
          results.failed.push({ drugId, error: error.message });
        }
      }

      // 3. WebSocket广播清算结果
      this.broadcastSettlementResult(dateStr, results);

      this.logger.log(
        `每日自动清算完成：成功 ${results.success.length} 个，` +
        `失败 ${results.failed.length} 个，` +
        `跳过 ${results.skipped.length} 个`,
      );

      return results;
    } catch (error) {
      this.logger.error(`每日自动清算执行失败：${error.message}`, error.stack);
      throw error;
    } finally {
      // 释放分布式锁
      await this.releaseLock(lockKey);
    }
  }

  /**
   * WebSocket广播清算结果
   */
  private broadcastSettlementResult(
    dateStr: string,
    results: {
      success: string[];
      failed: { drugId: string; error: string }[];
      skipped: string[];
    },
  ) {
    if (this.server) {
      this.server.emit('dailySettlementCompleted', {
        date: dateStr,
        timestamp: new Date().toISOString(),
        summary: {
          total: results.success.length + results.failed.length + results.skipped.length,
          success: results.success.length,
          failed: results.failed.length,
          skipped: results.skipped.length,
        },
        details: results,
      });

      this.logger.log('清算结果已通过WebSocket广播');
    }
  }

  /**
   * 手动触发清算（供管理员使用）
   */
  async triggerManualSettlement(drugId: string, dateStr: string) {
    this.logger.log(`手动触发清算：药品 ${drugId}，日期 ${dateStr}`);
    return this.settlementService.executeSettlement(drugId, dateStr, true);
  }
}
