import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DrugService } from './drug.service';
import { DrugController } from './drug.controller';
import { Drug } from '../../database/entities/drug.entity';
import { MarketSnapshot } from '../../database/entities/market-snapshot.entity';
import { PendingOrderModule } from '../pending-order/pending-order.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Drug, MarketSnapshot]),
    PendingOrderModule,
  ],
  controllers: [DrugController],
  providers: [DrugService],
  exports: [DrugService],
})
export class DrugModule {}
