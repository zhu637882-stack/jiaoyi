import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, LessThan, In, DataSource } from 'typeorm';
import { SaleRecord } from '../../database/entities/sale-record.entity';
import { Drug } from '../../database/entities/drug.entity';
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
    @InjectRepository(SaleRecord)
    private saleRecordRepository: Repository<SaleRecord>,
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
   * 每天凌晨1:00执行，将confirmedAt超过24小时且仍为CONFIRMED状态的订单自动推进为EFFECTIVE
   * 幂等：重复执行不会出错（只处理CONFIRMED状态）
   */
  @Cron('0 0 1 * * *')
  async handleT1Transition() {
    const lockKey = 'cron:lock:t1-transition';

    const lockAcquired = await this.acquireLock(lockKey);
    if (!lockAcquired) {
      this.logger.warn('[handleT1Transition] 未能获取分布式锁，跳过本次执行');
      return;
    }

    try {
      this.logger.log('[handleT1Transition] 开始T+1自动状态推进...');

      // 查找所有 CONFIRMED 状态且 confirmedAt 在24小时前的订单
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - 24);

      const pendingOrders = await this.subscriptionOrderRepository.find({
        where: {
          status: SubscriptionOrderStatus.CONFIRMED,
          confirmedAt: LessThan(cutoffTime),
        },
      });

      this.logger.log(`[handleT1Transition] 找到 ${pendingOrders.length} 个待推进订单`);

      if (pendingOrders.length === 0) {
        this.logger.log('[handleT1Transition] 没有需要推进的订单');
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const order of pendingOrders) {
        try {
          await this.dataSource.transaction(async (manager) => {
            // 悲观锁锁定订单
            const lockedOrder = await manager.findOne(SubscriptionOrder, {
              where: { id: order.id },
              lock: { mode: 'pessimistic_write' },
            });

            if (!lockedOrder || lockedOrder.status !== SubscriptionOrderStatus.CONFIRMED) {
              // 已被其他流程处理，跳过
              return;
            }

            // 再次确认确认时间已过24小时（竞态防护）
            if (lockedOrder.confirmedAt > cutoffTime) {
              return;
            }

            // 推进状态为生效
            lockedOrder.status = SubscriptionOrderStatus.EFFECTIVE;
            lockedOrder.effectiveAt = new Date();
            // 设置滞销截止日 = 生效日 + 90天
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + 90);
            lockedOrder.slowSellingDeadline = deadline;
            // 自动审核通过
            lockedOrder.auditStatus = 'approved';
            lockedOrder.auditAt = new Date();
            lockedOrder.auditRemark = 'T+1自动推进生效';

            await manager.save(lockedOrder);

            this.logger.log(
              `[handleT1Transition] T+1自动推进: 订单 ${lockedOrder.orderNo} → effective，滞销截止日=${deadline.toISOString()}`,
            );
          });

          successCount++;

          // WebSocket 通知用户（事务外执行）
          try {
            this.eventsGateway.emitSubscriptionUpdate(
              order.userId,
              'subscription:t1_effective',
              {
                orderId: order.id,
                orderNo: order.orderNo,
                drugId: order.drugId,
                message: `您的认购订单${order.orderNo}已自动生效`,
              },
            );
          } catch (notifyError) {
            this.logger.error(
              `[handleT1Transition] 发送T+1生效通知失败: orderId=${order.id}`,
              notifyError.stack,
            );
          }
        } catch (error) {
          failCount++;
          this.logger.error(
            `[handleT1Transition] 订单 ${order.orderNo} 推进失败: ${error.message}`,
            error.stack,
          );
        }
      }

      this.logger.log(
        `[handleT1Transition] T+1推进完成：成功${successCount}笔，失败${failCount}笔`,
      );
    } finally {
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

          const balanceBefore = Number(balance.availableBalance);

          // 补贴已每日实时发放，退回时不再重复计算
          const subsidyAmount = 0;
          const totalRefund = Number(refundAmount);

          // 退回本金+补贴到可用余额
          balance.availableBalance =
            Number(balance.availableBalance) + totalRefund;
          balance.frozenBalance =
            Number(balance.frozenBalance) - Number(refundAmount);
          await manager.save(balance);

          // 更新订单状态
          lockedOrder.status = SubscriptionOrderStatus.SLOW_SELLING_REFUND;
          lockedOrder.returnedAt = new Date();
          lockedOrder.unsettledAmount = 0;
          lockedOrder.settledQuantity = lockedOrder.quantity; // 全部标记为已退回
          await manager.save(lockedOrder);

          // 回退药品已认购库存
          const drug = await manager.findOne(Drug, { where: { id: lockedOrder.drugId } });
          if (drug) {
            const unsoldQty = lockedOrder.quantity - lockedOrder.soldQuantity;
            if (unsoldQty > 0) {
              drug.subscribedQuantity = Math.max(0, drug.subscribedQuantity - unsoldQty);
              await manager.save(drug);
            }
          }

          // 记录流水 - 本金退回
          const principalTx = manager.create(AccountTransaction, {
            userId: lockedOrder.userId,
            type: TransactionType.SLOW_SELL_REFUND,
            amount: refundAmount,
            balanceBefore: balanceBefore,
            balanceAfter: balanceBefore + Number(refundAmount),
            relatedOrderId: lockedOrder.id,
            description: `滞销退款 - 订单${lockedOrder.orderNo}，超过滞销期未售完，全额退回认购本金`,
          });
          await manager.save(principalTx);

          // 记录流水 - 滞销补贴
          if (subsidyAmount > 0) {
            const subsidyTx = manager.create(AccountTransaction, {
              userId: lockedOrder.userId,
              type: TransactionType.SLOW_SELL_SUBSIDY,
              amount: subsidyAmount,
              balanceBefore: balanceBefore + Number(refundAmount),
              balanceAfter: balanceBefore + totalRefund,
              relatedOrderId: lockedOrder.id,
              description: `滞销补贴 - 订单${lockedOrder.orderNo}，年化5%`,
            });
            await manager.save(subsidyTx);
          }
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

  /**
   * 每日凌晨2点处理到期结算
   * 检查 sale_records 中 settlementDueAt <= 今天 且 settled = false 的记录
   * 按订单的 queuePosition 排序（先进先出）结算
   */
  @Cron('0 0 2 * * *')
  async handleSettlement() {
    const lockKey = 'cron:lock:settlement';

    const lockAcquired = await this.acquireLock(lockKey);
    if (!lockAcquired) {
      this.logger.warn('[handleSettlement] 未能获取分布式锁，跳过本次执行');
      return;
    }

    try {
      this.logger.log('[handleSettlement] 开始处理到期结算...');

      const now = new Date();

      // 查找到期未结算的售出记录，关联订单信息
      const dueRecords = await this.saleRecordRepository
        .createQueryBuilder('sr')
        .leftJoinAndSelect('sr.order', 'order')
        .where('sr.settled = :settled', { settled: false })
        .andWhere('sr.settlementDueAt <= :now', { now })
        .orderBy('order.queuePosition', 'ASC')
        .getMany();

      this.logger.log(`[handleSettlement] 找到 ${dueRecords.length} 条到期记录`);

      let successCount = 0;
      let failCount = 0;

      for (const record of dueRecords) {
        try {
          await this.processSettlementRecord(record);
          successCount++;
        } catch (error) {
          failCount++;
          this.logger.error(`[handleSettlement] 结算记录 ${record.id} 失败: ${error.message}`);
        }
      }

      this.logger.log(`[handleSettlement] 结算完成：成功${successCount}笔，失败${failCount}笔`);
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * 处理单条结算记录
   */
  private async processSettlementRecord(record: SaleRecord) {
    await this.dataSource.transaction(async (manager) => {
      // 锁定售出记录（防并发）
      const lockedRecord = await manager.findOne(SaleRecord, {
        where: { id: record.id, settled: false },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedRecord) {
        return;
      }

      // 加载订单
      const order = await manager.findOne(SubscriptionOrder, {
        where: { id: lockedRecord.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        return;
      }

      // 加载药品
      const drug = await manager.findOne(Drug, {
        where: { id: order.drugId },
      });
      if (!drug) {
        throw new Error(`药品 ${order.drugId} 不存在`);
      }

      // === 计算各项金额 ===

      // 1. 本金 = 售出数量 × 采购价
      const principal = Number((lockedRecord.quantity * Number(drug.purchasePrice)).toFixed(2));

      // 2. 利润 = 售出金额 × 1.8%（售出金额 = 售出数量 × 售价）
      const saleAmount = Number((lockedRecord.quantity * Number(drug.sellingPrice)).toFixed(2));
      const profitAmount = Number((saleAmount * 0.018).toFixed(2));

      // 3. 滞销补贴已每日实时发放，结算时不再重复计算
      const subsidyAmount = 0;

      // 总结算金额
      const totalSettlement = Number((principal + profitAmount + subsidyAmount).toFixed(2));

      // === 更新用户余额 ===
      const balance = await manager.findOne(AccountBalance, {
        where: { userId: order.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        throw new Error(`用户 ${order.userId} 账户余额不存在`);
      }

      const balanceBefore = Number(balance.availableBalance);

      // 冻结余额减少本金（进货时冻结的）
      balance.frozenBalance = Number((Number(balance.frozenBalance) - principal).toFixed(2));
      // 可用余额增加：本金 + 利润 + 补贴
      balance.availableBalance = Number((Number(balance.availableBalance) + totalSettlement).toFixed(2));
      await manager.save(balance);

      // === 生成流水记录 ===

      // 本金退回流水
      const principalTx = manager.create(AccountTransaction, {
        userId: order.userId,
        type: TransactionType.PRINCIPAL_RETURN,
        amount: principal,
        balanceBefore: balanceBefore,
        balanceAfter: balanceBefore + principal,
        description: `结算本金退回(${lockedRecord.quantity}份) - 订单${order.orderNo}`,
        relatedOrderId: order.id,
      });
      await manager.save(principalTx);

      // 利润流水
      if (profitAmount > 0) {
        const profitTx = manager.create(AccountTransaction, {
          userId: order.userId,
          type: TransactionType.PROFIT_SHARE,
          amount: profitAmount,
          balanceBefore: balanceBefore + principal,
          balanceAfter: balanceBefore + principal + profitAmount,
          description: `销售利润分成(${lockedRecord.quantity}份×1.8%) - 订单${order.orderNo}`,
          relatedOrderId: order.id,
        });
        await manager.save(profitTx);
      }

      // 滞销补贴流水
      if (subsidyAmount > 0) {
        const subsidyTx = manager.create(AccountTransaction, {
          userId: order.userId,
          type: TransactionType.SLOW_SELL_SUBSIDY,
          amount: subsidyAmount,
          balanceBefore: balanceBefore + principal + profitAmount,
          balanceAfter: balanceBefore + totalSettlement,
          description: `滞销补贴(年化5%) - 订单${order.orderNo}`,
          relatedOrderId: order.id,
        });
        await manager.save(subsidyTx);
      }

      // === 更新售出记录 ===
      lockedRecord.settled = true;
      lockedRecord.settledAt = new Date();
      lockedRecord.saleAmount = saleAmount;
      lockedRecord.profitAmount = profitAmount;
      lockedRecord.subsidyAmount = subsidyAmount;
      await manager.save(lockedRecord);

      // === 检查订单是否全部结算完毕 ===
      const unsettledCount = await manager.count(SaleRecord, {
        where: { orderId: order.id, settled: false },
      });

      if (unsettledCount === 0 && order.soldQuantity >= order.quantity) {
        order.status = SubscriptionOrderStatus.SETTLED;
        await manager.save(order);
      }

      this.logger.log(
        `[handleSettlement] 记录 ${record.id} 结算成功: 本金${principal}+利润${profitAmount}+补贴${subsidyAmount}=${totalSettlement}`,
      );
    });
  }

  /**
   * 每日凌晨4点发放滞销补贴（年化5%按日）
   * 对所有 EFFECTIVE 或 PARTIAL_SOLD 状态且已过入库次日的订单
   * 按未售出金额计算当日补贴并实时发放到可用余额
   */
  @Cron('0 0 4 * * *')
  async handleDailySubsidy() {
    const lockKey = 'cron:lock:daily-subsidy';

    const lockAcquired = await this.acquireLock(lockKey);
    if (!lockAcquired) {
      this.logger.warn('[handleDailySubsidy] 未能获取分布式锁，跳过本次执行');
      return;
    }

    try {
      this.logger.log('[handleDailySubsidy] 开始发放每日滞销补贴...');

      const now = new Date();
      // 入库当日即开始计息：effectiveAt < tomorrow（即 effectiveAt 在今天及之前的都算）
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      // 查找所有已入库的订单（EFFECTIVE 或 PARTIAL_SOLD），入库当日即发放补贴
      const eligibleOrders = await this.subscriptionOrderRepository.find({
        where: [
          {
            status: SubscriptionOrderStatus.EFFECTIVE,
            effectiveAt: LessThan(tomorrow),
          },
          {
            status: SubscriptionOrderStatus.PARTIAL_SOLD,
            effectiveAt: LessThan(tomorrow),
          },
        ],
      });

      this.logger.log(`[handleDailySubsidy] 找到 ${eligibleOrders.length} 个有效订单`);

      let successCount = 0;
      let failCount = 0;

      for (const order of eligibleOrders) {
        try {
          await this.processDailySubsidy(order);
          successCount++;
        } catch (error) {
          failCount++;
          this.logger.error(`[handleDailySubsidy] 订单 ${order.id} 补贴发放失败: ${error.message}`);
        }
      }

      this.logger.log(`[handleDailySubsidy] 补贴发放完成：成功${successCount}笔，失败${failCount}笔`);
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * 处理单个订单的每日滞销补贴
   */
  private async processDailySubsidy(order: SubscriptionOrder) {
    await this.dataSource.transaction(async (manager) => {
      // 锁定订单
      const lockedOrder = await manager.findOne(SubscriptionOrder, {
        where: { id: order.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (
        !lockedOrder ||
        ![SubscriptionOrderStatus.EFFECTIVE, SubscriptionOrderStatus.PARTIAL_SOLD].includes(lockedOrder.status)
      ) {
        return;
      }

      // 计算未售出数量
      const unsoldQuantity = lockedOrder.quantity - lockedOrder.soldQuantity;
      if (unsoldQuantity <= 0) {
        return;
      }

      // 加载药品获取采购价
      const drug = await manager.findOne(Drug, {
        where: { id: lockedOrder.drugId },
      });
      if (!drug) {
        return;
      }

      // 计算每日补贴 = 未售出金额 × 5% / 365
      const unsoldAmount = Number((unsoldQuantity * Number(drug.purchasePrice)).toFixed(2));
      const dailySubsidy = Number((unsoldAmount * 0.05 / 365).toFixed(2));

      if (dailySubsidy <= 0) {
        return;
      }

      // 更新用户余额
      const balance = await manager.findOne(AccountBalance, {
        where: { userId: lockedOrder.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        throw new Error(`用户 ${lockedOrder.userId} 账户余额不存在`);
      }

      const balanceBefore = Number(balance.availableBalance);
      balance.availableBalance = Number((balanceBefore + dailySubsidy).toFixed(2));
      await manager.save(balance);

      // 生成流水记录
      const subsidyTx = manager.create(AccountTransaction, {
        userId: lockedOrder.userId,
        type: TransactionType.SLOW_SELL_SUBSIDY,
        amount: dailySubsidy,
        balanceBefore: balanceBefore,
        balanceAfter: Number(balance.availableBalance),
        description: `每日滞销补贴(${unsoldQuantity}份×¥${drug.purchasePrice}×5%/365)`,
        relatedOrderId: lockedOrder.id,
      });
      await manager.save(subsidyTx);

      this.logger.log(
        `[handleDailySubsidy] 订单 ${lockedOrder.orderNo} 补贴发放: ${dailySubsidy}元 (${unsoldQuantity}份未售)`,
      );
    });
  }

  /**
   * 锁定期到期提醒定时任务
   * 每日上午8:00执行，检测 lockExpiresAt <= now 的订单，WebSocket通知管理员
   */
  @Cron('0 0 8 * * *')
  async handleLockExpiryReminder() {
    const lockKey = 'cron:lock:lock-expiry-reminder';

    const lockAcquired = await this.acquireLock(lockKey);
    if (!lockAcquired) {
      this.logger.warn('[handleLockExpiryReminder] 未能获取分布式锁，跳过本次执行');
      return;
    }

    try {
      const now = new Date();

      // 查找锁定期已到期且未结算的订单
      const expiringOrders = await this.subscriptionOrderRepository.find({
        where: {
          status: SubscriptionOrderStatus.EFFECTIVE,
        },
        relations: ['user', 'drug'],
      });

      // 过滤出 lockExpiresAt <= now 的订单
      const expiredList = expiringOrders.filter(
        (o) => o.lockExpiresAt && new Date(o.lockExpiresAt) <= now,
      );

      this.logger.log(`[handleLockExpiryReminder] 发现 ${expiredList.length} 个已到期订单`);

      if (expiredList.length === 0) {
        return;
      }

      // 通过 WebSocket 推送提醒给所有在线的管理员
      for (const order of expiredList) {
        try {
          this.eventsGateway.emitSubscriptionUpdate(
            order.userId,
            'subscription:lock_expired',
            {
              orderId: order.id,
              orderNo: order.orderNo,
              drugName: order.drug?.name,
              userId: order.userId,
              username: order.user?.username,
              amount: Number(order.amount),
              lockExpiresAt: order.lockExpiresAt,
              message: `客户${order.user?.username || order.userId}的订单${order.orderNo}锁定期已到期，请及时处理分红结算`,
            },
          );
        } catch (notifyError) {
          this.logger.error(
            `[handleLockExpiryReminder] 发送到期提醒失败: orderId=${order.id}`,
            notifyError.stack,
          );
        }
      }

      this.logger.log(
        `[handleLockExpiryReminder] 到期提醒完成：共${expiredList.length}笔`,
      );
    } finally {
      await this.releaseLock(lockKey);
    }
  }
}
