import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { DailySales } from '../../database/entities/daily-sales.entity';
import { Drug } from '../../database/entities/drug.entity';
import { Settlement } from '../../database/entities/settlement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DailySales, Drug, Settlement])],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
