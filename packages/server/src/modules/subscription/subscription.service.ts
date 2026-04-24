import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
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
import { DailyYield } from '../../database/entities/daily-yield.entity';
import { User, UserStatus } from '../../database/entities/user.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import {
  QuerySubscriptionDto,
  AdminQuerySubscriptionDto,
} from './dto/query-subscription.dto';
import { InvitationService } from '../invitation/invitation.service';
import { TrialBonusService } from '../trial-bonus/trial-bonus.service';

@Injectable()
export class SubscriptionService {
  private logger = new Logger(SubscriptionService.name);

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
    @InjectRepository(DailyYield)
    private dailyYieldRepository: Repository<DailyYield>,
    private dataSource: DataSource,
    private invitationService: InvitationService,
    private trialBonusService: TrialBonusService,
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

    this.logger.log(`[createSubscription] 创建认购: userId=${userId}, drugId=${drugId}, quantity=${quantity}`);

    // 0. 校验用户审核状态
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.status !== UserStatus.APPROVED) {
      throw new BadRequestException('您的账户尚未通过审核，暂时无法认购');
    }

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

      // 4. 校验总额（真实余额 + 体验金）
      const availableReal = Number(balance.availableBalance);
      // 实时检查体验金是否已过期
      const now = new Date();
      const isTrialExpired = balance.trialExpiresAt && balance.trialExpiresAt <= now;
      const effectiveTrialBalance = isTrialExpired ? 0 : Number(balance.trialBalance || 0);
      const totalAvailable = Number((availableReal + effectiveTrialBalance).toFixed(2));

      if (totalAvailable < amount) {
        throw new BadRequestException(
          `可用余额不足，当前可用：${totalAvailable}元（真实余额${availableReal}元 + 体验金${effectiveTrialBalance}元），需要：${amount}元`,
        );
      }

      // 5. 冻结资金（优先使用真实余额，不足部分用体验金）
      const realUsed = Math.min(amount, availableReal);
      const trialUsed = Number((amount - realUsed).toFixed(2));
      const frozenBefore = Number(balance.frozenBalance);

      balance.availableBalance = Number((availableReal - realUsed).toFixed(2));
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

      // 9. 如果使用体验金，扣减体验金
      if (trialUsed > 0) {
        await this.trialBonusService.useTrialBonus(
          userId,
          trialUsed,
          queryRunner,
          savedOrder.id,
        );
      }

      // 10. 记录资金流水
      const transaction = queryRunner.manager.create(AccountTransaction, {
        userId,
        type: TransactionType.SUBSCRIPTION,
        amount: -amount,
        balanceBefore: availableReal,
        balanceAfter: balance.availableBalance,
        relatedOrderId: savedOrder.id,
        description: `认购 ${drug.name} ${quantity}盒，订单号：${orderNo}`,
      });

      await queryRunner.manager.save(transaction);

      // 11. 首次认购判断（在事务内，防止并发重复发放奖励）
      try {
        const userOrderCount = await queryRunner.manager.count(SubscriptionOrder, {
          where: { userId },
        });
        if (userOrderCount === 1) {
          await this.invitationService.processFirstSubscriptionReward(userId, queryRunner);
        }
      } catch (e) {
        this.logger.warn(`发放邀请奖励失败（不影响认购）: ${e.message}`);
      }

      await queryRunner.commitTransaction();

      this.logger.log(`[createSubscription] 认购成功: userId=${userId}, orderId=${savedOrder.id}, orderNo=${orderNo}, drugId=${drugId}, quantity=${quantity}, amount=${amount}`);

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
    this.logger.log(`[createSubscriptionFromPayment] 认购直付: userId=${userId}, drugId=${drugId}, quantity=${quantity}, amount=${amount}`);

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

    this.logger.log(`[createSubscriptionFromPayment] 认购直付成功: userId=${userId}, orderId=${savedOrder.id}, orderNo=${orderNo}`);

    return savedOrder;
  }

  /**
   * 取消认购（仅T+1前可取消）
   */
  async cancelSubscription(
    userId: string,
    orderId: string,
  ): Promise<SubscriptionOrder> {
    this.logger.log(`[cancelSubscription] 取消认购: userId=${userId}, orderId=${orderId}`);

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

      // 查询该订单使用的体验金金额
      const trialAmount = await this.trialBonusService.getTrialAmountUsedForOrder(
        userId,
        order.id,
        queryRunner,
      );

      // 解冻资金（真实余额 + 体验金分别恢复）
      const realRefund = Number((amount - trialAmount).toFixed(2));
      balance.availableBalance = Number((availableBefore + realRefund).toFixed(2));
      balance.frozenBalance = Number((frozenBefore - amount).toFixed(2));
      await queryRunner.manager.save(balance);

      // 恢复体验金
      if (trialAmount > 0) {
        await this.trialBonusService.restoreTrialBalance(
          userId,
          trialAmount,
          queryRunner,
          order.id,
        );
      }

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
        amount: realRefund,
        balanceBefore: availableBefore,
        balanceAfter: balance.availableBalance,
        relatedOrderId: order.id,
        description: `取消认购退款 ${drug?.name || ''} ${order.quantity}盒，订单号：${order.orderNo}`,
      });

      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      this.logger.log(`[cancelSubscription] 取消认购成功: userId=${userId}, orderId=${orderId}, 退回金额=${realRefund}`);

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
    const { status, auditStatus, page = 1, limit = 10 } = query;

    const queryBuilder = this.subscriptionOrderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.drug', 'drug')
      .where('order.userId = :userId', { userId })
      .orderBy('order.createdAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    if (auditStatus) {
      queryBuilder.andWhere('order.auditStatus = :auditStatus', { auditStatus });
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
        auditStatus: order.auditStatus,
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
   * 导出当前用户的所有交易记录为 CSV
   */
  async exportMySubscriptionsCsv(userId: string): Promise<string> {
    const orders = await this.subscriptionOrderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.drug', 'drug')
      .where('order.userId = :userId', { userId })
      .orderBy('order.createdAt', 'DESC')
      .getMany();

    const statusMap: Record<string, string> = {
      confirmed: '已确认',
      effective: '已生效',
      return_pending: '退回审核中',
      partial_returned: '部分退回',
      returned: '已退回',
      cancelled: '已取消',
      slow_selling_refund: '滞销退款',
      settled: '已结算',
    };

    // UTF-8 BOM 头，防止 Excel 中文乱码
    const BOM = '\uFEFF';
    const header = '交易时间,药品名称,交易类型,数量,单价,总金额,状态';

    const rows = orders.map((order) => {
      const time = order.createdAt
        ? new Date(order.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
        : '';
      const drugName = (order.drug?.name || '').replace(/,/g, '，');
      const type = '认购';
      const quantity = order.quantity;
      const unitPrice = order.quantity > 0
        ? (Number(order.amount) / order.quantity).toFixed(2)
        : '0.00';
      const totalAmount = Number(order.amount).toFixed(2);
      const status = statusMap[order.status] || order.status;
      return `${time},${drugName},${type},${quantity},${unitPrice},${totalAmount},${status}`;
    });

    return BOM + [header, ...rows].join('\n');
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
      auditStatus: order.auditStatus,
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
    const { status, drugId, userId, auditStatus, page = 1, limit = 10 } = query;

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

    if (auditStatus) {
      queryBuilder.andWhere('order.auditStatus = :auditStatus', { auditStatus });
    }

    // 认购审核查询时（有auditStatus但没指定status），排除退回相关状态的订单
    if (auditStatus && !status) {
      queryBuilder.andWhere('order.status NOT IN (:...excludeStatuses)', {
        excludeStatuses: ['return_pending', 'returned', 'partial_returned'],
      });
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
        auditStatus: order.auditStatus,
        auditAt: order.auditAt,
        auditBy: order.auditBy,
        auditRemark: order.auditRemark,
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
    this.logger.log(`[requestReturn] 申请退回: userId=${userId}, orderId=${orderId}`);

    const order = await this.subscriptionOrderRepository.findOne({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new NotFoundException('认购订单不存在');
    }

    // 允许：EFFECTIVE、PARTIAL_RETURNED、以及审核通过的CONFIRMED订单
    const allowedStatuses = [
      SubscriptionOrderStatus.EFFECTIVE,
      SubscriptionOrderStatus.PARTIAL_RETURNED,
    ];
    const isApprovedConfirmed = order.status === SubscriptionOrderStatus.CONFIRMED && order.auditStatus === 'approved';

    if (!allowedStatuses.includes(order.status) && !isApprovedConfirmed) {
      throw new BadRequestException('当前订单状态不可申请退回，仅已生效、部分退回或已审核通过的订单可申请');
    }

    order.status = SubscriptionOrderStatus.RETURN_PENDING;
    // 清除认购审核状态，避免退回订单出现在认购审核列表中
    order.auditStatus = 'approved';
    order.returnRequestedAt = new Date();

    this.logger.log(`[requestReturn] 退回申请已提交: userId=${userId}, orderId=${orderId}, 状态变更为RETURN_PENDING`);

    return this.subscriptionOrderRepository.save(order);
  }

  /**
   * 管理员核准退回
   * 退回本金从冻结余额转入可用余额，收益也转入可用余额
   */
  async approveReturn(adminUserId: string, orderId: string): Promise<SubscriptionOrder> {
    this.logger.log(`[approveReturn] 管理员核准退回: adminUserId=${adminUserId}, orderId=${orderId}`);

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

      // 查询该订单使用的体验金金额
      const trialAmount = await this.trialBonusService.getTrialAmountUsedForOrder(
        order.userId,
        order.id,
        queryRunner,
      );
      const actualTrialReturn = Math.min(trialAmount, returnPrincipal);
      const realReturn = Number((returnPrincipal - actualTrialReturn).toFixed(2));

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

        // 本金真实部分：冻结 → 可用
        balance.availableBalance = Number((availableBefore + realReturn).toFixed(2));
        balance.frozenBalance = Number((frozenBefore - returnPrincipal).toFixed(2));

        // 收益：加到可用余额
        if (returnProfit > 0) {
          balance.availableBalance = Number((Number(balance.availableBalance) + returnProfit).toFixed(2));
        }

        await queryRunner.manager.save(balance);

        // 体验金部分变成真钱
        if (actualTrialReturn > 0) {
          await this.trialBonusService.returnTrialBonus(
            order.userId,
            actualTrialReturn,
            queryRunner,
            order.id,
          );
        }

        // 记录资金流水 - 本金退回
        const principalTx = queryRunner.manager.create(AccountTransaction, {
          userId: order.userId,
          type: TransactionType.PRINCIPAL_RETURN,
          amount: realReturn,
          balanceBefore: availableBefore,
          balanceAfter: Number(balance.availableBalance) - (returnProfit > 0 ? returnProfit : 0),
          relatedOrderId: order.id,
          description: `退回本金：${drug?.name || ''} ${order.quantity}盒，¥${realReturn.toFixed(2)}`,
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

      this.logger.log(`[approveReturn] 退回核准成功: orderId=${orderId}, userId=${order.userId}, 退回本金=${returnPrincipal}, 收益=${returnProfit}`);

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
    this.logger.log(`[rejectReturn] 管理员驳回退回: adminUserId=${adminUserId}, orderId=${orderId}, reason=${reason}`);

    const order = await this.subscriptionOrderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('认购订单不存在');
    }

    if (order.status !== SubscriptionOrderStatus.RETURN_PENDING) {
      throw new BadRequestException('该订单不在退回审核状态');
    }

    // 根据 effectiveAt 判断应恢复到哪个状态
    const now = new Date();
    if (order.effectiveAt && order.effectiveAt <= now) {
      order.status = SubscriptionOrderStatus.EFFECTIVE;
    } else {
      order.status = SubscriptionOrderStatus.CONFIRMED;
    }
    order.returnApprovedBy = adminUserId;
    order.returnRejectReason = reason;

    this.logger.log(`[rejectReturn] 退回已驳回: orderId=${orderId}, 状态恢复为EFFECTIVE`);

    return this.subscriptionOrderRepository.save(order);
  }

  /**
   * 审核认购订单
   */
  async auditSubscription(adminUserId: string, orderId: string, approved: boolean, remark?: string): Promise<SubscriptionOrder> {
    this.logger.log(`[auditSubscription] 开始审核: orderId=${orderId}, approved=${approved}`);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 锁定查询不加载关系（避免FOR UPDATE与LEFT JOIN外连接冲突）
      const order = await queryRunner.manager.findOne(SubscriptionOrder, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('认购订单不存在');
      }

      // 单独加载drug关联（不使用锁，避免FOR UPDATE冲突）
      if (order.drugId) {
        const drug = await queryRunner.manager.findOne(Drug, {
          where: { id: order.drugId },
        });
        if (drug) {
          order.drug = drug;
        }
      }

      // 安全检查：已滞销退款的订单不可审核
      if (order.status === SubscriptionOrderStatus.SLOW_SELLING_REFUND) {
        throw new BadRequestException('该订单已被滞销退款，无法审核');
      }

      // 必须是 CONFIRMED 或 EFFECTIVE 状态且 auditStatus='pending'
      if (order.status !== SubscriptionOrderStatus.CONFIRMED && order.status !== SubscriptionOrderStatus.EFFECTIVE) {
        throw new BadRequestException('该订单当前状态不可审核');
      }

      if (order.auditStatus !== 'pending') {
        throw new BadRequestException('该订单已审核，不可重复审核');
      }

      order.auditAt = new Date();
      order.auditBy = adminUserId;
      order.auditRemark = remark || '';

      if (approved) {
        // 审核通过
        order.auditStatus = 'approved';
        await queryRunner.manager.save(order);
        this.logger.log(`[auditSubscription] 审核通过: orderId=${orderId}`);
      } else {
        // 审核拒绝
        order.auditStatus = 'rejected';
        order.status = SubscriptionOrderStatus.CANCELLED;
        await queryRunner.manager.save(order);

        // 退回本金到用户可用余额，解冻冻结资金
        const balance = await queryRunner.manager.findOne(AccountBalance, {
          where: { userId: order.userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (balance) {
          const availableBefore = Number(balance.availableBalance);
          const frozenBefore = Number(balance.frozenBalance);
          const amount = Number(order.amount);

          balance.availableBalance = Number((availableBefore + amount).toFixed(2));
          balance.frozenBalance = Number((frozenBefore - amount).toFixed(2));

          await queryRunner.manager.save(balance);

          // 记录资金流水 - 认购审核拒绝退款
          const transaction = queryRunner.manager.create(AccountTransaction, {
            userId: order.userId,
            type: TransactionType.SUBSCRIPTION,
            amount: amount,
            balanceBefore: availableBefore,
            balanceAfter: balance.availableBalance,
            relatedOrderId: order.id,
            description: `认购审核拒绝退款：${order.drug?.name || ''} ${order.quantity}盒，订单号：${order.orderNo}`,
          });

          await queryRunner.manager.save(transaction);
        }

        // 更新药品已认购数量
        const drug = await queryRunner.manager.findOne(Drug, {
          where: { id: order.drugId },
          lock: { mode: 'pessimistic_write' },
        });

        if (drug) {
          drug.subscribedQuantity = Math.max(0, Number(drug.subscribedQuantity) - order.quantity);
          await queryRunner.manager.save(drug);
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log(`[auditSubscription] 事务已提交: orderId=${orderId}`);

      // 安全地重新查询完整订单数据
      try {
        const result = await this.subscriptionOrderRepository.findOne({
          where: { id: order.id },
          relations: ['drug', 'user'],
        });
        if (result) {
          return result;
        }
      } catch (e) {
        this.logger.warn(`[auditSubscription] 重新查询订单异常: ${e.message}`);
      }
      // 如果重新查询失败，返回内存中的order对象
      return order;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取待审核列表
   */
  async getAuditPendingList(page: number = 1, limit: number = 10, filters?: { drugId?: string; userId?: string }): Promise<{ list: any[]; pagination: any }> {
    const queryBuilder = this.subscriptionOrderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.drug', 'drug')
      .leftJoinAndMapOne(
        'order.user',
        User,
        'user',
        'user.id = order.userId',
      )
      .where('order.auditStatus = :auditStatus', { auditStatus: 'pending' })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [SubscriptionOrderStatus.CONFIRMED, SubscriptionOrderStatus.EFFECTIVE],
      })
      .orderBy('order.createdAt', 'DESC');

    if (filters?.drugId) {
      queryBuilder.andWhere('order.drugId = :drugId', { drugId: filters.drugId });
    }

    if (filters?.userId) {
      queryBuilder.andWhere('order.userId = :userId', { userId: filters.userId });
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
        status: order.status,
        auditStatus: order.auditStatus,
        confirmedAt: order.confirmedAt,
        effectiveAt: order.effectiveAt,
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

  // ==================== 到期功能相关 ====================

  /**
   * A. 查询到期/即将到期的订单
   * 10天期限从 effectiveAt 起算
   */
  async getExpiringOrders(daysBeforeExpiry: number = 3): Promise<any[]> {
    const now = new Date();
    // 到期日 = effectiveAt + 10天
    // 查询 effectiveAt + 10天 <= now + daysBeforeExpiry 的 EFFECTIVE 订单
    const deadlineDate = new Date(now);
    deadlineDate.setDate(deadlineDate.getDate() + daysBeforeExpiry);

    const orders = await this.subscriptionOrderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.drug', 'drug')
      .leftJoinAndMapOne(
        'order.user',
        User,
        'user',
        'user.id = order.userId',
      )
      .where('order.status = :status', { status: SubscriptionOrderStatus.EFFECTIVE })
      .getMany();

    // 在JS中过滤：effectiveAt + 10天 <= deadlineDate
    const filtered = orders.filter((order: any) => {
      const expiryDate = new Date(order.effectiveAt);
      expiryDate.setDate(expiryDate.getDate() + 10);
      return expiryDate <= deadlineDate;
    });

    return filtered.map((order: any) => {
      const expiryDate = new Date(order.effectiveAt);
      expiryDate.setDate(expiryDate.getDate() + 10);
      const isExpired = expiryDate <= now;
      const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
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
        unsettledAmount: Number(order.unsettledAmount),
        effectiveAt: order.effectiveAt,
        expiryDate,
        isExpired,
        daysLeft,
        status: order.status,
        totalProfit: Number(order.totalProfit),
        totalLoss: Number(order.totalLoss),
      };
    });
  }

  /**
   * B. 获取待确认的合伙人收益列表
   * 合伙人收益 = (sellingPrice - purchasePrice - 运营费) / 10
   * 运营费 = sellingPrice * 0.06 + 0.45 + (isColdChain ? 20 : 3)
   */
  async getPendingPartnerProfit(): Promise<any[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await this.subscriptionOrderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.drug', 'drug')
      .leftJoinAndMapOne(
        'order.user',
        User,
        'user',
        'user.id = order.userId',
      )
      .where('order.status = :status', { status: SubscriptionOrderStatus.EFFECTIVE })
      .getMany();

    const result = [];

    for (const order of orders as any[]) {
      const drug = order.drug;
      if (!drug) continue;

      // 检查今天是否已发放过合伙人收益
      const todayYield = await this.dailyYieldRepository.findOne({
        where: {
          orderId: order.id,
          yieldDate: today,
        },
      });

      // 如果今天已有记录且 subsidyFilled=true，说明已确认发放
      if (todayYield && todayYield.subsidyFilled) {
        continue;
      }

      const sellingPrice = Number(drug.sellingPrice);
      const purchasePrice = Number(drug.purchasePrice);
      const deliveryFee = drug.isColdChain ? 20 : 3;
      const operationFee = Number((sellingPrice * 0.06 + 0.45 + deliveryFee).toFixed(2));
      const partnerProfit = Number(((sellingPrice - purchasePrice - operationFee) / 10).toFixed(2));

      // 检查是否在10天有效期内
      const effectiveAt = new Date(order.effectiveAt);
      const expiryDate = new Date(effectiveAt);
      expiryDate.setDate(expiryDate.getDate() + 10);
      const isExpired = expiryDate <= new Date();

      result.push({
        id: order.id,
        orderNo: order.orderNo,
        userId: order.userId,
        username: order.user?.username,
        realName: order.user?.realName,
        drugId: order.drugId,
        drugName: drug.name,
        drugCode: drug.code,
        sellingPrice,
        purchasePrice,
        isColdChain: drug.isColdChain,
        deliveryFee,
        operationFee,
        partnerProfit,
        quantity: order.quantity,
        amount: Number(order.amount),
        unsettledAmount: Number(order.unsettledAmount),
        effectiveAt: order.effectiveAt,
        expiryDate,
        isExpired,
        alreadyConfirmed: !!(todayYield && todayYield.subsidyFilled),
      });
    }

    return result;
  }

  /**
   * B. 管理员确认并发放合伙人收益
   */
  async confirmPartnerProfit(adminUserId: string, orderIds: string[]): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const results = [];

      for (const orderId of orderIds) {
        // 锁定查询不加载关系（避免FOR UPDATE与LEFT JOIN外连接冲突）
        const order = await queryRunner.manager.findOne(SubscriptionOrder, {
          where: { id: orderId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!order || order.status !== SubscriptionOrderStatus.EFFECTIVE) {
          continue;
        }

        // 单独加载drug关联
        if (order.drugId) {
          const drugEntity = await queryRunner.manager.findOne(Drug, {
            where: { id: order.drugId },
          });
          if (drugEntity) {
            order.drug = drugEntity;
          }
        }

        const drug = order.drug;
        if (!drug) continue;

        // 检查今天是否已发放
        const existingYield = await queryRunner.manager.findOne(DailyYield, {
          where: { orderId: order.id, yieldDate: today },
        });

        if (existingYield && existingYield.subsidyFilled) {
          continue; // 已发放，跳过
        }

        const sellingPrice = Number(drug.sellingPrice);
        const purchasePrice = Number(drug.purchasePrice);
        const deliveryFee = drug.isColdChain ? 20 : 3;
        const operationFee = Number((sellingPrice * 0.06 + 0.45 + deliveryFee).toFixed(2));
        const partnerProfit = Number(((sellingPrice - purchasePrice - operationFee) / 10).toFixed(2));

        if (partnerProfit <= 0) {
          continue; // 无收益，跳过
        }

        // 更新用户可用余额
        const balance = await queryRunner.manager.findOne(AccountBalance, {
          where: { userId: order.userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!balance) continue;

        const availableBefore = Number(balance.availableBalance);
        balance.availableBalance = Number((availableBefore + partnerProfit).toFixed(2));
        balance.totalProfit = Number((Number(balance.totalProfit) + partnerProfit).toFixed(2));
        await queryRunner.manager.save(balance);

        // 更新订单累计收益
        order.totalProfit = Number((Number(order.totalProfit) + partnerProfit).toFixed(2));
        await queryRunner.manager.save(order);

        // 创建流水记录
        const transaction = queryRunner.manager.create(AccountTransaction, {
          userId: order.userId,
          type: TransactionType.PROFIT_SHARE,
          amount: partnerProfit,
          balanceBefore: availableBefore,
          balanceAfter: Number(balance.availableBalance),
          relatedOrderId: order.id,
          description: `合伙人收益：${drug.name}，¥${partnerProfit.toFixed(2)}`,
        });
        await queryRunner.manager.save(transaction);

        // 记录到 daily_yields 表
        if (existingYield) {
          existingYield.subsidy = partnerProfit;
          existingYield.totalYield = Number((Number(existingYield.baseYield) + partnerProfit).toFixed(2));
          existingYield.subsidyFilled = true;
          await queryRunner.manager.save(existingYield);
        } else {
          const dailyYield = queryRunner.manager.create(DailyYield, {
            orderId: order.id,
            userId: order.userId,
            drugId: order.drugId,
            yieldDate: today,
            baseYield: 0,
            subsidy: partnerProfit,
            totalYield: partnerProfit,
            principalBalance: Number(order.unsettledAmount),
            cumulativeYield: Number(order.totalProfit),
            subsidyFilled: true,
          });
          await queryRunner.manager.save(dailyYield);
        }

        results.push({
          orderId: order.id,
          orderNo: order.orderNo,
          partnerProfit,
          userId: order.userId,
        });
      }

      await queryRunner.commitTransaction();
      return {
        confirmedCount: results.length,
        details: results,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * C. 截止处理 - 到期结算
   * 1. 更新订单状态为 SETTLED
   * 2. 退还本金到用户可用余额
   * 3. 创建退还本金流水记录
   */
  async settleOrder(adminUserId: string, orderId: string): Promise<SubscriptionOrder> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(SubscriptionOrder, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
        relations: ['drug'],
      });

      if (!order) {
        throw new NotFoundException('认购订单不存在');
      }

      // 安全检查：如果订单已被自动滞销退款，跳过手动结算
      if (order.status === SubscriptionOrderStatus.SLOW_SELLING_REFUND) {
        this.logger.warn(`订单 ${orderId} 已被滞销退款，跳过结算`);
        throw new BadRequestException('该订单已被滞销退款，无法进行截止处理');
      }

      if (order.status === SubscriptionOrderStatus.RETURNED) {
        throw new BadRequestException('该订单已退回，无法进行截止处理');
      }

      if (order.status !== SubscriptionOrderStatus.EFFECTIVE) {
        throw new BadRequestException('仅生效中的订单可进行截止处理');
      }

      // 验证10天期限已到
      const effectiveAt = new Date(order.effectiveAt);
      const expiryDate = new Date(effectiveAt);
      expiryDate.setDate(expiryDate.getDate() + 10);

      // 即使未到期也允许管理员手动截止（但给出提示）
      const isExpired = expiryDate <= new Date();

      const unsettledAmount = Number(order.unsettledAmount);

      // 查询该订单使用的体验金金额
      const trialAmount = await this.trialBonusService.getTrialAmountUsedForOrder(
        order.userId,
        order.id,
        queryRunner,
      );
      const actualTrialReturn = Math.min(trialAmount, unsettledAmount);
      const realReturn = Number((unsettledAmount - actualTrialReturn).toFixed(2));

      // 1. 更新订单状态
      order.status = SubscriptionOrderStatus.SETTLED;
      order.unsettledAmount = 0;
      order.settledQuantity = order.quantity;
      await queryRunner.manager.save(order);

      // 2. 退还本金到用户可用余额
      if (unsettledAmount > 0) {
        const balance = await queryRunner.manager.findOne(AccountBalance, {
          where: { userId: order.userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!balance) {
          throw new NotFoundException('用户账户不存在');
        }

        const availableBefore = Number(balance.availableBalance);
        const frozenBefore = Number(balance.frozenBalance);

        // 本金真实部分：冻结 → 可用
        balance.availableBalance = Number((availableBefore + realReturn).toFixed(2));
        balance.frozenBalance = Number((frozenBefore - unsettledAmount).toFixed(2));
        await queryRunner.manager.save(balance);

        // 体验金部分变成真钱
        if (actualTrialReturn > 0) {
          await this.trialBonusService.returnTrialBonus(
            order.userId,
            actualTrialReturn,
            queryRunner,
            order.id,
          );
        }

        // 3. 创建退还本金的流水记录
        const transaction = queryRunner.manager.create(AccountTransaction, {
          userId: order.userId,
          type: TransactionType.PRINCIPAL_RETURN,
          amount: realReturn,
          balanceBefore: availableBefore,
          balanceAfter: Number(balance.availableBalance),
          relatedOrderId: order.id,
          description: `到期退还本金：${order.drug?.name || ''} ${order.quantity}盒，¥${realReturn.toFixed(2)}`,
        });
        await queryRunner.manager.save(transaction);
      }

      // 更新药品已认购数量
      const drug = await queryRunner.manager.findOne(Drug, {
        where: { id: order.drugId },
        lock: { mode: 'pessimistic_write' },
      });
      if (drug) {
        drug.subscribedQuantity = Math.max(0, Number(drug.subscribedQuantity) - order.quantity);
        await queryRunner.manager.save(drug);
      }

      await queryRunner.commitTransaction();

      try {
        const result = await this.subscriptionOrderRepository.findOne({
          where: { id: order.id },
          relations: ['drug', 'user'],
        });
        if (result) {
          return result;
        }
      } catch (e) {
        this.logger.warn(`[settleOrder] 重新查询订单异常: ${e.message}`);
      }
      return order;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
