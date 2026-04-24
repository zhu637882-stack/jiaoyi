import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrialBonusService } from './trial-bonus.service';
import { TrialBonusController } from './trial-bonus.controller';
import { TrialBonus } from '../../database/entities/trial-bonus.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AccountTransaction } from '../../database/entities/account-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TrialBonus, AccountBalance, AccountTransaction]),
  ],
  controllers: [TrialBonusController],
  providers: [TrialBonusService],
  exports: [TrialBonusService],
})
export class TrialBonusModule {}
