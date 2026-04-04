import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';
import { join } from 'path';
import { User, UserRole } from '../entities/user.entity';
import { Drug, DrugStatus } from '../entities/drug.entity';
import { AccountBalance } from '../entities/account-balance.entity';

// 加载环境变量
config({ path: join(__dirname, '../../../.env') });

export default class InitialSeed {
  async run(dataSource: DataSource): Promise<void> {
    const userRepository = dataSource.getRepository(User);
    const drugRepository = dataSource.getRepository(Drug);
    const accountBalanceRepository = dataSource.getRepository(AccountBalance);

    // 创建管理员账户
    const adminExists = await userRepository.findOne({
      where: { username: 'admin' },
    });

    if (!adminExists) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      const admin = userRepository.create({
        username: 'admin',
        password: hashedPassword,
        role: UserRole.ADMIN,
        realName: '系统管理员',
        phone: '13800000000',
      });
      await userRepository.save(admin);
      console.log('管理员账户已创建: admin / admin123');
    }

    // 创建测试垫资方账户
    const investors = [
      { username: 'investor1', password: '123456', realName: '测试垫资方1', phone: '13800000001' },
      { username: 'investor2', password: '123456', realName: '测试垫资方2', phone: '13800000002' },
    ];

    for (const investorData of investors) {
      const exists = await userRepository.findOne({
        where: { username: investorData.username },
      });

      if (!exists) {
        const hashedPassword = bcrypt.hashSync(investorData.password, 10);
        const investor = userRepository.create({
          username: investorData.username,
          password: hashedPassword,
          role: UserRole.INVESTOR,
          realName: investorData.realName,
          phone: investorData.phone,
        });
        const savedInvestor = await userRepository.save(investor);

        // 创建初始余额 100000 元
        const balance = accountBalanceRepository.create({
          userId: savedInvestor.id,
          availableBalance: 100000,
          frozenBalance: 0,
          totalProfit: 0,
          totalInvested: 0,
        });
        await accountBalanceRepository.save(balance);
        console.log(`垫资方账户已创建: ${investorData.username} / ${investorData.password}，初始余额: 100000元`);
      }
    }

    // 创建示例药品
    const drugs = [
      {
        name: '三九感冒灵',
        code: 'DRUG-001',
        purchasePrice: 13.0,
        sellingPrice: 20.0,
        totalQuantity: 76923,
        batchNo: 'BATCH-2024-001',
        status: DrugStatus.FUNDING,
        annualRate: 5.0,
        unitFee: 1.0,
      },
      {
        name: '阿莫西林胶囊',
        code: 'DRUG-002',
        purchasePrice: 8.0,
        sellingPrice: 15.0,
        totalQuantity: 50000,
        batchNo: 'BATCH-2024-002',
        status: DrugStatus.FUNDING,
        annualRate: 5.0,
        unitFee: 1.0,
      },
      {
        name: '板蓝根颗粒',
        code: 'DRUG-003',
        purchasePrice: 10.0,
        sellingPrice: 18.0,
        totalQuantity: 80000,
        batchNo: 'BATCH-2024-003',
        status: DrugStatus.FUNDING,
        annualRate: 4.5,
        unitFee: 0.8,
      },
      {
        name: '布洛芬缓释胶囊',
        code: 'DRUG-004',
        purchasePrice: 15.0,
        sellingPrice: 28.0,
        totalQuantity: 40000,
        batchNo: 'BATCH-2024-004',
        status: DrugStatus.FUNDING,
        annualRate: 5.5,
        unitFee: 1.2,
      },
      {
        name: '复方丹参滴丸',
        code: 'DRUG-005',
        purchasePrice: 22.0,
        sellingPrice: 35.0,
        totalQuantity: 30000,
        batchNo: 'BATCH-2024-005',
        status: DrugStatus.FUNDING,
        annualRate: 6.0,
        unitFee: 1.5,
      },
      {
        name: '连花清瘟胶囊',
        code: 'DRUG-006',
        purchasePrice: 12.0,
        sellingPrice: 22.0,
        totalQuantity: 60000,
        batchNo: 'BATCH-2024-006',
        status: DrugStatus.FUNDING,
        annualRate: 5.0,
        unitFee: 1.0,
      },
      {
        name: '蒙脱石散',
        code: 'DRUG-007',
        purchasePrice: 6.0,
        sellingPrice: 12.0,
        totalQuantity: 100000,
        batchNo: 'BATCH-2024-007',
        status: DrugStatus.FUNDING,
        annualRate: 4.0,
        unitFee: 0.5,
      },
    ];

    for (const drugData of drugs) {
      const exists = await drugRepository.findOne({
        where: { code: drugData.code },
      });

      if (!exists) {
        const drug = drugRepository.create(drugData);
        await drugRepository.save(drug);
        console.log(`示例药品已创建: ${drugData.name} (${drugData.code})`);
      }
    }

    console.log('种子数据初始化完成');
  }
}

// 独立运行入口
async function bootstrap() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'yaozhuanzhuan',
    entities: [join(__dirname, '../entities/*.entity{.ts,.js}')],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('数据库连接成功');

    const seed = new InitialSeed();
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
