import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual } from 'typeorm';
import { MarketSnapshot } from '../../database/entities/market-snapshot.entity';
import { Drug } from '../../database/entities/drug.entity';
import { DailySales } from '../../database/entities/daily-sales.entity';
import { Settlement } from '../../database/entities/settlement.entity';
import { SubscriptionOrder, SubscriptionOrderStatus } from '../../database/entities/subscription-order.entity';
import { CreateSnapshotDto, KLinePeriod } from './dto';

export interface MarketOverviewItem {
  drugId: string;
  drugName: string;
  drugCode: string;
  purchasePrice: number;
  sellingPrice: number;
  dailySalesQuantity: number;
  dailySalesRevenue: number;
  averageSellingPrice: number;
  dailyReturn: number;
  cumulativeReturn: number;
  totalFundingAmount: number;
  fundingHeat: number;
  queueDepth: number;
  snapshotDate: Date;
}

export interface DrugMarketDetail {
  drug: {
    id: string;
    name: string;
    code: string;
    purchasePrice: number;
    sellingPrice: number;
    totalQuantity: number;
    subscribedQuantity: number;
    remainingQuantity: number;
    status: string;
  };
  market: MarketSnapshot | null;
  subscriptionStats: {
    totalOrders: number;
    totalAmount: number;
    activeOrders: number;
    activeAmount: number;
    avgOrderAmount: number;
  };
}

export interface KLineData {
  date: string;
  time: number;          // Unix timestamp（秒），lightweight-charts 需要
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;        // 成交量
  dailySalesQuantity: number;
  dailySalesRevenue: number;
  averageSellingPrice: number;
  dailyReturn: number;
  totalFundingAmount: number;
  cumulativeReturn: number;    // 累计收益率
  fundingHeat: number;         // 认购热度（参与认购的用户数）
}

export interface DepthData {
  ranges: {
    min: number;
    max: number;
    label: string;
    count: number;
    amount: number;
  }[];
  totalAmount: number;
  totalCount: number;
}

export interface MarketStats {
  totalDrugs: number;
  totalFundingAmount: number;
  totalSalesRevenue: number;
  totalSettlementCount: number;
  activeFunderCount: number;
}

@Injectable()
export class MarketService {
  constructor(
    @InjectRepository(MarketSnapshot)
    private readonly marketSnapshotRepo: Repository<MarketSnapshot>,
    @InjectRepository(Drug)
    private readonly drugRepo: Repository<Drug>,
    @InjectRepository(DailySales)
    private readonly dailySalesRepo: Repository<DailySales>,
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
    @InjectRepository(SubscriptionOrder)
    private readonly subscriptionOrderRepo: Repository<SubscriptionOrder>,
  ) {}

  /**
   * 验证 UUID 格式
   */
  private validateUUID(drugId: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(drugId)) {
      throw new BadRequestException('无效的药品ID格式，必须是有效的UUID');
    }
  }

  /**
   * 生成每日行情快照
   */
  async createSnapshot(dto: CreateSnapshotDto): Promise<MarketSnapshot> {
    const { drugId, snapshotDate } = dto;

    this.validateUUID(drugId);

    const date = snapshotDate ? new Date(snapshotDate) : new Date();
    date.setHours(0, 0, 0, 0);

    // 查询药品信息
    const drug = await this.drugRepo.findOne({ where: { id: drugId } });
    if (!drug) {
      throw new NotFoundException('药品不存在');
    }

    // 查询当日销售数据
    const dailySales = await this.dailySalesRepo.find({
      where: {
        drugId,
        saleDate: date,
      },
    });

    const dailySalesQuantity = dailySales.reduce((sum, s) => sum + s.quantity, 0);
    const dailySalesRevenue = dailySales.reduce((sum, s) => sum + Number(s.totalRevenue), 0);
    const averageSellingPrice = dailySalesQuantity > 0 
      ? dailySalesRevenue / dailySalesQuantity 
      : Number(drug.sellingPrice);

    // 查询当日清算数据
    const settlements = await this.settlementRepo.find({
      where: {
        drugId,
        settlementDate: date,
      },
    });

    const dailyNetProfit = settlements.reduce((sum, s) => sum + Number(s.netProfit), 0);

    // 查询当日认购数据
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const dailySubscriptionOrders = await this.subscriptionOrderRepo.find({
      where: {
        drugId,
        confirmedAt: Between(startOfDay, endOfDay),
      },
    });

    const dailyFundingAmount = dailySubscriptionOrders.reduce((sum, o) => sum + Number(o.amount), 0);
    const fundingHeat = new Set(dailySubscriptionOrders.map(o => o.userId)).size;

    // 计算日收益率 = 当日净利润 / 当日认购总额 × 100
    const dailyReturn = dailyFundingAmount > 0 
      ? (dailyNetProfit / dailyFundingAmount) * 100 
      : 0;

    // 查询历史快照计算累计收益率
    const previousSnapshots = await this.marketSnapshotRepo.find({
      where: {
        drugId,
        snapshotDate: LessThanOrEqual(date),
      },
      order: { snapshotDate: 'DESC' },
    });

    let cumulativeReturn = dailyReturn;
    if (previousSnapshots.length > 0) {
      const lastSnapshot = previousSnapshots[0];
      cumulativeReturn = Number(lastSnapshot.cumulativeReturn) + dailyReturn;
    }

    // 查询当前认购总额（所有生效中订单）
    const activeSubscriptionOrders = await this.subscriptionOrderRepo.find({
      where: {
        drugId,
        status: SubscriptionOrderStatus.EFFECTIVE,
      },
    });
    const totalFundingAmount = activeSubscriptionOrders.reduce((sum, o) => sum + Number(o.unsettledAmount), 0);

    // 查询排队深度
    const queueDepth = activeSubscriptionOrders.length;

    // 检查是否已存在快照，存在则更新
    const existingSnapshot = await this.marketSnapshotRepo.findOne({
      where: {
        drugId,
        snapshotDate: date,
      },
    });

    if (existingSnapshot) {
      existingSnapshot.dailySalesQuantity = dailySalesQuantity;
      existingSnapshot.dailySalesRevenue = dailySalesRevenue;
      existingSnapshot.averageSellingPrice = averageSellingPrice;
      existingSnapshot.dailyReturn = dailyReturn;
      existingSnapshot.cumulativeReturn = cumulativeReturn;
      existingSnapshot.totalFundingAmount = totalFundingAmount;
      existingSnapshot.fundingHeat = fundingHeat;
      existingSnapshot.queueDepth = queueDepth;
      return this.marketSnapshotRepo.save(existingSnapshot);
    }

    // 创建新快照
    const snapshot = this.marketSnapshotRepo.create({
      drugId,
      snapshotDate: date,
      dailySalesQuantity,
      dailySalesRevenue,
      averageSellingPrice,
      dailyReturn,
      cumulativeReturn,
      totalFundingAmount,
      fundingHeat,
      queueDepth,
    });

    return this.marketSnapshotRepo.save(snapshot);
  }

  /**
   * 获取市场总览
   */
  async getMarketOverview(): Promise<MarketOverviewItem[]> {
    // 获取所有药品
    const drugs = await this.drugRepo.find();
    
    const overview: MarketOverviewItem[] = [];

    for (const drug of drugs) {
      // 获取最新快照
      const latestSnapshot = await this.marketSnapshotRepo.findOne({
        where: { drugId: drug.id },
        order: { snapshotDate: 'DESC' },
      });

      if (latestSnapshot) {
        overview.push({
          drugId: drug.id,
          drugName: drug.name,
          drugCode: drug.code,
          purchasePrice: Number(drug.purchasePrice),
          sellingPrice: Number(drug.sellingPrice),
          dailySalesQuantity: latestSnapshot.dailySalesQuantity,
          dailySalesRevenue: Number(latestSnapshot.dailySalesRevenue),
          averageSellingPrice: Number(latestSnapshot.averageSellingPrice),
          dailyReturn: Number(latestSnapshot.dailyReturn),
          cumulativeReturn: Number(latestSnapshot.cumulativeReturn),
          totalFundingAmount: Number(latestSnapshot.totalFundingAmount),
          fundingHeat: latestSnapshot.fundingHeat,
          queueDepth: latestSnapshot.queueDepth,
          snapshotDate: latestSnapshot.snapshotDate,
        });
      } else {
        // 没有快照时返回基础信息
        const activeOrders = await this.subscriptionOrderRepo.find({
          where: {
            drugId: drug.id,
            status: SubscriptionOrderStatus.EFFECTIVE,
          },
        });
        const totalFundingAmount = activeOrders.reduce((sum, o) => sum + Number(o.unsettledAmount), 0);
        
        overview.push({
          drugId: drug.id,
          drugName: drug.name,
          drugCode: drug.code,
          purchasePrice: Number(drug.purchasePrice),
          sellingPrice: Number(drug.sellingPrice),
          dailySalesQuantity: 0,
          dailySalesRevenue: 0,
          averageSellingPrice: Number(drug.sellingPrice),
          dailyReturn: 0,
          cumulativeReturn: 0,
          totalFundingAmount,
          fundingHeat: 0,
          queueDepth: activeOrders.length,
          snapshotDate: new Date(),
        });
      }
    }

    // 按认购热度排序
    return overview.sort((a, b) => b.fundingHeat - a.fundingHeat);
  }

  /**
   * 获取单药品行情详情
   */
  async getDrugMarket(drugId: string): Promise<DrugMarketDetail> {
    this.validateUUID(drugId);

    const drug = await this.drugRepo.findOne({ where: { id: drugId } });
    if (!drug) {
      throw new NotFoundException('药品不存在');
    }

    const latestSnapshot = await this.marketSnapshotRepo.findOne({
      where: { drugId },
      order: { snapshotDate: 'DESC' },
    });

    // 统计认购数据
    const allOrders = await this.subscriptionOrderRepo.find({ where: { drugId } });
    const activeOrders = allOrders.filter(o => o.status === SubscriptionOrderStatus.EFFECTIVE);
    
    const totalAmount = allOrders.reduce((sum, o) => sum + Number(o.amount), 0);
    const activeAmount = activeOrders.reduce((sum, o) => sum + Number(o.unsettledAmount), 0);

    return {
      drug: {
        id: drug.id,
        name: drug.name,
        code: drug.code,
        purchasePrice: Number(drug.purchasePrice),
        sellingPrice: Number(drug.sellingPrice),
        totalQuantity: drug.totalQuantity,
        subscribedQuantity: drug.subscribedQuantity,
        remainingQuantity: drug.remainingQuantity,
        status: drug.status,
      },
      market: latestSnapshot,
      subscriptionStats: {
        totalOrders: allOrders.length,
        totalAmount,
        activeOrders: activeOrders.length,
        activeAmount,
        avgOrderAmount: allOrders.length > 0 ? totalAmount / allOrders.length : 0,
      },
    };
  }

  /**
   * 获取K线数据
   */
  async getDrugKLine(drugId: string, period: KLinePeriod): Promise<KLineData[]> {
    this.validateUUID(drugId);

    const drug = await this.drugRepo.findOne({ where: { id: drugId } });
    if (!drug) {
      throw new NotFoundException('药品不存在');
    }

    // 判断周期类型并获取基础日线数据
    const { startDate, isTimeRange, isMinute, isHourly, isDaily, isWeekly, isMonthly } = this.getPeriodConfig(period);
    
    const endDate = new Date();
    
    const snapshots = await this.marketSnapshotRepo.find({
      where: {
        drugId,
        snapshotDate: Between(startDate, endDate),
      },
      order: { snapshotDate: 'ASC' },
    });

    // 去重：同一天可能有多条快照，只保留最后一条（最新的）
    const deduped = snapshots.reduce((acc, s) => {
      const dateKey = s.snapshotDate instanceof Date
        ? s.snapshotDate.toISOString().split('T')[0]
        : String(s.snapshotDate);
      acc.set(dateKey, s);
      return acc;
    }, new Map<string, typeof snapshots[0]>());
    const uniqueSnapshots = Array.from(deduped.values());

    // 转换为日线数据
    const dailyData = this.convertSnapshotsToKLineData(uniqueSnapshots);

    // 根据周期类型处理数据
    if (isTimeRange) {
      // 时间范围类型（7d/30d/90d/all）：直接返回日线数据
      return dailyData;
    }

    if (isMinute || isHourly) {
      // 15m/1h/4h：模拟生成分时数据
      return this.generateIntradayData(dailyData, period);
    }

    if (isDaily) {
      // 1d：日线，直接返回
      return dailyData;
    }

    if (isWeekly) {
      // 1w：周线，聚合数据
      return this.aggregateToWeekly(dailyData);
    }

    if (isMonthly) {
      // 1mo：月线，聚合数据
      return this.aggregateToMonthly(dailyData);
    }

    return dailyData;
  }

  /**
   * 获取周期配置
   */
  private getPeriodConfig(period: KLinePeriod): {
    startDate: Date;
    isTimeRange: boolean;
    isMinute: boolean;
    isHourly: boolean;
    isDaily: boolean;
    isWeekly: boolean;
    isMonthly: boolean;
  } {
    const startDate = new Date();
    let isTimeRange = false;
    let isMinute = false;
    let isHourly = false;
    let isDaily = false;
    let isWeekly = false;
    let isMonthly = false;

    switch (period) {
      case KLinePeriod.FIFTEEN_MIN:
        startDate.setDate(startDate.getDate() - 7);
        isMinute = true;
        break;
      case KLinePeriod.ONE_HOUR:
        startDate.setDate(startDate.getDate() - 7);
        isHourly = true;
        break;
      case KLinePeriod.FOUR_HOURS:
        startDate.setDate(startDate.getDate() - 14);
        isHourly = true;
        break;
      case KLinePeriod.ONE_DAY:
        startDate.setDate(startDate.getDate() - 90);
        isDaily = true;
        break;
      case KLinePeriod.ONE_WEEK:
        startDate.setDate(startDate.getDate() - 180);
        isWeekly = true;
        break;
      case KLinePeriod.ONE_MONTH:
        startDate.setFullYear(2000, 0, 1);
        isMonthly = true;
        break;
      case KLinePeriod.SEVEN_DAYS:
        startDate.setDate(startDate.getDate() - 7);
        isTimeRange = true;
        break;
      case KLinePeriod.THIRTY_DAYS:
        startDate.setDate(startDate.getDate() - 30);
        isTimeRange = true;
        break;
      case KLinePeriod.NINETY_DAYS:
        startDate.setDate(startDate.getDate() - 90);
        isTimeRange = true;
        break;
      case KLinePeriod.ALL:
        startDate.setFullYear(2000, 0, 1);
        isTimeRange = true;
        break;
      default:
        startDate.setDate(startDate.getDate() - 90);
        isDaily = true;
    }

    return { startDate, isTimeRange, isMinute, isHourly, isDaily, isWeekly, isMonthly };
  }

  /**
   * 将快照转换为K线数据
   */
  private convertSnapshotsToKLineData(snapshots: MarketSnapshot[]): KLineData[] {
    return snapshots.map((s, index) => {
      const dateStr = s.snapshotDate instanceof Date 
        ? s.snapshotDate.toISOString().split('T')[0] 
        : String(s.snapshotDate);
      
      // 计算 Unix timestamp（秒）
      const time = Math.floor(new Date(dateStr).getTime() / 1000);
      
      // 基础数据
      const close = Number(s.averageSellingPrice);
      const dailyReturn = Number(s.dailyReturn);
      const volume = s.dailySalesQuantity;
      
      // 计算开盘价：第一天用 close * (1 - dailyReturn/200)，后续用前一天的 close
      let open: number;
      if (index === 0) {
        open = close * (1 - dailyReturn / 200);
      } else {
        const prevSnapshot = snapshots[index - 1];
        open = Number(prevSnapshot.averageSellingPrice);
      }
      
      // 基于日期字符串生成确定性伪随机数
      const seed = dateStr.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const variation = (seed % 100) / 50000;  // 0 ~ 0.002，缩小为原来的1/5

      // 计算最高价和最低价
      const maxOC = Math.max(open, close);
      const minOC = Math.min(open, close);

      // 涨跌区分处理：增大returnFactor灵敏度
      const absReturnFactor = Math.abs(dailyReturn) / 50;  // 增大约3倍
      const upBias = dailyReturn > 0 ? absReturnFactor * 0.5 : 0;    // 上涨时 high 额外拉高
      const downBias = dailyReturn < 0 ? absReturnFactor * 0.5 : 0;  // 下跌时 low 额外压低

      const high = maxOC * (1 + absReturnFactor + variation + upBias);
      const low = minOC * (1 - absReturnFactor - variation - downBias);
      
      return {
        date: dateStr,
        time,
        open,
        high,
        low,
        close,
        volume,
        dailySalesQuantity: s.dailySalesQuantity,
        dailySalesRevenue: Number(s.dailySalesRevenue),
        averageSellingPrice: Number(s.averageSellingPrice),
        dailyReturn: Number(s.dailyReturn),
        totalFundingAmount: Number(s.totalFundingAmount),
        cumulativeReturn: Number(s.cumulativeReturn) || 0,
        fundingHeat: s.fundingHeat || 0,
      };
    });
  }

  /**
   * 生成分时数据（15m/1h/4h）
   */
  private generateIntradayData(dailyData: KLineData[], period: KLinePeriod): KLineData[] {
    const result: KLineData[] = [];
    
    // 确定每个交易日的子周期数量
    let subPeriodsPerDay: number;
    let intervalSeconds: number;
    
    switch (period) {
      case KLinePeriod.FIFTEEN_MIN:
        subPeriodsPerDay = 26; // 6.5小时 * 4 = 26个15分钟周期（模拟9:30-16:00）
        intervalSeconds = 15 * 60;
        break;
      case KLinePeriod.ONE_HOUR:
        subPeriodsPerDay = 6; // 6个小时（模拟9:30-15:30交易时间）
        intervalSeconds = 60 * 60;
        break;
      case KLinePeriod.FOUR_HOURS:
        subPeriodsPerDay = 2; // 2个4小时周期
        intervalSeconds = 4 * 60 * 60;
        break;
      default:
        subPeriodsPerDay = 6;
        intervalSeconds = 60 * 60;
    }

    for (const dayKLine of dailyData) {
      // 基准时间戳（当天开盘时间 9:30）
      const baseDate = new Date(dayKLine.date.split(' ')[0]);
      const baseTime = Math.floor(baseDate.getTime() / 1000) + 9.5 * 3600; // 9:30 AM
      
      // 生成子周期数据
      const subPeriods = this.generateSubPeriods(dayKLine, subPeriodsPerDay, baseTime, intervalSeconds);
      result.push(...subPeriods);
    }

    return result;
  }

  /**
   * 生成单日的子周期数据
   */
  private generateSubPeriods(
    dayKLine: KLineData,
    subPeriodsPerDay: number,
    baseTime: number,
    intervalSeconds: number
  ): KLineData[] {
    const result: KLineData[] = [];
    const { open: dayOpen, high: dayHigh, low: dayLow, close: dayClose, volume: dayVolume } = dayKLine;
    
    // 基于日期字符串生成确定性随机种子
    const seed = dayKLine.date.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    
    // 生成价格路径（从 dayOpen 到 dayClose 的随机游走）
    const pricePoints: number[] = [];
    pricePoints.push(dayOpen);
    
    const priceRange = dayHigh - dayLow;
    const step = (dayClose - dayOpen) / (subPeriodsPerDay - 1);
    
    for (let i = 1; i < subPeriodsPerDay; i++) {
      const deterministicRandom = ((seed * (i + 1) * 17) % 1000) / 1000;
      const noise = (deterministicRandom - 0.5) * priceRange * 0.3;
      const basePrice = dayOpen + step * i;
      let price = basePrice + noise;
      
      // 确保价格在日线范围内
      price = Math.max(dayLow, Math.min(dayHigh, price));
      pricePoints.push(price);
    }
    
    
    // 最后一个点确保是 dayClose
    pricePoints[subPeriodsPerDay - 1] = dayClose;
    
    // 分配成交量（带随机扰动）
    const volumeWeights: number[] = [];
    let totalWeight = 0;
    for (let i = 0; i < subPeriodsPerDay; i++) {
      const weight = 0.8 + ((seed * (i + 2) * 13) % 1000) / 2500; // 0.8 ~ 1.2
      volumeWeights.push(weight);
      totalWeight += weight;
    }
    
    // 生成每个子周期的 K 线数据
    for (let i = 0; i < subPeriodsPerDay; i++) {
      const periodOpen = pricePoints[i];
      const periodClose = i < subPeriodsPerDay - 1 ? pricePoints[i + 1] : dayClose;
      
      // 计算 high/low（在 open 和 close 之间，并略微扩展）
      const minOC = Math.min(periodOpen, periodClose);
      const maxOC = Math.max(periodOpen, periodClose);
      const expandFactor = priceRange * 0.1;
      
      const periodHigh = Math.min(dayHigh, maxOC + expandFactor);
      const periodLow = Math.max(dayLow, minOC - expandFactor);
      
      // 计算成交量
      const periodVolume = Math.round((dayVolume * volumeWeights[i]) / totalWeight);
      
      // 时间戳
      const periodTime = baseTime + i * intervalSeconds;
      
      // 格式化日期时间
      const periodDate = new Date(periodTime * 1000);
      const dateStr = periodDate.toISOString().split('T')[0];
      const hours = String(periodDate.getHours()).padStart(2, '0');
      const minutes = String(periodDate.getMinutes()).padStart(2, '0');
      const dateTimeStr = `${dateStr} ${hours}:${minutes}`;
      
      // 按比例分配其他字段
      const ratio = volumeWeights[i] / totalWeight;
      
      result.push({
        date: dateTimeStr,
        time: periodTime,
        open: Number(periodOpen.toFixed(2)),
        high: Number(periodHigh.toFixed(2)),
        low: Number(periodLow.toFixed(2)),
        close: Number(periodClose.toFixed(2)),
        volume: periodVolume,
        dailySalesQuantity: Math.round(dayKLine.dailySalesQuantity * ratio),
        dailySalesRevenue: Number((dayKLine.dailySalesRevenue * ratio).toFixed(2)),
        averageSellingPrice: Number(((periodOpen + periodClose) / 2).toFixed(2)),
        dailyReturn: Number((dayKLine.dailyReturn * ratio).toFixed(4)),
        totalFundingAmount: Number((dayKLine.totalFundingAmount * ratio).toFixed(2)),
        cumulativeReturn: Number((dayKLine.cumulativeReturn * ratio).toFixed(4)),
        fundingHeat: Math.round(dayKLine.fundingHeat * ratio),
      });
    }

    return result;
  }

  /**
   * 聚合为周线数据
   */
  private aggregateToWeekly(dailyData: KLineData[]): KLineData[] {
    if (dailyData.length === 0) return [];

    const weeklyMap = new Map<string, KLineData[]>();

    for (const item of dailyData) {
      const date = new Date(item.time * 1000);
      // 获取该周的周一日期
      const dayOfWeek = date.getDay();
      const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(date);
      monday.setDate(diff);
      const weekKey = monday.toISOString().split('T')[0];

      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, []);
      }
      weeklyMap.get(weekKey)!.push(item);
    }

    const result: KLineData[] = [];
    const sortedWeeks = Array.from(weeklyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    for (const [weekKey, weekData] of sortedWeeks) {
      if (weekData.length === 0) continue;

      const sortedData = weekData.sort((a, b) => a.time - b.time);
      const open = sortedData[0].open;
      const close = sortedData[sortedData.length - 1].close;
      const high = Math.max(...sortedData.map(d => d.high));
      const low = Math.min(...sortedData.map(d => d.low));
      const volume = sortedData.reduce((sum, d) => sum + d.volume, 0);
      const dailySalesQuantity = sortedData.reduce((sum, d) => sum + d.dailySalesQuantity, 0);
      const dailySalesRevenue = sortedData.reduce((sum, d) => sum + d.dailySalesRevenue, 0);
      const totalFundingAmount = sortedData.reduce((sum, d) => sum + d.totalFundingAmount, 0);
      const dailyReturn = sortedData.reduce((sum, d) => sum + d.dailyReturn, 0);
      const cumulativeReturn = sortedData[sortedData.length - 1].cumulativeReturn;
      const fundingHeat = sortedData.reduce((sum, d) => sum + d.fundingHeat, 0);
      
      // 周一时间戳
      const mondayDate = new Date(weekKey);
      const time = Math.floor(mondayDate.getTime() / 1000);

      result.push({
        date: weekKey,
        time,
        open,
        high,
        low,
        close,
        volume,
        dailySalesQuantity,
        dailySalesRevenue: Number(dailySalesRevenue.toFixed(2)),
        averageSellingPrice: Number(((open + close) / 2).toFixed(2)),
        dailyReturn: Number(dailyReturn.toFixed(4)),
        totalFundingAmount: Number(totalFundingAmount.toFixed(2)),
        cumulativeReturn,
        fundingHeat,
      });
    }

    return result;
  }

  /**
   * 聚合为月线数据
   */
  private aggregateToMonthly(dailyData: KLineData[]): KLineData[] {
    if (dailyData.length === 0) return [];

    const monthlyMap = new Map<string, KLineData[]>();

    for (const item of dailyData) {
      const date = new Date(item.time * 1000);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, []);
      }
      monthlyMap.get(monthKey)!.push(item);
    }

    const result: KLineData[] = [];
    const sortedMonths = Array.from(monthlyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    for (const [monthKey, monthData] of sortedMonths) {
      if (monthData.length === 0) continue;

      const sortedData = monthData.sort((a, b) => a.time - b.time);
      const open = sortedData[0].open;
      const close = sortedData[sortedData.length - 1].close;
      const high = Math.max(...sortedData.map(d => d.high));
      const low = Math.min(...sortedData.map(d => d.low));
      const volume = sortedData.reduce((sum, d) => sum + d.volume, 0);
      const dailySalesQuantity = sortedData.reduce((sum, d) => sum + d.dailySalesQuantity, 0);
      const dailySalesRevenue = sortedData.reduce((sum, d) => sum + d.dailySalesRevenue, 0);
      const totalFundingAmount = sortedData.reduce((sum, d) => sum + d.totalFundingAmount, 0);
      const dailyReturn = sortedData.reduce((sum, d) => sum + d.dailyReturn, 0);
      const cumulativeReturn = sortedData[sortedData.length - 1].cumulativeReturn;
      const fundingHeat = sortedData.reduce((sum, d) => sum + d.fundingHeat, 0);
      
      // 月初时间戳
      const monthDate = new Date(monthKey);
      const time = Math.floor(monthDate.getTime() / 1000);

      result.push({
        date: monthKey,
        time,
        open,
        high,
        low,
        close,
        volume,
        dailySalesQuantity,
        dailySalesRevenue: Number(dailySalesRevenue.toFixed(2)),
        averageSellingPrice: Number(((open + close) / 2).toFixed(2)),
        dailyReturn: Number(dailyReturn.toFixed(4)),
        totalFundingAmount: Number(totalFundingAmount.toFixed(2)),
        cumulativeReturn,
        fundingHeat,
      });
    }

    return result;
  }

  /**
   * 获取认购深度数据
   */
  async getDrugDepth(drugId: string): Promise<DepthData> {
    this.validateUUID(drugId);

    const drug = await this.drugRepo.findOne({ where: { id: drugId } });
    if (!drug) {
      throw new NotFoundException('药品不存在');
    }

    // 获取所有未清算订单
    const activeOrders = await this.subscriptionOrderRepo.find({
      where: {
        drugId,
        status: SubscriptionOrderStatus.EFFECTIVE,
      },
      order: { queuePosition: 'ASC' },
    });

    // 定义金额区间
    const ranges = [
      { min: 0, max: 5000, label: '0-5千' },
      { min: 5000, max: 10000, label: '5千-1万' },
      { min: 10000, max: 50000, label: '1万-5万' },
      { min: 50000, max: 100000, label: '5万-10万' },
      { min: 100000, max: Infinity, label: '10万+' },
    ];

    const rangeStats = ranges.map(range => ({
      ...range,
      count: 0,
      amount: 0,
    }));

    let totalAmount = 0;

    for (const order of activeOrders) {
      const amount = Number(order.unsettledAmount);
      totalAmount += amount;
      
      for (const range of rangeStats) {
        if (amount >= range.min && amount < range.max) {
          range.count++;
          range.amount += amount;
          break;
        }
      }
    }

    return {
      ranges: rangeStats,
      totalAmount,
      totalCount: activeOrders.length,
    };
  }

  /**
   * 获取热门药品排行
   */
  async getHotList(limit: number = 10): Promise<MarketOverviewItem[]> {
    const overview = await this.getMarketOverview();
    return overview.slice(0, limit);
  }

  /**
   * 获取平台全局统计
   */
  async getMarketStats(): Promise<MarketStats> {
    // 总药品数
    const totalDrugs = await this.drugRepo.count();

    // 总认购额（所有未清算订单）
    const activeOrders = await this.subscriptionOrderRepo.find({
      where: { status: SubscriptionOrderStatus.EFFECTIVE },
    });
    const totalFundingAmount = activeOrders.reduce((sum, o) => sum + Number(o.unsettledAmount), 0);

    // 总销售额
    const allSales = await this.dailySalesRepo.find();
    const totalSalesRevenue = allSales.reduce((sum, s) => sum + Number(s.totalRevenue), 0);

    // 总清算次数
    const totalSettlementCount = await this.settlementRepo.count();

    // 活跃认购方数量（有未清算订单的用户）
    const activeFunderIds = new Set(activeOrders.map(o => o.userId));
    const activeFunderCount = activeFunderIds.size;

    return {
      totalDrugs,
      totalFundingAmount,
      totalSalesRevenue,
      totalSettlementCount,
      activeFunderCount,
    };
  }

  /**
   * 获取所有药品的最新行情（用于WebSocket推送）
   */
  async getLatestTickers(): Promise<Partial<MarketOverviewItem>[]> {
    const drugs = await this.drugRepo.find();
    const tickers: Partial<MarketOverviewItem>[] = [];

    for (const drug of drugs) {
      const latestSnapshot = await this.marketSnapshotRepo.findOne({
        where: { drugId: drug.id },
        order: { snapshotDate: 'DESC' },
      });

      tickers.push({
        drugId: drug.id,
        drugName: drug.name,
        drugCode: drug.code,
        sellingPrice: Number(drug.sellingPrice),
        dailyReturn: latestSnapshot ? Number(latestSnapshot.dailyReturn) : 0,
        cumulativeReturn: latestSnapshot ? Number(latestSnapshot.cumulativeReturn) : 0,
        fundingHeat: latestSnapshot ? latestSnapshot.fundingHeat : 0,
      });
    }

    return tickers;
  }
}
