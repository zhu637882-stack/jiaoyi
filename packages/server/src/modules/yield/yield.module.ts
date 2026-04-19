import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YieldService } from './yield.service';
import { YieldController } from './yield.controller';
import { DailyYield } from '../../database/entities/daily-yield.entity';
import { SubscriptionOrder } from '../../database/entities/subscription-order.entity';
import { Drug } from '../../database/entities/drug.entity';
import { User } from '../../database/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyYield, SubscriptionOrder, Drug, User]),
  ],
  controllers: [YieldController],
  providers: [YieldService],
  exports: [YieldService],
})
export class YieldModule {}
