import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Drug, DrugStatus } from '../../database/entities/drug.entity';
import { MarketSnapshot } from '../../database/entities/market-snapshot.entity';
import {
  CreateDrugDto,
  UpdateDrugDto,
  UpdateDrugStatusDto,
  QueryDrugDto,
} from './dto';

@Injectable()
export class DrugService {
  constructor(
    @InjectRepository(Drug)
    private readonly drugRepository: Repository<Drug>,
    @InjectRepository(MarketSnapshot)
    private readonly marketSnapshotRepository: Repository<MarketSnapshot>,
  ) {}

  /**
   * 创建药品（管理员）
   * 发布采购需求，自动设置状态为 funding
   */
  async create(createDrugDto: CreateDrugDto): Promise<Drug> {
    // 检查编码是否已存在
    const existingDrug = await this.drugRepository.findOne({
      where: { code: createDrugDto.code },
    });

    if (existingDrug) {
      throw new BadRequestException('药品编码已存在');
    }

    const drug = this.drugRepository.create({
      ...createDrugDto,
      status: DrugStatus.FUNDING,
      fundedQuantity: 0,
    });

    return this.drugRepository.save(drug);
  }

  /**
   * 查询药品列表（分页）
   */
  async findAll(queryDto: QueryDrugDto) {
    const {
      status,
      keyword,
      page = 1,
      pageSize = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = queryDto;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (keyword) {
      where.name = Like(`%${keyword}%`);
    }

    const [drugs, total] = await this.drugRepository.findAndCount({
      where,
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 计算额外字段
    const items = drugs.map((drug) => ({
      id: drug.id,
      name: drug.name,
      code: drug.code,
      purchasePrice: drug.purchasePrice,
      sellingPrice: drug.sellingPrice,
      totalQuantity: drug.totalQuantity,
      fundedQuantity: drug.fundedQuantity,
      remainingQuantity: drug.remainingQuantity,
      status: drug.status,
      annualRate: drug.annualRate,
      batchNo: drug.batchNo,
      unitFee: drug.unitFee,
      createdAt: drug.createdAt,
      fundingProgress:
        drug.totalQuantity > 0
          ? Number(((drug.fundedQuantity / drug.totalQuantity) * 100).toFixed(2))
          : 0,
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取药品统计数据
   */
  async getStatistics() {
    const totalDrugs = await this.drugRepository.count();
    const fundingDrugs = await this.drugRepository.count({
      where: { status: DrugStatus.FUNDING },
    });

    // 计算总垫资额
    const result = await this.drugRepository
      .createQueryBuilder('drug')
      .select('SUM(drug.fundedQuantity * drug.purchasePrice)', 'totalFunding')
      .getRawOne();

    const totalFundingAmount = Number(result?.totalFunding || 0);

    return {
      totalDrugs,
      fundingDrugs,
      totalFundingAmount,
    };
  }

  /**
   * 查询单个药品详情
   */
  async findOne(id: string) {
    const drug = await this.drugRepository.findOne({
      where: { id },
    });

    if (!drug) {
      throw new NotFoundException('药品不存在');
    }

    // 获取最新行情快照
    const latestSnapshot = await this.marketSnapshotRepository.findOne({
      where: { drugId: id },
      order: { snapshotDate: 'DESC' },
    });

    // 计算垫资统计
    const fundingProgress =
      drug.totalQuantity > 0
        ? Number(((drug.fundedQuantity / drug.totalQuantity) * 100).toFixed(2))
        : 0;

    const totalFundingAmount = Number(
      (drug.fundedQuantity * drug.purchasePrice).toFixed(2),
    );

    return {
      id: drug.id,
      name: drug.name,
      code: drug.code,
      purchasePrice: drug.purchasePrice,
      sellingPrice: drug.sellingPrice,
      totalQuantity: drug.totalQuantity,
      fundedQuantity: drug.fundedQuantity,
      remainingQuantity: drug.remainingQuantity,
      status: drug.status,
      annualRate: drug.annualRate,
      batchNo: drug.batchNo,
      unitFee: drug.unitFee,
      createdAt: drug.createdAt,
      updatedAt: drug.updatedAt,
      fundingProgress,
      totalFundingAmount,
      latestSnapshot: latestSnapshot
        ? {
            snapshotDate: latestSnapshot.snapshotDate,
            dailySalesQuantity: latestSnapshot.dailySalesQuantity,
            dailySalesRevenue: latestSnapshot.dailySalesRevenue,
            averageSellingPrice: latestSnapshot.averageSellingPrice,
            dailyReturn: latestSnapshot.dailyReturn,
            cumulativeReturn: latestSnapshot.cumulativeReturn,
            fundingHeat: latestSnapshot.fundingHeat,
            queueDepth: latestSnapshot.queueDepth,
          }
        : null,
    };
  }

  /**
   * 更新药品信息
   */
  async update(id: string, updateDrugDto: UpdateDrugDto): Promise<Drug> {
    const drug = await this.drugRepository.findOne({ where: { id } });

    if (!drug) {
      throw new NotFoundException('药品不存在');
    }

    // 如果更新编码，检查是否与其他药品冲突
    if (updateDrugDto.code && updateDrugDto.code !== drug.code) {
      const existingDrug = await this.drugRepository.findOne({
        where: { code: updateDrugDto.code },
      });

      if (existingDrug) {
        throw new BadRequestException('药品编码已存在');
      }
    }

    // 更新字段
    Object.assign(drug, updateDrugDto);

    return this.drugRepository.save(drug);
  }

  /**
   * 更新药品状态
   */
  async updateStatus(
    id: string,
    updateStatusDto: UpdateDrugStatusDto,
  ): Promise<Drug> {
    const drug = await this.drugRepository.findOne({ where: { id } });

    if (!drug) {
      throw new NotFoundException('药品不存在');
    }

    drug.status = updateStatusDto.status;

    return this.drugRepository.save(drug);
  }

  /**
   * 删除药品（仅 pending 状态可删除）
   */
  async remove(id: string): Promise<void> {
    const drug = await this.drugRepository.findOne({ where: { id } });

    if (!drug) {
      throw new NotFoundException('药品不存在');
    }

    if (drug.status !== DrugStatus.PENDING) {
      throw new ForbiddenException('只有 pending 状态的药品可以删除');
    }

    await this.drugRepository.remove(drug);
  }

  /**
   * 获取药品历史收益率（从 market_snapshots 取）
   */
  async getDrugHistory(id: string) {
    const drug = await this.drugRepository.findOne({ where: { id } });

    if (!drug) {
      throw new NotFoundException('药品不存在');
    }

    const snapshots = await this.marketSnapshotRepository.find({
      where: { drugId: id },
      order: { snapshotDate: 'ASC' },
    });

    return snapshots.map((snapshot) => ({
      date: snapshot.snapshotDate,
      dailyReturn: Number(snapshot.dailyReturn.toFixed(4)),
      cumulativeReturn: Number(snapshot.cumulativeReturn.toFixed(4)),
      dailySalesQuantity: snapshot.dailySalesQuantity,
      fundingHeat: snapshot.fundingHeat,
    }));
  }
}
