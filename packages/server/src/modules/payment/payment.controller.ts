import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  Header,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('payment')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  /**
   * 创建支付宝订单
   */
  @Post('alipay/create')
  @UseGuards(JwtAuthGuard)
  async createAlipayOrder(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentService.createAlipayOrder(userId, dto.amount);
  }

  /**
   * 创建微信支付订单
   */
  @Post('wechat/create')
  @UseGuards(JwtAuthGuard)
  async createWechatOrder(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreatePaymentDto,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    return this.paymentService.createWechatOrder(userId, dto.amount, clientIp);
  }

  /**
   * 支付宝异步回调
   * 返回纯文本 'success' 或 'fail'
   */
  @Post('alipay/notify')
  @HttpCode(200)
  @Header('Content-Type', 'text/plain')
  async alipayNotify(@Body() body: any) {
    return this.paymentService.handleAlipayNotify(body);
  }

  /**
   * 微信支付异步回调
   * 返回 XML 格式响应
   */
  @Post('wechat/notify')
  @HttpCode(200)
  @Header('Content-Type', 'application/xml')
  async wechatNotify(@Body() body: string) {
    return this.paymentService.handleWechatNotify(body);
  }

  /**
   * 查询支付宝订单状态
   */
  @Get('alipay/query/:outTradeNo')
  @UseGuards(JwtAuthGuard)
  async queryAlipayOrder(@Param('outTradeNo') outTradeNo: string) {
    return this.paymentService.queryAlipayOrder(outTradeNo);
  }

  /**
   * 查询微信支付订单状态
   */
  @Get('wechat/query/:outTradeNo')
  @UseGuards(JwtAuthGuard)
  async queryWechatOrder(@Param('outTradeNo') outTradeNo: string) {
    return this.paymentService.queryWechatOrder(outTradeNo);
  }
}
