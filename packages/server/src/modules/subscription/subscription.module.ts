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
import { EventsModule } from '../../common/events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionOrder,
      Drug,
      AccountBalance,
      AccountTransaction,
      User,
    ]),
    EventsModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, SubscriptionCronService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
