import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PendingOrderService } from './pending-order.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  CreatePendingOrderDto,
  QueryPendingOrderDto,
} from './dto';
import { UserRole } from '../../database/entities/user.entity';

@Controller('pending-orders')
export class PendingOrderController {
  constructor(private readonly pendingOrderService: PendingOrderService) {}

  /**
   * 管理员获取委托统计
   * GET /api/pending-orders/admin/stats
   */
  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAdminStats() {
    const stats = await this.pendingOrderService.getAdminStats();
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 管理员获取所有委托订单列表
   * GET /api/pending-orders/admin/list
   */
  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAdminPendingOrders(@Query() query: QueryPendingOrderDto) {
    const result = await this.pendingOrderService.getAdminPendingOrders({
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 管理员强制撤单
   * DELETE /api/pending-orders/admin/:id
   */
  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminCancelOrder(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const order = await this.pendingOrderService.adminCancelOrder(id);
    return {
      success: true,
      data: order,
      message: '委托订单已强制撤销',
    };
  }

  /**
   * 测试触发委托单（仅用于调试）
   * POST /api/pending-orders/test-trigger
   */
  @Post('test-trigger')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async testTrigger(
    @CurrentUser('userId') userId: string,
    @Body() body: { drugId: string },
  ) {
    // 仅管理员可调用
    const result = await this.pendingOrderService.testTriggerPendingOrders(body.drugId);
    return {
      success: true,
      data: result,
      message: '测试触发完成',
    };
  }

  /**
   * 创建条件委托订单
   * POST /api/pending-orders
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @Idempotent()
  @HttpCode(HttpStatus.CREATED)
  async createPendingOrder(
    @CurrentUser('userId') userId: string,
    @Body() createDto: CreatePendingOrderDto,
  ) {
    const order = await this.pendingOrderService.createPendingOrder(userId, createDto);
    return {
      success: true,
      data: order,
      message: '条件委托订单创建成功',
    };
  }

  /**
   * 获取我的委托订单列表
   * GET /api/pending-orders
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getPendingOrders(
    @CurrentUser('userId') userId: string,
    @Query() query: QueryPendingOrderDto,
  ) {
    const result = await this.pendingOrderService.getPendingOrders(userId, {
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 获取活跃委托数量
   * GET /api/pending-orders/active/count
   */
  @Get('active/count')
  @UseGuards(JwtAuthGuard)
  async getActiveCount(
    @CurrentUser('userId') userId: string,
  ) {
    const count = await this.pendingOrderService.getActiveCount(userId);
    return {
      success: true,
      data: { count },
    };
  }

  /**
   * 获取委托订单详情
   * GET /api/pending-orders/:id
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getPendingOrderDetail(
    @CurrentUser('userId') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    const order = await this.pendingOrderService.getPendingOrderDetail(userId, orderId);
    return {
      success: true,
      data: order,
    };
  }

  /**
   * 撤销委托订单
   * DELETE /api/pending-orders/:id
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async cancelPendingOrder(
    @CurrentUser('userId') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    const order = await this.pendingOrderService.cancelPendingOrder(userId, orderId);
    return {
      success: true,
      data: order,
      message: '委托订单已撤销',
    };
  }
}
