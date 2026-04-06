import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingOrderService } from './pending-order.service';
import { PendingOrderController } from './pending-order.controller';
import { PendingOrderTriggerService } from './pending-order-trigger.service';
import { PendingOrderCronService } from './pending-order-cron.service';
import { PendingOrder } from '../../database/entities/pending-order.entity';
import { Drug } from '../../database/entities/drug.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AccountTransaction } from '../../database/entities/account-transaction.entity';
import { User } from '../../database/entities/user.entity';
import { FundingModule } from '../funding/funding.module';
import { EventsModule } from '../../common/events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PendingOrder,
      Drug,
      AccountBalance,
      AccountTransaction,
      User,
    ]),
    FundingModule,
    EventsModule,
  ],
  controllers: [PendingOrderController],
  providers: [PendingOrderService, PendingOrderTriggerService, PendingOrderCronService],
  exports: [PendingOrderService, PendingOrderTriggerService],
})
export class PendingOrderModule {}
