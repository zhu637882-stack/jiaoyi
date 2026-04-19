import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, LessThanOrEqual } from 'typeorm';
import {
  SubscriptionOrder,
  SubscriptionOrderStatus,
} from '../../database/entities/subscription-order.entity';
import { Drug, DrugStatus } from '../../database/entities/drug.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import {
  AccountTransaction,
  TransactionType,
} from '../../database/entities/account-transaction.entity';
import { User } from '../../database/entities/user.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import {
  QuerySubscriptionDto,
  AdminQuerySubscriptionDto,
} from './dto/query-subscription.dto';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(SubscriptionOrder)
    private subscriptionOrderRepository: Repository<SubscriptionOrder>,
    @InjectRepository(Drug)
    private drugRepository: Repository<Drug>,
    @InjectRepository(AccountBalance)
    private accountBalanceRepository: Repository<AccountBalance>,
    @InjectRepository(AccountTransaction)
    private accountTransactionRepository: Repository<AccountTransaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  /**
   * 生成唯一订单号
   * 格式：SO + YYYYMMDDHHmmss + 4位随机数
   */
  private generateOrderNo(): string {
    const now = new Date();
    const dateStr = now
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `SO${dateStr}${randomNum}`;
  }

  /**
   * 获取次日零点时间
   */
  private getNextDayMidnight(date: Date): Date {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);
    return nextDay;
  }

  /**
   * 创建认购订单
   */
  async createSubscription(
    userId: string,
    dto: CreateSubscriptionDto,
  ): Promise<SubscriptionOrder> {
    const { drugId, quantity } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 校验药品状态（带悲观锁）
      const drug = await queryRunner.manager.findOne(Drug, {
        where: { id: drugId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!drug) {
        throw new NotFoundException('药品不存在');
      }

      if (drug.status !== DrugStatus.FUNDING) {
        throw new BadRequestException('该药品当前不可认购');
      }

      // 2. 校验剩余可认购数量
      const remainingQuantity = drug.totalQuantity - drug.subscribedQuantity;
      if (remainingQuantity < quantity) {
        throw new BadRequestException(
          `剩余可认购数量不足，当前剩余：${remainingQuantity}盒`,
        );
      }

      // 3. 计算认购金额
      const amount = Number((quantity * Number(drug.purchasePrice)).toFixed(2));

      // 4. 校验用户余额（带悲观锁）
      const balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        throw new NotFoundException('账户不存在');
      }

      if (Number(balance.availableBalance) < amount) {
        throw new BadRequestException(
          `可用余额不足，当前可用：${balance.availableBalance}元，需要：${amount}元`,
        );
      }

      // 5. 冻结资金
      const availableBefore = Number(balance.availableBalance);
      const frozenBefore = Number(balance.frozenBalance);

      balance.availableBalance = Number((availableBefore - amount).toFixed(2));
      balance.frozenBalance = Number((frozenBefore + amount).toFixed(2));

      await queryRunner.manager.save(balance);

      // 6. 获取当前最大排队序号
      const maxQueueResult = await queryRunner.manager
        .createQueryBuilder(SubscriptionOrder, 'order')
        .select('MAX(order.queuePosition)', 'maxPosition')
        .where('order.drugId = :drugId', { drugId })
        .getRawOne();

      const queuePosition = (maxQueueResult?.maxPosition || 0) + 1;

      // 7. 计算生效时间和滞销截止日
      const confirmedAt = new Date();
      const effectiveAt = this.getNextDayMidnight(confirmedAt);
      const slowSellingDeadline = new Date(effectiveAt);
      slowSellingDeadline.setDate(
        slowSellingDeadline.getDate() + drug.slowSellingDays,
      );

      // 8. 创建认购订单
      const orderNo = this.generateOrderNo();
      const order = queryRunner.manager.create(SubscriptionOrder, {
        orderNo,
        userId,
        drugId,
        quantity,
        amount,
        settledQuantity: 0,
        unsettledAmount: amount,
        originalAmount: amount,
        status: SubscriptionOrderStatus.CONFIRMED,
        queuePosition,
        confirmedAt,
        effectiveAt,
        slowSellingDeadline,
        totalProfit: 0,
        totalLoss: 0,
      });

      const savedOrder = await queryRunner.manager.save(order);

      // 9. 更新药品已认购数量
      drug.subscribedQuantity += quantity;
      await queryRunner.manager.save(drug);

      // 10. 记录资金流水
      const transaction = queryRunner.manager.create(AccountTransaction, {
        userId,
        type: TransactionType.SUBSCRIPTION,
        amount: -amount,
        balanceBefore: availableBefore,
        balanceAfter: balance.availableBalance,
        relatedOrderId: savedOrder.id,
        description: `认购 ${drug.name} ${quantity}盒，订单号：${orderNo}`,
      });

      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      // 返回完整订单信息（包含药品信息）
      return this.subscriptionOrderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['drug'],
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 认购直付：支付成功后直接创建认购订单（不走余额扣款）
   * 由 PaymentService 在支付回调成功时调用
   * @param queryRunner 已开启事务的 queryRunner，由调用方管理事务生命周期
   */
  async createSubscriptionFromPayment(
    userId: string,
    drugId: string,
    quantity: number,
    amount: number,
    queryRunner: import('typeorm').QueryRunner,
  ): Promise<SubscriptionOrder> {
    // 1. 校验药品状态（带悲观锁）
    const drug = await queryRunner.manager.findOne(Drug, {
      where: { id: drugId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!drug) {
      throw new NotFoundException('药品不存在');
    }

    if (drug.status !== DrugStatus.FUNDING) {
      throw new BadRequestException('该药品当前不可认购');
    }

    // 2. 校验剩余可认购数量
    const remainingQuantity = drug.totalQuantity - drug.subscribedQuantity;
    if (remainingQuantity < quantity) {
      throw new BadRequestException(
        `剩余可认购数量不足，当前剩余：${remainingQuantity}盒`,
      );
    }

    // 3. 获取用户余额（带悲观锁）— 认购直付不需要扣余额，但要记录流水
    const balance = await queryRunner.manager.findOne(AccountBalance, {
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!balance) {
      throw new NotFoundException('账户不存在');
    }

    const availableBefore = Number(balance.availableBalance);

    // 4. 认购直付：将支付金额记为冻结余额（代表已付待生效资金）
    balance.frozenBalance = Number(
      (Number(balance.frozenBalance) + amount).toFixed(2),
    );
    await queryRunner.manager.save(balance);

    // 5. 获取当前最大排队序号
    const maxQueueResult = await queryRunner.manager
      .createQueryBuilder(SubscriptionOrder, 'order')
      .select('MAX(order.queuePosition)', 'maxPosition')
      .where('order.drugId = :drugId', { drugId })
      .getRawOne();

    const queuePosition = (maxQueueResult?.maxPosition || 0) + 1;

    // 6. 计算生效时间和滞销截止日
    const confirmedAt = new Date();
    const effectiveAt = this.getNextDayMidnight(confirmedAt);
    const slowSellingDeadline = new Date(effectiveAt);
    slowSellingDeadline.setDate(
      slowSellingDeadline.getDate() + drug.slowSellingDays,
    );

    // 7. 创建认购订单
    const orderNo = this.generateOrderNo();
    const order = queryRunner.manager.create(SubscriptionOrder, {
      orderNo,
      userId,
      drugId,
      quantity,
      amount,
      settledQuantity: 0,
      unsettledAmount: amount,
      originalAmount: amount,
      status: SubscriptionOrderStatus.CONFIRMED,
      queuePosition,
      confirmedAt,
      effectiveAt,
      slowSellingDeadline,
      totalProfit: 0,
      totalLoss: 0,
    });

    const savedOrder = await queryRunner.manager.save(order);

    // 8. 更新药品已认购数量
    drug.subscribedQuantity += quantity;
    await queryRunner.manager.save(drug);

    // 9. 记录资金流水（认购直付，不从余额扣款，记录为冻结）
    const transaction = queryRunner.manager.create(AccountTransaction, {
      userId,
      type: TransactionType.SUBSCRIPTION,
      amount: -amount,
      balanceBefore: availableBefore,
      balanceAfter: balance.availableBalance,
      relatedOrderId: savedOrder.id,
      description: `认购直付 ${drug.name} ${quantity}盒，订单号：${orderNo}`,
    });

    await queryRunner.manager.save(transaction);

    return savedOrder;
  }

  /**
   * 取消认购（仅T+1前可取消）
   */
  async cancelSubscription(
    userId: string,
    orderId: string,
  ): Promise<SubscriptionOrder> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 查询订单（带锁）
      const order = await queryRunner.manager.findOne(SubscriptionOrder, {
        where: { id: orderId, userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('认购订单不存在');
      }

      // 2. 校验状态（仅CONFIRMED状态可取消）
      if (order.status !== SubscriptionOrderStatus.CONFIRMED) {
        throw new BadRequestException('该订单当前状态不可取消');
      }

      // 3. 校验取消时间窗口（T+1生效前才可取消）
      if (order.effectiveAt && order.effectiveAt <= new Date()) {
        throw new BadRequestException('该订单已过取消时限（T+1已生效），无法取消');
      }

      // 4. 查询关联药品
      const drug = await queryRunner.manager.findOne(Drug, {
        where: { id: order.drugId },
        lock: { mode: 'pessimistic_write' },
      });

      // 4. 解冻资金
      const balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        throw new NotFoundException('账户不存在');
      }

      const availableBefore = Number(balance.availableBalance);
      const frozenBefore = Number(balance.frozenBalance);
      const amount = Number(order.amount);

      balance.availableBalance = Number((availableBefore + amount).toFixed(2));
      balance.frozenBalance = Number((frozenBefore - amount).toFixed(2));

      await queryRunner.manager.save(balance);

      // 5. 更新订单状态
      order.status = SubscriptionOrderStatus.CANCELLED;
      const savedOrder = await queryRunner.manager.save(order);

      // 6. 更新药品已认购数量
      if (drug) {
        drug.subscribedQuantity -= order.quantity;
        await queryRunner.manager.save(drug);
      }

      // 7. 记录资金流水（退款）
      const transaction = queryRunner.manager.create(AccountTransaction, {
        userId,
        type: TransactionType.SUBSCRIPTION,
        amount: amount,
        balanceBefore: availableBefore,
        balanceAfter: balance.availableBalance,
        relatedOrderId: order.id,
        description: `取消认购退款 ${drug?.name || ''} ${order.quantity}盒，订单号：${order.orderNo}`,
      });

      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return savedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取我的认购列表
   */
  async getMySubscriptions(
    userId: string,
    query: QuerySubscriptionDto,
  ): Promise<{ list: any[]; pagination: any }> {
    const { status, page = 1, limit = 10 } = query;

    const queryBuilder = this.subscriptionOrderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.drug', 'drug')
      .where('order.userId = :userId', { userId })
      .orderBy('order.createdAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    const total = await queryBuilder.getCount();

    const orders = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      list: orders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        drugId: order.drugId,
        drugName: order.drug?.name,
        drugCode: order.drug?.code,
        quantity: order.quantity,
        amount: Number(order.amount),
        settledQuantity: order.settledQuantity,
        unsettledAmount: Number(order.unsettledAmount),
        status: order.status,
        queuePosition: order.queuePosition,
        confirmedAt: order.confirmedAt,
        effectiveAt: order.effectiveAt,
        slowSellingDeadline: order.slowSellingDeadline,
        returnedAt: order.returnedAt,
        totalProfit: Number(order.totalProfit),
        totalLoss: Number(order.totalLoss),
        createdAt: order.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取认购详情
   */
  async getSubscriptionDetail(
    userId: string,
    orderId: string,
  ): Promise<any> {
    const order = await this.subscriptionOrderRepository.findOne({
      where: { id: orderId, userId },
      relations: ['drug'],
    });

    if (!order) {
      throw new NotFoundException('认购订单不存在');
    }

    return {
      id: order.id,
      orderNo: order.orderNo,
      drug: order.drug
        ? {
            id: order.drug.id,
            name: order.drug.name,
            code: order.drug.code,
            purchasePrice: order.drug.purchasePrice,
            sellingPrice: order.drug.sellingPrice,
            operationFeeRate: order.drug.operationFeeRate,
            slowSellingDays: order.drug.slowSellingDays,
          }
        : null,
      quantity: order.quantity,
      amount: Number(order.amount),
      settledQuantity: order.settledQuantity,
      unsettledAmount: Number(order.unsettledAmount),
      status: order.status,
      queuePosition: order.queuePosition,
      confirmedAt: order.confirmedAt,
      effectiveAt: order.effectiveAt,
      slowSellingDeadline: order.slowSellingDeadline,
      returnedAt: order.returnedAt,
      totalProfit: Number(order.totalProfit),
      totalLoss: Number(order.totalLoss),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  /**
   * 获取当前认购摘要
   */
  async getActiveSubscriptionSummary(userId: string): Promise<any> {
    // 查询该用户所有订单的汇总统计（不限状态）
    const allStats = await this.subscriptionOrderRepository
      .createQueryBuilder('order')
      .select('COUNT(*)', 'totalOrderCount')
      .addSelect('COALESCE(SUM(order.quantity), 0)', 'totalQuantity')
      .addSelect('COALESCE(SUM(order.amount), 0)', 'totalAmount')
      .addSelect('COALESCE(SUM(order.settledQuantity), 0)', 'totalSettledQuantity')
      .addSelect('COALESCE(SUM(order.totalProfit), 0)', 'totalProfit')
      .addSelect('COALESCE(SUM(order.totalLoss), 0)', 'totalLoss')
      .where('order.userId = :userId', { userId })
      .getRawOne();

    // 查询活跃订单（confirmed + effective + partial_returned）的汇总
    const activeStats = await this.subscriptionOrderRepository
      .createQueryBuilder('order')
      .select('COUNT(*)', 'activeOrderCount')
      .addSelect('COALESCE(SUM(order.amount), 0)', 'activeAmount')
      .addSelect('COALESCE(SUM(order.unsettledAmount), 0)', 'totalUnsettledAmount')
      .where('order.userId = :userId', { userId })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [
          SubscriptionOrderStatus.CONFIRMED,
          SubscriptionOrderStatus.EFFECTIVE,
          SubscriptionOrderStatus.PARTIAL_RETURNED,
        ],
      })
      .getRawOne();

    // 待生效金额（仅 CONFIRMED 状态）
    const confirmedStats = await this.subscriptionOrderRepository
      .createQueryBuilder('order')
      .select('COALESCE(SUM(order.amount), 0)', 'totalConfirmedAmount')
      .where('order.userId = :userId', { userId })
      .andWhere('order.status = :status', { status: SubscriptionOrderStatus.CONFIRMED })
      .getRawOne();

    // 已生效金额（EFFECTIVE + PARTIAL_RETURNED）
    const effectiveStats = await this.subscriptionOrderRepository
      .createQueryBuilder('order')
      .select('COALESCE(SUM(order.amount), 0)', 'totalEffectiveAmount')
      .where('order.userId = :userId', { userId })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [
          SubscriptionOrderStatus.EFFECTIVE,
          SubscriptionOrderStatus.PARTIAL_RETURNED,
        ],
      })
      .getRawOne();

    return {
      // 全局统计
      totalOrderCount: Number(allStats?.totalOrderCount || 0),
      totalQuantity: Number(allStats?.totalQuantity || 0),
      totalAmount: Number(allStats?.totalAmount || 0),
      totalSettledQuantity: Number(allStats?.totalSettledQuantity || 0),
      totalProfit: Number(Number(allStats?.totalProfit || 0).toFixed(2)),
      totalLoss: Number(Number(allStats?.totalLoss || 0).toFixed(2)),
      // 活跃订单统计
      activeOrderCount: Number(activeStats?.activeOrderCount || 0),
      activeAmount: Number(activeStats?.activeAmount || 0),
      totalUnsettledAmount: Number(activeStats?.totalUnsettledAmount || 0),
      // 分类金额
      totalConfirmedAmount: Number(confirmedStats?.totalConfirmedAmount || 0),
      totalEffectiveAmount: Number(effectiveStats?.totalEffectiveAmount || 0),
    };
  }

  /**
   * 管理员获取所有认购列表
   */
  async getAdminSubscriptions(
    query: AdminQuerySubscriptionDto,
  ): Promise<{ list: any[]; pagination: any }> {
    const { status, drugId, userId, page = 1, limit = 10 } = query;

    const queryBuilder = this.subscriptionOrderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.drug', 'drug')
      .leftJoinAndMapOne(
        'order.user',
        User,
        'user',
        'user.id = order.userId',
      )
      .orderBy('order.createdAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    if (drugId) {
      queryBuilder.andWhere('order.drugId = :drugId', { drugId });
    }

    if (userId) {
      queryBuilder.andWhere('order.userId = :userId', { userId });
    }

    const total = await queryBuilder.getCount();

    const orders = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      list: orders.map((order: any) => ({
        id: order.id,
        orderNo: order.orderNo,
        userId: order.userId,
        username: order.user?.username,
        realName: order.user?.realName,
        drugId: order.drugId,
        drugName: order.drug?.name,
        drugCode: order.drug?.code,
        quantity: order.quantity,
        amount: Number(order.amount),
        settledQuantity: order.settledQuantity,
        unsettledAmount: Number(order.unsettledAmount),
        status: order.status,
        queuePosition: order.queuePosition,
        confirmedAt: order.confirmedAt,
        effectiveAt: order.effectiveAt,
        slowSellingDeadline: order.slowSellingDeadline,
        returnedAt: order.returnedAt,
        totalProfit: Number(order.totalProfit),
        totalLoss: Number(order.totalLoss),
        createdAt: order.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 管理员获取认购统计
   */
  async getAdminStats(): Promise<any> {
    // 总认购数和总金额
    const totalStats = await this.subscriptionOrderRepository
      .createQueryBuilder('order')
      .select('COUNT(order.id)', 'totalCount')
      .addSelect('SUM(order.amount)', 'totalAmount')
      .getRawOne();

    // 各状态统计
    const confirmedCount = await this.subscriptionOrderRepository.count({
      where: { status: SubscriptionOrderStatus.CONFIRMED },
    });

    const effectiveCount = await this.subscriptionOrderRepository.count({
      where: { status: SubscriptionOrderStatus.EFFECTIVE },
    });

    const partialReturnedCount = await this.subscriptionOrderRepository.count({
      where: { status: SubscriptionOrderStatus.PARTIAL_RETURNED },
    });

    const returnedCount = await this.subscriptionOrderRepository.count({
      where: { status: SubscriptionOrderStatus.RETURNED },
    });

    const cancelledCount = await this.subscriptionOrderRepository.count({
      where: { status: SubscriptionOrderStatus.CANCELLED },
    });

    const slowSellingRefundCount = await this.subscriptionOrderRepository.count({
      where: { status: SubscriptionOrderStatus.SLOW_SELLING_REFUND },
    });

    // 待生效金额统计（CONFIRMED状态的金额之和）
    const confirmedResult = await this.subscriptionOrderRepository
      .createQueryBuilder('order')
      .select('SUM(order.amount)', 'total')
      .where('order.status = :status', {
        status: SubscriptionOrderStatus.CONFIRMED,
      })
      .getRawOne();

    return {
      totalCount: Number(totalStats?.totalCount || 0),
      totalAmount: Number(Number(totalStats?.totalAmount || 0).toFixed(2)),
      statusStats: {
        confirmed: confirmedCount,
        effective: effectiveCount,
        partialReturned: partialReturnedCount,
        returned: returnedCount,
        cancelled: cancelledCount,
        slowSellingRefund: slowSellingRefundCount,
      },
      confirmedAmount: Number(confirmedResult?.total || 0),
    };
  }

  /**
   * 获取待生效的订单（用于定时任务）
   */
  async getPendingEffectiveOrders(): Promise<SubscriptionOrder[]> {
    const now = new Date();
    return this.subscriptionOrderRepository.find({
      where: {
        status: SubscriptionOrderStatus.CONFIRMED,
        effectiveAt: LessThanOrEqual(now),
      },
      relations: ['user', 'drug'],
    });
  }

  /**
   * 批量更新订单为生效状态（用于定时任务）
   */
  async batchEffectiveOrders(orderIds: string[]): Promise<number> {
    if (orderIds.length === 0) return 0;

    const result = await this.subscriptionOrderRepository
      .createQueryBuilder()
      .update(SubscriptionOrder)
      .set({ status: SubscriptionOrderStatus.EFFECTIVE })
      .whereInIds(orderIds)
      .execute();

    return result.affected || 0;
  }

  /**
   * 客户申请退回认购订单
   */
  async requestReturn(userId: string, orderId: string): Promise<SubscriptionOrder> {
    const order = await this.subscriptionOrderRepository.findOne({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new NotFoundException('认购订单不存在');
    }

    if (order.status !== SubscriptionOrderStatus.EFFECTIVE && order.status !== SubscriptionOrderStatus.PARTIAL_RETURNED) {
      throw new BadRequestException('当前订单状态不可申请退回，仅认购中或部分退回的订单可申请');
    }

    order.status = SubscriptionOrderStatus.RETURN_PENDING;
    order.returnRequestedAt = new Date();
    return this.subscriptionOrderRepository.save(order);
  }

  /**
   * 管理员核准退回
   * 退回本金从冻结余额转入可用余额，收益也转入可用余额
   */
  async approveReturn(adminUserId: string, orderId: string): Promise<SubscriptionOrder> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(SubscriptionOrder, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('认购订单不存在');
      }

      if (order.status !== SubscriptionOrderStatus.RETURN_PENDING) {
        throw new BadRequestException('该订单不在退回审核状态');
      }

      const returnPrincipal = Number(order.unsettledAmount);
      const returnProfit = Number(Number(order.totalProfit) - Number(order.totalLoss || 0));

      // 更新订单状态
      order.status = SubscriptionOrderStatus.RETURNED;
      order.returnedAt = new Date();
      order.returnApprovedBy = adminUserId;
      order.settledQuantity = order.quantity;
      order.unsettledAmount = 0;
      await queryRunner.manager.save(order);

      // 更新药品已认购数量
      const drug = await queryRunner.manager.findOne(Drug, {
        where: { id: order.drugId },
        lock: { mode: 'pessimistic_write' },
      });
      if (drug) {
        drug.subscribedQuantity = Math.max(0, Number(drug.subscribedQuantity) - order.quantity);
        await queryRunner.manager.save(drug);
      }

      // 更新用户余额：本金从冻结转可用，收益加到可用
      const balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId: order.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (balance) {
        const availableBefore = Number(balance.availableBalance);
        const frozenBefore = Number(balance.frozenBalance);

        // 本金：冻结 → 可用
        balance.availableBalance = Number((availableBefore + returnPrincipal).toFixed(2));
        balance.frozenBalance = Number((frozenBefore - returnPrincipal).toFixed(2));

        // 收益：加到可用余额
        if (returnProfit > 0) {
          balance.availableBalance = Number((Number(balance.availableBalance) + returnProfit).toFixed(2));
        }

        await queryRunner.manager.save(balance);

        // 记录资金流水 - 本金退回
        const principalTx = queryRunner.manager.create(AccountTransaction, {
          userId: order.userId,
          type: TransactionType.PRINCIPAL_RETURN,
          amount: returnPrincipal,
          balanceBefore: availableBefore,
          balanceAfter: Number(balance.availableBalance) - (returnProfit > 0 ? returnProfit : 0),
          relatedOrderId: order.id,
          description: `退回本金：${drug?.name || ''} ${order.quantity}盒，¥${returnPrincipal.toFixed(2)}`,
        });
        await queryRunner.manager.save(principalTx);

        // 记录资金流水 - 退回收益
        if (returnProfit > 0) {
          const profitTx = queryRunner.manager.create(AccountTransaction, {
            userId: order.userId,
            type: TransactionType.RETURN_PROFIT,
            amount: returnProfit,
            balanceBefore: Number(balance.availableBalance) - returnProfit,
            balanceAfter: Number(balance.availableBalance),
            relatedOrderId: order.id,
            description: `退回收益：${drug?.name || ''} ¥${returnProfit.toFixed(2)}`,
          });
          await queryRunner.manager.save(profitTx);
        }
      }

      await queryRunner.commitTransaction();
      return order;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 管理员驳回退回申请
   */
  async rejectReturn(adminUserId: string, orderId: string, reason: string): Promise<SubscriptionOrder> {
    const order = await this.subscriptionOrderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('认购订单不存在');
    }

    if (order.status !== SubscriptionOrderStatus.RETURN_PENDING) {
      throw new BadRequestException('该订单不在退回审核状态');
    }

    order.status = SubscriptionOrderStatus.EFFECTIVE;
    order.returnApprovedBy = adminUserId;
    order.returnRejectReason = reason;
    return this.subscriptionOrderRepository.save(order);
  }
}
