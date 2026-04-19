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
import { UserRole } from '../../database/entities/user.entity';
import { YieldService } from './yield.service';
import { FillSubsidyDto, GenerateDailyYieldDto, QueryYieldCurveDto, QueryPendingSubsidyDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('yield')
@UseGuards(JwtAuthGuard)
export class YieldController {
  constructor(private readonly yieldService: YieldService) {}

  /**
   * 管理员：手动触发生成日收益记录
   */
  @Post('generate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async generateDailyYields(@Body() dto: GenerateDailyYieldDto) {
    const result = await this.yieldService.generateDailyYields(dto.yieldDate);
    return {
      success: true,
      data: result,
      message: `成功生成 ${result.generated} 条日收益记录`,
    };
  }

  /**
   * 管理员：获取待填写补贴金的列表
   */
  @Get('pending-subsidy')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getPendingSubsidyList(@Query() dto: QueryPendingSubsidyDto) {
    const result = await this.yieldService.getPendingSubsidyList(dto);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 管理员：财务填写补贴金
   */
  @Post('subsidy')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async fillSubsidy(@Body() dto: FillSubsidyDto) {
    const result = await this.yieldService.fillSubsidy(dto);
    return {
      success: true,
      data: result,
      message: `成功更新 ${result.updated} 条补贴金`,
    };
  }

  /**
   * 管理员：获取某药品的收益曲线（所有客户汇总）
   */
  @Get('drug/:drugId/curve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getDrugYieldCurve(
    @Param('drugId') drugId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const curve = await this.yieldService.getDrugYieldCurve(drugId, startDate, endDate);
    return {
      success: true,
      data: curve,
    };
  }

  /**
   * 客户：获取我的收益曲线
   */
  @Get('my/curve')
  async getMyYieldCurve(@CurrentUser('userId') userId: string, @Query() dto: QueryYieldCurveDto) {
    const curve = await this.yieldService.getYieldCurve(userId, dto);
    return {
      success: true,
      data: curve,
    };
  }

  /**
   * 客户：获取我的收益汇总
   */
  @Get('my/summary')
  async getMyYieldSummary(@CurrentUser('userId') userId: string) {
    const summary = await this.yieldService.getYieldSummary(userId);
    return {
      success: true,
      data: summary,
    };
  }
}
