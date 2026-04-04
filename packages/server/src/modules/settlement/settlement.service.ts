import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import { Settlement, SettlementStatus } from '../../database/entities/settlement.entity';
import {
  FundingOrder,
  FundingOrderStatus,
} from '../../database/entities/funding-order.entity';
import { DailySales } from '../../database/entities/daily-sales.entity';
import { Drug } from '../../database/entities/drug.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import {
  AccountTransaction,
  TransactionType,
} from '../../database/entities/account-transaction.entity';

// 清算订单明细（用于记录解套详情）
export interface SettlementOrderDetail {
  orderId: string;
  orderNo: string;
  userId: string;
  settledQuantity: number;
  settledPrincipal: number;
  profitShare: number;
  lossShare: number;
}

@Injectable()
export class SettlementService {
  constructor(
    @InjectRepository(Settlement)
    private settlementRepository: Repository<Settlement>,
    @InjectRepository(FundingOrder)
    private fundingOrderRepository: Repository<FundingOrder>,
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
   * 完整的7步清算流程，在数据库事务中执行
   */
  async executeSettlement(
    drugId: string,
    settlementDateStr: string,
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

      if (sales.length === 0) {
        throw new BadRequestException(
          `${settlementDateStr} 没有销售记录，无法清算`,
        );
      }

      // ========== 第一步：汇总当日销售数据 ==========
      let totalSalesQuantity = 0;
      let totalSalesRevenue = 0;

      for (const sale of sales) {
        totalSalesQuantity += sale.quantity;
        totalSalesRevenue += Number(sale.totalRevenue);
      }

      totalSalesRevenue = Number(totalSalesRevenue.toFixed(2));

      // ========== 第二步：计算当日成本 ==========
      const purchaseCost = Number(
        (totalSalesQuantity * drug.purchasePrice).toFixed(2),
      );
      const totalFees = Number(
        (totalSalesQuantity * drug.unitFee).toFixed(2),
      );

      // ========== 第三步：按FIFO解套垫资方本金 ==========
      const orderDetails: SettlementOrderDetail[] = [];
      let remainingQuantity = totalSalesQuantity;
      let totalSettledPrincipal = 0;
      let settledOrderCount = 0;

      // 查询所有未结清订单，按 fundedAt ASC 排序（FIFO）
      const pendingOrders = await queryRunner.manager.find(FundingOrder, {
        where: {
          drugId,
          status: Between(FundingOrderStatus.HOLDING, FundingOrderStatus.PARTIAL_SETTLED),
        },
        order: { fundedAt: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });

      for (const order of pendingOrders) {
        if (remainingQuantity <= 0) break;

        // 计算可解套数量
        const unsettledQuantity = order.quantity - order.settledQuantity;
        const settleQuantity = Math.min(unsettledQuantity, remainingQuantity);

        if (settleQuantity <= 0) continue;

        // 计算解套金额
        const settleAmount = Number(
          (settleQuantity * drug.purchasePrice).toFixed(2),
        );

        // 更新订单
        order.settledQuantity += settleQuantity;
        order.unsettledAmount = Number(
          (Number(order.unsettledAmount) - settleAmount).toFixed(2),
        );

        if (order.unsettledAmount <= 0) {
          order.status = FundingOrderStatus.SETTLED;
          order.settledAt = new Date();
        } else {
          order.status = FundingOrderStatus.PARTIAL_SETTLED;
        }

        await queryRunner.manager.save(order);

        // 返还本金到用户账户
        const balance = await queryRunner.manager.findOne(AccountBalance, {
          where: { userId: order.userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (balance) {
          const availableBefore = Number(balance.availableBalance);
          const frozenBefore = Number(balance.frozenBalance);

          balance.availableBalance = Number(
            (availableBefore + settleAmount).toFixed(2),
          );
          balance.frozenBalance = Number(
            (frozenBefore - settleAmount).toFixed(2),
          );

          await queryRunner.manager.save(balance);

          // 记录资金流水 - 本金返还
          const transaction = queryRunner.manager.create(AccountTransaction, {
            userId: order.userId,
            type: TransactionType.PRINCIPAL_RETURN,
            amount: settleAmount,
            balanceBefore: availableBefore,
            balanceAfter: balance.availableBalance,
            relatedOrderId: order.id,
            description: `解套返还本金：${drug.name} ${settleQuantity}盒，金额 ${settleAmount}元`,
          });

          await queryRunner.manager.save(transaction);
        }

        orderDetails.push({
          orderId: order.id,
          orderNo: order.orderNo,
          userId: order.userId,
          settledQuantity: settleQuantity,
          settledPrincipal: settleAmount,
          profitShare: 0,
          lossShare: 0,
        });

        remainingQuantity -= settleQuantity;
        totalSettledPrincipal += settleAmount;
        settledOrderCount++;
      }

      // ========== 第四步：计算利息 ==========
      // 重新查询所有未结清订单（包括刚刚部分解套的）
      const activeOrders = await queryRunner.manager.find(FundingOrder, {
        where: {
          drugId,
          status: Between(FundingOrderStatus.HOLDING, FundingOrderStatus.PARTIAL_SETTLED),
        },
      });

      let totalInterest = 0;

      for (const order of activeOrders) {
        const dailyInterest = Number(
          (
            (Number(order.unsettledAmount) * drug.annualRate) /
            100 /
            360
          ).toFixed(2),
        );

        totalInterest += dailyInterest;
        order.totalInterest = Number(
          (Number(order.totalInterest) + dailyInterest).toFixed(2),
        );

        await queryRunner.manager.save(order);
      }

      totalInterest = Number(totalInterest.toFixed(2));

      // ========== 第五步：计算净利润/亏损 ==========
      const netProfit = Number(
        (
          totalSalesRevenue -
          purchaseCost -
          totalFees -
          totalInterest
        ).toFixed(2),
      );

      const isProfit = netProfit > 0;
      const profitAmount = isProfit ? netProfit : 0;
      const lossAmount = isProfit ? 0 : Math.abs(netProfit);

      // ========== 第六步：3:7 分润/共担 ==========
      let investorProfitShare = 0;
      let platformProfitShare = 0;
      let investorLossShare = 0;
      let platformLossShare = 0;

      // 计算总垫资本金（解套的 + 未结清的，用于按比例分配）
      const settledPrincipalFromDetails = orderDetails.reduce(
        (sum, detail) => sum + detail.settledPrincipal,
        0,
      );
      const totalUnsettledPrincipal = activeOrders.reduce(
        (sum, order) => sum + Number(order.unsettledAmount),
        0,
      );
      // 总参与分润的本金 = 当日解套本金 + 当前未结清本金
      const totalPrincipalForSharing = settledPrincipalFromDetails + totalUnsettledPrincipal;

      if (isProfit && profitAmount > 0 && totalPrincipalForSharing > 0) {
        // 盈利时：垫资方30%，平台70%
        investorProfitShare = Number((profitAmount * 0.3).toFixed(2));
        platformProfitShare = Number((profitAmount * 0.7).toFixed(2));

        // 1. 先给解套订单分配分润
        for (const detail of orderDetails) {
          if (detail.settledPrincipal <= 0) continue;

          const shareRatio =
            totalPrincipalForSharing > 0
              ? detail.settledPrincipal / totalPrincipalForSharing
              : 0;
          const orderProfitShare = Number(
            (investorProfitShare * shareRatio).toFixed(2),
          );

          if (orderProfitShare > 0) {
            // 更新订单总利润
            const order = await queryRunner.manager.findOne(FundingOrder, {
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

              // 记录资金流水 - 利润分成
              const transaction = queryRunner.manager.create(
                AccountTransaction,
                {
                  userId: detail.userId,
                  type: TransactionType.PROFIT_SHARE,
                  amount: orderProfitShare,
                  balanceBefore: availableBefore,
                  balanceAfter: balance.availableBalance,
                  relatedOrderId: detail.orderId,
                  description: `分润收入：${drug.name}，金额 ${orderProfitShare}元`,
                },
              );

              await queryRunner.manager.save(transaction);
            }

            // 更新订单明细
            detail.profitShare = orderProfitShare;
          }
        }

        // 2. 再给未结清订单分配分润
        for (const order of activeOrders) {
          const orderUnsettled = Number(order.unsettledAmount);
          const shareRatio =
            totalPrincipalForSharing > 0
              ? orderUnsettled / totalPrincipalForSharing
              : 0;
          const orderProfitShare = Number(
            (investorProfitShare * shareRatio).toFixed(2),
          );

          if (orderProfitShare > 0) {
            // 更新订单总利润
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

              // 记录资金流水 - 利润分成
              const transaction = queryRunner.manager.create(
                AccountTransaction,
                {
                  userId: order.userId,
                  type: TransactionType.PROFIT_SHARE,
                  amount: orderProfitShare,
                  balanceBefore: availableBefore,
                  balanceAfter: balance.availableBalance,
                  relatedOrderId: order.id,
                  description: `分润收入：${drug.name}，金额 ${orderProfitShare}元`,
                },
              );

              await queryRunner.manager.save(transaction);
            }

            // 更新订单明细
            const detail = orderDetails.find((d) => d.orderId === order.id);
            if (detail) {
              detail.profitShare = orderProfitShare;
            } else {
              orderDetails.push({
                orderId: order.id,
                orderNo: order.orderNo,
                userId: order.userId,
                settledQuantity: 0,
                settledPrincipal: 0,
                profitShare: orderProfitShare,
                lossShare: 0,
              });
            }
          }
        }
      } else if (!isProfit && lossAmount > 0 && totalPrincipalForSharing > 0) {
        // 亏损时：垫资方承担30%，平台承担70%
        investorLossShare = Number((lossAmount * 0.3).toFixed(2));
        platformLossShare = Number((lossAmount * 0.7).toFixed(2));

        // 1. 先给解套订单分摊亏损
        for (const detail of orderDetails) {
          if (detail.settledPrincipal <= 0) continue;

          const shareRatio =
            totalPrincipalForSharing > 0
              ? detail.settledPrincipal / totalPrincipalForSharing
              : 0;
          const orderLossShare = Number(
            (investorLossShare * shareRatio).toFixed(2),
          );

          if (orderLossShare > 0) {
            // 更新订单总亏损
            const order = await queryRunner.manager.findOne(FundingOrder, {
              where: { id: detail.orderId },
              lock: { mode: 'pessimistic_write' },
            });
            if (order) {
              order.totalLoss = Number(
                (Number(order.totalLoss) + orderLossShare).toFixed(2),
              );
              await queryRunner.manager.save(order);

              // 记录资金流水 - 亏损分摊
              const balance = await queryRunner.manager.findOne(AccountBalance, {
                where: { userId: detail.userId },
              });

              if (balance) {
                const availableBefore = Number(balance.availableBalance);

                const transaction = queryRunner.manager.create(
                  AccountTransaction,
                  {
                    userId: detail.userId,
                    type: TransactionType.LOSS_SHARE,
                    amount: -orderLossShare,
                    balanceBefore: availableBefore,
                    balanceAfter: availableBefore,
                    relatedOrderId: detail.orderId,
                    description: `亏损分摊：${drug.name}，金额 ${orderLossShare}元（从本金抵扣）`,
                  },
                );

                await queryRunner.manager.save(transaction);
              }
            }

            // 更新订单明细
            detail.lossShare = orderLossShare;
          }
        }

        // 2. 再给未结清订单分摊亏损
        for (const order of activeOrders) {
          const orderUnsettled = Number(order.unsettledAmount);
          const shareRatio =
            totalPrincipalForSharing > 0
              ? orderUnsettled / totalPrincipalForSharing
              : 0;
          const orderLossShare = Number(
            (investorLossShare * shareRatio).toFixed(2),
          );

          if (orderLossShare > 0) {
            // 更新订单总亏损
            order.totalLoss = Number(
              (Number(order.totalLoss) + orderLossShare).toFixed(2),
            );

            // 亏损优先从后续分润抵扣，这里简化为直接从未结清本金中抵扣
            order.unsettledAmount = Number(
              (Number(order.unsettledAmount) - orderLossShare).toFixed(2),
            );

            // 如果本金扣完，标记为已结清
            if (order.unsettledAmount <= 0) {
              order.unsettledAmount = 0;
              order.status = FundingOrderStatus.SETTLED;
              order.settledAt = new Date();
            }

            await queryRunner.manager.save(order);

            // 记录资金流水 - 亏损分摊
            const balance = await queryRunner.manager.findOne(AccountBalance, {
              where: { userId: order.userId },
            });

            if (balance) {
              const availableBefore = Number(balance.availableBalance);

              const transaction = queryRunner.manager.create(
                AccountTransaction,
                {
                  userId: order.userId,
                  type: TransactionType.LOSS_SHARE,
                  amount: -orderLossShare,
                  balanceBefore: availableBefore,
                  balanceAfter: availableBefore,
                  relatedOrderId: order.id,
                  description: `亏损分摊：${drug.name}，金额 ${orderLossShare}元（从本金抵扣）`,
                },
              );

              await queryRunner.manager.save(transaction);
            }

            // 更新订单明细
            const detail = orderDetails.find((d) => d.orderId === order.id);
            if (detail) {
              detail.lossShare = orderLossShare;
            } else {
              orderDetails.push({
                orderId: order.id,
                orderNo: order.orderNo,
                userId: order.userId,
                settledQuantity: 0,
                settledPrincipal: 0,
                profitShare: 0,
                lossShare: orderLossShare,
              });
            }
          }
        }
      }

      // ========== 第七步：创建清算记录 ==========
      const settlement = queryRunner.manager.create(Settlement, {
        drugId,
        settlementDate,
        totalSalesRevenue,
        totalCost: purchaseCost,
        totalFees,
        totalInterest,
        netProfit,
        investorProfitShare,
        platformProfitShare,
        investorLossShare,
        platformLossShare,
        settledPrincipal: totalSettledPrincipal,
        settledOrderCount,
        status: SettlementStatus.COMPLETED,
      });

      const savedSettlement = await queryRunner.manager.save(settlement);

      // 更新订单明细中的 settlementId
      for (const detail of orderDetails) {
        await queryRunner.manager.update(
          AccountTransaction,
          { relatedOrderId: detail.orderId },
          { relatedSettlementId: savedSettlement.id },
        );
      }

      // 提交事务
      await queryRunner.commitTransaction();

      return {
        settlement: savedSettlement,
        orderDetails,
      };
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

    // 5. 计算成本
    const purchaseCost = totalSalesQuantity * drug.purchasePrice;
    const totalFees = totalSalesQuantity * drug.unitFee;

    // 6. 计算预计解套订单
    const pendingOrders = await this.fundingOrderRepository.find({
      where: {
        drugId,
        status: Between(FundingOrderStatus.HOLDING, FundingOrderStatus.PARTIAL_SETTLED),
      },
      order: { fundedAt: 'ASC' },
      relations: ['user'],
    });

    let remainingQuantity = totalSalesQuantity;
    const estimatedSettlements: Array<{
      orderId: string;
      orderNo: string;
      userId: string;
      username: string;
      totalQuantity: number;
      settledQuantity: number;
      unsettledQuantity: number;
      estimatedSettleQuantity: number;
      estimatedSettleAmount: number;
    }> = [];

    for (const order of pendingOrders) {
      if (remainingQuantity <= 0) break;

      const unsettledQuantity = order.quantity - order.settledQuantity;
      const settleQuantity = Math.min(unsettledQuantity, remainingQuantity);

      if (settleQuantity > 0) {
        estimatedSettlements.push({
          orderId: order.id,
          orderNo: order.orderNo,
          userId: order.userId,
          username: order.user?.username || '',
          totalQuantity: order.quantity,
          settledQuantity: order.settledQuantity,
          unsettledQuantity,
          estimatedSettleQuantity: settleQuantity,
          estimatedSettleAmount: Number(
            (settleQuantity * drug.purchasePrice).toFixed(2),
          ),
        });

        remainingQuantity -= settleQuantity;
      }
    }

    // 7. 计算预计利息
    const activeOrders = await this.fundingOrderRepository.find({
      where: {
        drugId,
        status: Between(FundingOrderStatus.HOLDING, FundingOrderStatus.PARTIAL_SETTLED),
      },
    });

    let estimatedInterest = 0;
    for (const order of activeOrders) {
      estimatedInterest +=
        (Number(order.unsettledAmount) * drug.annualRate) / 100 / 360;
    }

    // 8. 计算预计利润/亏损
    const estimatedNetProfit = Number(
      (
        totalSalesRevenue -
        purchaseCost -
        totalFees -
        estimatedInterest
      ).toFixed(2),
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
        totalFees: Number(totalFees.toFixed(2)),
        estimatedInterest: Number(estimatedInterest.toFixed(2)),
      },
      estimatedSettlements,
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
        totalSalesRevenue: Number(s.totalSalesRevenue),
        totalCost: Number(s.totalCost),
        totalFees: Number(s.totalFees),
        totalInterest: Number(s.totalInterest),
        netProfit: Number(s.netProfit),
        investorProfitShare: Number(s.investorProfitShare),
        platformProfitShare: Number(s.platformProfitShare),
        investorLossShare: Number(s.investorLossShare),
        platformLossShare: Number(s.platformLossShare),
        settledPrincipal: Number(s.settledPrincipal),
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

    // 获取相关交易流水（解套、分润、亏损）
    const transactions = await this.accountTransactionRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.user', 'user')
      .where('t.relatedSettlementId = :settlementId', { settlementId: id })
      .orderBy('t.createdAt', 'ASC')
      .getMany();

    // 获取解套订单明细
    const orderDetails = await this.fundingOrderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .where(
        'order.drugId = :drugId AND order.settledAt >= :settlementDate AND order.settledAt < :nextDate',
        {
          drugId: settlement.drugId,
          settlementDate: settlement.settlementDate,
          nextDate: new Date(
            new Date(settlement.settlementDate).getTime() + 24 * 60 * 60 * 1000,
          ),
        },
      )
      .getMany();

    return {
      settlement: {
        id: settlement.id,
        drugId: settlement.drugId,
        drugName: settlement.drug?.name,
        drugCode: settlement.drug?.code,
        settlementDate: settlement.settlementDate,
        totalSalesRevenue: Number(settlement.totalSalesRevenue),
        totalCost: Number(settlement.totalCost),
        totalFees: Number(settlement.totalFees),
        totalInterest: Number(settlement.totalInterest),
        netProfit: Number(settlement.netProfit),
        investorProfitShare: Number(settlement.investorProfitShare),
        platformProfitShare: Number(settlement.platformProfitShare),
        investorLossShare: Number(settlement.investorLossShare),
        platformLossShare: Number(settlement.platformLossShare),
        settledPrincipal: Number(settlement.settledPrincipal),
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
      .where('s.status = :status', { status: SettlementStatus.COMPLETED })
      .getRawOne();

    const totalSalesRevenue = Number(stats?.totalSalesRevenue || 0);
    const totalNetProfit = Number(stats?.totalNetProfit || 0);
    const totalInvestorProfit = Number(stats?.totalInvestorProfit || 0);
    const totalInvestorLoss = Number(stats?.totalInvestorLoss || 0);

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
    };
  }

  /**
   * 获取用户的清算记录（垫资方视角）
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
    const userDrugIds = await this.fundingOrderRepository
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
        // 优先通过 relatedSettlementId 查询，如果没有则通过日期范围查询
        let transactions = await this.accountTransactionRepository
          .createQueryBuilder('t')
          .where('t.userId = :userId', { userId })
          .andWhere('t.relatedSettlementId = :settlementId', {
            settlementId: s.id,
          })
          .getMany();

        // 如果没有找到关联的交易记录，尝试通过订单关联匹配（兼容历史数据）
        if (transactions.length === 0) {
          // 获取用户在清算日期前后几天的相关交易
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
            const orders = await this.fundingOrderRepository
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
   * 获取用户的清算统计（垫资方视角）
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
          TransactionType.INTEREST,
        ],
      })
      .getMany();

    let totalPrincipalReturn = 0;
    let totalProfitShare = 0;
    let totalLossShare = 0;
    let totalInterest = 0;

    for (const t of transactions) {
      if (t.type === TransactionType.PRINCIPAL_RETURN) {
        totalPrincipalReturn += Number(t.amount);
      } else if (t.type === TransactionType.PROFIT_SHARE) {
        totalProfitShare += Number(t.amount);
      } else if (t.type === TransactionType.LOSS_SHARE) {
        totalLossShare += Math.abs(Number(t.amount));
      } else if (t.type === TransactionType.INTEREST) {
        totalInterest += Number(t.amount);
      }
    }

    return {
      totalPrincipalReturn: Number(totalPrincipalReturn.toFixed(2)),
      totalProfitShare: Number(totalProfitShare.toFixed(2)),
      totalLossShare: Number(totalLossShare.toFixed(2)),
      totalInterest: Number(totalInterest.toFixed(2)),
      netProfit: Number(
        (totalProfitShare - totalLossShare + totalInterest).toFixed(2),
      ),
      totalReturn: Number(
        (totalPrincipalReturn + totalProfitShare - totalLossShare + totalInterest).toFixed(2),
      ),
    };
  }
}
