import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DrugService } from './drug.service';
import { DrugController } from './drug.controller';
import { Drug } from '../../database/entities/drug.entity';
import { MarketSnapshot } from '../../database/entities/market-snapshot.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Drug, MarketSnapshot]),
  ],
  controllers: [DrugController],
  providers: [DrugService],
  exports: [DrugService],
})
export class DrugModule {}
