import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AccountService } from './account.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RechargeDto } from './dto/recharge.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { WithdrawDto } from './dto/withdraw.dto';

@Controller('account')
export class AccountController {
  constructor(private accountService: AccountService) {}

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  async getBalance(@CurrentUser('userId') userId: string) {
    const balance = await this.accountService.getBalance(userId);
    const stats = await this.accountService.getTransactionStats(userId);
    return {
      ...balance,
      stats,
    };
  }

  @Post('recharge')
  @UseGuards(JwtAuthGuard)
  async recharge(
    @CurrentUser('userId') userId: string,
    @Body() rechargeDto: RechargeDto,
  ) {
    return this.accountService.recharge(
      userId,
      rechargeDto.amount,
      rechargeDto.description,
    );
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  async getTransactions(
    @CurrentUser('userId') userId: string,
    @Query() query: TransactionQueryDto,
  ) {
    return this.accountService.getTransactions(userId, {
      type: query.type,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@CurrentUser('userId') userId: string) {
    return this.accountService.getTransactionStats(userId);
  }

  @Post('withdraw')
  @UseGuards(JwtAuthGuard)
  async withdraw(
    @CurrentUser('userId') userId: string,
    @Body() withdrawDto: WithdrawDto,
  ) {
    return this.accountService.withdraw(
      userId,
      withdrawDto.amount,
      withdrawDto.description,
    );
  }
}
