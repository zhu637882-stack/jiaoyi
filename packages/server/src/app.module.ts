import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { DrugModule } from './modules/drug/drug.module';
import { FundingModule } from './modules/funding/funding.module';
import { PendingOrderModule } from './modules/pending-order/pending-order.module';
import { SalesModule } from './modules/sales/sales.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { AccountModule } from './modules/account/account.module';
import { MarketModule } from './modules/market/market.module';
import { PaymentModule } from './modules/payment/payment.module';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './common/events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_DATABASE', 'yaozhuanzhuan'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        migrationsRun: true,
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    EventsModule,
    AuthModule,
    UserModule,
    DrugModule,
    FundingModule,
    PendingOrderModule,
    SalesModule,
    SettlementModule,
    AccountModule,
    MarketModule,
    PaymentModule,
  ],
})
export class AppModule {}
