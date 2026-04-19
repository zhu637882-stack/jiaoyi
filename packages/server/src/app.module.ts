import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { DrugModule } from './modules/drug/drug.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { SalesModule } from './modules/sales/sales.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { AccountModule } from './modules/account/account.module';
import { MarketModule } from './modules/market/market.module';
import { PaymentModule } from './modules/payment/payment.module';
import { SystemMessageModule } from './modules/system-message/system-message.module';
import { YieldModule } from './modules/yield/yield.module';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './common/events/events.module';
import { AuditModule } from './common/services/audit.module';
import { IdempotencyGuard } from './common/guards/idempotency.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbType = configService.get('DB_TYPE', 'postgres');
        
        if (dbType === 'sqlite') {
          return {
            type: 'sqlite',
            database: configService.get('DB_DATABASE', './data.sqlite'),
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true,
            logging: configService.get('NODE_ENV') === 'development',
          };
        }
        
        return {
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
        };
      },
      inject: [ConfigService],
    }),
    DatabaseModule,
    EventsModule,
    AuditModule,
    AuthModule,
    UserModule,
    DrugModule,
    SubscriptionModule,
    SalesModule,
    SettlementModule,
    AccountModule,
    MarketModule,
    PaymentModule,
    SystemMessageModule,
    YieldModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: IdempotencyGuard },
  ],
})
export class AppModule {}
