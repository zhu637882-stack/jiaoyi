import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { SettlementCronService } from './settlement-cron.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/user.entity';
import {
  ExecuteSettlementDto,
  QuerySettlementDto,
  SettlementPreviewQueryDto,
} from './dto';

@Controller('settlements')
export class SettlementController {
  constructor(
    private readonly settlementService: SettlementService,
    private readonly settlementCronService: SettlementCronService,
  ) {}

  /**
   * 手动执行日清日结清算（管理员）
   * POST /api/settlements/execute
   */
  @Post('execute')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async executeSettlement(@Body() executeDto: ExecuteSettlementDto) {
    const result = await this.settlementCronService.triggerManualSettlement(
      executeDto.drugId,
      executeDto.settlementDate,
    );
    return {
      success: true,
      data: result,
      message: '手动清算执行成功',
    };
  }

  /**
   * 获取清算预览（管理员）
   * GET /api/settlements/preview
   */
  @Get('preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getSettlementPreview(@Query() query: SettlementPreviewQueryDto) {
    const result = await this.settlementService.getSettlementPreview(
      query.drugId,
      query.date,
    );
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 获取清算汇总统计（管理员）
   * GET /api/settlements/summary/all
   */
  @Get('summary/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getSettlementSummary() {
    const result = await this.settlementService.getSettlementSummary();
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 获取我的清算记录（合作方视角）
   * GET /api/settlements/my/list
   */
  @Get('my/list')
  @UseGuards(JwtAuthGuard)
  async getMySettlements(
    @CurrentUser('userId') userId: string,
    @Query() query: QuerySettlementDto,
  ) {
    const result = await this.settlementService.getUserSettlements(userId, {
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 获取我的清算统计（合作方视角）
   * GET /api/settlements/my/stats
   */
  @Get('my/stats')
  @UseGuards(JwtAuthGuard)
  async getMySettlementStats(@CurrentUser('userId') userId: string) {
    const result = await this.settlementService.getUserSettlementStats(userId);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 获取清算记录列表
   * GET /api/settlements
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getSettlements(@Query() query: QuerySettlementDto) {
    const result = await this.settlementService.getSettlements({
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
   * 获取清算详情
   * GET /api/settlements/:id
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getSettlementDetail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const result = await this.settlementService.getSettlementDetail(id);
    return {
      success: true,
      data: result,
    };
  }
}
