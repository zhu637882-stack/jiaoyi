import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { DailySales } from '../../database/entities/daily-sales.entity';
import { Drug } from '../../database/entities/drug.entity';
import { Settlement, SettlementStatus } from '../../database/entities/settlement.entity';
import { CreateDailySalesDto } from './dto/create-daily-sales.dto';
import { UpdateDailySalesDto } from './dto/update-daily-sales.dto';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(DailySales)
    private dailySalesRepository: Repository<DailySales>,
    @InjectRepository(Drug)
    private drugRepository: Repository<Drug>,
    @InjectRepository(Settlement)
    private settlementRepository: Repository<Settlement>,
  ) {}

  /**
   * 创建销售记录
   */
  async createSales(createDto: CreateDailySalesDto): Promise<DailySales> {
    const { drugId, saleDate, quantity, actualSellingPrice, terminal } = createDto;

    // 1. 校验药品是否存在
    const drug = await this.drugRepository.findOne({
      where: { id: drugId },
    });

    if (!drug) {
      throw new NotFoundException('药品不存在');
    }

    // 2. 校验是否已存在同一药品同一终端同一日期的销售记录
    const existingSale = await this.dailySalesRepository.findOne({
      where: {
        drugId,
        saleDate: new Date(saleDate),
        terminal,
      },
    });

    if (existingSale) {
      throw new BadRequestException(
        `该药品在该终端 ${saleDate} 已有销售记录，请使用更新功能`,
      );
    }

    // 3. 校验该日期是否已清算
    const existingSettlement = await this.settlementRepository.findOne({
      where: {
        drugId,
        settlementDate: new Date(saleDate),
        status: SettlementStatus.COMPLETED,
      },
    });

    if (existingSettlement) {
      throw new BadRequestException(
        `该药品在 ${saleDate} 已完成清算，不能添加销售记录`,
      );
    }

    // 4. 计算总销售额
    const totalRevenue = Number((quantity * actualSellingPrice).toFixed(2));

    // 5. 创建销售记录
    const sales = this.dailySalesRepository.create({
      drugId,
      saleDate: new Date(saleDate),
      quantity,
      actualSellingPrice,
      totalRevenue,
      terminal,
    });

    return this.dailySalesRepository.save(sales);
  }

  /**
   * 更新销售记录
   */
  async updateSales(
    id: string,
    updateDto: UpdateDailySalesDto,
  ): Promise<DailySales> {
    // 1. 查找销售记录
    const sales = await this.dailySalesRepository.findOne({
      where: { id },
    });

    if (!sales) {
      throw new NotFoundException('销售记录不存在');
    }

    // 2. 校验该日期是否已清算
    const existingSettlement = await this.settlementRepository.findOne({
      where: {
        drugId: sales.drugId,
        settlementDate: sales.saleDate,
        status: SettlementStatus.COMPLETED,
      },
    });

    if (existingSettlement) {
      throw new ForbiddenException('该销售记录已清算，不能修改');
    }

    // 3. 更新字段
    if (updateDto.quantity !== undefined) {
      sales.quantity = updateDto.quantity;
    }

    if (updateDto.actualSellingPrice !== undefined) {
      sales.actualSellingPrice = updateDto.actualSellingPrice;
    }

    if (updateDto.terminal !== undefined) {
      sales.terminal = updateDto.terminal;
    }

    // 4. 重新计算总销售额
    sales.totalRevenue = Number(
      (sales.quantity * sales.actualSellingPrice).toFixed(2),
    );

    return this.dailySalesRepository.save(sales);
  }

  /**
   * 删除销售记录
   */
  async deleteSales(id: string): Promise<void> {
    // 1. 查找销售记录
    const sales = await this.dailySalesRepository.findOne({
      where: { id },
    });

    if (!sales) {
      throw new NotFoundException('销售记录不存在');
    }

    // 2. 校验该日期是否已清算
    const existingSettlement = await this.settlementRepository.findOne({
      where: {
        drugId: sales.drugId,
        settlementDate: sales.saleDate,
        status: SettlementStatus.COMPLETED,
      },
    });

    if (existingSettlement) {
      throw new ForbiddenException('该销售记录已清算，不能删除');
    }

    await this.dailySalesRepository.remove(sales);
  }

  /**
   * 获取销售记录列表
   */
  async getSales(options: {
    drugId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { drugId, startDate, endDate, page = 1, pageSize = 10 } = options;

    const queryBuilder = this.dailySalesRepository
      .createQueryBuilder('sales')
      .leftJoinAndSelect('sales.drug', 'drug')
      .orderBy('sales.saleDate', 'DESC')
      .addOrderBy('sales.createdAt', 'DESC');

    if (drugId) {
      queryBuilder.andWhere('sales.drugId = :drugId', { drugId });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('sales.saleDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    } else if (startDate) {
      queryBuilder.andWhere('sales.saleDate >= :startDate', {
        startDate: new Date(startDate),
      });
    } else if (endDate) {
      queryBuilder.andWhere('sales.saleDate <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    const total = await queryBuilder.getCount();

    const sales = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return {
      list: sales.map((s) => ({
        id: s.id,
        drugId: s.drugId,
        drugName: s.drug?.name,
        drugCode: s.drug?.code,
        saleDate: s.saleDate,
        quantity: s.quantity,
        actualSellingPrice: Number(s.actualSellingPrice),
        totalRevenue: Number(s.totalRevenue),
        terminal: s.terminal,
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
   * 获取某日某药品的销售汇总
   */
  async getDailySummary(drugId: string, date: string) {
    // 1. 校验药品是否存在
    const drug = await this.drugRepository.findOne({
      where: { id: drugId },
    });

    if (!drug) {
      throw new NotFoundException('药品不存在');
    }

    // 2. 查询该日所有销售记录
    const sales = await this.dailySalesRepository.find({
      where: {
        drugId,
        saleDate: new Date(date),
      },
    });

    // 3. 计算汇总数据
    let totalQuantity = 0;
    let totalRevenue = 0;
    const terminalDetails: Array<{
      terminal: string;
      quantity: number;
      revenue: number;
    }> = [];

    for (const sale of sales) {
      totalQuantity += sale.quantity;
      totalRevenue += Number(sale.totalRevenue);
      terminalDetails.push({
        terminal: sale.terminal,
        quantity: sale.quantity,
        revenue: Number(sale.totalRevenue),
      });
    }

    // 4. 检查是否已清算
    const settlement = await this.settlementRepository.findOne({
      where: {
        drugId,
        settlementDate: new Date(date),
        status: SettlementStatus.COMPLETED,
      },
    });

    return {
      drugId,
      drugName: drug.name,
      date,
      totalQuantity,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      terminalDetails,
      isSettled: !!settlement,
      settlementId: settlement?.id,
    };
  }

  /**
   * 获取某药品某日期的销售记录（用于清算）
   */
  async getSalesByDrugAndDate(drugId: string, date: Date): Promise<DailySales[]> {
    return this.dailySalesRepository.find({
      where: {
        drugId,
        saleDate: date,
      },
    });
  }
}
