import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { TrialBonusService } from './trial-bonus.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('trial-bonus')
export class TrialBonusController {
  constructor(private readonly trialBonusService: TrialBonusService) {}

  /**
   * 获取当前用户体验金状态
   * GET /api/trial-bonus/status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@CurrentUser('userId') userId: string) {
    const status = await this.trialBonusService.getTrialBonusStatus(userId);
    return {
      success: true,
      data: status,
    };
  }

  /**
   * 管理端查询所有体验金列表
   * GET /api/trial-bonus/admin/list
   */
  @Get('admin/list')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAdminList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.trialBonusService.getAllTrialBonuses(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
