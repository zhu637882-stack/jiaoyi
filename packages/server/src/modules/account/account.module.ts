import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AccountTransaction } from '../../database/entities/account-transaction.entity';
import { WithdrawOrder } from '../../database/entities/withdraw-order.entity';
import { User } from '../../database/entities/user.entity';
import { YieldModule } from '../yield/yield.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountBalance, AccountTransaction, WithdrawOrder, User]),
    YieldModule,
  ],
  controllers: [AccountController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
