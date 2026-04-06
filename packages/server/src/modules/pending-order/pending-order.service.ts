import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import {
  PendingOrder,
  PendingOrderType,
  PendingOrderStatus,
} from '../../database/entities/pending-order.entity';
import { Drug, DrugStatus } from '../../database/entities/drug.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import {
  AccountTransaction,
  TransactionType,
} from '../../database/entities/account-transaction.entity';
import { User } from '../../database/entities/user.entity';
import { CreatePendingOrderDto } from './dto/create-pending-order.dto';
import { FundingService } from '../funding/funding.service';
import { AuditService } from '../../common/services/audit.service';

@Injectable()
export class PendingOrderService {
  constructor(
    @InjectRepository(PendingOrder)
    private pendingOrderRepository: Repository<PendingOrder>,
    @InjectRepository(Drug)
    private drugRepository: Repository<Drug>,
    @InjectRepository(AccountBalance)
    private accountBalanceRepository: Repository<AccountBalance>,
    @InjectRepository(AccountTransaction)
    private accountTransactionRepository: Repository<AccountTransaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
    private fundingService: FundingService,
    private auditService: AuditService,
  ) {}

  /**
   * 生成唯一订单号
   * 格式：PO + YYYYMMDDHHmmss + 4位随机数
   */
  private generateOrderNo(): string {
    const now = new Date();
    const dateStr = now
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `PO${dateStr}${randomNum}`;
  }

  /**
   * 创建条件委托订单
   */
  async createPendingOrder(
    userId: string,
    createDto: CreatePendingOrderDto,
  ): Promise<PendingOrder> {
    const { drugId, type, targetPrice, quantity, expireAt } = createDto;

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
        throw new BadRequestException('该药品当前不可交易');
      }

      // 2. 计算冻结金额
      const frozenAmount = Number((targetPrice * quantity).toFixed(2));

      // 3. 如果是 limit_buy，检查当前价格是否已满足条件
      if (type === PendingOrderType.LIMIT_BUY) {
        const currentPrice = Number(drug.purchasePrice);
        
        // 如果当前价格 <= 目标价格，直接成交
        if (currentPrice <= targetPrice) {
          await queryRunner.commitTransaction();
          await queryRunner.release();
          
          // 调用 FundingService 创建垫资订单
          const fundingOrder = await this.fundingService.createOrder(userId, {
            drugId,
            quantity,
          });

          // 创建已触发的委托单记录
          const orderNo = this.generateOrderNo();
          const pendingOrder = this.pendingOrderRepository.create({
            orderNo,
            userId,
            drugId,
            type,
            targetPrice,
            quantity,
            filledQuantity: quantity,
            frozenAmount: 0,
            status: PendingOrderStatus.TRIGGERED,
            expireAt: expireAt ? new Date(expireAt) : null,
            triggeredAt: new Date(),
            fundingOrderId: fundingOrder.id,
          });

          return this.pendingOrderRepository.save(pendingOrder);
        }

        // 4. 校验用户余额（未满足条件时才需要冻结）
        const balance = await queryRunner.manager.findOne(AccountBalance, {
          where: { userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!balance) {
          throw new NotFoundException('账户不存在');
        }

        if (Number(balance.availableBalance) < frozenAmount) {
          throw new BadRequestException(
            `可用余额不足，当前可用：${balance.availableBalance}元，需要：${frozenAmount}元`,
          );
        }

        // 5. 冻结资金
        const availableBefore = Number(balance.availableBalance);
        const frozenBefore = Number(balance.frozenBalance);

        balance.availableBalance = Number((availableBefore - frozenAmount).toFixed(2));
        balance.frozenBalance = Number((frozenBefore + frozenAmount).toFixed(2));

        await queryRunner.manager.save(balance);

        // 6. 创建 PENDING 委托单
        const orderNo = this.generateOrderNo();
        const order = queryRunner.manager.create(PendingOrder, {
          orderNo,
          userId,
          drugId,
          type,
          targetPrice,
          quantity,
          filledQuantity: 0,
          frozenAmount,
          status: PendingOrderStatus.PENDING,
          expireAt: expireAt ? new Date(expireAt) : null,
        });

        const savedOrder = await queryRunner.manager.save(order);

        // 7. 记录资金流水
        const transaction = queryRunner.manager.create(AccountTransaction, {
          userId,
          type: TransactionType.FUNDING,
          amount: -frozenAmount,
          balanceBefore: availableBefore,
          balanceAfter: balance.availableBalance,
          relatedOrderId: savedOrder.id,
          description: `条件委托冻结资金 ${drug.name} ${quantity}盒 @ ${targetPrice}元，订单号：${orderNo}`,
        });

        await queryRunner.manager.save(transaction);

        await queryRunner.commitTransaction();

        return this.pendingOrderRepository.findOne({
          where: { id: savedOrder.id },
          relations: ['drug'],
        });
      }

      // LIMIT_SELL 类型（暂不支持，预留）
      throw new BadRequestException('暂不支持限价卖出委托');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取我的委托订单列表
   */
  async getPendingOrders(
    userId: string,
    options: {
      status?: PendingOrderStatus;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { status, page = 1, pageSize = 10 } = options;

    const queryBuilder = this.pendingOrderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.drug', 'drug')
      .where('order.userId = :userId', { userId })
      .orderBy('order.createdAt', 'DESC');

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
        type: order.type,
        targetPrice: Number(order.targetPrice),
        quantity: order.quantity,
        filledQuantity: order.filledQuantity,
        frozenAmount: Number(order.frozenAmount),
        status: order.status,
        expireAt: order.expireAt,
        triggeredAt: order.triggeredAt,
        fundingOrderId: order.fundingOrderId,
        createdAt: order.createdAt,
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
   * 获取委托订单详情
   */
  async getPendingOrderDetail(userId: string, orderId: string) {
    const order = await this.pendingOrderRepository.findOne({
      where: { id: orderId, userId },
      relations: ['drug'],
    });

    if (!order) {
      throw new NotFoundException('委托订单不存在');
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
          }
        : null,
      type: order.type,
      targetPrice: Number(order.targetPrice),
      quantity: order.quantity,
      filledQuantity: order.filledQuantity,
      frozenAmount: Number(order.frozenAmount),
      status: order.status,
      expireAt: order.expireAt,
      triggeredAt: order.triggeredAt,
      fundingOrderId: order.fundingOrderId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  /**
   * 撤销委托订单
   */
  async cancelPendingOrder(userId: string, orderId: string): Promise<PendingOrder> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 查询委托单（带锁）- 不使用 relations 避免外连接悲观锁问题
      const order = await queryRunner.manager.findOne(PendingOrder, {
        where: { id: orderId, userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('委托订单不存在');
      }

      // 单独查询关联的 drug
      const drug = await queryRunner.manager.findOne(Drug, {
        where: { id: order.drugId },
      });

      // 2. 校验状态
      if (![PendingOrderStatus.PENDING, PendingOrderStatus.PARTIAL].includes(order.status)) {
        throw new BadRequestException('该委托单当前状态不可撤销');
      }

      // 3. 计算需要解冻的金额
      const unfilledQuantity = order.quantity - order.filledQuantity;
      const unfrozenAmount = Number((order.targetPrice * unfilledQuantity).toFixed(2));

      if (unfrozenAmount > 0) {
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

        balance.availableBalance = Number((availableBefore + unfrozenAmount).toFixed(2));
        balance.frozenBalance = Number((frozenBefore - unfrozenAmount).toFixed(2));

        await queryRunner.manager.save(balance);

        // 5. 记录资金流水
        const transaction = queryRunner.manager.create(AccountTransaction, {
          userId,
          type: TransactionType.FUNDING,
          amount: unfrozenAmount,
          balanceBefore: availableBefore,
          balanceAfter: balance.availableBalance,
          relatedOrderId: order.id,
          description: `撤销委托解冻资金 ${drug?.name || ''} ${unfilledQuantity}盒 @ ${order.targetPrice}元，订单号：${order.orderNo}`,
        });

        await queryRunner.manager.save(transaction);
      }

      // 6. 更新委托单状态
      order.status = PendingOrderStatus.CANCELLED;
      order.frozenAmount = Number(((order.filledQuantity * order.targetPrice)).toFixed(2));

      const savedOrder = await queryRunner.manager.save(order);

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
   * 获取活跃委托数量（pending + partial）
   */
  async getActiveCount(userId: string): Promise<number> {
    const count = await this.pendingOrderRepository.count({
      where: {
        userId,
        status: In([PendingOrderStatus.PENDING, PendingOrderStatus.PARTIAL]),
      },
    });

    return count;
  }

  /**
   * 管理员获取所有委托订单列表
   */
  async getAdminPendingOrders(options: {
    status?: PendingOrderStatus;
    page?: number;
    pageSize?: number;
  } = {}) {
    const { status, page = 1, pageSize = 10 } = options;

    const queryBuilder = this.pendingOrderRepository
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

    const total = await queryBuilder.getCount();

    const orders = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
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
        type: order.type,
        targetPrice: Number(order.targetPrice),
        quantity: order.quantity,
        filledQuantity: order.filledQuantity,
        frozenAmount: Number(order.frozenAmount),
        status: order.status,
        expireAt: order.expireAt,
        triggeredAt: order.triggeredAt,
        fundingOrderId: order.fundingOrderId,
        createdAt: order.createdAt,
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
   * 管理员强制撤单
   */
  async adminCancelOrder(orderId: string): Promise<PendingOrder> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 查询委托单（带锁）- 不校验 userId
      const order = await queryRunner.manager.findOne(PendingOrder, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('委托订单不存在');
      }

      // 单独查询关联的 drug
      const drug = await queryRunner.manager.findOne(Drug, {
        where: { id: order.drugId },
      });

      // 2. 校验状态
      if (![PendingOrderStatus.PENDING, PendingOrderStatus.PARTIAL].includes(order.status)) {
        throw new BadRequestException('该委托单当前状态不可撤销');
      }

      // 3. 计算需要解冻的金额
      const unfilledQuantity = order.quantity - order.filledQuantity;
      const unfrozenAmount = Number((order.targetPrice * unfilledQuantity).toFixed(2));

      if (unfrozenAmount > 0) {
        // 4. 解冻资金
        const balance = await queryRunner.manager.findOne(AccountBalance, {
          where: { userId: order.userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!balance) {
          throw new NotFoundException('账户不存在');
        }

        const availableBefore = Number(balance.availableBalance);
        const frozenBefore = Number(balance.frozenBalance);

        balance.availableBalance = Number((availableBefore + unfrozenAmount).toFixed(2));
        balance.frozenBalance = Number((frozenBefore - unfrozenAmount).toFixed(2));

        await queryRunner.manager.save(balance);

        // 5. 记录资金流水
        const transaction = queryRunner.manager.create(AccountTransaction, {
          userId: order.userId,
          type: TransactionType.FUNDING,
          amount: unfrozenAmount,
          balanceBefore: availableBefore,
          balanceAfter: balance.availableBalance,
          relatedOrderId: order.id,
          description: `管理员强制撤销委托解冻资金 ${drug?.name || ''} ${unfilledQuantity}盒 @ ${order.targetPrice}元，订单号：${order.orderNo}`,
        });

        await queryRunner.manager.save(transaction);
      }

      // 6. 更新委托单状态
      order.status = PendingOrderStatus.CANCELLED;
      order.frozenAmount = Number(((order.filledQuantity * order.targetPrice)).toFixed(2));

      const savedOrder = await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();

      // 记录审计日志 - 强制撤单
      await this.auditService.log({
        action: 'FORCE_CANCEL',
        targetType: 'pending_order',
        targetId: orderId,
        detail: {
          orderNo: order.orderNo,
          userId: order.userId,
          drugId: order.drugId,
          unfrozenAmount: unfrozenAmount,
        },
      });

      return savedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 管理员获取委托统计
   */
  async getAdminStats() {
    // 统计各状态委托数量
    const pendingCount = await this.pendingOrderRepository.count({
      where: { status: PendingOrderStatus.PENDING },
    });

    const triggeredCount = await this.pendingOrderRepository.count({
      where: { status: PendingOrderStatus.TRIGGERED },
    });

    const cancelledCount = await this.pendingOrderRepository.count({
      where: { status: PendingOrderStatus.CANCELLED },
    });

    const expiredCount = await this.pendingOrderRepository.count({
      where: { status: PendingOrderStatus.EXPIRED },
    });

    // 统计总冻结金额（pending状态的 frozenAmount 之和）
    const frozenResult = await this.pendingOrderRepository
      .createQueryBuilder('order')
      .select('SUM(order.frozenAmount)', 'total')
      .where('order.status = :status', { status: PendingOrderStatus.PENDING })
      .getRawOne();

    const totalFrozenAmount = Number(frozenResult?.total || 0);

    return {
      pendingCount,
      triggeredCount,
      cancelledCount,
      expiredCount,
      totalFrozenAmount,
    };
  }

  /**
   * 测试触发委托单（仅用于调试）
   */
  async testTriggerPendingOrders(drugId: string): Promise<any> {
    console.log(`[TestTrigger] 开始测试触发药品 ${drugId} 的委托单`);

    // 查询该药品的pending委托单
    const pendingOrders = await this.pendingOrderRepository.find({
      where: {
        drugId,
        status: PendingOrderStatus.PENDING,
      },
      order: {
        createdAt: 'ASC',
      },
    });

    console.log(`[TestTrigger] 找到 ${pendingOrders.length} 个pending委托单`);

    // 获取药品当前价格
    const drug = await this.drugRepository.findOne({ where: { id: drugId } });
    if (!drug) {
      return { error: '药品不存在' };
    }

    console.log(`[TestTrigger] 药品当前进货价: ${drug.purchasePrice}, 类型: ${typeof drug.purchasePrice}`);

    const results = [];
    for (const order of pendingOrders) {
      const targetPrice = Number(order.targetPrice);
      const currentPrice = Number(drug.purchasePrice);

      console.log(`[TestTrigger] 委托单 ${order.orderNo}: targetPrice=${targetPrice}(${typeof targetPrice}), currentPrice=${currentPrice}(${typeof currentPrice})`);
      console.log(`[TestTrigger] 触发条件检查: ${currentPrice} <= ${targetPrice} = ${currentPrice <= targetPrice}`);

      results.push({
        orderNo: order.orderNo,
        targetPrice,
        currentPrice,
        shouldTrigger: currentPrice <= targetPrice,
        status: order.status,
      });
    }

    return {
      drugId,
      currentPrice: Number(drug.purchasePrice),
      pendingOrders: results,
    };
  }
}
