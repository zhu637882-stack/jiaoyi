import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentOrder } from '../../database/entities/payment-order.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AccountTransaction } from '../../database/entities/account-transaction.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { AlipayService } from './alipay.service';
import { WechatPayService } from './wechat-pay.service';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentOrder, AccountBalance, AccountTransaction])],
  controllers: [PaymentController],
  providers: [PaymentService, AlipayService, WechatPayService],
  exports: [PaymentService],
})
export class PaymentModule {}
