import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SystemMessageService } from './system-message.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { CreateSystemMessageDto } from './dto/create-system-message.dto';
import { UpdateSystemMessageDto } from './dto/update-system-message.dto';

@Controller('system-messages')
export class SystemMessageController {
  constructor(private systemMessageService: SystemMessageService) {}

  // 公开接口（无需Admin角色）：获取已发布消息列表（分页）
  @Get()
  @UseGuards(JwtAuthGuard)
  async getPublishedMessages(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.systemMessageService.getPublishedMessages(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 10,
    );
    return { success: true, data: result };
  }

  // 管理员接口：获取所有消息（含草稿）
  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminGetList(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.systemMessageService.getAllMessages({
      status,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 10,
    });
    return { success: true, data: result };
  }

  // 管理员接口：创建消息
  @Post('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminCreate(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateSystemMessageDto,
  ) {
    const result = await this.systemMessageService.createMessage(userId, dto);
    return { success: true, data: result };
  }

  // 管理员接口：编辑消息
  @Put('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminUpdate(
    @Param('id') id: string,
    @Body() dto: UpdateSystemMessageDto,
  ) {
    const result = await this.systemMessageService.updateMessage(id, dto);
    return { success: true, data: result };
  }

  // 管理员接口：删除消息
  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminDelete(@Param('id') id: string) {
    const result = await this.systemMessageService.deleteMessage(id);
    return { success: true, data: result };
  }

  // 管理员接口：发布消息
  @Patch('admin/:id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminPublish(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    const result = await this.systemMessageService.publishMessage(id, userId);
    return { success: true, data: result };
  }
}
