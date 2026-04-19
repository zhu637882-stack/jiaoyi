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
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  CreateSubscriptionDto,
  QuerySubscriptionDto,
  AdminQuerySubscriptionDto,
} from './dto';
import { UserRole } from '../../database/entities/user.entity';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * 创建认购订单
   * POST /api/subscriptions
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @Idempotent()
  @HttpCode(HttpStatus.CREATED)
  async createSubscription(
    @CurrentUser('userId') userId: string,
    @Body() createDto: CreateSubscriptionDto,
  ) {
    console.log('[DEBUG] createSubscription body:', JSON.stringify(createDto));
    const order = await this.subscriptionService.createSubscription(
      userId,
      createDto,
    );
    return {
      success: true,
      data: order,
      message: '认购订单创建成功',
    };
  }

  /**
   * 取消认购
   * DELETE /api/subscriptions/:id
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async cancelSubscription(
    @CurrentUser('userId') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    const order = await this.subscriptionService.cancelSubscription(
      userId,
      orderId,
    );
    return {
      success: true,
      data: order,
      message: '认购订单已取消',
    };
  }

  /**
   * 客户申请退回认购
   * POST /api/subscriptions/:id/return
   */
  @Post(':id/return')
  @UseGuards(JwtAuthGuard)
  async requestReturn(
    @CurrentUser('userId') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    const order = await this.subscriptionService.requestReturn(userId, orderId);
    return {
      success: true,
      data: order,
      message: '退回申请已提交，等待管理员核准',
    };
  }

  /**
   * 获取我的认购列表
   * GET /api/subscriptions
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getMySubscriptions(
    @CurrentUser('userId') userId: string,
    @Query() query: QuerySubscriptionDto,
  ) {
    const result = await this.subscriptionService.getMySubscriptions(userId, {
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 获取认购详情
   * GET /api/subscriptions/:id
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getSubscriptionDetail(
    @CurrentUser('userId') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    const order = await this.subscriptionService.getSubscriptionDetail(
      userId,
      orderId,
    );
    return {
      success: true,
      data: order,
    };
  }

  /**
   * 获取当前认购摘要
   * GET /api/subscriptions/active/summary
   */
  @Get('active/summary')
  @UseGuards(JwtAuthGuard)
  async getActiveSubscriptionSummary(
    @CurrentUser('userId') userId: string,
  ) {
    const summary = await this.subscriptionService.getActiveSubscriptionSummary(
      userId,
    );
    return {
      success: true,
      data: summary,
    };
  }

  /**
   * 管理员获取所有认购列表
   * GET /api/subscriptions/admin/list
   */
  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAdminSubscriptions(@Query() query: AdminQuerySubscriptionDto) {
    const result = await this.subscriptionService.getAdminSubscriptions({
      status: query.status,
      drugId: query.drugId,
      userId: query.userId,
      page: query.page,
      limit: query.limit,
    });
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 管理员获取认购统计
   * GET /api/subscriptions/admin/stats
   */
  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAdminStats() {
    const stats = await this.subscriptionService.getAdminStats();
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 管理员核准退回
   * PUT /api/subscriptions/admin/:id/approve-return
   */
  @Put('admin/:id/approve-return')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async approveReturn(
    @CurrentUser('userId') adminUserId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    const order = await this.subscriptionService.approveReturn(adminUserId, orderId);
    return {
      success: true,
      data: order,
      message: '退回已核准，本金和收益已退还客户',
    };
  }

  /**
   * 管理员驳回退回
   * PUT /api/subscriptions/admin/:id/reject-return
   */
  @Put('admin/:id/reject-return')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async rejectReturn(
    @CurrentUser('userId') adminUserId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body('reason') reason: string,
  ) {
    const order = await this.subscriptionService.rejectReturn(adminUserId, orderId, reason);
    return {
      success: true,
      data: order,
      message: '退回申请已驳回',
    };
  }
}
