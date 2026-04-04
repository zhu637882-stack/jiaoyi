import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { MarketSnapshot } from '../../database/entities/market-snapshot.entity';
import { Drug } from '../../database/entities/drug.entity';
import { DailySales } from '../../database/entities/daily-sales.entity';
import { Settlement } from '../../database/entities/settlement.entity';
import { FundingOrder } from '../../database/entities/funding-order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketSnapshot,
      Drug,
      DailySales,
      Settlement,
      FundingOrder,
    ]),
  ],
  controllers: [MarketController],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}
