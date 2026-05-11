import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, LessThanOrEqual, MoreThanOrEqual, LessThan } from 'typeorm';
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
import { SaleRecord } from '../../database/entities/sale-record.entity';
import { InvitationService } from '../invitation/invitation.service';
import { TrialBonusService } from '../trial-bonus/trial-bonus.service';

@Injectable()
export class SubscriptionService {
  private logger = new Logger(SubscriptionService.name);

  // 交易限额配置
  private readonly MAX_SINGLE_AMOUNT = 100000; // 单笔最大10万
  private readonly DAILY_LIMIT = 500000; // 日限额50万

  // 频率限制配置（内存实现）
  private readonly requestCache = new Map<string, number[]>();
  private readonly RATE_LIMIT = 3; // 每分钟最多3次
  private readonly RATE_WINDOW = 60000; // 1分钟窗口

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
    @InjectRepository(SaleRecord)
    private saleRecordRepository: Repository<SaleRecord>,
    private dataSource: DataSource,
    private invitationService: InvitationService,
    private trialBonusService: TrialBonusService,
  ) {}

  /**
   * 频率限制检查（内存实现）
   * 同一用户每分钟最多 RATE_LIMIT 次认购请求
   */
  private checkRateLimit(userId: string): void {
    const now = Date.now();
    const requests = this.requestCache.get(userId) || [];
    const recentRequests = requests.filter(t => now - t < this.RATE_WINDOW);
    if (recentRequests.length >= this.RATE_LIMIT) {
      throw new BadRequestException('操作过于频繁，请稍后再试');
    }
    recentRequests.push(now);
    this.requestCache.set(userId, recentRequests);

    // 定期清理过期数据（防止内存泄漏）
    if (this.requestCache.size > 10000) {
      for (const [key, timestamps] of this.requestCache.entries()) {
        const filtered = timestamps.filter(t => now - t < this.RATE_WINDOW);
        if (filtered.length === 0) {
          this.requestCache.delete(key);
        } else {
          this.requestCache.set(key, filtered);
        }
      }
    }
  }

  /**
   * 单笔限额校验
   */
  private checkSingleAmountLimit(amount: number): void {
    if (amount > this.MAX_SINGLE_AMOUNT) {
      throw new BadRequestException(`单笔认购金额不能超过${this.MAX_SINGLE_AMOUNT / 10000}万元`);
    }
  }

  /**
   * 日限额校验（在事务内执行，使用queryRunner）
   */
  private async checkDailyLimit(userId: string, amount: number, queryRunner: import('typeorm').QueryRunner): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTotal = await queryRunner.manager
      .createQueryBuilder(SubscriptionOrder, 'so')
      .where('so.userId = :userId', { userId })
      .andWhere('so.createdAt >= :today', { today })
      .andWhere('so.status != :cancelled', { cancelled: SubscriptionOrderStatus.CANCELLED })
      .select('COALESCE(SUM(so.amount), 0)', 'total')
      .getRawOne();

    if (Number(todayTotal.total) + amount > this.DAILY_LIMIT) {
      throw new BadRequestException(`今日认购总额已超限，日限额${this.DAILY_LIMIT / 10000}万元`);
    }
  }

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

    // 最小认购数量校验
    if (quantity < 100) {
      throw new BadRequestException('最小认购单位为100盒');
    }

    this.logger.log(`[createSubscription] 创建认购: userId=${userId}, drugId=${drugId}, quantity=${quantity}`);

    // 0. 频率限制校验
    this.checkRateLimit(userId);

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

      // 3.1 单笔限额校验
      this.checkSingleAmountLimit(amount);

      // 3.2 日限额校验
      await this.checkDailyLimit(userId, amount, queryRunner);

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

      // 6. 获取当前最大排队序号（全局排序，不按drugId分组）
      const maxQueueResult = await queryRunner.manager
        .createQueryBuilder(SubscriptionOrder, 'order')
        .select('MAX(order.queuePosition)', 'maxPosition')
        .getRawOne();

      const queuePosition = (maxQueueResult?.maxPosition || 0) + 1;

      // 7. 记录确认时间，生效时间和滞销截止日由审核通过时设置
      const confirmedAt = new Date();

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
        effectiveAt: null,
        slowSellingDeadline: null,
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

    // 5. 获取当前最大排队序号（全局排序，不按drugId分组）
    const maxQueueResult = await queryRunner.manager
      .createQueryBuilder(SubscriptionOrder, 'order')
      .select('MAX(order.queuePosition)', 'maxPosition')
      .getRawOne();

    const queuePosition = (maxQueueResult?.maxPosition || 0) + 1;

    // 6. 记录确认时间，生效时间和滞销截止日由审核通过时设置
    const confirmedAt = new Date();

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
      effectiveAt: null,
      slowSellingDeadline: null,
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

      // 3. 校验取消时间窗口（锁定期内不可取消）
      if (order.lockExpiresAt && order.lockExpiresAt > new Date()) {
        const remainingDays = Math.ceil((order.lockExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        throw new BadRequestException(`该订单处于10天锁定期内，剩余${remainingDays}天，暂不可取消`);
      }

      // 4. 校验取消时间窗口（T+1生效前才可取消）
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
        lockExpiresAt: order.lockExpiresAt,
        dividendAmount: Number(order.dividendAmount),
        confirmedQuantity: order.confirmedQuantity || 0,
        unconfirmedQuantity: order.unconfirmedQuantity || 0,
        unconfirmedAt: order.unconfirmedAt,
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
      .leftJoinAndMapOne(
        'order.auditor',
        User,
        'auditor',
        'auditor.id = order.auditBy',
      )
      .orderBy('order.queuePosition', 'ASC');

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
        auditorName: order.auditor?.realName || order.auditor?.username || null,
        auditRemark: order.auditRemark,
        queuePosition: order.queuePosition,
        confirmedAt: order.confirmedAt,
        effectiveAt: order.effectiveAt,
        slowSellingDeadline: order.slowSellingDeadline,
        returnedAt: order.returnedAt,
        totalProfit: Number(order.totalProfit),
        totalLoss: Number(order.totalLoss),
        lockExpiresAt: order.lockExpiresAt,
        dividendAmount: Number(order.dividendAmount),
        confirmedQuantity: order.confirmedQuantity || 0,
        unconfirmedQuantity: order.unconfirmedQuantity || 0,
        unconfirmedAt: order.unconfirmedAt,
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
   * 客户申请退回认购订单（退货回库）
   * 允许状态：EFFECTIVE（可退全部）、PARTIAL_SOLD（可退未售出部分）
   */
  async requestReturn(userId: string, orderId: string): Promise<SubscriptionOrder> {
    this.logger.log(`[requestReturn] 申请退回: userId=${userId}, orderId=${orderId}`);

    const order = await this.subscriptionOrderRepository.findOne({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new NotFoundException('认购订单不存在');
    }

    // 允许：EFFECTIVE（已入库，可退全部）、PARTIAL_SOLD（部分售出，可退未售部分）
    const allowedStatuses = [
      SubscriptionOrderStatus.EFFECTIVE,
      SubscriptionOrderStatus.PARTIAL_SOLD,
    ];

    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException('当前订单状态不可申请退回，仅已生效或部分售出的订单可申请');
    }

    // PARTIAL_SOLD 时检查是否还有未售出部分
    if (order.status === SubscriptionOrderStatus.PARTIAL_SOLD) {
      const unsoldQuantity = order.quantity - order.soldQuantity;
      if (unsoldQuantity <= 0) {
        throw new BadRequestException('该订单已全部售出，没有可退回的部分');
      }
    }

    order.status = SubscriptionOrderStatus.RETURN_PENDING;
    // 清除认购审核状态，避免退回订单出现在认购审核列表中
    order.auditStatus = 'approved';
    order.returnRequestedAt = new Date();

    this.logger.log(`[requestReturn] 退回申请已提交: userId=${userId}, orderId=${orderId}, 状态变更为RETURN_PENDING`);

    return this.subscriptionOrderRepository.save(order);
  }

  /**
   * 管理员核准退回（退货回库模式）
   * 退货 = 回库：未售出部分本金从冻结退回可用，药品库存回退，停止计息
   * 不发放利润（未售出的没有利润），不发放滞销补贴
   */
  async approveReturn(adminUserId: string, orderId: string): Promise<SubscriptionOrder> {
    this.logger.log(`[approveReturn] 管理员核准退回(回库): adminUserId=${adminUserId}, orderId=${orderId}`);

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

      const drug = await queryRunner.manager.findOne(Drug, {
        where: { id: order.drugId },
        lock: { mode: 'pessimistic_write' },
      });

      // 退货数量 = 未售出部分
      const returnQuantity = order.quantity - order.soldQuantity;
      const returnPrincipal = Number((returnQuantity * Number(drug.purchasePrice)).toFixed(2));

      // 更新用户余额：冻结→可用（只退未售出部分的本金）
      const balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId: order.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (balance) {
        const availableBefore = Number(balance.availableBalance);
        const frozenBefore = Number(balance.frozenBalance);

        balance.frozenBalance = Number((frozenBefore - returnPrincipal).toFixed(2));
        balance.availableBalance = Number((availableBefore + returnPrincipal).toFixed(2));
        await queryRunner.manager.save(balance);

        // 生成本金退回流水
        const principalTx = queryRunner.manager.create(AccountTransaction, {
          userId: order.userId,
          type: TransactionType.PRINCIPAL_RETURN,
          amount: returnPrincipal,
          balanceBefore: availableBefore,
          balanceAfter: Number(balance.availableBalance),
          relatedOrderId: order.id,
          description: `退货回库-本金退回(${returnQuantity}份) ${drug?.name || ''}`,
        });
        await queryRunner.manager.save(principalTx);
      }

      // 药品库存回退（减少已认购数量，使其可重新售出）
      if (drug) {
        drug.subscribedQuantity = Math.max(0, Number(drug.subscribedQuantity) - returnQuantity);
        await queryRunner.manager.save(drug);
      }

      // 更新订单状态
      if (order.soldQuantity > 0) {
        // 有部分已售出 → 标记为全部售出（退回的部分已处理，剩下的等结算）
        order.status = SubscriptionOrderStatus.FULLY_SOLD;
      } else {
        // 完全未售出 → 标记为已退回
        order.status = SubscriptionOrderStatus.RETURNED;
      }

      order.returnApprovedBy = adminUserId;
      order.returnedAt = new Date();
      // 更新未结算金额（扣除退回部分）
      order.unsettledAmount = Number((Number(order.unsettledAmount) - returnPrincipal).toFixed(2));
      await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();

      this.logger.log(`[approveReturn] 退货回库核准成功: orderId=${orderId}, userId=${order.userId}, 退回数量=${returnQuantity}, 退回本金=${returnPrincipal}, 新状态=${order.status}`);

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
  async auditSubscription(adminUserId: string, orderId: string, approved: boolean, remark?: string, confirmedQuantity?: number): Promise<SubscriptionOrder> {
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
        // 部分确认数量校验
        let confirmQty = confirmedQuantity != null ? confirmedQuantity : order.quantity;
        if (confirmQty <= 0 || confirmQty > order.quantity) {
          throw new BadRequestException(`确认数量必须在1-${order.quantity}之间`);
        }

        // 设置确认数量和待确认数量
        order.confirmedQuantity = confirmQty;
        order.unconfirmedQuantity = order.quantity - confirmQty;

        // 审核通过：变为生效/入库状态
        order.auditStatus = 'approved';
        order.status = SubscriptionOrderStatus.EFFECTIVE;
        order.effectiveAt = new Date();
        // 设置锁定期截止日 = 生效日 + 10天
        const lockExpires = new Date();
        lockExpires.setDate(lockExpires.getDate() + 10);
        order.lockExpiresAt = lockExpires;
        order.slowSellingDeadline = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

        // 如果部分确认，记录未确认部分计时起点
        if (order.unconfirmedQuantity > 0) {
          order.unconfirmedAt = new Date();
          this.logger.log(`[auditSubscription] 部分确认: orderId=${orderId}, 确认${confirmQty}盒, 待确认${order.unconfirmedQuantity}盒`);
        }

        await queryRunner.manager.save(order);
        this.logger.log(`[auditSubscription] 审核通过并即时入库生效: orderId=${orderId}, 锁定期截止=${lockExpires.toISOString()}`);
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
      .leftJoinAndMapOne(
        'order.auditor',
        User,
        'auditor',
        'auditor.id = order.auditBy',
      )
      .where('order.auditStatus = :auditStatus', { auditStatus: 'pending' })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [SubscriptionOrderStatus.CONFIRMED, SubscriptionOrderStatus.EFFECTIVE],
      })
      .orderBy('order.queuePosition', 'ASC');

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
        auditBy: order.auditBy,
        auditorName: order.auditor?.realName || order.auditor?.username || null,
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
   * 90天期限从 effectiveAt 起算
   */
  async getExpiringOrders(daysBeforeExpiry: number = 3): Promise<any[]> {
    const now = new Date();
    // 到期日 = effectiveAt + 90天
    // 查询 effectiveAt + 90天 <= now + daysBeforeExpiry 的 EFFECTIVE 订单
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

    // 在JS中过滤：effectiveAt + 90天 <= deadlineDate
    const filtered = orders.filter((order: any) => {
      const expiryDate = new Date(order.effectiveAt);
      expiryDate.setDate(expiryDate.getDate() + 90);
      return expiryDate <= deadlineDate;
    });

    return filtered.map((order: any) => {
      const expiryDate = new Date(order.effectiveAt);
      expiryDate.setDate(expiryDate.getDate() + 90);
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

      // 检查是否在90天有效期内
      const effectiveAt = new Date(order.effectiveAt);
      const expiryDate = new Date(effectiveAt);
      expiryDate.setDate(expiryDate.getDate() + 90);
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
   * 管理员录入售出数量
   */
  async recordSale(orderId: string, quantity: number): Promise<SaleRecord> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 查找并锁定订单（不加relations，避免FOR UPDATE冲突）
      const order = await queryRunner.manager.findOne(SubscriptionOrder, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('订单不存在');
      }

      // 2. 校验订单状态（只有 EFFECTIVE 或 PARTIAL_SOLD 可以录入售出）
      if (![SubscriptionOrderStatus.EFFECTIVE, SubscriptionOrderStatus.PARTIAL_SOLD].includes(order.status)) {
        throw new BadRequestException(`订单状态为${order.status}，无法录入售出`);
      }

      // 3. 校验数量
      const unsoldQuantity = order.quantity - order.soldQuantity;
      if (quantity <= 0) {
        throw new BadRequestException('售出数量必须大于0');
      }
      if (quantity > unsoldQuantity) {
        throw new BadRequestException(`售出数量不能超过未售出数量(${unsoldQuantity})`);
      }

      // 4. 加载药品信息计算金额
      const drug = await queryRunner.manager.findOne(Drug, {
        where: { id: order.drugId },
      });

      const saleAmount = Number((quantity * Number(drug.sellingPrice)).toFixed(2));
      const profitAmount = Number((saleAmount * 0.018).toFixed(2)); // 资方利润 1.8%

      // 5. 创建售出记录
      const settlementDueAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10天后结算
      const saleRecord = queryRunner.manager.create(SaleRecord, {
        orderId: order.id,
        quantity,
        settlementDueAt,
        settled: false,
        saleAmount,
        profitAmount,
        subsidyAmount: 0, // 结算时再计算补贴
      });
      await queryRunner.manager.save(saleRecord);

      // 6. 更新订单售出数量和状态
      order.soldQuantity += quantity;
      if (!order.firstSoldAt) {
        order.firstSoldAt = new Date();
      }
      order.lastSoldAt = new Date();

      // 7. 更新订单状态
      if (order.soldQuantity >= order.quantity) {
        order.status = SubscriptionOrderStatus.FULLY_SOLD;
      } else {
        order.status = SubscriptionOrderStatus.PARTIAL_SOLD;
      }

      await queryRunner.manager.save(order);
      await queryRunner.commitTransaction();

      return saleRecord;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取订单的售出记录列表
   */
  async getSaleRecords(orderId: string): Promise<SaleRecord[]> {
    return this.saleRecordRepository.find({
      where: { orderId },
      order: { recordedAt: 'DESC' },
    });
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

      // 验证90天期限已到
      const effectiveAt = new Date(order.effectiveAt);
      const expiryDate = new Date(effectiveAt);
      expiryDate.setDate(expiryDate.getDate() + 90);

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

  /**
   * 管理员查询已到锁定期截止日的订单（用于到期提醒）
   * 按 queuePosition 升序（先进先出）
   */
  async getAdminExpiringOrders(): Promise<{ list: any[]; count: number }> {
    const now = new Date();
    const orders = await this.subscriptionOrderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.drug', 'drug')
      .leftJoinAndMapOne(
        'order.user',
        User,
        'user',
        'user.id = order.userId',
      )
      .where('order.lockExpiresAt IS NOT NULL')
      .andWhere('order.lockExpiresAt <= :now', { now })
      .andWhere('order.status = :status', { status: SubscriptionOrderStatus.EFFECTIVE })
      .andWhere('order.dividendAmount = 0')
      .orderBy('order.queuePosition', 'ASC')
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
        quantity: order.quantity,
        amount: Number(order.amount),
        queuePosition: order.queuePosition,
        lockExpiresAt: order.lockExpiresAt,
        effectiveAt: order.effectiveAt,
        status: order.status,
      })),
      count: orders.length,
    };
  }

  /**
   * 管理员手动填写分红金额并结算
   * 本金+分红一次性退回客户余额，订单 → SETTLED
   */
  async fillDividend(adminUserId: string, orderId: string, dividendAmount: number): Promise<SubscriptionOrder> {
    this.logger.log(`[fillDividend] 管理员填写分红: orderId=${orderId}, dividendAmount=${dividendAmount}`);

    if (dividendAmount <= 0) {
      throw new BadRequestException('分红金额必须大于0');
    }

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

      if (order.status !== SubscriptionOrderStatus.EFFECTIVE) {
        throw new BadRequestException('仅生效中的订单可进行分红结算');
      }

      if (order.dividendAmount > 0) {
        throw new BadRequestException('该订单已完成分红结算');
      }

      // 记录分红信息
      order.dividendAmount = Number(dividendAmount.toFixed(2));
      order.dividendFilledBy = adminUserId;
      order.dividendFilledAt = new Date();
      order.status = SubscriptionOrderStatus.SETTLED;

      // 结算：解锁冻结本金 + 分红退回到可用余额
      const amount = Number(order.amount);
      const totalRefund = Number((amount + order.dividendAmount).toFixed(2));

      const balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId: order.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        throw new Error(`用户 ${order.userId} 账户余额不存在`);
      }

      const balanceBefore = Number(balance.availableBalance);
      balance.availableBalance = Number((balanceBefore + totalRefund).toFixed(2));
      balance.frozenBalance = Number((Number(balance.frozenBalance) - amount).toFixed(2));
      await queryRunner.manager.save(balance);
      await queryRunner.manager.save(order);

      // 记录资金流水 - 本金退回
      const principalTx = queryRunner.manager.create(AccountTransaction, {
        userId: order.userId,
        type: TransactionType.PRINCIPAL_RETURN,
        amount: amount,
        balanceBefore: balanceBefore,
        balanceAfter: Number((balanceBefore + amount).toFixed(2)),
        relatedOrderId: order.id,
        description: `10天锁定期结算本金退回(${order.quantity}份) - 订单${order.orderNo}`,
      });
      await queryRunner.manager.save(principalTx);

      // 记录资金流水 - 分红收益
      const dividendTx = queryRunner.manager.create(AccountTransaction, {
        userId: order.userId,
        type: TransactionType.DIVIDEND_SETTLE,
        amount: order.dividendAmount,
        balanceBefore: Number((balanceBefore + amount).toFixed(2)),
        balanceAfter: Number(balance.availableBalance),
        relatedOrderId: order.id,
        description: `10天锁定期分红收益 ¥${order.dividendAmount} - 订单${order.orderNo}`,
      });
      await queryRunner.manager.save(dividendTx);

      await queryRunner.commitTransaction();

      this.logger.log(`[fillDividend] 分红结算完成: orderId=${orderId}, 本金${amount}+分红${order.dividendAmount}`);

      // 重新查询完整数据
      const result = await this.subscriptionOrderRepository.findOne({
        where: { id: order.id },
        relations: ['drug', 'user'],
      });
      return result || order;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
