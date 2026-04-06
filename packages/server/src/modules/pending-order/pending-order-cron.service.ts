import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, IsNull, Not } from 'typeorm';
import { PendingOrder, PendingOrderStatus } from '../../database/entities/pending-order.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AccountTransaction, TransactionType } from '../../database/entities/account-transaction.entity';

@Injectable()
export class PendingOrderCronService {
  private readonly logger = new Logger(PendingOrderCronService.name);

  constructor(
    @InjectRepository(PendingOrder)
    private pendingOrderRepository: Repository<PendingOrder>,
    private dataSource: DataSource,
  ) {}

  /**
   * 每小时执行一次，清理过期委托单
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredOrders() {
    this.logger.log('开始扫描过期委托单...');

    try {
      // 查找所有 pending 状态且已过期的委托单（expireAt 不为 null 且小于当前时间）
      const expiredOrders = await this.pendingOrderRepository.find({
        where: {
          status: PendingOrderStatus.PENDING,
          expireAt: Not(IsNull()) as any,
        },
      });

      // 过滤出真正过期的订单
      const now = new Date();
      const trulyExpiredOrders = expiredOrders.filter(order => order.expireAt && order.expireAt < now);

      if (trulyExpiredOrders.length === 0) {
        this.logger.log('没有过期委托单');
        return;
      }

      this.logger.log(`发现 ${trulyExpiredOrders.length} 个过期委托单，开始处理...`);

      let successCount = 0;
      let failCount = 0;

      for (const order of trulyExpiredOrders) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          // 1. 锁定委托单
          const lockedOrder = await queryRunner.manager.findOne(PendingOrder, {
            where: { id: order.id, status: PendingOrderStatus.PENDING },
            lock: { mode: 'pessimistic_write' },
          });

          if (!lockedOrder) {
            // 可能已被其他进程处理
            await queryRunner.rollbackTransaction();
            continue;
          }

          // 2. 解冻资金
          const balance = await queryRunner.manager.findOne(AccountBalance, {
            where: { userId: lockedOrder.userId },
            lock: { mode: 'pessimistic_write' },
          });

          if (balance) {
            const frozenAmount = Number(lockedOrder.frozenAmount);
            const availableBefore = Number(balance.availableBalance);

            balance.frozenBalance = Number((Number(balance.frozenBalance) - frozenAmount).toFixed(2));
            balance.availableBalance = Number((availableBefore + frozenAmount).toFixed(2));
            await queryRunner.manager.save(balance);

            // 3. 记录资金流水
            const transaction = queryRunner.manager.create(AccountTransaction, {
              userId: lockedOrder.userId,
              type: TransactionType.FUNDING,
              amount: frozenAmount,
              balanceBefore: availableBefore,
              balanceAfter: balance.availableBalance,
              description: `委托单过期自动撤销，解冻资金 ¥${frozenAmount}，订单号：${lockedOrder.orderNo}`,
            });
            await queryRunner.manager.save(transaction);
          }

          // 4. 更新委托单状态
          lockedOrder.status = PendingOrderStatus.EXPIRED;
          await queryRunner.manager.save(lockedOrder);

          await queryRunner.commitTransaction();
          successCount++;
          this.logger.log(`委托单 ${lockedOrder.orderNo} 已过期撤销`);
        } catch (error) {
          await queryRunner.rollbackTransaction();
          failCount++;
          this.logger.error(`处理委托单 ${order.orderNo} 失败:`, error.message);
        } finally {
          await queryRunner.release();
        }
      }

      this.logger.log(`过期委托处理完成: 成功 ${successCount}, 失败 ${failCount}`);
    } catch (error) {
      this.logger.error('扫描过期委托单失败:', error.message);
    }
  }
}
