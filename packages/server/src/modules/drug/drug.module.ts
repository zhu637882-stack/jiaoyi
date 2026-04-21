import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DrugService } from './drug.service';
import { DrugController } from './drug.controller';
import { Drug } from '../../database/entities/drug.entity';
import { MarketSnapshot } from '../../database/entities/market-snapshot.entity';
import { SubscriptionOrder } from '../../database/entities/subscription-order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Drug, MarketSnapshot, SubscriptionOrder]),
  ],
  controllers: [DrugController],
  providers: [DrugService],
  exports: [DrugService],
})
export class DrugModule {}
