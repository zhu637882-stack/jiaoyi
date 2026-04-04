import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FundingService } from './funding.service';
import { FundingController } from './funding.controller';
import { FundingOrder } from '../../database/entities/funding-order.entity';
import { Drug } from '../../database/entities/drug.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AccountTransaction } from '../../database/entities/account-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FundingOrder,
      Drug,
      AccountBalance,
      AccountTransaction,
    ]),
  ],
  controllers: [FundingController],
  providers: [FundingService],
  exports: [FundingService],
})
export class FundingModule {}
