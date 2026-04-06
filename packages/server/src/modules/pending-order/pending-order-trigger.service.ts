import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  PendingOrder,
  PendingOrderType,
  PendingOrderStatus,
} from '../../database/entities/pending-order.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { Drug } from '../../database/entities/drug.entity';
import {
  AccountTransaction,
  TransactionType,
} from '../../database/entities/account-transaction.entity';
import { FundingService } from '../funding/funding.service';

@Injectable()
export class PendingOrderTriggerService {
  private readonly logger = new Logger(PendingOrderTriggerService.name);

  constructor(
    @InjectRepository(PendingOrder)
    private pendingOrderRepository: Repository<PendingOrder>,
    @InjectRepository(AccountBalance)
    private accountBalanceRepository: Repository<AccountBalance>,
    private dataSource: DataSource,
    private fundingService: FundingService,
  ) {}

  /**
   * 触发指定药品的条件委托单
   * 当管理员更新药品价格时调用
   */
  async triggerPendingOrders(
    drugId: string,
    newPurchasePrice: number,
    newSellingPrice: number,
  ): Promise<void> {
    // 1. 查找该药品所有 pending 状态的委托单，按创建时间排序（FIFO）
    const pendingOrders = await this.pendingOrderRepository.find({
      where: {
        drugId,
        status: PendingOrderStatus.PENDING,
      },
      order: {
        createdAt: 'ASC',
      },
    });

    if (pendingOrders.length === 0) {
      this.logger.log(`没有找到药品 ${drugId} 的pending委托单`);
      return;
    }

    this.logger.log(
      `开始检查药品 ${drugId} 的委托单，新进货价: ${newPurchasePrice}, 新售价: ${newSellingPrice}，共 ${pendingOrders.length} 个待处理委托单`,
    );
    console.log(`[TriggerService] 找到 ${pendingOrders.length} 个pending委托单，新进货价=${newPurchasePrice}`);

    // 2. 筛选出满足触发条件的委托单
    const triggeredOrders: PendingOrder[] = [];

    for (const order of pendingOrders) {
      // 确保类型转换正确
      const targetPrice = Number(order.targetPrice);
      
      if (order.type === PendingOrderType.LIMIT_BUY) {
        // 买入委托：当进货价 <= 目标价时触发
        // 用户设定：当价格降到 X 元时买入
        // 触发条件：newPurchasePrice <= order.targetPrice
        if (newPurchasePrice <= targetPrice) {
          this.logger.log(
            `委托单 ${order.orderNo} 满足触发条件: 进货价 ${newPurchasePrice} <= 目标价 ${targetPrice}`,
          );
          triggeredOrders.push(order);
        }
      } else if (order.type === PendingOrderType.LIMIT_SELL) {
        // 卖出委托：当售价 >= 目标价时触发
        // 用户设定：当价格涨到 Y 元时卖出
        // 触发条件：newSellingPrice >= order.targetPrice
        if (newSellingPrice >= targetPrice) {
          this.logger.log(
            `委托单 ${order.orderNo} 满足触发条件: 售价 ${newSellingPrice} >= 目标价 ${targetPrice}`,
          );
          triggeredOrders.push(order);
        }
      }
    }

    if (triggeredOrders.length === 0) {
      this.logger.log(`药品 ${drugId} 没有满足触发条件的委托单`);
      return;
    }

    this.logger.log(
      `药品 ${drugId} 有 ${triggeredOrders.length} 个委托单满足触发条件`,
    );

    // 3. 按 FIFO 顺序依次执行触发的委托单
    for (const order of triggeredOrders) {
      await this.executeTriggeredOrder(order, newPurchasePrice, newSellingPrice);
    }
  }

  /**
   * 执行单个触发的委托单
   */
  private async executeTriggeredOrder(
    order: PendingOrder,
    newPurchasePrice: number,
    newSellingPrice: number,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 使用悲观锁重新查询委托单，确保状态未被其他进程修改
      // 不使用 relations 避免外连接悲观锁问题
      const lockedOrder = await queryRunner.manager.findOne(PendingOrder, {
        where: { id: order.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedOrder || lockedOrder.status !== PendingOrderStatus.PENDING) {
        this.logger.warn(`委托单 ${order.id} 状态已变更，跳过执行`);
        await queryRunner.rollbackTransaction();
        return;
      }

      // 单独查询关联的 drug
      const drug = await queryRunner.manager.findOne(Drug, {
        where: { id: lockedOrder.drugId },
      });

      const userId = lockedOrder.userId;
      const drugId = lockedOrder.drugId;
      const quantity = lockedOrder.quantity;
      const frozenAmount = Number(lockedOrder.frozenAmount);

      // 获取实际成交价格（买入用进货价，卖出用售价）
      const executionPrice =
        lockedOrder.type === PendingOrderType.LIMIT_BUY
          ? newPurchasePrice
          : newSellingPrice;
      const actualAmount = Number((executionPrice * quantity).toFixed(2));

      this.logger.log(
        `执行委托单 ${lockedOrder.orderNo}: 用户 ${userId}, 类型 ${lockedOrder.type}, 数量 ${quantity}, 冻结金额 ${frozenAmount}, 实际金额 ${actualAmount}`,
      );

      // 1. 解冻资金（将 frozenBalance 转回 availableBalance）
      const balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        throw new Error(`用户 ${userId} 账户不存在`);
      }

      const availableBefore = Number(balance.availableBalance);
      const frozenBefore = Number(balance.frozenBalance);

      // 解冻：frozenBalance 减少，availableBalance 增加
      balance.frozenBalance = Number((frozenBefore - frozenAmount).toFixed(2));
      balance.availableBalance = Number(
        (availableBefore + frozenAmount).toFixed(2),
      );

      await queryRunner.manager.save(balance);

      this.logger.log(
        `用户 ${userId} 资金解冻: 冻结 ${frozenBefore} -> ${balance.frozenBalance}, 可用 ${availableBefore} -> ${balance.availableBalance}`,
      );

      // 2. 记录资金解冻流水
      const unfrozenTransaction = queryRunner.manager.create(AccountTransaction, {
        userId,
        type: TransactionType.FUNDING,
        amount: frozenAmount,
        balanceBefore: availableBefore,
        balanceAfter: balance.availableBalance,
        relatedOrderId: lockedOrder.id,
        description: `委托触发解冻资金 ${drug?.name || ''} ${quantity}盒，订单号：${lockedOrder.orderNo}`,
      });

      await queryRunner.manager.save(unfrozenTransaction);

      // 3. 提交事务（解冻完成）
      await queryRunner.commitTransaction();

      // 4. 调用 FundingService 创建实际垫资订单
      // 注意：createOrder 内部会再次扣减 availableBalance
      let fundingOrder;
      try {
        fundingOrder = await this.fundingService.createOrder(userId, {
          drugId,
          quantity,
        });

        this.logger.log(
          `委托单 ${lockedOrder.orderNo} 成功创建垫资订单 ${fundingOrder.id}`,
        );
      } catch (error) {
        this.logger.error(
          `委托单 ${lockedOrder.orderNo} 创建垫资订单失败: ${error.message}`,
        );
        // 垫资订单创建失败，需要回滚解冻操作
        // 但由于事务已提交，这里只能记录日志，实际业务中可能需要人工介入
        // 或者设计补偿机制
        throw error;
      }

      // 5. 更新委托单状态为 triggered
      lockedOrder.status = PendingOrderStatus.TRIGGERED;
      lockedOrder.triggeredAt = new Date();
      lockedOrder.fundingOrderId = fundingOrder.id;
      lockedOrder.frozenAmount = 0; // 已解冻

      await this.pendingOrderRepository.save(lockedOrder);

      this.logger.log(
        `委托单 ${lockedOrder.orderNo} 执行完成，状态更新为 TRIGGERED，关联垫资订单 ${fundingOrder.id}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `执行委托单 ${order.orderNo} 失败: ${error.message}`,
        error.stack,
      );
      // 单个委托单失败不影响其他委托单
    } finally {
      await queryRunner.release();
    }
  }
}
