import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { User, UserRole } from '../entities/user.entity';
import { Drug, DrugStatus } from '../entities/drug.entity';
import { FundingOrder, FundingOrderStatus } from '../entities/funding-order.entity';
import { DailySales } from '../entities/daily-sales.entity';
import { MarketSnapshot } from '../entities/market-snapshot.entity';
import { AccountTransaction, TransactionType } from '../entities/account-transaction.entity';
import { Settlement, SettlementStatus } from '../entities/settlement.entity';
import { AccountBalance } from '../entities/account-balance.entity';

// 加载环境变量
config({ path: join(__dirname, '../../../.env') });

export default class MockHistorySeed {
  async run(dataSource: DataSource): Promise<void> {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 获取仓库
      const userRepository = dataSource.getRepository(User);
      const drugRepository = dataSource.getRepository(Drug);
      const fundingOrderRepository = dataSource.getRepository(FundingOrder);
      const dailySalesRepository = dataSource.getRepository(DailySales);
      const marketSnapshotRepository = dataSource.getRepository(MarketSnapshot);
      const accountTransactionRepository = dataSource.getRepository(AccountTransaction);
      const settlementRepository = dataSource.getRepository(Settlement);
      const accountBalanceRepository = dataSource.getRepository(AccountBalance);

      // 1. 查询现有用户和药品
      const admin = await userRepository.findOne({ where: { username: 'admin', role: UserRole.ADMIN } });
      const investor1 = await userRepository.findOne({ where: { username: 'investor1', role: UserRole.INVESTOR } });
      const investor2 = await userRepository.findOne({ where: { username: 'investor2', role: UserRole.INVESTOR } });

      if (!admin || !investor1 || !investor2) {
        throw new Error('缺少必要的用户数据，请先运行 initial.seed.ts');
      }

      const allDrugs = await drugRepository.find();
      const drugs = allDrugs.filter(d => d.code.startsWith('DRUG-'));
      if (drugs.length === 0) {
        throw new Error('缺少药品数据，请先运行 initial.seed.ts');
      }

      // 创建药品映射
      const drugMap = new Map(drugs.map(d => [d.code, d]));

      console.log(`找到用户: admin=${admin.id}, investor1=${investor1.id}, investor2=${investor2.id}`);
      console.log(`找到 ${drugs.length} 种药品`);

      // 2. 生成垫资订单 (20-25条)
      console.log('\n=== 生成垫资订单 ===');
      const fundingOrders: FundingOrder[] = [];
      const orderCount = 22;
      const investors = [investor1, investor2];
      const drugCodes = ['DRUG-001', 'DRUG-002', 'DRUG-003', 'DRUG-004', 'DRUG-005', 'DRUG-006', 'DRUG-007'];
      
      // 状态分布: 60% settled, 30% holding/partial_settled (模拟funded), 10% pending (模拟queued)
      const statusDistribution = [
        ...Array(13).fill(FundingOrderStatus.SETTLED),
        ...Array(6).fill(FundingOrderStatus.HOLDING),
        ...Array(3).fill(FundingOrderStatus.PENDING),
      ];

      for (let i = 0; i < orderCount; i++) {
        const investor = investors[i % 2];
        const drugCode = drugCodes[i % drugCodes.length];
        const drug = drugMap.get(drugCode)!;
        const quantity = Math.floor(Math.random() * 4900) + 100; // 100-5000
        const amount = Math.round(quantity * drug.purchasePrice * 100) / 100;
        const status = statusDistribution[i];
        
        // 生成 fundedAt (过去30天内)
        const fundedAt = this.getRandomDateInPast(30);
        
        // settledAt 在 fundedAt 之后 (仅 settled 状态)
        let settledAt: Date | null = null;
        let settledQuantity = 0;
        let unsettledAmount = amount;
        let totalProfit = 0;
        let totalInterest = 0;

        if (status === FundingOrderStatus.SETTLED) {
          settledAt = new Date(fundedAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000); // 1-7天后结算
          settledQuantity = quantity;
          unsettledAmount = 0;
          // 模拟收益: 售价-进价的30%-80%作为毛利，投资者分70%
          const profitPerUnit = drug.sellingPrice - drug.purchasePrice;
          const totalProfitRaw = quantity * profitPerUnit * (0.3 + Math.random() * 0.5);
          totalProfit = Math.round(totalProfitRaw * 0.7 * 100) / 100;
          // 模拟利息: 年化5%，按天计算
          const days = Math.ceil((settledAt.getTime() - fundedAt.getTime()) / (24 * 60 * 60 * 1000));
          totalInterest = Math.round(amount * (drug.annualRate / 100) * (days / 365) * 100) / 100;
        } else if (status === FundingOrderStatus.HOLDING) {
          settledQuantity = Math.floor(quantity * Math.random() * 0.5); // 部分结算
          unsettledAmount = Math.round((quantity - settledQuantity) * drug.purchasePrice * 100) / 100;
        }

        const order = fundingOrderRepository.create({
          orderNo: `ORD-${Date.now()}-${i.toString().padStart(4, '0')}`,
          userId: investor.id,
          drugId: drug.id,
          quantity,
          amount,
          settledQuantity,
          unsettledAmount,
          status,
          queuePosition: i + 1,
          fundedAt,
          settledAt,
          totalProfit,
          totalLoss: 0,
          totalInterest,
        });

        fundingOrders.push(order);
      }

      const savedOrders = await fundingOrderRepository.save(fundingOrders);
      console.log(`✓ 创建了 ${savedOrders.length} 条垫资订单`);

      // 清除旧的快照和销售数据，避免重复
      console.log('\n=== 清除旧数据 ===');
      await queryRunner.query('DELETE FROM market_snapshots');
      await queryRunner.query('DELETE FROM daily_sales');
      console.log('✓ 已清除旧的市场快照和每日销售记录');

      // 3. 生成每日销售记录 (365天，每天3-5种药品有销售)
      console.log('\n=== 生成每日销售记录 ===');
      const dailySales: DailySales[] = [];
      const terminals = ['终端A', '终端B', '终端C', '终端D', '终端E'];

      for (let day = 364; day >= 0; day--) {
        const saleDate = new Date();
        saleDate.setDate(saleDate.getDate() - day);
        saleDate.setHours(0, 0, 0, 0);

        // 每天随机选择3-5种药品有销售
        const dailyDrugCount = 3 + Math.floor(Math.random() * 3); // 3-5种
        const dailyDrugs = drugCodes.sort(() => 0.5 - Math.random()).slice(0, dailyDrugCount);
        
        for (const drugCode of dailyDrugs) {
          const drug = drugMap.get(drugCode)!;
          // 销售量有周期性波动（模拟周末少、工作日多）
          const dayOfWeek = saleDate.getDay();
          const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.5 : 1.0;
          const seed = (drugCode.charCodeAt(5) * 31 + day * 7) % 100;
          const quantity = Math.floor((800 + seed * 25) * weekendFactor); 
          
          const actualSellingPrice = drug.sellingPrice * (0.95 + Math.random() * 0.1); // 售价浮动 ±5%
          const totalRevenue = Math.round(quantity * actualSellingPrice * 100) / 100;

          const sale = dailySalesRepository.create({
            drugId: drug.id,
            saleDate,
            quantity,
            actualSellingPrice: Math.round(actualSellingPrice * 100) / 100,
            totalRevenue,
            terminal: terminals[Math.floor(Math.random() * terminals.length)],
          });

          dailySales.push(sale);
        }
      }

      const savedSales = await dailySalesRepository.save(dailySales);
      console.log(`✓ 创建了 ${savedSales.length} 条每日销售记录`);

      // 4. 生成市场快照 (全部7种药品，每种365天数据)
      console.log('\n=== 生成市场快照 ===');
      const marketSnapshots: MarketSnapshot[] = [];

      // 为每种药品定义差异化特征
      const drugCharacteristics: Record<string, {
        baseBias: number;      // 基础偏移（上涨趋势强度）
        volatility: number;    // 波动率
        salesBase: number;     // 销量基数
        fundingBase: number;   // 垫资金额基数
      }> = {
        'DRUG-001': { baseBias: 0.006, volatility: 0.012, salesBase: 900, fundingBase: 80000 },   // 三九感冒灵 - 稳健上涨
        'DRUG-002': { baseBias: 0.008, volatility: 0.018, salesBase: 700, fundingBase: 60000 },   // 阿莫西林 - 较高波动
        'DRUG-003': { baseBias: 0.005, volatility: 0.010, salesBase: 850, fundingBase: 70000 },   // 板蓝根 - 低波动稳健
        'DRUG-004': { baseBias: 0.010, volatility: 0.022, salesBase: 500, fundingBase: 90000 },   // 布洛芬 - 高波动高增长
        'DRUG-005': { baseBias: 0.007, volatility: 0.015, salesBase: 400, fundingBase: 100000 },  // 复方丹参 - 中等波动
        'DRUG-006': { baseBias: 0.009, volatility: 0.020, salesBase: 750, fundingBase: 75000 },   // 连花清瘟 - 较高波动
        'DRUG-007': { baseBias: 0.004, volatility: 0.008, salesBase: 1000, fundingBase: 50000 },  // 蒙脱石散 - 最稳定
      };

      // 为每种药品生成365天的连续快照
      for (const drugCode of drugCodes) {
        const drug = drugMap.get(drugCode)!;
        const chars = drugCharacteristics[drugCode] || { baseBias: 0.005, volatility: 0.015, salesBase: 800, fundingBase: 60000 };
        let cumulativeReturn = 0;
        let totalFundingAmount = chars.fundingBase + Math.round(Math.random() * 50000);
        const basePrice = Number(drug.sellingPrice);
        
        for (let day = 364; day >= 0; day--) {
          const snapshotDate = new Date();
          snapshotDate.setDate(snapshotDate.getDate() - day);
          snapshotDate.setHours(0, 0, 0, 0);
          
          // 使用确定性随机（基于日期+药品code）让数据可重现
          const seed = (drugCode.charCodeAt(5) * 31 + day * 7) % 100;
          const drugIndex = parseInt(drugCode.split('-')[1]) - 1; // 0-6

          // 模拟真实波动：整体呈上涨趋势，使用药品差异化参数
          const baseBias = chars.baseBias + (seed % 30) / 10000;  // 个性化基础偏移
          const cyclical = Math.sin(day / (15 + drugIndex * 3)) * chars.volatility;  // 个性化周期
          const noise = ((seed % 40) / 1000 - 0.02) * chars.volatility * 1.5;  // 个性化噪声
          const dailyReturn = baseBias + cyclical + noise;
          // 约束在合理范围：最小-2%，最大+5%，整体偏正
          const clampedReturn = Math.max(-0.02, Math.min(0.05, dailyReturn));

          cumulativeReturn += clampedReturn;

          // 销售量有周期性波动（模拟周末少、工作日多），并随时间增长
          const dayOfWeek = snapshotDate.getDay();
          const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.4 : 1.0;
          const trendFactor = 1 + (364 - day) * 0.001;  // 从 day=364（最远）到 day=0（最近），增长约36%
          const dailySalesQuantity = Math.floor((chars.salesBase + seed * 25) * weekendFactor * trendFactor);

          // 均价随累积收益率上涨，形成明确上升趋势
          const priceVariation = 1 + cumulativeReturn * 0.6;  // 累积收益率影响价格
          const averageSellingPrice = Math.round(basePrice * priceVariation * 100) / 100;
          const dailySalesRevenue = Math.round(dailySalesQuantity * averageSellingPrice * 100) / 100;
          
          // 垫资金额有趋势性
          const fundingDelta = Math.round((seed - 50) * 300 + Math.sin(day / (20 + drugIndex * 2)) * 15000);
          totalFundingAmount = Math.max(10000, totalFundingAmount + fundingDelta);
          
          // 热度和深度
          const fundingHeat = Math.floor(30 + seed * 0.7 + Math.sin(day / (7 + drugIndex)) * 20);
          const queueDepth = Math.floor(5 + seed * 0.4 + Math.cos(day / (12 + drugIndex * 2)) * 10);
          
          const snapshot = marketSnapshotRepository.create({
            drugId: drug.id,
            snapshotDate,
            dailySalesQuantity,
            dailySalesRevenue,
            averageSellingPrice,
            dailyReturn: Math.round(clampedReturn * 10000) / 10000,
            cumulativeReturn: Math.round(cumulativeReturn * 10000) / 10000,
            totalFundingAmount: Math.round(totalFundingAmount * 100) / 100,
            fundingHeat: Math.max(0, Math.min(100, fundingHeat)),
            queueDepth: Math.max(1, queueDepth),
          });
          
          marketSnapshots.push(snapshot);
        }
      }

      const savedSnapshots = await marketSnapshotRepository.save(marketSnapshots);
      console.log(`✓ 创建了 ${savedSnapshots.length} 条市场快照`);

      // 5. 生成账户流水 (15条)
      console.log('\n=== 生成账户流水 ===');
      const transactions: AccountTransaction[] = [];

      // 为每个投资者生成流水
      for (const investor of investors) {
        // 获取当前余额
        let balance = await accountBalanceRepository.findOne({ where: { userId: investor.id } });
        if (!balance) {
          balance = accountBalanceRepository.create({
            userId: investor.id,
            availableBalance: 100000,
            frozenBalance: 0,
            totalProfit: 0,
            totalInvested: 0,
          });
          await accountBalanceRepository.save(balance);
        }

        let currentBalance = Number(balance.availableBalance) || 100000;
        const investorOrders = savedOrders.filter(o => o.userId === investor.id);

        // 充值记录 (2条)
        for (let i = 0; i < 2; i++) {
          const amount = Math.round((50000 + Math.random() * 50000) * 100) / 100;
          const balanceBefore = Math.round(currentBalance * 100) / 100;
          currentBalance = Math.round((currentBalance + amount) * 100) / 100;

          transactions.push(accountTransactionRepository.create({
            userId: investor.id,
            type: TransactionType.RECHARGE,
            amount,
            balanceBefore,
            balanceAfter: currentBalance,
            description: `账户充值 ¥${amount.toFixed(2)}`,
            createdAt: this.getRandomDateInPast(25),
          }));
        }

        // 垫资记录 (对应订单)
        for (const order of investorOrders.slice(0, 5)) {
          const orderAmount = Number(order.amount);
          const balanceBefore = Math.round(currentBalance * 100) / 100;
          currentBalance = Math.round((currentBalance - orderAmount) * 100) / 100;

          const drugName = drugMap.get(drugs.find(d => d.id === order.drugId)!.code)!.name;
          transactions.push(accountTransactionRepository.create({
            userId: investor.id,
            type: TransactionType.FUNDING,
            amount: -orderAmount,
            balanceBefore,
            balanceAfter: currentBalance,
            relatedOrderId: order.id,
            description: `垫资购买 ${drugName}`,
            createdAt: order.fundedAt,
          }));
        }

        // 收益记录 (对应已结算订单)
        const settledOrders = investorOrders.filter(o => o.status === FundingOrderStatus.SETTLED && o.totalProfit > 0);
        for (const order of settledOrders.slice(0, 3)) {
          const orderAmount = Number(order.amount);
          const orderProfit = Number(order.totalProfit);
          const orderInterest = Number(order.totalInterest);
          // 收益 = 本金 + 利润 + 利息
          const returnAmount = orderAmount + orderProfit + orderInterest;
          const balanceBefore = Math.round(currentBalance * 100) / 100;
          currentBalance = Math.round((currentBalance + returnAmount) * 100) / 100;

          transactions.push(accountTransactionRepository.create({
            userId: investor.id,
            type: TransactionType.PROFIT_SHARE,
            amount: returnAmount,
            balanceBefore,
            balanceAfter: currentBalance,
            relatedOrderId: order.id,
            description: `垫资收益结算 (本金+利润)`,
            createdAt: order.settledAt!,
          }));
        }

        // 更新账户余额
        balance.availableBalance = currentBalance;
        await accountBalanceRepository.save(balance);
      }

      const savedTransactions = await accountTransactionRepository.save(transactions);
      console.log(`✓ 创建了 ${savedTransactions.length} 条账户流水`);

      // 6. 生成清算记录 (5条)
      console.log('\n=== 生成清算记录 ===');
      const settlements: Settlement[] = [];
      const settledDrugs = drugCodes.slice(0, 5);

      for (let i = 0; i < 5; i++) {
        const drugCode = settledDrugs[i];
        const drug = drugMap.get(drugCode)!;
        
        const settlementDate = new Date();
        settlementDate.setDate(settlementDate.getDate() - i * 2);
        settlementDate.setHours(0, 0, 0, 0);

        // 获取该药品的已结算订单
        const drugSettledOrders = savedOrders.filter(o => o.drugId === drug.id && o.status === FundingOrderStatus.SETTLED);
        
        if (drugSettledOrders.length > 0) {
          const totalCost = drugSettledOrders.reduce((sum, o) => sum + Number(o.amount), 0);
          const totalSalesRevenue = drugSettledOrders.reduce((sum, o) => sum + (o.quantity * Number(drug.sellingPrice)), 0);
          const totalFees = drugSettledOrders.reduce((sum, o) => sum + (o.quantity * Number(drug.unitFee)), 0);
          const totalInterest = drugSettledOrders.reduce((sum, o) => sum + Number(o.totalInterest), 0);
          
          const netProfit = Math.round((totalSalesRevenue - totalCost - totalFees - totalInterest) * 100) / 100;
          const investorProfitShare = Math.max(0, Math.round(netProfit * 0.7 * 100) / 100);
          const platformProfitShare = Math.max(0, Math.round(netProfit * 0.3 * 100) / 100);

          const settlement = settlementRepository.create({
            drugId: drug.id,
            settlementDate,
            totalSalesRevenue: Math.round(totalSalesRevenue * 100) / 100,
            totalCost: Math.round(totalCost * 100) / 100,
            totalFees: Math.round(totalFees * 100) / 100,
            totalInterest: Math.round(totalInterest * 100) / 100,
            netProfit: Math.max(0, netProfit),
            investorProfitShare,
            platformProfitShare,
            investorLossShare: 0,
            platformLossShare: 0,
            settledPrincipal: Math.round(totalCost * 100) / 100,
            settledOrderCount: drugSettledOrders.length,
            status: SettlementStatus.COMPLETED,
          });

          settlements.push(settlement);
        }
      }

      const savedSettlements = await settlementRepository.save(settlements);
      console.log(`✓ 创建了 ${savedSettlements.length} 条清算记录`);

      await queryRunner.commitTransaction();

      // 返回统计信息
      console.log('\n========================================');
      console.log('模拟历史数据生成完成！');
      console.log('========================================');
      console.log(`垫资订单: ${savedOrders.length} 条`);
      console.log(`  - 已结算(SETTLED): ${savedOrders.filter(o => o.status === FundingOrderStatus.SETTLED).length} 条`);
      console.log(`  - 持有中(HOLDING): ${savedOrders.filter(o => o.status === FundingOrderStatus.HOLDING).length} 条`);
      console.log(`  - 待处理(PENDING): ${savedOrders.filter(o => o.status === FundingOrderStatus.PENDING).length} 条`);
      console.log(`每日销售: ${savedSales.length} 条`);
      console.log(`市场快照: ${savedSnapshots.length} 条`);
      console.log(`账户流水: ${savedTransactions.length} 条`);
      console.log(`清算记录: ${savedSettlements.length} 条`);
      console.log('========================================');

    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('生成模拟数据失败:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // 辅助方法：生成过去N天内的随机日期
  private getRandomDateInPast(days: number): Date {
    const now = new Date();
    const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const randomTime = past.getTime() + Math.random() * (now.getTime() - past.getTime());
    return new Date(randomTime);
  }
}

// 独立运行入口
async function bootstrap() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'a1234',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'yaozhuanzhuan',
    entities: [join(__dirname, '../entities/*.entity{.ts,.js}')],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('数据库连接成功');

    const seed = new MockHistorySeed();
    await seed.run(dataSource);

    await dataSource.destroy();
    console.log('数据库连接已关闭');
    process.exit(0);
  } catch (error) {
    console.error('种子数据执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行 bootstrap
if (require.main === module) {
  bootstrap();
}
