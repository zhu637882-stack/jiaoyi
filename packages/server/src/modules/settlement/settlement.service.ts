import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Between } from 'typeorm';
import { Settlement, SettlementStatus } from '../../database/entities/settlement.entity';
import {
  SubscriptionOrder,
  SubscriptionOrderStatus,
} from '../../database/entities/subscription-order.entity';
import { DailySales } from '../../database/entities/daily-sales.entity';
import { Drug } from '../../database/entities/drug.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import {
  AccountTransaction,
  TransactionType,
} from '../../database/entities/account-transaction.entity';

// 清算订单明细（用于记录退回详情）
export interface SettlementOrderDetail {
  orderId: string;
  orderNo: string;
  userId: string;
  returnedQuantity: number;      // 当日退回数量
  returnedPrincipal: number;     // 当日退回本金
  profitShare: number;           // 当日分润
  lossShare: number;             // 当日亏损分摊
}

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    @InjectRepository(Settlement)
    private settlementRepository: Repository<Settlement>,
    @InjectRepository(SubscriptionOrder)
    private subscriptionOrderRepository: Repository<SubscriptionOrder>,
    @InjectRepository(DailySales)
    private dailySalesRepository: Repository<DailySales>,
    @InjectRepository(Drug)
    private drugRepository: Repository<Drug>,
    @InjectRepository(AccountBalance)
    private accountBalanceRepository: Repository<AccountBalance>,
    @InjectRepository(AccountTransaction)
    private accountTransactionRepository: Repository<AccountTransaction>,
    private dataSource: DataSource,
  ) {}

  /**
   * 执行日清日结清算（核心方法）
   * 新清算公式：可分配收益 = 销售额 - 采购成本 - 运营费用
   * 份额FIFO自动退回 + 30:70收益分配/亏损共担
   */
  async executeSettlement(
    drugId: string,
    settlementDateStr: string,
    isManual: boolean = false,  // 标记是否为手动清算
  ): Promise<{
    settlement: Settlement;
    orderDetails: SettlementOrderDetail[];
  }> {
    const settlementDate = new Date(settlementDateStr);

    // 使用事务保证原子性
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ========== 前置校验 ==========

      // 1. 校验药品是否存在
      const drug = await queryRunner.manager.findOne(Drug, {
        where: { id: drugId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!drug) {
        throw new NotFoundException('药品不存在');
      }

      // 2. 检查是否已清算
      const existingSettlement = await queryRunner.manager.findOne(Settlement, {
        where: {
          drugId,
          settlementDate,
          status: SettlementStatus.COMPLETED,
        },
      });

      if (existingSettlement) {
        throw new BadRequestException(
          `该药品在 ${settlementDateStr} 已完成清算，不能重复清算`,
        );
      }

      // 3. 查询当日销售数据
      const sales = await queryRunner.manager.find(DailySales, {
        where: { drugId, saleDate: settlementDate },
      });

      // 无销售数据时返回零值清算结果（手动清算场景）
      if (sales.length === 0) {
        await queryRunner.commitTransaction();
        this.logger.log(
          `清算跳过：药品 ${drug.name}，日期 ${settlementDateStr}，无销售数据`
        );
        return {
          settlement: null as any,
          orderDetails: [],
        };
      }

      // ========== 第一步：汇总当日销售数据 ==========
      let totalSalesQuantity = 0;
      let totalSalesRevenue = 0;

      for (const sale of sales) {
        totalSalesQuantity += sale.quantity;
        totalSalesRevenue += Number(sale.totalRevenue);
      }

      totalSalesRevenue = Number(totalSalesRevenue.toFixed(2));

      // ========== 第二步：计算成本和费用 ==========
      // 采购成本 = 销售数量 × 采购单价
      const purchaseCost = Number(
        (totalSalesQuantity * drug.purchasePrice).toFixed(2),
      );
      
      // 运营费用 = 销售额 × 运营费用比例
      const operationFees = Number(
        (totalSalesRevenue * drug.operationFeeRate).toFixed(2),
      );

      // ========== 第三步：份额FIFO自动退回 ==========
      const orderDetails: SettlementOrderDetail[] = [];
      let remainingQuantity = totalSalesQuantity;  // 剩余可退数量
      let totalReturnedPrincipal = 0;              // 当日退回总本金
      let settledOrderCount = 0;                   // 参与订单数

      // 查询所有生效中的认购订单，按 effectiveAt ASC 排序（先认先退）
      const activeOrders = await queryRunner.manager.find(SubscriptionOrder, {
        where: {
          drugId,
          status: In([SubscriptionOrderStatus.EFFECTIVE, SubscriptionOrderStatus.PARTIAL_RETURNED]),
        },
        order: { effectiveAt: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });

      for (const order of activeOrders) {
        if (remainingQuantity <= 0) break;

        // 计算该订单可退回数量
        const returnableQuantity = order.quantity - order.settledQuantity;
        const returnQuantity = Math.min(returnableQuantity, remainingQuantity);

        if (returnQuantity <= 0) continue;

        // 计算退回金额（按订单单价计算）
        const unitPrice = Number(order.amount) / order.quantity;
        const returnAmount = Number((returnQuantity * unitPrice).toFixed(2));

        // 更新订单状态
        order.settledQuantity += returnQuantity;
        order.unsettledAmount = Number(
          (Number(order.unsettledAmount) - returnAmount).toFixed(2),
        );

        // 判断订单是否全部退回
        if (order.settledQuantity >= order.quantity) {
          order.status = SubscriptionOrderStatus.RETURNED;
          order.returnedAt = new Date();
        } else {
          order.status = SubscriptionOrderStatus.PARTIAL_RETURNED;
        }

        await queryRunner.manager.save(order);

        // 退回本金到用户账户（解冻）
        const balance = await queryRunner.manager.findOne(AccountBalance, {
          where: { userId: order.userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (balance) {
          const availableBefore = Number(balance.availableBalance);
          const frozenBefore = Number(balance.frozenBalance);

          balance.availableBalance = Number(
            (availableBefore + returnAmount).toFixed(2),
          );
          balance.frozenBalance = Number(
            (frozenBefore - returnAmount).toFixed(2),
          );

          await queryRunner.manager.save(balance);

          // 记录资金流水 - 本金退回
          const transaction = queryRunner.manager.create(AccountTransaction, {
            userId: order.userId,
            type: TransactionType.PRINCIPAL_RETURN,
            amount: returnAmount,
            balanceBefore: availableBefore,
            balanceAfter: balance.availableBalance,
            relatedOrderId: order.id,
            description: `份额退回：${drug.name} ${returnQuantity}盒，金额 ${returnAmount}元`,
          });

          await queryRunner.manager.save(transaction);
        }

        orderDetails.push({
          orderId: order.id,
          orderNo: order.orderNo,
          userId: order.userId,
          returnedQuantity: returnQuantity,
          returnedPrincipal: returnAmount,
          profitShare: 0,
          lossShare: 0,
        });

        remainingQuantity -= returnQuantity;
        totalReturnedPrincipal += returnAmount;
        settledOrderCount++;
      }

      // ========== 第四步：计算净利润/亏损 ==========
      // 净利润 = 销售额 - 采购成本 - 运营费用
      const netProfit = Number(
        (totalSalesRevenue - purchaseCost - operationFees).toFixed(2),
      );

      const isProfit = netProfit > 0;
      const profitAmount = isProfit ? netProfit : 0;
      const lossAmount = isProfit ? 0 : Math.abs(netProfit);

      // ========== 第五步：30:70 分润/共担 ==========
      let investorProfitShare = 0;
      let platformProfitShare = 0;
      let investorLossShare = 0;
      let platformLossShare = 0;

      // 计算总参与本金（当日退回的 + 仍生效的）
      const returnedPrincipalFromDetails = orderDetails.reduce(
        (sum, detail) => sum + detail.returnedPrincipal,
        0,
      );

      // 重新查询仍生效的订单
      const remainingActiveOrders = await queryRunner.manager.find(SubscriptionOrder, {
        where: {
          drugId,
          status: In([SubscriptionOrderStatus.EFFECTIVE, SubscriptionOrderStatus.PARTIAL_RETURNED]),
        },
      });

      const totalRemainingPrincipal = remainingActiveOrders.reduce(
        (sum, order) => sum + Number(order.unsettledAmount),
        0,
      );

      // 总参与分配的本金 = 当日退回本金 + 仍生效的本金
      const totalPrincipalForSharing = returnedPrincipalFromDetails + totalRemainingPrincipal;

      if (isProfit && profitAmount > 0 && totalPrincipalForSharing > 0) {
        // 盈利时：合作方（用户）30%，平台 70%
        investorProfitShare = Number((profitAmount * 0.3).toFixed(2));
        platformProfitShare = Number((profitAmount * 0.7).toFixed(2));

        // 1. 给当日退回的订单分配分润
        for (const detail of orderDetails) {
          if (detail.returnedPrincipal <= 0) continue;

          const shareRatio = totalPrincipalForSharing > 0
            ? detail.returnedPrincipal / totalPrincipalForSharing
            : 0;
          const orderProfitShare = Number(
            (investorProfitShare * shareRatio).toFixed(2),
          );

          if (orderProfitShare > 0) {
            // 更新订单累计收益
            const order = await queryRunner.manager.findOne(SubscriptionOrder, {
              where: { id: detail.orderId },
              lock: { mode: 'pessimistic_write' },
            });
            if (order) {
              order.totalProfit = Number(
                (Number(order.totalProfit) + orderProfitShare).toFixed(2),
              );
              await queryRunner.manager.save(order);
            }

            // 分润加到用户可用余额
            const balance = await queryRunner.manager.findOne(AccountBalance, {
              where: { userId: detail.userId },
              lock: { mode: 'pessimistic_write' },
            });

            if (balance) {
              const availableBefore = Number(balance.availableBalance);
              balance.availableBalance = Number(
                (availableBefore + orderProfitShare).toFixed(2),
              );
              balance.totalProfit = Number(
                (Number(balance.totalProfit) + orderProfitShare).toFixed(2),
              );

              await queryRunner.manager.save(balance);

              // 记录资金流水 - 收益分成
              const transaction = queryRunner.manager.create(
                AccountTransaction,
                {
                  userId: detail.userId,
                  type: TransactionType.PROFIT_SHARE,
                  amount: orderProfitShare,
                  balanceBefore: availableBefore,
                  balanceAfter: balance.availableBalance,
                  relatedOrderId: detail.orderId,
                  description: `收益分成：${drug.name}，金额 ${orderProfitShare}元`,
                },
              );

              await queryRunner.manager.save(transaction);
            }

            detail.profitShare = orderProfitShare;
          }
        }

        // 2. 给仍生效的订单分配分润（只记录，不解冻）
        for (const order of remainingActiveOrders) {
          const orderUnsettled = Number(order.unsettledAmount);
          const shareRatio = totalPrincipalForSharing > 0
            ? orderUnsettled / totalPrincipalForSharing
            : 0;
          const orderProfitShare = Number(
            (investorProfitShare * shareRatio).toFixed(2),
          );

          if (orderProfitShare > 0) {
            // 更新订单累计收益
            order.totalProfit = Number(
              (Number(order.totalProfit) + orderProfitShare).toFixed(2),
            );
            await queryRunner.manager.save(order);

            // 分润加到用户可用余额
            const balance = await queryRunner.manager.findOne(AccountBalance, {
              where: { userId: order.userId },
              lock: { mode: 'pessimistic_write' },
            });

            if (balance) {
              const availableBefore = Number(balance.availableBalance);
              balance.availableBalance = Number(
                (availableBefore + orderProfitShare).toFixed(2),
              );
              balance.totalProfit = Number(
                (Number(balance.totalProfit) + orderProfitShare).toFixed(2),
              );

              await queryRunner.manager.save(balance);

              // 记录资金流水 - 收益分成
              const transaction = queryRunner.manager.create(
                AccountTransaction,
                {
                  userId: order.userId,
                  type: TransactionType.PROFIT_SHARE,
                  amount: orderProfitShare,
                  balanceBefore: availableBefore,
                  balanceAfter: balance.availableBalance,
                  relatedOrderId: order.id,
                  description: `收益分成：${drug.name}，金额 ${orderProfitShare}元`,
                },
              );

              await queryRunner.manager.save(transaction);
            }

            // 更新订单明细
            const detail = orderDetails.find((d) => d.orderId === order.id);
            if (detail) {
              detail.profitShare = (detail.profitShare || 0) + orderProfitShare;
            } else {
              orderDetails.push({
                orderId: order.id,
                orderNo: order.orderNo,
                userId: order.userId,
                returnedQuantity: 0,
                returnedPrincipal: 0,
                profitShare: orderProfitShare,
                lossShare: 0,
              });
            }
          }
        }
      } else if (!isProfit && lossAmount > 0 && totalPrincipalForSharing > 0) {
        // 亏损时：合作方承担 30%，平台承担 70%
        investorLossShare = Number((lossAmount * 0.3).toFixed(2));
        platformLossShare = Number((lossAmount * 0.7).toFixed(2));

        // 1. 给当日退回的订单分摊亏损
        for (const detail of orderDetails) {
          if (detail.returnedPrincipal <= 0) continue;

          const shareRatio = totalPrincipalForSharing > 0
            ? detail.returnedPrincipal / totalPrincipalForSharing
            : 0;
          const orderLossShare = Number(
            (investorLossShare * shareRatio).toFixed(2),
          );

          if (orderLossShare > 0) {
            // 更新订单累计亏损
            const order = await queryRunner.manager.findOne(SubscriptionOrder, {
              where: { id: detail.orderId },
              lock: { mode: 'pessimistic_write' },
            });
            if (order) {
              order.totalLoss = Number(
                (Number(order.totalLoss) + orderLossShare).toFixed(2),
              );
              await queryRunner.manager.save(order);

              // 从用户可用余额中扣除亏损（优先从服务酬劳抵扣）
              const balance = await queryRunner.manager.findOne(AccountBalance, {
                where: { userId: detail.userId },
                lock: { mode: 'pessimistic_write' },
              });

              if (balance) {
                const availableBefore = Number(balance.availableBalance);
                // 计算实际可扣除金额（余额不足时扣到0为止）
                const actualDeduction = Math.min(availableBefore, orderLossShare);
                const remainingLoss = Number((orderLossShare - actualDeduction).toFixed(2));

                // 扣除余额
                balance.availableBalance = Number(
                  (availableBefore - actualDeduction).toFixed(2),
                );
                await queryRunner.manager.save(balance);

                // 构建描述信息
                let description = `亏损分摊：${drug.name}，金额 ${orderLossShare}元`;
                if (remainingLoss > 0) {
                  description += `（其中${remainingLoss}元待抵扣，余额不足）`;
                }

                const transaction = queryRunner.manager.create(
                  AccountTransaction,
                  {
                    userId: detail.userId,
                    type: TransactionType.LOSS_SHARE,
                    amount: -actualDeduction,
                    balanceBefore: availableBefore,
                    balanceAfter: balance.availableBalance,
                    relatedOrderId: detail.orderId,
                    description,
                  },
                );

                await queryRunner.manager.save(transaction);
              }
            }

            detail.lossShare = orderLossShare;
          }
        }

        // 2. 给仍生效的订单分摊亏损
        for (const order of remainingActiveOrders) {
          const orderUnsettled = Number(order.unsettledAmount);
          const shareRatio = totalPrincipalForSharing > 0
            ? orderUnsettled / totalPrincipalForSharing
            : 0;
          const orderLossShare = Number(
            (investorLossShare * shareRatio).toFixed(2),
          );

          if (orderLossShare > 0) {
            // 更新订单累计亏损
            order.totalLoss = Number(
              (Number(order.totalLoss) + orderLossShare).toFixed(2),
            );
            await queryRunner.manager.save(order);

            // 从用户可用余额中扣除亏损
            const balance = await queryRunner.manager.findOne(AccountBalance, {
              where: { userId: order.userId },
              lock: { mode: 'pessimistic_write' },
            });

            if (balance) {
              const availableBefore = Number(balance.availableBalance);
              // 计算实际可扣除金额（余额不足时扣到0为止）
              const actualDeduction = Math.min(availableBefore, orderLossShare);
              const remainingLoss = Number((orderLossShare - actualDeduction).toFixed(2));

              // 扣除余额
              balance.availableBalance = Number(
                (availableBefore - actualDeduction).toFixed(2),
              );
              await queryRunner.manager.save(balance);

              // 构建描述信息
              let description = `亏损分摊：${drug.name}，金额 ${orderLossShare}元`;
              if (remainingLoss > 0) {
                description += `（其中${remainingLoss}元待抵扣，余额不足）`;
              }

              const transaction = queryRunner.manager.create(
                AccountTransaction,
                {
                  userId: order.userId,
                  type: TransactionType.LOSS_SHARE,
                  amount: -actualDeduction,
                  balanceBefore: availableBefore,
                  balanceAfter: balance.availableBalance,
                  relatedOrderId: order.id,
                  description,
                },
              );

              await queryRunner.manager.save(transaction);
            }

            // 更新订单明细
            const detail = orderDetails.find((d) => d.orderId === order.id);
            if (detail) {
              detail.lossShare = (detail.lossShare || 0) + orderLossShare;
            } else {
              orderDetails.push({
                orderId: order.id,
                orderNo: order.orderNo,
                userId: order.userId,
                returnedQuantity: 0,
                returnedPrincipal: 0,
                profitShare: 0,
                lossShare: orderLossShare,
              });
            }
          }
        }
      }

      // ========== 第六步：创建清算记录 ==========
      const settlement = queryRunner.manager.create(Settlement, {
        drugId,
        settlementDate,
        totalSalesQuantity,
        totalSalesRevenue,
        totalCost: purchaseCost,
        totalFees: 0,  // 旧字段，保持兼容
        operationFees: operationFees,
        netProfit,
        investorProfitShare,
        platformProfitShare,
        investorLossShare,
        platformLossShare,
        returnedPrincipal: totalReturnedPrincipal,
        settledOrderCount,
        status: SettlementStatus.COMPLETED,
      });

      const savedSettlement = await queryRunner.manager.save(settlement);

      // 更新订单明细中的 settlementId（加入时间范围条件避免关联历史交易）
      const settlementDateStart = new Date(settlementDate);
      settlementDateStart.setHours(0, 0, 0, 0);
      const settlementDateEnd = new Date(settlementDate);
      settlementDateEnd.setHours(23, 59, 59, 999);

      for (const detail of orderDetails) {
        await queryRunner.manager.update(
          AccountTransaction,
          {
            relatedOrderId: detail.orderId,
            createdAt: Between(settlementDateStart, settlementDateEnd),
            type: In([
              TransactionType.PRINCIPAL_RETURN,
              TransactionType.PROFIT_SHARE,
              TransactionType.LOSS_SHARE,
            ]),
          },
          { relatedSettlementId: savedSettlement.id },
        );
      }

      // 提交事务
      await queryRunner.commitTransaction();

      this.logger.log(
        `清算完成：药品 ${drug.name}，日期 ${settlementDateStr}，` +
        `销售额 ${totalSalesRevenue}，净利润 ${netProfit}，` +
        `退回本金 ${totalReturnedPrincipal}，参与订单 ${settledOrderCount}` +
        `${isManual ? ' [手动清算]' : ''}`
      );

      return {
        settlement: savedSettlement,
        orderDetails,
      };
    } catch (error) {
      // 回滚事务
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `清算失败：药品 ${drugId}，日期 ${settlementDateStr}，错误：${error.message}`
      );
      throw error;
    } finally {
      // 释放查询运行器
      await queryRunner.release();
    }
  }

  /**
   * 获取清算预览（执行清算前查看预计结果）
   */
  async getSettlementPreview(drugId: string, dateStr: string) {
    const date = new Date(dateStr);

    // 1. 校验药品是否存在
    const drug = await this.drugRepository.findOne({
      where: { id: drugId },
    });

    if (!drug) {
      throw new NotFoundException('药品不存在');
    }

    // 2. 检查是否已清算
    const existingSettlement = await this.settlementRepository.findOne({
      where: {
        drugId,
        settlementDate: date,
        status: SettlementStatus.COMPLETED,
      },
    });

    if (existingSettlement) {
      throw new BadRequestException(
        `该药品在 ${dateStr} 已完成清算，不能重复清算`,
      );
    }

    // 3. 查询当日销售数据
    const sales = await this.dailySalesRepository.find({
      where: { drugId, saleDate: date },
    });

    if (sales.length === 0) {
      throw new BadRequestException(
        `${dateStr} 没有销售记录，无法清算`,
      );
    }

    // 4. 汇总销售数据
    let totalSalesQuantity = 0;
    let totalSalesRevenue = 0;

    for (const sale of sales) {
      totalSalesQuantity += sale.quantity;
      totalSalesRevenue += Number(sale.totalRevenue);
    }

    // 5. 计算成本和费用
    const purchaseCost = totalSalesQuantity * drug.purchasePrice;
    const operationFees = totalSalesRevenue * drug.operationFeeRate;

    // 6. 计算预计退回订单
    const activeOrders = await this.subscriptionOrderRepository.find({
      where: {
        drugId,
        status: In([SubscriptionOrderStatus.EFFECTIVE, SubscriptionOrderStatus.PARTIAL_RETURNED]),
      },
      order: { effectiveAt: 'ASC' },
      relations: ['user'],
    });

    let remainingQuantity = totalSalesQuantity;
    const estimatedReturns: Array<{
      orderId: string;
      orderNo: string;
      userId: string;
      username: string;
      totalQuantity: number;
      settledQuantity: number;
      returnableQuantity: number;
      estimatedReturnQuantity: number;
      estimatedReturnAmount: number;
    }> = [];

    for (const order of activeOrders) {
      if (remainingQuantity <= 0) break;

      const returnableQuantity = order.quantity - order.settledQuantity;
      const returnQuantity = Math.min(returnableQuantity, remainingQuantity);

      if (returnQuantity > 0) {
        const unitPrice = Number(order.amount) / order.quantity;
        estimatedReturns.push({
          orderId: order.id,
          orderNo: order.orderNo,
          userId: order.userId,
          username: order.user?.username || '',
          totalQuantity: order.quantity,
          settledQuantity: order.settledQuantity,
          returnableQuantity,
          estimatedReturnQuantity: returnQuantity,
          estimatedReturnAmount: Number(
            (returnQuantity * unitPrice).toFixed(2),
          ),
        });

        remainingQuantity -= returnQuantity;
      }
    }

    // 7. 计算预计净利润/亏损
    const estimatedNetProfit = Number(
      (totalSalesRevenue - purchaseCost - operationFees).toFixed(2),
    );

    const isProfit = estimatedNetProfit > 0;
    const investorShare = isProfit
      ? Number((estimatedNetProfit * 0.3).toFixed(2))
      : Number((Math.abs(estimatedNetProfit) * 0.3).toFixed(2));
    const platformShare = isProfit
      ? Number((estimatedNetProfit * 0.7).toFixed(2))
      : Number((-Math.abs(estimatedNetProfit) * 0.7).toFixed(2));

    return {
      drugId,
      drugName: drug.name,
      date: dateStr,
      salesSummary: {
        totalQuantity: totalSalesQuantity,
        totalRevenue: Number(totalSalesRevenue.toFixed(2)),
        terminalCount: sales.length,
      },
      costSummary: {
        purchaseCost: Number(purchaseCost.toFixed(2)),
        operationFees: Number(operationFees.toFixed(2)),
      },
      estimatedReturns,
      estimatedUnsettledQuantity: remainingQuantity,
      estimatedProfit: {
        netProfit: estimatedNetProfit,
        isProfit,
        investorShare,
        platformShare,
      },
    };
  }

  /**
   * 获取清算记录列表
   */
  async getSettlements(options: {
    drugId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { drugId, startDate, endDate, page = 1, pageSize = 10 } = options;

    const queryBuilder = this.settlementRepository
      .createQueryBuilder('settlement')
      .leftJoinAndSelect('settlement.drug', 'drug')
      .orderBy('settlement.settlementDate', 'DESC')
      .addOrderBy('settlement.createdAt', 'DESC');

    if (drugId) {
      queryBuilder.andWhere('settlement.drugId = :drugId', { drugId });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'settlement.settlementDate BETWEEN :startDate AND :endDate',
        {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        },
      );
    } else if (startDate) {
      queryBuilder.andWhere('settlement.settlementDate >= :startDate', {
        startDate: new Date(startDate),
      });
    } else if (endDate) {
      queryBuilder.andWhere('settlement.settlementDate <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    const total = await queryBuilder.getCount();

    const settlements = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return {
      list: settlements.map((s) => ({
        id: s.id,
        drugId: s.drugId,
        drugName: s.drug?.name,
        drugCode: s.drug?.code,
        settlementDate: s.settlementDate,
        totalSalesQuantity: s.totalSalesQuantity || 0,
        totalSalesRevenue: Number(s.totalSalesRevenue),
        totalCost: Number(s.totalCost),
        operationFees: Number(s.operationFees || 0),
        netProfit: Number(s.netProfit),
        investorProfitShare: Number(s.investorProfitShare),
        platformProfitShare: Number(s.platformProfitShare),
        investorLossShare: Number(s.investorLossShare),
        platformLossShare: Number(s.platformLossShare),
        returnedPrincipal: Number(s.returnedPrincipal || 0),
        settledOrderCount: s.settledOrderCount,
        status: s.status,
        createdAt: s.createdAt,
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
   * 获取清算详情
   */
  async getSettlementDetail(id: string) {
    const settlement = await this.settlementRepository.findOne({
      where: { id },
      relations: ['drug'],
    });

    if (!settlement) {
      throw new NotFoundException('清算记录不存在');
    }

    // 获取相关交易流水（退回、分润、亏损）
    const transactions = await this.accountTransactionRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.user', 'user')
      .where('t.relatedSettlementId = :settlementId', { settlementId: id })
      .orderBy('t.createdAt', 'ASC')
      .getMany();

    // 获取退回订单明细（通过交易流水关联的订单）
    const orderIds = [...new Set(transactions
      .filter((t) => t.relatedOrderId)
      .map((t) => t.relatedOrderId))];

    let orderDetails: SubscriptionOrder[] = [];
    if (orderIds.length > 0) {
      orderDetails = await this.subscriptionOrderRepository
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.user', 'user')
        .where('order.id IN (:...orderIds)', { orderIds })
        .getMany();
    }

    return {
      settlement: {
        id: settlement.id,
        drugId: settlement.drugId,
        drugName: settlement.drug?.name,
        drugCode: settlement.drug?.code,
        settlementDate: settlement.settlementDate,
        totalSalesQuantity: settlement.totalSalesQuantity || 0,
        totalSalesRevenue: Number(settlement.totalSalesRevenue),
        totalCost: Number(settlement.totalCost),
        operationFees: Number(settlement.operationFees || 0),
        netProfit: Number(settlement.netProfit),
        investorProfitShare: Number(settlement.investorProfitShare),
        platformProfitShare: Number(settlement.platformProfitShare),
        investorLossShare: Number(settlement.investorLossShare),
        platformLossShare: Number(settlement.platformLossShare),
        returnedPrincipal: Number(settlement.returnedPrincipal || 0),
        settledOrderCount: settlement.settledOrderCount,
        status: settlement.status,
        createdAt: settlement.createdAt,
      },
      orderDetails: orderDetails.map((o) => ({
        orderId: o.id,
        orderNo: o.orderNo,
        userId: o.userId,
        username: o.user?.username,
        quantity: o.quantity,
        settledQuantity: o.settledQuantity,
        amount: Number(o.amount),
        unsettledAmount: Number(o.unsettledAmount),
        totalProfit: Number(o.totalProfit),
        totalLoss: Number(o.totalLoss),
        status: o.status,
      })),
      transactions: transactions.map((t) => ({
        id: t.id,
        userId: t.userId,
        username: t.user?.username,
        type: t.type,
        amount: Number(t.amount),
        description: t.description,
        createdAt: t.createdAt,
      })),
    };
  }

  /**
   * 获取清算汇总统计
   */
  async getSettlementSummary() {
    // 总清算次数
    const totalCount = await this.settlementRepository.count({
      where: { status: SettlementStatus.COMPLETED },
    });

    // 总销售额、总利润、总亏损
    const stats = await this.settlementRepository
      .createQueryBuilder('s')
      .select('SUM(s.totalSalesRevenue)', 'totalSalesRevenue')
      .addSelect('SUM(s.netProfit)', 'totalNetProfit')
      .addSelect('SUM(s.investorProfitShare)', 'totalInvestorProfit')
      .addSelect('SUM(s.investorLossShare)', 'totalInvestorLoss')
      .addSelect('SUM(s.returnedPrincipal)', 'totalReturnedPrincipal')
      .where('s.status = :status', { status: SettlementStatus.COMPLETED })
      .getRawOne();

    const totalSalesRevenue = Number(stats?.totalSalesRevenue || 0);
    const totalNetProfit = Number(stats?.totalNetProfit || 0);
    const totalInvestorProfit = Number(stats?.totalInvestorProfit || 0);
    const totalInvestorLoss = Number(stats?.totalInvestorLoss || 0);
    const totalReturnedPrincipal = Number(stats?.totalReturnedPrincipal || 0);

    return {
      totalSettlementCount: totalCount,
      totalSalesRevenue,
      totalNetProfit,
      totalProfit: totalNetProfit > 0 ? totalNetProfit : 0,
      totalLoss: totalNetProfit < 0 ? Math.abs(totalNetProfit) : 0,
      totalInvestorProfit,
      totalInvestorLoss,
      investorNetProfit: Number(
        (totalInvestorProfit - totalInvestorLoss).toFixed(2),
      ),
      totalReturnedPrincipal,
    };
  }

  /**
   * 获取用户的清算记录（合作方视角）
   */
  async getUserSettlements(
    userId: string,
    options: {
      page?: number;
      pageSize?: number;
    },
  ) {
    const { page = 1, pageSize = 10 } = options;

    // 获取用户有参与的药品ID
    const userDrugIds = await this.subscriptionOrderRepository
      .createQueryBuilder('order')
      .select('DISTINCT order.drugId', 'drugId')
      .where('order.userId = :userId', { userId })
      .getRawMany();

    const drugIds = userDrugIds.map((d) => d.drugId);

    if (drugIds.length === 0) {
      return {
        list: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0,
        },
      };
    }

    // 查询这些药品的清算记录
    const queryBuilder = this.settlementRepository
      .createQueryBuilder('settlement')
      .leftJoinAndSelect('settlement.drug', 'drug')
      .where('settlement.drugId IN (:...drugIds)', { drugIds })
      .andWhere('settlement.status = :status', {
        status: SettlementStatus.COMPLETED,
      })
      .orderBy('settlement.settlementDate', 'DESC');

    const total = await queryBuilder.getCount();

    const settlements = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    // 获取用户在这些清算中的明细
    const result = await Promise.all(
      settlements.map(async (s) => {
        // 获取用户当日的交易记录
        let transactions = await this.accountTransactionRepository
          .createQueryBuilder('t')
          .where('t.userId = :userId', { userId })
          .andWhere('t.relatedSettlementId = :settlementId', {
            settlementId: s.id,
          })
          .getMany();

        // 如果没有找到关联的交易记录，尝试通过订单关联匹配（兼容历史数据）
        if (transactions.length === 0) {
          const settlementDate = new Date(s.settlementDate);
          const startDate = new Date(settlementDate);
          startDate.setDate(startDate.getDate() - 1);
          const endDate = new Date(settlementDate);
          endDate.setDate(endDate.getDate() + 2);

          const allTransactions = await this.accountTransactionRepository
            .createQueryBuilder('t')
            .where('t.userId = :userId', { userId })
            .andWhere('t.createdAt >= :startDate AND t.createdAt < :endDate', {
              startDate: startDate,
              endDate: endDate,
            })
            .andWhere('t.type IN (:...types)', {
              types: [
                TransactionType.PRINCIPAL_RETURN,
                TransactionType.PROFIT_SHARE,
                TransactionType.LOSS_SHARE,
              ],
            })
            .getMany();

          // 通过 relatedOrderId 关联到订单，检查订单的药品ID是否匹配
          const orderIds = allTransactions
            .filter((t) => t.relatedOrderId)
            .map((t) => t.relatedOrderId);

          if (orderIds.length > 0) {
            const orders = await this.subscriptionOrderRepository
              .createQueryBuilder('o')
              .where('o.id IN (:...orderIds)', { orderIds })
              .andWhere('o.drugId = :drugId', { drugId: s.drugId })
              .getMany();

            const matchedOrderIds = new Set(orders.map((o) => o.id));

            transactions = allTransactions.filter((t) =>
              t.relatedOrderId && matchedOrderIds.has(t.relatedOrderId),
            );
          }
        }

        const principalReturn = transactions
          .filter((t) => t.type === TransactionType.PRINCIPAL_RETURN)
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const profitShare = transactions
          .filter((t) => t.type === TransactionType.PROFIT_SHARE)
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const lossShare = transactions
          .filter((t) => t.type === TransactionType.LOSS_SHARE)
          .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

        return {
          id: s.id,
          drugId: s.drugId,
          drugName: s.drug?.name,
          drugCode: s.drug?.code,
          settlementDate: s.settlementDate,
          totalSalesRevenue: Number(s.totalSalesRevenue),
          netProfit: Number(s.netProfit),
          myPrincipalReturn: principalReturn,
          myProfitShare: profitShare,
          myLossShare: lossShare,
          myNetIncome: Number(
            (principalReturn + profitShare - lossShare).toFixed(2),
          ),
        };
      }),
    );

    return {
      list: result,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 获取用户的清算统计（合作方视角）
   */
  async getUserSettlementStats(userId: string) {
    // 获取用户所有相关交易
    const transactions = await this.accountTransactionRepository
      .createQueryBuilder('t')
      .where('t.userId = :userId', { userId })
      .andWhere('t.type IN (:...types)', {
        types: [
          TransactionType.PRINCIPAL_RETURN,
          TransactionType.PROFIT_SHARE,
          TransactionType.LOSS_SHARE,
        ],
      })
      .getMany();

    let totalPrincipalReturn = 0;
    let totalProfitShare = 0;
    let totalLossShare = 0;

    for (const t of transactions) {
      if (t.type === TransactionType.PRINCIPAL_RETURN) {
        totalPrincipalReturn += Number(t.amount);
      } else if (t.type === TransactionType.PROFIT_SHARE) {
        totalProfitShare += Number(t.amount);
      } else if (t.type === TransactionType.LOSS_SHARE) {
        totalLossShare += Math.abs(Number(t.amount));
      }
    }

    return {
      totalPrincipalReturn: Number(totalPrincipalReturn.toFixed(2)),
      totalProfitShare: Number(totalProfitShare.toFixed(2)),
      totalLossShare: Number(totalLossShare.toFixed(2)),
      netProfit: Number(
        (totalProfitShare - totalLossShare).toFixed(2),
      ),
      totalReturn: Number(
        (totalPrincipalReturn + totalProfitShare - totalLossShare).toFixed(2),
      ),
    };
  }

  /**
   * 获取需要清算的药品列表（用于定时任务）
   * 查询所有有 EFFECTIVE/PARTIAL_RETURNED 订单的药品
   */
  async getDrugsNeedingSettlement(): Promise<string[]> {
    const result = await this.subscriptionOrderRepository
      .createQueryBuilder('order')
      .select('DISTINCT order.drugId', 'drugId')
      .where('order.status IN (:...statuses)', {
        statuses: [SubscriptionOrderStatus.EFFECTIVE, SubscriptionOrderStatus.PARTIAL_RETURNED],
      })
      .getRawMany();

    return result.map((r) => r.drugId);
  }

  /**
   * 检查药品在指定日期是否有销售数据
   */
  async hasDailySales(drugId: string, date: Date): Promise<boolean> {
    const count = await this.dailySalesRepository.count({
      where: { drugId, saleDate: date },
    });
    return count > 0;
  }
}
