import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class ValidateInvitationCodeDto {
  code: string;
}

@Controller('invitation')
export class InvitationController {
  constructor(private invitationService: InvitationService) {}

  /**
   * 获取我的邀请码（需JWT认证，如果没有则自动生成）
   */
  @Get('my-code')
  @UseGuards(JwtAuthGuard)
  async getMyCode(@CurrentUser('userId') userId: string) {
    const code = await this.invitationService.generateInvitationCode(userId);
    return {
      code: code.code,
      usedCount: code.usedCount,
      maxUses: code.maxUses,
    };
  }

  /**
   * 获取邀请统计
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@CurrentUser('userId') userId: string) {
    return this.invitationService.getInvitationStats(userId);
  }

  /**
   * 获取邀请明细
   */
  @Get('records')
  @UseGuards(JwtAuthGuard)
  async getRecords(@CurrentUser('userId') userId: string) {
    return this.invitationService.getInvitationRecords(userId);
  }

  /**
   * 验证邀请码有效性
   */
  @Post('validate')
  async validateCode(@Body() dto: ValidateInvitationCodeDto) {
    return this.invitationService.validateInvitationCode(dto.code);
  }

  /**
   * 管理端分页查询（需Admin角色）
   */
  @Get('admin/list')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAdminList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invitationService.getAdminList(
      parseInt(page || '1', 10),
      parseInt(limit || '10', 10),
    );
  }
}
