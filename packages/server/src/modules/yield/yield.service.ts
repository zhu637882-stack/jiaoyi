import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual } from 'typeorm';
import { DailyYield } from '../../database/entities/daily-yield.entity';
import { SubscriptionOrder, SubscriptionOrderStatus } from '../../database/entities/subscription-order.entity';
import { Drug } from '../../database/entities/drug.entity';
import { User } from '../../database/entities/user.entity';
import { FillSubsidyDto, SubsidyItemDto, QueryYieldCurveDto, QueryPendingSubsidyDto } from './dto';

// 年化收益率 5%
const ANNUAL_YIELD_RATE = 0.05;
const DAYS_PER_YEAR = 365;

export interface YieldCurvePoint {
  date: string;
  baseYield: number;
  subsidy: number;
  totalYield: number;
  cumulativeYield: number;
  principalBalance: number;
}

export interface PendingSubsidyItem {
  orderId: string;
  orderNo: string;
  userId: string;
  username: string;
  realName: string;
  phone: string;
  drugId: string;
  drugName: string;
  drugCode: string;
  quantity: number;
  amount: number;
  principalBalance: number;
  baseYield: number;
  currentSubsidy: number;
  subsidyFilled: boolean;
  yieldDate: string;
}

export interface YieldSummary {
  totalBaseYield: number;
  totalSubsidy: number;
  totalYield: number;
  todayBaseYield: number;
  todaySubsidy: number;
  todayTotalYield: number;
  yieldRate30d: number; // 近30天年化收益率
}

@Injectable()
export class YieldService {
  private readonly logger = new Logger(YieldService.name);

  constructor(
    @InjectRepository(DailyYield)
    private readonly dailyYieldRepo: Repository<DailyYield>,
    @InjectRepository(SubscriptionOrder)
    private readonly subscriptionOrderRepo: Repository<SubscriptionOrder>,
    @InjectRepository(Drug)
    private readonly drugRepo: Repository<Drug>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * 为所有生效中的订单生成指定日期的日收益记录
   * 基础收益 = 本金余额 × 5% / 365
   */
  async generateDailyYields(yieldDate?: string): Promise<{ generated: number }> {
    const date = yieldDate ? new Date(yieldDate) : new Date();
    date.setHours(0, 0, 0, 0);

    // 如果没指定日期，默认生成昨天的
    if (!yieldDate) {
      date.setDate(date.getDate() - 1);
    }

    const dateStr = date.toISOString().split('T')[0];
    this.logger.log(`[日收益生成] 开始生成 ${dateStr} 的收益记录`);

    // 查找所有生效中的订单
    const effectiveOrders = await this.subscriptionOrderRepo.find({
      where: { status: SubscriptionOrderStatus.EFFECTIVE },
    });

    // 过滤出在收益日期当天已生效的订单
    const activeOrders = effectiveOrders.filter(
      (order) => new Date(order.effectiveAt) <= date,
    );

    this.logger.log(`[日收益生成] 找到 ${activeOrders.length} 个生效订单`);

    let generated = 0;

    for (const order of activeOrders) {
      // 检查是否已存在
      const existing = await this.dailyYieldRepo.findOne({
        where: { orderId: order.id, yieldDate: date },
      });

      if (existing) {
        // 已存在则更新基础收益（补贴金保留）
        const principal = Number(order.unsettledAmount);
        const baseYield = Number((principal * ANNUAL_YIELD_RATE / DAYS_PER_YEAR).toFixed(2));
        existing.baseYield = baseYield;
        existing.principalBalance = principal;
        existing.totalYield = Number((baseYield + Number(existing.subsidy)).toFixed(2));
        await this.dailyYieldRepo.save(existing);
        continue;
      }

      const principal = Number(order.unsettledAmount);
      const baseYield = Number((principal * ANNUAL_YIELD_RATE / DAYS_PER_YEAR).toFixed(2));

      // 计算累计收益
      const previousYields = await this.dailyYieldRepo.find({
        where: {
          orderId: order.id,
          yieldDate: LessThanOrEqual(new Date(date.getTime() - 86400000)),
        },
        order: { yieldDate: 'DESC' },
        take: 1,
      });

      const prevCumulative = previousYields.length > 0
        ? Number(previousYields[0].cumulativeYield)
        : 0;

      const dailyYield = this.dailyYieldRepo.create({
        orderId: order.id,
        userId: order.userId,
        drugId: order.drugId,
        yieldDate: date,
        baseYield,
        subsidy: 0,
        totalYield: baseYield,
        principalBalance: principal,
        cumulativeYield: Number((prevCumulative + baseYield).toFixed(2)),
        subsidyFilled: false,
      });

      await this.dailyYieldRepo.save(dailyYield);
      generated++;
    }

    this.logger.log(`[日收益生成] 生成完成，新增 ${generated} 条记录`);
    return { generated };
  }

  /**
   * 财务填写补贴金
   * 一般今天填昨天的收益补贴
   */
  async fillSubsidy(dto: FillSubsidyDto): Promise<{ updated: number }> {
    const date = new Date(dto.yieldDate);
    date.setHours(0, 0, 0, 0);

    let updated = 0;

    for (const item of dto.items) {
      let yieldRecord = await this.dailyYieldRepo.findOne({
        where: { orderId: item.orderId, yieldDate: date },
      });

      // 如果该订单当天没有日收益记录，则自动创建
      if (!yieldRecord) {
        const order = await this.subscriptionOrderRepo.findOne({
          where: { id: item.orderId },
        });
        if (!order) {
          this.logger.warn(`[补贴金填写] 未找到订单 ${item.orderId}，跳过`);
          continue;
        }

        const principalBalance = Number(order.unsettledAmount);
        const baseYield = Number((principalBalance * ANNUAL_YIELD_RATE / DAYS_PER_YEAR).toFixed(2));

        yieldRecord = this.dailyYieldRepo.create({
          orderId: item.orderId,
          userId: order.userId,
          drugId: order.drugId,
          yieldDate: date,
          principalBalance,
          baseYield,
          subsidy: 0,
          totalYield: baseYield,
          cumulativeYield: 0,
          subsidyFilled: false,
        });
      }

      yieldRecord.subsidy = Number(item.subsidy.toFixed(2));
      yieldRecord.totalYield = Number((Number(yieldRecord.baseYield) + yieldRecord.subsidy).toFixed(2));
      yieldRecord.subsidyFilled = true;

      await this.dailyYieldRepo.save(yieldRecord);
      await this.recalculateCumulativeYield(item.orderId, date);

      updated++;
    }

    this.logger.log(`[补贴金填写] 更新了 ${updated} 条记录`);
    return { updated };
  }

  /**
   * 重新计算累计收益（从指定日期开始）
   */
  private async recalculateCumulativeYield(orderId: string, fromDate: Date): Promise<void> {
    const records = await this.dailyYieldRepo.find({
      where: { orderId, yieldDate: LessThanOrEqual(fromDate) },
      order: { yieldDate: 'ASC' },
    });

    // 计算 fromDate 之前的累计值
    let cumulative = 0;
    const beforeRecords = records.filter(
      (r) => new Date(r.yieldDate) < fromDate,
    );
    if (beforeRecords.length > 0) {
      cumulative = Number(beforeRecords[beforeRecords.length - 1].cumulativeYield);
    }

    // 从 fromDate 开始重新计算
    const fromRecords = await this.dailyYieldRepo.find({
      where: { orderId },
      order: { yieldDate: 'ASC' },
    });

    let runningCumulative = 0;
    for (const record of fromRecords) {
      if (new Date(record.yieldDate) < fromDate) {
        runningCumulative = Number(record.cumulativeYield);
        continue;
      }
      runningCumulative = Number((runningCumulative + Number(record.totalYield)).toFixed(2));
      record.cumulativeYield = runningCumulative;
      await this.dailyYieldRepo.save(record);
    }
  }

  /**
   * 获取补贴金客户列表（管理员）
   * 数据源：直接从有效认购订单查询所有在持客户，不依赖日收益记录
   */
  async getPendingSubsidyList(dto: QueryPendingSubsidyDto): Promise<{
    list: PendingSubsidyItem[];
    total: number;
  }> {
    const yieldDate = dto.yieldDate || new Date().toISOString().split('T')[0];

    const page = dto.page || 1;
    const pageSize = dto.pageSize || 50;

    // 查询所有有效认购订单（status=effective）
    const queryBuilder = this.subscriptionOrderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.user', 'u')
      .leftJoinAndSelect('o.drug', 'd')
      .where('o.status = :status', { status: SubscriptionOrderStatus.EFFECTIVE })
      .andWhere('o.effectiveAt <= :yieldDate', {
        yieldDate: new Date(yieldDate + 'T23:59:59'),
      });

    if (dto.drugId) {
      queryBuilder.andWhere('o.drugId = :drugId', { drugId: dto.drugId });
    }

    const total = await queryBuilder.getCount();

    const orders = await queryBuilder
      .orderBy('u.realName', 'ASC')
      .addOrderBy('d.name', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    // 查询该日期已有的日收益记录（用于显示已填写的补贴金）
    const orderIds = orders.map((o) => o.id);
    const existingYields = orderIds.length > 0
      ? await this.dailyYieldRepo
          .createQueryBuilder('dy')
          .where('dy.yieldDate = :date', { date: yieldDate })
          .andWhere('dy.orderId IN (:...orderIds)', { orderIds })
          .getMany()
      : [];

    const yieldMap = new Map(existingYields.map((y) => [y.orderId, y]));

    const list: PendingSubsidyItem[] = orders.map((o) => {
      const existingYield = yieldMap.get(o.id);
      const principalBalance = Number(o.unsettledAmount);
      const baseYield = Number((principalBalance * ANNUAL_YIELD_RATE / DAYS_PER_YEAR).toFixed(2));

      return {
        orderId: o.id,
        orderNo: o.orderNo,
        userId: o.userId,
        username: (o.user as any)?.username || '',
        realName: (o.user as any)?.realName || '',
        phone: (o.user as any)?.phone || '',
        drugId: o.drugId,
        drugName: (o.drug as any)?.name || '',
        drugCode: (o.drug as any)?.code || '',
        quantity: o.quantity,
        amount: Number(o.amount),
        principalBalance,
        baseYield: existingYield ? Number(existingYield.baseYield) : baseYield,
        currentSubsidy: existingYield ? Number(existingYield.subsidy) : 0,
        subsidyFilled: existingYield ? existingYield.subsidyFilled : false,
        yieldDate,
      };
    });

    return { list, total };
  }

  /**
   * 获取用户的收益曲线数据
   * 曲线展示：每天的基础收益 + 补贴金 的累计值
   */
  async getYieldCurve(userId: string, dto: QueryYieldCurveDto): Promise<YieldCurvePoint[]> {
    const endDate = dto.endDate ? new Date(dto.endDate) : new Date();
    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          return d;
        })();

    const queryBuilder = this.dailyYieldRepo
      .createQueryBuilder('dy')
      .where('dy.userId = :userId', { userId })
      .andWhere('dy.yieldDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });

    if (dto.drugId) {
      queryBuilder.andWhere('dy.drugId = :drugId', { drugId: dto.drugId });
    }

    const records = await queryBuilder
      .orderBy('dy.yieldDate', 'ASC')
      .getMany();

    // 按日期汇总（如果同一天有多个订单）
    const dateMap = new Map<string, YieldCurvePoint>();

    for (const r of records) {
      const dateStr = r.yieldDate instanceof Date
        ? r.yieldDate.toISOString().split('T')[0]
        : String(r.yieldDate);

      const existing = dateMap.get(dateStr);
      if (existing) {
        existing.baseYield = Number((existing.baseYield + Number(r.baseYield)).toFixed(2));
        existing.subsidy = Number((existing.subsidy + Number(r.subsidy)).toFixed(2));
        existing.totalYield = Number((existing.totalYield + Number(r.totalYield)).toFixed(2));
        existing.cumulativeYield = Number(r.cumulativeYield); // 取最后一条的累计值
        existing.principalBalance = Number((existing.principalBalance + Number(r.principalBalance)).toFixed(2));
      } else {
        dateMap.set(dateStr, {
          date: dateStr,
          baseYield: Number(r.baseYield),
          subsidy: Number(r.subsidy),
          totalYield: Number(r.totalYield),
          cumulativeYield: Number(r.cumulativeYield),
          principalBalance: Number(r.principalBalance),
        });
      }
    }

    // 重新计算正确的累计值
    const points = Array.from(dateMap.values());
    let cumulative = 0;
    for (const point of points) {
      cumulative = Number((cumulative + point.totalYield).toFixed(2));
      point.cumulativeYield = cumulative;
    }

    return points;
  }

  /**
   * 获取用户收益汇总
   */
  async getYieldSummary(userId: string): Promise<YieldSummary> {
    // 全部收益汇总
    const allYields = await this.dailyYieldRepo.find({
      where: { userId },
    });

    const totalBaseYield = allYields.reduce((sum, y) => sum + Number(y.baseYield), 0);
    const totalSubsidy = allYields.reduce((sum, y) => sum + Number(y.subsidy), 0);
    const totalYield = allYields.reduce((sum, y) => sum + Number(y.totalYield), 0);

    // 今日收益
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayYields = allYields.filter(
      (y) => new Date(y.yieldDate).getTime() === today.getTime(),
    );

    const todayBaseYield = todayYields.reduce((sum, y) => sum + Number(y.baseYield), 0);
    const todaySubsidy = todayYields.reduce((sum, y) => sum + Number(y.subsidy), 0);
    const todayTotalYield = todayYields.reduce((sum, y) => sum + Number(y.totalYield), 0);

    // 近30天年化收益率
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentYields = allYields.filter(
      (y) => new Date(y.yieldDate) >= thirtyDaysAgo,
    );
    const recentTotalYield = recentYields.reduce((sum, y) => sum + Number(y.totalYield), 0);
    const activeOrders = await this.subscriptionOrderRepo.find({
      where: { userId, status: SubscriptionOrderStatus.EFFECTIVE },
    });
    const avgPrincipal = activeOrders.reduce((sum, o) => sum + Number(o.unsettledAmount), 0);
    const yieldRate30d = avgPrincipal > 0
      ? Number(((recentTotalYield / avgPrincipal) * (DAYS_PER_YEAR / 30) * 100).toFixed(2))
      : 0;

    return {
      totalBaseYield: Number(totalBaseYield.toFixed(2)),
      totalSubsidy: Number(totalSubsidy.toFixed(2)),
      totalYield: Number(totalYield.toFixed(2)),
      todayBaseYield: Number(todayBaseYield.toFixed(2)),
      todaySubsidy: Number(todaySubsidy.toFixed(2)),
      todayTotalYield: Number(todayTotalYield.toFixed(2)),
      yieldRate30d,
    };
  }

  /**
   * 获取某药品的收益曲线（管理员视角，所有客户汇总）
   */
  async getDrugYieldCurve(drugId: string, startDate?: string, endDate?: string): Promise<YieldCurvePoint[]> {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          return d;
        })();

    const records = await this.dailyYieldRepo.find({
      where: {
        drugId,
        yieldDate: Between(start, end),
      },
      order: { yieldDate: 'ASC' },
    });

    // 按日期汇总所有客户
    const dateMap = new Map<string, YieldCurvePoint>();
    for (const r of records) {
      const dateStr = r.yieldDate instanceof Date
        ? r.yieldDate.toISOString().split('T')[0]
        : String(r.yieldDate);

      const existing = dateMap.get(dateStr);
      if (existing) {
        existing.baseYield = Number((existing.baseYield + Number(r.baseYield)).toFixed(2));
        existing.subsidy = Number((existing.subsidy + Number(r.subsidy)).toFixed(2));
        existing.totalYield = Number((existing.totalYield + Number(r.totalYield)).toFixed(2));
        existing.principalBalance = Number((existing.principalBalance + Number(r.principalBalance)).toFixed(2));
      } else {
        dateMap.set(dateStr, {
          date: dateStr,
          baseYield: Number(r.baseYield),
          subsidy: Number(r.subsidy),
          totalYield: Number(r.totalYield),
          cumulativeYield: 0,
          principalBalance: Number(r.principalBalance),
        });
      }
    }

    // 计算累计值
    const points = Array.from(dateMap.values());
    let cumulative = 0;
    for (const point of points) {
      cumulative = Number((cumulative + point.totalYield).toFixed(2));
      point.cumulativeYield = cumulative;
    }

    return points;
  }
}
