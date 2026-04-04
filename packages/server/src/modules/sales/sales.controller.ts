import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../../database/entities/user.entity';
import {
  CreateDailySalesDto,
  UpdateDailySalesDto,
  QuerySalesDto,
  DailySummaryQueryDto,
} from './dto';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  /**
   * 创建销售记录（管理员）
   * POST /api/sales
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createSales(@Body() createDto: CreateDailySalesDto) {
    const sales = await this.salesService.createSales(createDto);
    return {
      success: true,
      data: sales,
      message: '销售记录创建成功',
    };
  }

  /**
   * 更新销售记录（管理员）
   * PUT /api/sales/:id
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateSales(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateDto: UpdateDailySalesDto,
  ) {
    const sales = await this.salesService.updateSales(id, updateDto);
    return {
      success: true,
      data: sales,
      message: '销售记录更新成功',
    };
  }

  /**
   * 删除销售记录（管理员）
   * DELETE /api/sales/:id
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteSales(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    await this.salesService.deleteSales(id);
    return {
      success: true,
      message: '销售记录删除成功',
    };
  }

  /**
   * 获取销售记录列表
   * GET /api/sales
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getSales(@Query() query: QuerySalesDto) {
    const result = await this.salesService.getSales({
      drugId: query.drugId,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 获取某日某药品的销售汇总
   * GET /api/sales/daily-summary
   */
  @Get('daily-summary')
  @UseGuards(JwtAuthGuard)
  async getDailySummary(@Query() query: DailySummaryQueryDto) {
    const result = await this.salesService.getDailySummary(
      query.drugId,
      query.date,
    );
    return {
      success: true,
      data: result,
    };
  }
}
