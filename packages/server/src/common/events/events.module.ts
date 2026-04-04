import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventsGateway } from './events.gateway';
import { MarketModule } from '../../modules/market/market.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MarketModule,
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
