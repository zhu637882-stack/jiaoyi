import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { MarketService } from './market.service';
import { CreateSnapshotDto, QueryKLineDto, KLinePeriod } from './dto';

@Controller('market')
@UseGuards(JwtAuthGuard)
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  /**
   * 生成每日行情快照（管理员）
   */
  @Post('snapshot')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async createSnapshot(@Body() dto: CreateSnapshotDto) {
    const snapshot = await this.marketService.createSnapshot(dto);
    return {
      success: true,
      data: snapshot,
      message: '行情快照生成成功',
    };
  }

  /**
   * 获取市场总览
   */
  @Get('overview')
  @Public()
  async getMarketOverview() {
    const overview = await this.marketService.getMarketOverview();
    return {
      success: true,
      data: overview,
    };
  }

  /**
   * 获取单药品行情详情
   */
  @Get('drug/:drugId')
  @Public()
  async getDrugMarket(@Param('drugId') drugId: string) {
    const detail = await this.marketService.getDrugMarket(drugId);
    return {
      success: true,
      data: detail,
    };
  }

  /**
   * 获取K线数据
   */
  @Get('drug/:drugId/kline')
  @Public()
  async getDrugKLine(
    @Param('drugId') drugId: string,
    @Query() query: QueryKLineDto,
  ) {
    const period = query.period || KLinePeriod.THIRTY_DAYS;
    const kline = await this.marketService.getDrugKLine(drugId, period);
    return {
      success: true,
      data: kline,
    };
  }

  /**
   * 获取垫资深度数据
   */
  @Get('drug/:drugId/depth')
  @Public()
  async getDrugDepth(@Param('drugId') drugId: string) {
    const depth = await this.marketService.getDrugDepth(drugId);
    return {
      success: true,
      data: depth,
    };
  }

  /**
   * 获取热门药品排行
   */
  @Get('hot-list')
  @Public()
  async getHotList(@Query('limit') limit?: string) {
    const hotList = await this.marketService.getHotList(
      limit ? parseInt(limit, 10) : 10,
    );
    return {
      success: true,
      data: hotList,
    };
  }

  /**
   * 获取平台全局统计
   */
  @Get('stats')
  @Public()
  async getMarketStats() {
    const stats = await this.marketService.getMarketStats();
    return {
      success: true,
      data: stats,
    };
  }
}
