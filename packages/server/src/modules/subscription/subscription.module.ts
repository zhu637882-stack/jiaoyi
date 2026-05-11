import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionCronService } from './subscription-cron.service';
import { SubscriptionOrder } from '../../database/entities/subscription-order.entity';
import { Drug } from '../../database/entities/drug.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AccountTransaction } from '../../database/entities/account-transaction.entity';
import { User } from '../../database/entities/user.entity';
import { DailyYield } from '../../database/entities/daily-yield.entity';
import { SaleRecord } from '../../database/entities/sale-record.entity';
import { EventsModule } from '../../common/events/events.module';
import { InvitationModule } from '../invitation/invitation.module';
import { TrialBonusModule } from '../trial-bonus/trial-bonus.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionOrder,
      Drug,
      AccountBalance,
      AccountTransaction,
      User,
      DailyYield,
      SaleRecord,
    ]),
    EventsModule,
    InvitationModule,
    TrialBonusModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, SubscriptionCronService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
