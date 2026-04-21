import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YieldService } from './yield.service';
import { YieldController } from './yield.controller';
import { YieldCronService } from './yield-cron.service';
import { DailyYield } from '../../database/entities/daily-yield.entity';
import { SubscriptionOrder } from '../../database/entities/subscription-order.entity';
import { Drug } from '../../database/entities/drug.entity';
import { User } from '../../database/entities/user.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AccountTransaction } from '../../database/entities/account-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DailyYield,
      SubscriptionOrder,
      Drug,
      User,
      AccountBalance,
      AccountTransaction,
    ]),
  ],
  controllers: [YieldController],
  providers: [YieldService, YieldCronService],
  exports: [YieldService],
})
export class YieldModule {}
