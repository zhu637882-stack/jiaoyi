import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, MoreThan } from 'typeorm';
import {
  FundingOrder,
  FundingOrderStatus,
} from '../../database/entities/funding-order.entity';
import { Drug, DrugStatus } from '../../database/entities/drug.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import {
  AccountTransaction,
  TransactionType,
} from '../../database/entities/account-transaction.entity';
import { CreateFundingOrderDto } from './dto/create-funding-order.dto';

@Injectable()
export class FundingService {
  constructor(
    @InjectRepository(FundingOrder)
    private fundingOrderRepository: Repository<FundingOrder>,
    @InjectRepository(Drug)
    private drugRepository: Repository<Drug>,
    @InjectRepository(AccountBalance)
    private accountBalanceRepository: Repository<AccountBalance>,
    @InjectRepository(AccountTransaction)
    private accountTransactionRepository: Repository<AccountTransaction>,
    private dataSource: DataSource,
  ) {}

  /**
   * 生成唯一订单号
   * 格式：FD + YYYYMMDDHHmmss + 4位随机数
   */
  private generateOrderNo(): string {
    const now = new Date();
    const dateStr = now
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `FD${dateStr}${randomNum}`;
  }

  /**
   * 创建垫资订单（带数据库事务）
   */
  async createOrder(
    userId: string,
    createDto: CreateFundingOrderDto,
  ): Promise<FundingOrder> {
    const { drugId, quantity } = createDto;

    // 使用事务保证原子性
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 校验药品状态
      const drug = await queryRunner.manager.findOne(Drug, {
        where: { id: drugId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!drug) {
        throw new NotFoundException('药品不存在');
      }

      if (drug.status !== DrugStatus.FUNDING) {
        throw new BadRequestException('该药品当前不可垫资');
      }

      const remainingQuantity = drug.totalQuantity - drug.fundedQuantity;
      if (remainingQuantity < quantity) {
        throw new BadRequestException(
          `剩余可垫数量不足，当前剩余：${remainingQuantity}盒`,
        );
      }

      // 2. 计算垫资金额
      const amount = Number((quantity * drug.purchasePrice).toFixed(2));

      // 3. 校验用户余额
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

      // 4. 获取当前最大排队序号
      const maxQueueResult = await queryRunner.manager
        .createQueryBuilder(FundingOrder, 'order')
        .select('MAX(order.queuePosition)', 'maxPosition')
        .where('order.drugId = :drugId', { drugId })
        .getRawOne();

      const queuePosition = (maxQueueResult?.maxPosition || 0) + 1;

      // 5. 扣减可用余额，增加冻结金额
      const availableBefore = Number(balance.availableBalance);
      const frozenBefore = Number(balance.frozenBalance);

      balance.availableBalance = Number((availableBefore - amount).toFixed(2));
      balance.frozenBalance = Number((frozenBefore + amount).toFixed(2));
      balance.totalInvested = Number(
        (Number(balance.totalInvested) + amount).toFixed(2),
      );

      await queryRunner.manager.save(balance);

      // 6. 更新药品已垫数量
      drug.fundedQuantity += quantity;
      await queryRunner.manager.save(drug);

      // 7. 创建垫资订单
      const orderNo = this.generateOrderNo();
      const order = queryRunner.manager.create(FundingOrder, {
        orderNo,
        userId,
        drugId,
        quantity,
        amount,
        settledQuantity: 0,
        unsettledAmount: amount,
        status: FundingOrderStatus.HOLDING,
        queuePosition,
        fundedAt: new Date(),
        totalProfit: 0,
        totalLoss: 0,
        totalInterest: 0,
      });

      const savedOrder = await queryRunner.manager.save(order);

      // 8. 记录资金流水
      const transaction = queryRunner.manager.create(AccountTransaction, {
        userId,
        type: TransactionType.FUNDING,
        amount: -amount,
        balanceBefore: availableBefore,
        balanceAfter: balance.availableBalance,
        relatedOrderId: savedOrder.id,
        description: `垫资购买 ${drug.name} ${quantity}盒，订单号：${orderNo}`,
      });

      await queryRunner.manager.save(transaction);

      // 提交事务
      await queryRunner.commitTransaction();

      // 返回完整订单信息（包含药品信息）
      return this.fundingOrderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['drug'],
      });
    } catch (error) {
      // 回滚事务
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // 释放查询运行器
      await queryRunner.release();
    }
  }

  /**
   * 获取我的垫资订单列表
   */
  async getOrders(
    userId: string,
    options: {
      status?: FundingOrderStatus;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { status, page = 1, pageSize = 10 } = options;

    const queryBuilder = this.fundingOrderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.drug', 'drug')
      .where('order.userId = :userId', { userId })
      .orderBy('order.fundedAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    const total = await queryBuilder.getCount();

    const orders = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
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
        unsettledAmount: Number(order.unsettledAmount),
        settledQuantity: order.settledQuantity,
        status: order.status,
        queuePosition: order.queuePosition,
        fundedAt: order.fundedAt,
        totalProfit: Number(order.totalProfit),
        totalInterest: Number(order.totalInterest),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 获取订单详情
   */
  async getOrderDetail(userId: string, orderId: string) {
    const order = await this.fundingOrderRepository.findOne({
      where: { id: orderId, userId },
      relations: ['drug'],
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 获取收益明细（从结算记录中计算）
    // 这里简化处理，实际可能需要关联 settlement 表
    const holdingDays = Math.floor(
      (Date.now() - new Date(order.fundedAt).getTime()) / (1000 * 60 * 60 * 24),
    );

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
            annualRate: order.drug.annualRate,
          }
        : null,
      quantity: order.quantity,
      amount: Number(order.amount),
      unsettledAmount: Number(order.unsettledAmount),
      settledQuantity: order.settledQuantity,
      status: order.status,
      queuePosition: order.queuePosition,
      fundedAt: order.fundedAt,
      settledAt: order.settledAt,
      totalProfit: Number(order.totalProfit),
      totalLoss: Number(order.totalLoss),
      totalInterest: Number(order.totalInterest),
      holdingDays,
      dailyProfitEstimate:
        order.status === FundingOrderStatus.HOLDING
          ? Number(
              (
                (Number(order.unsettledAmount) * order.drug.annualRate) /
                100 /
                360
              ).toFixed(2),
            )
          : 0,
    };
  }

  /**
   * 获取当前持仓摘要
   */
  async getActiveFundingSummary(userId: string) {
    const queryBuilder = this.fundingOrderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.drug', 'drug')
      .where('order.userId = :userId', { userId })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [FundingOrderStatus.HOLDING, FundingOrderStatus.PARTIAL_SETTLED],
      });

    const orders = await queryBuilder.getMany();

    let totalHoldingAmount = 0;
    let totalUnsettledPrincipal = 0;
    let todayEstimatedProfit = 0;

    for (const order of orders) {
      const unsettledAmount = Number(order.unsettledAmount);
      totalHoldingAmount += Number(order.amount);
      totalUnsettledPrincipal += unsettledAmount;

      // 计算今日预估收益
      if (order.drug && order.status === FundingOrderStatus.HOLDING) {
        const dailyRate = order.drug.annualRate / 100 / 360;
        todayEstimatedProfit += unsettledAmount * dailyRate;
      }
    }

    return {
      totalHoldingAmount: Number(totalHoldingAmount.toFixed(2)),
      totalUnsettledPrincipal: Number(totalUnsettledPrincipal.toFixed(2)),
      holdingOrderCount: orders.length,
      todayEstimatedProfit: Number(todayEstimatedProfit.toFixed(2)),
    };
  }

  /**
   * 获取某药品的垫资排队队列
   */
  async getFundingQueue(drugId: string) {
    // 校验药品是否存在
    const drug = await this.drugRepository.findOne({
      where: { id: drugId },
    });

    if (!drug) {
      throw new NotFoundException('药品不存在');
    }

    const orders = await this.fundingOrderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .where('order.drugId = :drugId', { drugId })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [FundingOrderStatus.HOLDING, FundingOrderStatus.PARTIAL_SETTLED],
      })
      .orderBy('order.queuePosition', 'ASC')
      .getMany();

    let cumulativeAmount = 0;
    const queue = orders.map((order) => {
      cumulativeAmount += Number(order.amount);
      return {
        queuePosition: order.queuePosition,
        quantity: order.quantity,
        amount: Number(order.amount),
        status: order.status,
        cumulativeAmount: Number(cumulativeAmount.toFixed(2)),
      };
    });

    return {
      drugId: drug.id,
      drugName: drug.name,
      drugCode: drug.code,
      purchasePrice: drug.purchasePrice,
      totalQuantity: drug.totalQuantity,
      fundedQuantity: drug.fundedQuantity,
      remainingQuantity: drug.totalQuantity - drug.fundedQuantity,
      queue,
      queueDepth: queue.length,
    };
  }

  /**
   * 获取个人垫资统计
   */
  async getFundingStatistics(userId: string) {
    // 总垫资次数和金额
    const totalStats = await this.fundingOrderRepository
      .createQueryBuilder('order')
      .select('COUNT(order.id)', 'totalCount')
      .addSelect('SUM(order.amount)', 'totalAmount')
      .addSelect('SUM(order.totalProfit)', 'totalProfit')
      .addSelect('SUM(order.totalLoss)', 'totalLoss')
      .addSelect('SUM(order.totalInterest)', 'totalInterest')
      .where('order.userId = :userId', { userId })
      .getRawOne();

    // 计算平均持仓天数
    const orders = await this.fundingOrderRepository
      .createQueryBuilder('order')
      .where('order.userId = :userId', { userId })
      .andWhere('order.status != :status', { status: FundingOrderStatus.PENDING })
      .getMany();

    let totalHoldingDays = 0;
    for (const order of orders) {
      const endDate = order.settledAt || new Date();
      const days = Math.floor(
        (endDate.getTime() - new Date(order.fundedAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      totalHoldingDays += days;
    }

    const avgHoldingDays =
      orders.length > 0 ? Math.round(totalHoldingDays / orders.length) : 0;

    return {
      totalFundingCount: Number(totalStats?.totalCount || 0),
      totalFundingAmount: Number(Number(totalStats?.totalAmount || 0).toFixed(2)),
      totalProfit: Number(Number(totalStats?.totalProfit || 0).toFixed(2)),
      totalLoss: Number(Number(totalStats?.totalLoss || 0).toFixed(2)),
      totalInterest: Number(Number(totalStats?.totalInterest || 0).toFixed(2)),
      netProfit: Number(
        (
          Number(totalStats?.totalProfit || 0) -
          Number(totalStats?.totalLoss || 0) +
          Number(totalStats?.totalInterest || 0)
        ).toFixed(2),
      ),
      averageHoldingDays: avgHoldingDays,
    };
  }

  /**
   * 获取某药品的我的持仓订单
   */
  async getDrugHoldings(userId: string, drugId: string) {
    const orders = await this.fundingOrderRepository
      .createQueryBuilder('order')
      .where('order.userId = :userId', { userId })
      .andWhere('order.drugId = :drugId', { drugId })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [FundingOrderStatus.HOLDING, FundingOrderStatus.PARTIAL_SETTLED],
      })
      .orderBy('order.fundedAt', 'DESC')
      .getMany();

    return orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      quantity: order.quantity,
      amount: Number(order.amount),
      unsettledAmount: Number(order.unsettledAmount),
      settledQuantity: order.settledQuantity,
      status: order.status,
      queuePosition: order.queuePosition,
      fundedAt: order.fundedAt,
      totalProfit: Number(order.totalProfit),
      totalInterest: Number(order.totalInterest),
    }));
  }
}
