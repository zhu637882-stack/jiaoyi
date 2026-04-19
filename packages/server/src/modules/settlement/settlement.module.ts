import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettlementService } from './settlement.service';
import { SettlementCronService } from './settlement-cron.service';
import { SettlementController } from './settlement.controller';
import { Settlement } from '../../database/entities/settlement.entity';
import { SubscriptionOrder } from '../../database/entities/subscription-order.entity';
import { DailySales } from '../../database/entities/daily-sales.entity';
import { Drug } from '../../database/entities/drug.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AccountTransaction } from '../../database/entities/account-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Settlement,
      SubscriptionOrder,
      DailySales,
      Drug,
      AccountBalance,
      AccountTransaction,
    ]),
  ],
  controllers: [SettlementController],
  providers: [SettlementService, SettlementCronService],
  exports: [SettlementService, SettlementCronService],
})
export class SettlementModule {}
