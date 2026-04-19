import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In, DataSource } from 'typeorm';
import Redis from 'ioredis';
import {
  SubscriptionOrder,
  SubscriptionOrderStatus,
} from '../../database/entities/subscription-order.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import {
  AccountTransaction,
  TransactionType,
} from '../../database/entities/account-transaction.entity';
import { EventsGateway } from '../../common/events/events.gateway';
import { REDIS_CLIENT } from '../../database/database.module';

@Injectable()
export class SubscriptionCronService {
  private readonly logger = new Logger(SubscriptionCronService.name);

  // 分布式锁配置
  private readonly LOCK_TIMEOUT = 600; // 10分钟（秒）

  constructor(
    @InjectRepository(SubscriptionOrder)
    private subscriptionOrderRepository: Repository<SubscriptionOrder>,
    private eventsGateway: EventsGateway,
    private dataSource: DataSource,
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
   * T+1自动生效定时任务
   * 每日凌晨0:05执行，将confirmedAt < 今日且status=CONFIRMED的订单更新为EFFECTIVE
   */
  @Cron('0 5 0 * * *')
  async handleOrderEffective() {
    const lockKey = 'cron:lock:t1-effective';

    // 尝试获取分布式锁
    const lockAcquired = await this.acquireLock(lockKey);
    if (!lockAcquired) {
      this.logger.warn('T+1订单生效定时任务：未能获取分布式锁，跳过本次执行');
      return;
    }

    try {
      this.logger.log('开始执行T+1订单生效定时任务...');

      const now = new Date();
      const todayMidnight = new Date(now);
      todayMidnight.setHours(0, 0, 0, 0);

      // 查询所有status=CONFIRMED且effectiveAt <= 当前的订单
      const pendingOrders = await this.subscriptionOrderRepository.find({
        where: {
          status: SubscriptionOrderStatus.CONFIRMED,
          effectiveAt: LessThanOrEqual(now),
        },
        relations: ['user', 'drug'],
      });

      this.logger.log(`找到 ${pendingOrders.length} 个待生效订单`);

      if (pendingOrders.length === 0) {
        this.logger.log('没有需要生效的订单');
        return;
      }

      // 批量更新订单状态
      const orderIds = pendingOrders.map((order) => order.id);
      const updateResult = await this.subscriptionOrderRepository
        .createQueryBuilder()
        .update(SubscriptionOrder)
        .set({ status: SubscriptionOrderStatus.EFFECTIVE })
        .whereInIds(orderIds)
        .execute();

      this.logger.log(
        `成功更新 ${updateResult.affected} 个订单为生效状态`,
      );

      // 发送WebSocket通知给每个用户
      for (const order of pendingOrders) {
        try {
          this.eventsGateway.emitSubscriptionUpdate(
            order.userId,
            'subscription:effective',
            {
              orderId: order.id,
              orderNo: order.orderNo,
              drugId: order.drugId,
              drugName: order.drug?.name,
              quantity: order.quantity,
              amount: order.amount,
              effectiveAt: order.effectiveAt,
              message: '您的认购订单已生效',
            },
          );
          this.logger.log(`已发送生效通知给用户 ${order.userId}, 订单 ${order.orderNo}`);
        } catch (error) {
          this.logger.error(
            `发送通知失败: userId=${order.userId}, orderId=${order.id}`,
            error.stack,
          );
        }
      }

      this.logger.log('T+1订单生效定时任务执行完成');
    } catch (error) {
      this.logger.error('T+1订单生效定时任务执行失败', error.stack);
      throw error;
    } finally {
      // 释放分布式锁
      await this.releaseLock(lockKey);
    }
  }

  /**
   * 滞销检测定时任务
   * 每日凌晨1:00执行，处理已到滞销截止日的订单，自动全额退回认购本金
   */
  @Cron('0 0 1 * * *')
  async handleSlowSellingRefund() {
    const lockKey = 'cron:lock:slow-selling';

    // 尝试获取分布式锁
    const lockAcquired = await this.acquireLock(lockKey);
    if (!lockAcquired) {
      this.logger.warn('滞销检测定时任务：未能获取分布式锁，跳过本次执行');
      return;
    }

    try {
      // 查询所有已到滞销截止日的订单
      const slowSellingOrders = await this.subscriptionOrderRepository.find({
        where: {
          status: In([
            SubscriptionOrderStatus.EFFECTIVE,
            SubscriptionOrderStatus.PARTIAL_RETURNED,
          ]),
          slowSellingDeadline: LessThanOrEqual(new Date()),
        },
        relations: ['user', 'drug'],
      });

      this.logger.log(`找到 ${slowSellingOrders.length} 个滞销订单`);

      if (slowSellingOrders.length === 0) {
        this.logger.log('没有需要处理的滞销订单');
        return;
      }

    let successCount = 0;
    let failCount = 0;

    for (const order of slowSellingOrders) {
      try {
        await this.dataSource.transaction(async (manager) => {
          // 悲观锁锁定订单
          const lockedOrder = await manager.findOne(SubscriptionOrder, {
            where: { id: order.id },
            lock: { mode: 'pessimistic_write' },
          });

          if (
            !lockedOrder ||
            ![
              SubscriptionOrderStatus.EFFECTIVE,
              SubscriptionOrderStatus.PARTIAL_RETURNED,
            ].includes(lockedOrder.status)
          ) {
            // 已被清算处理，跳过
            return;
          }

          // 再次检查滞销截止日（竞态条件防护）
          if (lockedOrder.slowSellingDeadline > new Date()) {
            // 滞销期未到，跳过
            return;
          }

          // 计算剩余未退本金
          const refundAmount = lockedOrder.unsettledAmount;

          if (refundAmount <= 0) {
            // 无需退款，直接标记
            lockedOrder.status = SubscriptionOrderStatus.SLOW_SELLING_REFUND;
            lockedOrder.returnedAt = new Date();
            await manager.save(lockedOrder);
            return;
          }

          // 锁定用户账户余额
          const balance = await manager.findOne(AccountBalance, {
            where: { userId: lockedOrder.userId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!balance) {
            throw new Error(`用户 ${lockedOrder.userId} 账户余额不存在`);
          }

          const balanceBefore = balance.availableBalance;

          // 退回本金到可用余额
          balance.availableBalance =
            Number(balance.availableBalance) + Number(refundAmount);
          balance.frozenBalance =
            Number(balance.frozenBalance) - Number(refundAmount);
          await manager.save(balance);

          // 更新订单状态
          lockedOrder.status = SubscriptionOrderStatus.SLOW_SELLING_REFUND;
          lockedOrder.returnedAt = new Date();
          lockedOrder.unsettledAmount = 0;
          lockedOrder.settledQuantity = lockedOrder.quantity; // 全部标记为已退回
          await manager.save(lockedOrder);

          // 记录流水
          const transaction = manager.create(AccountTransaction, {
            userId: lockedOrder.userId,
            type: TransactionType.SLOW_SELL_REFUND,
            amount: refundAmount,
            balanceBefore: balanceBefore,
            balanceAfter: balance.availableBalance,
            relatedOrderId: lockedOrder.id,
            description: `滞销退款 - 订单${lockedOrder.orderNo}，药品超过${order.drug?.slowSellingDays || 90}天未售完，全额退回认购本金`,
          });
          await manager.save(transaction);
        });

        successCount++;

        // WebSocket 通知用户（事务外执行）
        try {
          this.eventsGateway.emitSubscriptionUpdate(
            order.userId,
            'subscription:slow_selling_refund',
            {
              orderId: order.id,
              orderNo: order.orderNo,
              drugId: order.drugId,
              drugName: order.drug?.name,
              quantity: order.quantity,
              amount: order.amount,
              returnedAt: new Date(),
              message: `您的认购订单${order.orderNo}因滞销已全额退款`,
            },
          );
          this.logger.log(
            `已发送滞销退款通知给用户 ${order.userId}, 订单 ${order.orderNo}`,
          );
        } catch (notifyError) {
          this.logger.error(
            `发送滞销退款通知失败: userId=${order.userId}, orderId=${order.id}`,
            notifyError.stack,
          );
        }
      } catch (error) {
        failCount++;
        this.logger.error(
          `滞销退款失败 - 订单${order.orderNo}: ${error.message}`,
          error.stack,
        );
      }
    }

      this.logger.log(
        `滞销检测完成：成功${successCount}笔，失败${failCount}笔`,
      );
    } finally {
      // 释放分布式锁
      await this.releaseLock(lockKey);
    }
  }
}
