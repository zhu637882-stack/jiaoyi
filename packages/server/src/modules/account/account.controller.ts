import { Controller, Get, Post, Body, Query, Param, UseGuards } from '@nestjs/common';
import { AccountService } from './account.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RechargeDto } from './dto/recharge.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { ApproveWithdrawDto } from './dto/approve-withdraw.dto';
import { UserRole } from '../../database/entities/user.entity';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { AuditService } from '../../common/services/audit.service';
import { YieldService } from '../yield/yield.service';

@Controller('account')
export class AccountController {
  constructor(
    private accountService: AccountService,
    private auditService: AuditService,
    private yieldService: YieldService,
  ) {}

  /**
   * 管理员获取审计日志
   * GET /api/account/admin/audit-logs
   */
  @Get('admin/audit-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAuditLogs(
    @Query('action') action?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.auditService.getAuditLogs({
      action,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 管理员获取资金总览
   * GET /api/account/admin/overview
   */
  @Get('admin/overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAdminOverview() {
    const overview = await this.accountService.getAdminOverview();
    return {
      success: true,
      data: overview,
    };
  }

  /**
   * 管理员获取用户余额列表
   * GET /api/account/admin/balances
   */
  @Get('admin/balances')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAdminBalances(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    const result = await this.accountService.getAdminBalances({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 10,
      sortBy,
      sortOrder,
    });
    return {
      success: true,
      data: result,
    };
  }

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  async getBalance(@CurrentUser('userId') userId: string) {
    const balance = await this.accountService.getBalance(userId);
    const stats = await this.accountService.getTransactionStats(userId);
    const yieldSummary = await this.yieldService.getYieldSummary(userId);
    // 优先用日收益汇总（包含未清算的账面收益），其次用交易记录
    const totalProfit = yieldSummary.totalYield > 0
      ? yieldSummary.totalYield
      : stats.totalProfit;
    return {
      ...balance,
      totalProfit,
      stats,
    };
  }

  @Post('recharge')
  @UseGuards(JwtAuthGuard)
  @Idempotent()
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
  @Idempotent()
  async withdraw(
    @CurrentUser('userId') userId: string,
    @Body() withdrawDto: WithdrawDto,
  ) {
    return this.accountService.withdraw(
      userId,
      withdrawDto.amount,
      withdrawDto.description,
      withdrawDto.password,
      withdrawDto.bankInfo,
    );
  }

  /**
   * 获取我的出金申请列表
   * GET /api/account/withdraw/orders
   */
  @Get('withdraw/orders')
  @UseGuards(JwtAuthGuard)
  async getMyWithdrawOrders(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.accountService.getMyWithdrawOrders(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /**
   * 管理员：获取出金申请列表
   * GET /api/account/admin/withdraw-orders
   */
  @Get('admin/withdraw-orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getWithdrawOrders(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.accountService.getWithdrawOrders(
      status,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /**
   * 管理员：确认出金（银行已打款）
   * POST /api/account/admin/withdraw-orders/:id/approve
   */
  @Post('admin/withdraw-orders/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async approveWithdraw(
    @Param('id') orderId: string,
    @CurrentUser('userId') adminUserId: string,
    @Body() dto: ApproveWithdrawDto,
  ) {
    return this.accountService.approveWithdraw(orderId, adminUserId, dto.bankTransactionNo);
  }

  /**
   * 管理员：驳回出金申请
   * POST /api/account/admin/withdraw-orders/:id/reject
   */
  @Post('admin/withdraw-orders/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async rejectWithdraw(
    @Param('id') orderId: string,
    @CurrentUser('userId') adminUserId: string,
    @Body() dto: ApproveWithdrawDto,
  ) {
    if (!dto.rejectReason) {
      return { success: false, message: '请填写驳回原因' };
    }
    return this.accountService.rejectWithdraw(orderId, adminUserId, dto.rejectReason);
  }
}
