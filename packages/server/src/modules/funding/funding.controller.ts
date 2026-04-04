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
import { FundingService } from './funding.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  CreateFundingOrderDto,
  QueryFundingOrderDto,
} from './dto';

@Controller('funding')
export class FundingController {
  constructor(private readonly fundingService: FundingService) {}

  /**
   * 创建垫资订单
   * POST /api/funding/orders
   */
  @Post('orders')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @CurrentUser('userId') userId: string,
    @Body() createDto: CreateFundingOrderDto,
  ) {
    const order = await this.fundingService.createOrder(userId, createDto);
    return {
      success: true,
      data: order,
      message: '垫资订单创建成功',
    };
  }

  /**
   * 获取我的垫资订单列表
   * GET /api/funding/orders
   */
  @Get('orders')
  @UseGuards(JwtAuthGuard)
  async getOrders(
    @CurrentUser('userId') userId: string,
    @Query() query: QueryFundingOrderDto,
  ) {
    const result = await this.fundingService.getOrders(userId, {
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
   * 获取订单详情
   * GET /api/funding/orders/:id
   */
  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  async getOrderDetail(
    @CurrentUser('userId') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    const order = await this.fundingService.getOrderDetail(userId, orderId);
    return {
      success: true,
      data: order,
    };
  }

  /**
   * 获取当前持仓摘要
   * GET /api/funding/orders/active
   */
  @Get('orders/active/summary')
  @UseGuards(JwtAuthGuard)
  async getActiveFundingSummary(
    @CurrentUser('userId') userId: string,
  ) {
    const summary = await this.fundingService.getActiveFundingSummary(userId);
    return {
      success: true,
      data: summary,
    };
  }

  /**
   * 获取某药品的垫资排队队列
   * GET /api/funding/queue/:drugId
   */
  @Get('queue/:drugId')
  @UseGuards(JwtAuthGuard)
  async getFundingQueue(
    @Param('drugId', new ParseUUIDPipe({ version: '4' })) drugId: string,
  ) {
    const queue = await this.fundingService.getFundingQueue(drugId);
    return {
      success: true,
      data: queue,
    };
  }

  /**
   * 获取个人垫资统计
   * GET /api/funding/statistics
   */
  @Get('statistics')
  @UseGuards(JwtAuthGuard)
  async getFundingStatistics(
    @CurrentUser('userId') userId: string,
  ) {
    const stats = await this.fundingService.getFundingStatistics(userId);
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 获取某药品的我的持仓订单
   * GET /api/funding/holdings/:drugId
   */
  @Get('holdings/:drugId')
  @UseGuards(JwtAuthGuard)
  async getDrugHoldings(
    @CurrentUser('userId') userId: string,
    @Param('drugId', new ParseUUIDPipe({ version: '4' })) drugId: string,
  ) {
    const holdings = await this.fundingService.getDrugHoldings(userId, drugId);
    return {
      success: true,
      data: holdings,
    };
  }
}
