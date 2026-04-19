import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentOrder } from '../../database/entities/payment-order.entity';
import { Drug } from '../../database/entities/drug.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AccountTransaction } from '../../database/entities/account-transaction.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { AlipayService } from './alipay.service';
import { WechatPayService } from './wechat-pay.service';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentOrder, Drug, AccountBalance, AccountTransaction]),
    forwardRef(() => SubscriptionModule),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, AlipayService, WechatPayService],
  exports: [PaymentService],
})
export class PaymentModule {}
