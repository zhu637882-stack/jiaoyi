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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  CreatePendingOrderDto,
  QueryPendingOrderDto,
} from './dto';

@Controller('pending-orders')
export class PendingOrderController {
  constructor(private readonly pendingOrderService: PendingOrderService) {}

  /**
   * 创建条件委托订单
   * POST /api/pending-orders
   */
  @Post()
  @UseGuards(JwtAuthGuard)
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
