import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import Redis from 'ioredis';
import { PaymentOrder, PaymentChannel, PaymentStatus } from '../../database/entities/payment-order.entity';
import { Drug, DrugStatus } from '../../database/entities/drug.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AccountTransaction, TransactionType } from '../../database/entities/account-transaction.entity';
import { User, UserStatus } from '../../database/entities/user.entity';
import { AlipayService } from './alipay.service';
import { WechatPayService } from './wechat-pay.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { TrialBonusService } from '../trial-bonus/trial-bonus.service';
import { REDIS_CLIENT } from '../../database/database.module';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentOrder)
    private paymentOrderRepository: Repository<PaymentOrder>,
    @InjectRepository(Drug)
    private drugRepository: Repository<Drug>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private alipayService: AlipayService,
    private wechatPayService: WechatPayService,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
    private trialBonusService: TrialBonusService,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  /**
   * 校验用户审核状态（仅APPROVED用户可操作）
   */
  private async validateUserApproved(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.status !== UserStatus.APPROVED) {
      throw new BadRequestException('您的账户尚未通过审核，暂时无法进行此操作');
    }
  }

  /**
   * 生成唯一订单号
   * 格式：PAY + 时间戳 + 6位随机数
   */
  private generateOutTradeNo(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `PAY${timestamp}${random}`;
  }

  /**
   * 认购直付：创建支付订单（携带认购信息）
   * 支付成功后直接创建认购订单，不再充值余额
   */
  async createSubscriptionPayment(
    userId: string,
    drugId: string,
    quantity: number,
    channel: 'alipay' | 'wechat',
    clientIp?: string,
  ): Promise<{
    outTradeNo: string;
    qrCode?: string;
    codeUrl?: string;
    mockMode?: boolean;
  }> {
    // 0. 校验用户审核状态
    await this.validateUserApproved(userId);

    // 1. 校验药品
    const drug = await this.drugRepository.findOne({ where: { id: drugId } });
    if (!drug) {
      throw new BadRequestException('药品不存在');
    }
    if (drug.status !== DrugStatus.FUNDING) {
      throw new BadRequestException('该药品当前不可认购');
    }
    const remainingQuantity = drug.totalQuantity - drug.subscribedQuantity;
    if (remainingQuantity < quantity) {
      throw new BadRequestException(`剩余可认购数量不足，当前剩余：${remainingQuantity}盒`);
    }

    // 2. 计算认购金额
    const amount = Number((quantity * Number(drug.purchasePrice)).toFixed(2));

    // 3. 创建支付订单
    const outTradeNo = this.generateOutTradeNo();
    const subscriptionInfo = { drugId, quantity, amount };

    this.logger.log(`[createSubscriptionPayment] 创建认购支付: userId=${userId}, drugId=${drugId}, quantity=${quantity}, amount=${amount}, channel=${channel}, outTradeNo=${outTradeNo}`);

    if (channel === 'alipay') {
      const result = await this.alipayService.createOrder(
        outTradeNo,
        amount,
        `零钱保认购${drug.name}-${outTradeNo}`,
      );

      if (result.mockMode) {
        const paymentOrder = this.paymentOrderRepository.create({
          userId,
          outTradeNo,
          channel: PaymentChannel.ALIPAY,
          amount,
          status: PaymentStatus.PENDING,
          subscriptionInfo,
        });
        await this.paymentOrderRepository.save(paymentOrder);
        return { outTradeNo, qrCode: result.qrCode, mockMode: true };
      }

      const paymentOrder = this.paymentOrderRepository.create({
        userId,
        outTradeNo,
        channel: PaymentChannel.ALIPAY,
        amount,
        status: PaymentStatus.PENDING,
        subscriptionInfo,
      });
      await this.paymentOrderRepository.save(paymentOrder);
      return { outTradeNo, qrCode: result.qrCode };
    } else {
      const result = await this.wechatPayService.createOrder(
        outTradeNo,
        amount,
        `零钱保认购${drug.name}`,
        clientIp || '127.0.0.1',
      );

      if (result.mockMode) {
        const paymentOrder = this.paymentOrderRepository.create({
          userId,
          outTradeNo,
          channel: PaymentChannel.WECHAT,
          amount,
          status: PaymentStatus.PENDING,
          subscriptionInfo,
        });
        await this.paymentOrderRepository.save(paymentOrder);
        return { outTradeNo, codeUrl: result.codeUrl, mockMode: true };
      }

      const paymentOrder = this.paymentOrderRepository.create({
        userId,
        outTradeNo,
        channel: PaymentChannel.WECHAT,
        amount,
        status: PaymentStatus.PENDING,
        subscriptionInfo,
      });
      await this.paymentOrderRepository.save(paymentOrder);
      return { outTradeNo, codeUrl: result.codeUrl };
    }
  }

  /**
   * 支付成功后处理：根据 subscriptionInfo 分流
   * - 有 subscriptionInfo → 认购直付（创建认购订单）
   * - 无 subscriptionInfo → 充值余额（原有逻辑）
   */
  private async processPaymentSuccess(
    order: PaymentOrder,
    queryRunner: QueryRunner,
  ): Promise<void> {
    this.logger.log(`[processPaymentSuccess] 开始处理订单: ${order.outTradeNo}, userId: ${order.userId}, 金额: ${order.amount}, subscriptionInfo: ${JSON.stringify(order.subscriptionInfo)}`);

    if (order.subscriptionInfo) {
      // 认购直付：直接创建认购订单
      const { drugId, quantity, amount } = order.subscriptionInfo;
      this.logger.log(`[processPaymentSuccess] 认购直付: drugId=${drugId}, quantity=${quantity}, amount=${amount}`);
      await this.subscriptionService.createSubscriptionFromPayment(
        order.userId,
        drugId,
        quantity,
        amount,
        queryRunner,
      );
      this.logger.log(`认购直付成功: ${order.outTradeNo}, 药品: ${drugId}, 数量: ${quantity}, 金额: ${amount}`);
    } else {
      // 原有充值余额逻辑
      this.logger.log(`[processPaymentSuccess] 充值余额流程: 查找 AccountBalance, userId=${order.userId}`);

      // 幂等性保护：检查是否已有该订单的充值记录，防止并发或绕过状态检查的重复入账
      const existingTx = await queryRunner.manager.findOne(AccountTransaction, {
        where: { relatedOrderId: order.id, type: TransactionType.RECHARGE },
      });
      if (existingTx) {
        this.logger.warn(`[processPaymentSuccess] 重复充值已拦截: ${order.outTradeNo}, 交易ID: ${existingTx.id}`);
        return;
      }

      let balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId: order.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        this.logger.log(`[processPaymentSuccess] AccountBalance 不存在，创建新记录: userId=${order.userId}`);
        balance = queryRunner.manager.create(AccountBalance, {
          userId: order.userId,
          availableBalance: 0,
          frozenBalance: 0,
          totalProfit: 0,
          totalInvested: 0,
        });
        await queryRunner.manager.save(AccountBalance, balance);
        this.logger.log(`[processPaymentSuccess] AccountBalance 创建成功: id=${balance.id}`);
      } else {
        this.logger.log(`[processPaymentSuccess] AccountBalance 已存在: id=${balance.id}, availableBalance=${balance.availableBalance}`);
      }

      const balanceBefore = Number(balance.availableBalance);
      balance.availableBalance = Number((balanceBefore + Number(order.amount)).toFixed(2));
      this.logger.log(`[processPaymentSuccess] 更新余额: ${balanceBefore} + ${order.amount} = ${balance.availableBalance}`);

      await queryRunner.manager.save(AccountBalance, balance);
      this.logger.log(`[processPaymentSuccess] AccountBalance 保存成功`);

      const channelLabel = order.channel === PaymentChannel.ALIPAY ? '支付宝' : '微信支付';
      const transaction = queryRunner.manager.create(AccountTransaction, {
        userId: order.userId,
        type: TransactionType.RECHARGE,
        amount: order.amount,
        balanceBefore,
        balanceAfter: balance.availableBalance,
        description: `${channelLabel}充值 (${order.outTradeNo})`,
        relatedOrderId: order.id,
      });
      this.logger.log(`[processPaymentSuccess] 创建 AccountTransaction: type=RECHARGE, amount=${order.amount}, balanceBefore=${balanceBefore}, balanceAfter=${balance.availableBalance}`);

      await queryRunner.manager.save(AccountTransaction, transaction);
      this.logger.log(`[processPaymentSuccess] AccountTransaction 保存成功: id=${transaction.id}`);

      // 充值成功后，尝试激活体验金（失败不影响充值）
      try {
        await this.trialBonusService.activateTrialBonus(order.userId, queryRunner);
      } catch (e) {
        this.logger.error(`[processPaymentSuccess] 体验金激活失败: ${e.message}`);
      }

      this.logger.log(`充值成功: ${order.outTradeNo}, 金额: ${order.amount}`);
    }
  }

  /**
   * 创建支付宝支付订单
   */
  async createAlipayOrder(userId: string, amount: number): Promise<{
    outTradeNo: string;
    qrCode: string;
    mockMode?: boolean;
  }> {
    // 校验用户审核状态
    await this.validateUserApproved(userId);

    const outTradeNo = this.generateOutTradeNo();

    this.logger.log(`[createAlipayOrder] 创建支付宝充值订单: userId=${userId}, amount=${amount}, outTradeNo=${outTradeNo}`);

    // 调用支付宝创建订单
    const result = await this.alipayService.createOrder(
      outTradeNo,
      amount,
      `零钱保账户充值-${outTradeNo}`,
    );

    // Mock模式：创建pending状态订单，等待用户确认
    if (result.mockMode) {
      const paymentOrder = this.paymentOrderRepository.create({
        userId,
        outTradeNo,
        channel: PaymentChannel.ALIPAY,
        amount,
        status: PaymentStatus.PENDING,
      });
      await this.paymentOrderRepository.save(paymentOrder);
      this.logger.log(`[Mock模式] 创建支付宝订单: ${outTradeNo}, 金额: ${amount}, 状态: pending`);
      return {
        outTradeNo,
        qrCode: result.qrCode,
        mockMode: true,
      };
    }

    // 正常模式：创建待支付订单记录
    const paymentOrder = this.paymentOrderRepository.create({
      userId,
      outTradeNo,
      channel: PaymentChannel.ALIPAY,
      amount,
      status: PaymentStatus.PENDING,
    });
    await this.paymentOrderRepository.save(paymentOrder);

    return {
      outTradeNo,
      qrCode: result.qrCode,
    };
  }

  /**
   * 创建微信支付订单
   */
  async createWechatOrder(
    userId: string,
    amount: number,
    clientIp: string,
  ): Promise<{
    outTradeNo: string;
    codeUrl: string;
    mockMode?: boolean;
  }> {
    // 校验用户审核状态
    await this.validateUserApproved(userId);

    const outTradeNo = this.generateOutTradeNo();

    this.logger.log(`[createWechatOrder] 创建微信充值订单: userId=${userId}, amount=${amount}, outTradeNo=${outTradeNo}`);

    // 调用微信支付创建订单
    const result = await this.wechatPayService.createOrder(
      outTradeNo,
      amount,
      `零钱保账户充值`,
      clientIp,
    );

    // Mock模式：创建pending状态订单，等待用户确认
    if (result.mockMode) {
      const paymentOrder = this.paymentOrderRepository.create({
        userId,
        outTradeNo,
        channel: PaymentChannel.WECHAT,
        amount,
        status: PaymentStatus.PENDING,
      });
      await this.paymentOrderRepository.save(paymentOrder);
      this.logger.log(`[Mock模式] 创建微信支付订单: ${outTradeNo}, 金额: ${amount}, 状态: pending`);
      return {
        outTradeNo,
        codeUrl: result.codeUrl,
        mockMode: true,
      };
    }

    // 正常模式：创建待支付订单记录
    const paymentOrder = this.paymentOrderRepository.create({
      userId,
      outTradeNo,
      channel: PaymentChannel.WECHAT,
      amount,
      status: PaymentStatus.PENDING,
    });
    await this.paymentOrderRepository.save(paymentOrder);

    return {
      outTradeNo,
      codeUrl: result.codeUrl,
    };
  }

  /**
   * 处理Mock模式支付：直接完成充值
   */
  private async handleMockPayment(
    userId: string,
    outTradeNo: string,
    amount: number,
    channel: PaymentChannel,
    qrCode: string,
  ): Promise<{
    outTradeNo: string;
    qrCode: string;
    mockMode: boolean;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 创建已支付的订单记录
      const paymentOrder = queryRunner.manager.create(PaymentOrder, {
        userId,
        outTradeNo,
        channel,
        amount,
        status: PaymentStatus.PAID,
        tradeNo: `MOCK_TRADE_${Date.now()}`,
        paidAt: new Date(),
        notifyData: JSON.stringify({ mockMode: true }),
      });
      await queryRunner.manager.save(PaymentOrder, paymentOrder);

      // 支付成功处理（认购直付或充值余额）
      await this.processPaymentSuccess(paymentOrder, queryRunner);

      await queryRunner.commitTransaction();

      this.logger.log(`[Mock模式] 支付完成: ${outTradeNo}, 金额: ${amount}`);

      return {
        outTradeNo,
        qrCode,
        mockMode: true,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[Mock模式] 支付处理失败: ${outTradeNo}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Mock模式确认支付
   * 用户点击"模拟支付完成"按钮后调用，将订单状态改为已支付
   */
  async confirmMockPayment(outTradeNo: string): Promise<{
    status: string;
    amount: number;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 用悲观锁锁定订单行
      const order = await queryRunner.manager.findOne(PaymentOrder, {
        where: { outTradeNo },
        lock: { mode: 'pessimistic_write' }
      });

      if (!order) {
        await queryRunner.rollbackTransaction();
        throw new BadRequestException('订单不存在');
      }

      // 检查订单状态
      if (order.status === PaymentStatus.PAID) {
        await queryRunner.commitTransaction();
        return {
          status: PaymentStatus.PAID,
          amount: Number(order.amount),
        };
      }

      if (order.status !== PaymentStatus.PENDING) {
        await queryRunner.rollbackTransaction();
        throw new BadRequestException('订单状态不正确，无法确认支付');
      }

      // 更新订单状态为已支付
      order.status = PaymentStatus.PAID;
      order.tradeNo = `MOCK_CONFIRMED_${Date.now()}`;
      order.paidAt = new Date();
      order.notifyData = JSON.stringify({ mockMode: true, confirmedAt: new Date().toISOString() });
      await queryRunner.manager.save(PaymentOrder, order);

      // 支付成功处理（认购直付或充值余额）
      await this.processPaymentSuccess(order, queryRunner);

      await queryRunner.commitTransaction();

      this.logger.log(`[Mock模式] 支付确认成功: ${outTradeNo}, 金额: ${order.amount}`);

      return {
        status: PaymentStatus.PAID,
        amount: Number(order.amount),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[Mock模式] 支付确认失败: ${outTradeNo}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 处理支付宝异步通知
   * 双层防重机制：Redis + 数据库悲观锁
   */
  async handleAlipayNotify(params: Record<string, string>): Promise<string> {
    this.logger.log(`收到支付宝回调通知: ${JSON.stringify(params)}`);

    const outTradeNo = params.out_trade_no;
    const notifyId = params.notify_id;
    const tradeStatus = params.trade_status;
    const tradeNo = params.trade_no;

    // 第一层防重：Redis 检查 notify_id 是否已处理
    const redisKey = `payment:notify:alipay:${notifyId}`;
    try {
      const alreadyProcessed = await this.redis.get(redisKey);
      if (alreadyProcessed) {
        this.logger.log(`支付宝回调已处理过(Redis命中): notify_id=${notifyId}`);
        return 'success';
      }
    } catch (redisError) {
      this.logger.warn(`Redis检查失败，降级到数据库层防重: ${redisError.message}`);
    }

    // 第二层防重：数据库事务内检查订单状态（悲观锁）
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 用悲观锁锁定订单行，防止并发
      const order = await queryRunner.manager.findOne(PaymentOrder, {
        where: { outTradeNo },
        lock: { mode: 'pessimistic_write' }
      });

      if (!order) {
        this.logger.error(`订单不存在: ${outTradeNo}`);
        await queryRunner.rollbackTransaction();
        return 'fail';
      }

      // 如果订单已经是 paid 状态，说明已处理过
      if (order.status === PaymentStatus.PAID) {
        this.logger.log(`订单已支付(数据库命中): ${outTradeNo}`);
        await queryRunner.commitTransaction();
        // 补设 Redis 缓存（可能之前 Redis 写入失败）
        try {
          await this.redis.setex(redisKey, 86400, '1');
        } catch (e) {
          // 忽略 Redis 错误
        }
        return 'success';
      }

      // 验证支付宝签名
      const verified = this.alipayService.verifyNotify(params);
      if (!verified) {
        this.logger.error('支付宝签名验证失败');
        await queryRunner.rollbackTransaction();
        return 'fail';
      }

      // 检查交易状态
      if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
        this.logger.log(`交易状态非成功: ${tradeStatus}`);
        await queryRunner.commitTransaction();
        return 'success';
      }

      // 更新订单状态
      order.status = PaymentStatus.PAID;
      order.tradeNo = tradeNo;
      order.paidAt = new Date();
      order.notifyData = JSON.stringify(params);
      this.logger.log(`[handleAlipayNotify] 更新订单状态: ${outTradeNo} -> PAID, tradeNo=${tradeNo}`);
      await queryRunner.manager.save(PaymentOrder, order);

      // 支付成功处理（认购直付或充值余额）
      await this.processPaymentSuccess(order, queryRunner);

      this.logger.log(`[handleAlipayNotify] 提交事务...`);
      await queryRunner.commitTransaction();
      this.logger.log(`[handleAlipayNotify] 事务提交成功`);

      // 事务提交后验证
      try {
        const verifyOrder = await this.paymentOrderRepository.findOne({ where: { outTradeNo } });
        if (verifyOrder && verifyOrder.status === PaymentStatus.PAID) {
          this.logger.log(`[验证] payment_orders 已确认: ${outTradeNo} status=PAID`);
        } else {
          this.logger.error(`[验证] payment_orders 异常: ${outTradeNo} status=${verifyOrder?.status ?? 'NOT_FOUND'}`);
        }
      } catch (verifyErr) {
        this.logger.error(`[验证] 数据验证异常: ${verifyErr.message}`);
      }

      this.logger.log(`支付宝回调处理成功: ${outTradeNo}, 金额: ${order.amount}`);

      // 事务成功后设置 Redis 缓存（24小时过期）
      try {
        await this.redis.setex(redisKey, 86400, '1');
      } catch (redisError) {
        this.logger.warn(`Redis缓存设置失败: ${redisError.message}`);
      }

      return 'success';
    } catch (error) {
      await queryRunner.rollbackTransaction().catch(rbErr => {
        this.logger.error(`[handleAlipayNotify] 回滚事务也失败: ${rbErr.message}`);
      });
      this.logger.error(`支付宝回调处理失败: ${outTradeNo}, 错误: ${error.message}`, error.stack);
      return 'fail';
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 处理微信支付异步通知
   * 双层防重机制：Redis + 数据库悲观锁
   * 支持 V2（XML）和 V3（JSON）回调
   */
  async handleWechatNotify(body: any, headers?: Record<string, string>): Promise<string> {
    this.logger.log(`收到微信支付回调通知`);

    // 日志输出数据库连接信息，用于排查数据写入到哪个库
    try {
      const dbOpts = this.dataSource.options as any;
      this.logger.log(`[DB] DataSource: type=${dbOpts?.type}, host=${dbOpts?.host}, port=${dbOpts?.port}, database=${dbOpts?.database}, isConnected=${this.dataSource.isInitialized}`);
    } catch (e) {
      this.logger.warn(`[DB] 无法获取DataSource信息: ${e.message}`);
    }

    // 正确处理body：可能是XML字符串、Buffer（NestJS默认不解析XML）或JSON对象
    let bodyStr: string;
    if (typeof body === 'string') {
      bodyStr = body;
    } else if (Buffer.isBuffer(body)) {
      bodyStr = body.toString('utf-8');
    } else if (body && typeof body === 'object') {
      bodyStr = JSON.stringify(body);
    } else {
      bodyStr = String(body || '');
    }

    // 验证签名并解析数据
    const { verified, data } = await this.wechatPayService.verifyNotify(bodyStr, headers);
    if (!verified || !data) {
      this.logger.error('微信支付签名验证失败');
      return this.wechatPayService.buildFailResponse('签名验证失败');
    }

    const outTradeNo = data.out_trade_no;
    // V2回调没有 trade_state，用 result_code 判断；V3有 trade_state
    const tradeState = data.trade_state || (data.return_code === 'SUCCESS' && data.result_code === 'SUCCESS' ? 'SUCCESS' : data.result_code);
    const transactionId = data.transaction_id;

    this.logger.log(`[回调解析] outTradeNo=${outTradeNo}, tradeState=${tradeState}, transactionId=${transactionId}, return_code=${data.return_code}, result_code=${data.result_code}`);

    // 第一层防重：Redis 检查是否已处理（使用 out_trade_no + transaction_id 组合作为唯一标识）
    const redisKey = `payment:notify:wechat:${outTradeNo}_${transactionId}`;
    try {
      const alreadyProcessed = await this.redis.get(redisKey);
      if (alreadyProcessed) {
        this.logger.log(`微信回调已处理过(Redis命中): ${outTradeNo}_${transactionId}`);
        return this.wechatPayService.buildSuccessResponse();
      }
    } catch (redisError) {
      this.logger.warn(`Redis检查失败，降级到数据库层防重: ${redisError.message}`);
    }

    // 第二层防重：数据库事务内检查订单状态（悲观锁）
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 用悲观锁锁定订单行，防止并发
      const order = await queryRunner.manager.findOne(PaymentOrder, {
        where: { outTradeNo },
        lock: { mode: 'pessimistic_write' }
      });

      if (!order) {
        this.logger.error(`订单不存在: ${outTradeNo}`);
        await queryRunner.rollbackTransaction();
        return this.wechatPayService.buildFailResponse('订单不存在');
      }

      // 如果订单已经是 paid 状态，说明已处理过
      if (order.status === PaymentStatus.PAID) {
        this.logger.log(`订单已支付(数据库命中): ${outTradeNo}`);
        await queryRunner.commitTransaction();
        // 补设 Redis 缓存（可能之前 Redis 写入失败）
        try {
          await this.redis.setex(redisKey, 86400, '1');
        } catch (e) {
          // 忽略 Redis 错误
        }
        return this.wechatPayService.buildSuccessResponse();
      }

      // 检查交易状态
      if (tradeState !== 'SUCCESS') {
        this.logger.log(`交易状态非成功: ${tradeState}`);
        await queryRunner.commitTransaction();
        return this.wechatPayService.buildSuccessResponse();
      }

      // 更新订单状态
      order.status = PaymentStatus.PAID;
      order.tradeNo = transactionId;
      order.paidAt = new Date();
      order.notifyData = JSON.stringify(data);
      this.logger.log(`[handleWechatNotify] 更新订单状态: ${outTradeNo} -> PAID, tradeNo=${transactionId}`);
      await queryRunner.manager.save(PaymentOrder, order);
      this.logger.log(`[handleWechatNotify] 订单状态保存成功`);

      // 支付成功处理（认购直付或充值余额）
      await this.processPaymentSuccess(order, queryRunner);

      this.logger.log(`[handleWechatNotify] 提交事务...`);
      await queryRunner.commitTransaction();
      this.logger.log(`[handleWechatNotify] 事务提交成功`);

      // 事务提交后验证数据是否真正写入
      try {
        const verifyOrder = await this.paymentOrderRepository.findOne({ where: { outTradeNo } });
        if (verifyOrder && verifyOrder.status === PaymentStatus.PAID) {
          this.logger.log(`[验证] payment_orders 已确认: ${outTradeNo} status=PAID`);
        } else {
          this.logger.error(`[验证] payment_orders 异常: ${outTradeNo} status=${verifyOrder?.status ?? 'NOT_FOUND'}`);
        }
        // 验证 account_balances 和 account_transactions
        if (!order.subscriptionInfo) {
          const verifyBalance = await this.dataSource.getRepository(AccountBalance).findOne({ where: { userId: order.userId } });
          if (verifyBalance) {
            this.logger.log(`[验证] account_balances 已确认: userId=${order.userId}, availableBalance=${verifyBalance.availableBalance}`);
          } else {
            this.logger.error(`[验证] account_balances 未找到: userId=${order.userId}`);
          }
          const verifyTransaction = await this.dataSource.getRepository(AccountTransaction).findOne({
            where: { userId: order.userId, type: TransactionType.RECHARGE },
            order: { createdAt: 'DESC' },
          });
          if (verifyTransaction) {
            this.logger.log(`[验证] account_transactions 已确认: userId=${order.userId}, amount=${verifyTransaction.amount}`);
          } else {
            this.logger.error(`[验证] account_transactions 未找到: userId=${order.userId}`);
          }
        }
      } catch (verifyErr) {
        this.logger.error(`[验证] 数据验证异常: ${verifyErr.message}`);
      }

      this.logger.log(`微信回调处理成功: ${outTradeNo}, 金额: ${order.amount}`);

      // 事务成功后设置 Redis 缓存（24小时过期）
      try {
        await this.redis.setex(redisKey, 86400, '1');
      } catch (redisError) {
        this.logger.warn(`Redis缓存设置失败: ${redisError.message}`);
      }

      return this.wechatPayService.buildSuccessResponse();
    } catch (error) {
      await queryRunner.rollbackTransaction().catch(rbErr => {
        this.logger.error(`[handleWechatNotify] 回滚事务也失败: ${rbErr.message}`);
      });
      this.logger.error(`微信回调处理失败: ${outTradeNo}, 错误: ${error.message}`, error.stack);
      return this.wechatPayService.buildFailResponse('处理失败');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 查询支付宝订单状态
   * 如果查询到已支付，使用事务处理防止重复入账
   */
  async queryAlipayOrder(outTradeNo: string): Promise<{
    status: string;
    amount: number;
  }> {
    const paymentOrder = await this.paymentOrderRepository.findOne({
      where: { outTradeNo },
    });

    if (!paymentOrder) {
      throw new BadRequestException('订单不存在');
    }

    this.logger.log(`[queryAlipayOrder] 查询支付宝订单: outTradeNo=${outTradeNo}, 当前状态=${paymentOrder.status}`);

    // 如果已经是支付成功状态，直接返回
    if (paymentOrder.status === PaymentStatus.PAID) {
      return {
        status: PaymentStatus.PAID,
        amount: Number(paymentOrder.amount),
      };
    }

    // 查询支付宝订单状态
    const result = await this.alipayService.queryOrder(outTradeNo);

    // 如果查询结果显示已支付，使用事务处理（带悲观锁）
    if (result.tradeStatus === 'TRADE_SUCCESS' || result.tradeStatus === 'TRADE_FINISHED') {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 重新查询订单并加锁
        const order = await queryRunner.manager.findOne(PaymentOrder, {
          where: { outTradeNo },
          lock: { mode: 'pessimistic_write' }
        });

        if (!order) {
          await queryRunner.rollbackTransaction();
          throw new BadRequestException('订单不存在');
        }

        // 再次检查状态（双重检查）
        if (order.status === PaymentStatus.PAID) {
          await queryRunner.commitTransaction();
          return {
            status: PaymentStatus.PAID,
            amount: Number(order.amount),
          };
        }

        // 更新订单状态
        order.status = PaymentStatus.PAID;
        order.tradeNo = result.tradeNo || '';
        order.paidAt = new Date();
        order.notifyData = JSON.stringify(result);
        await queryRunner.manager.save(PaymentOrder, order);

        // 支付成功处理（认购直付或充值余额）
        await this.processPaymentSuccess(order, queryRunner);

        await queryRunner.commitTransaction();

        this.logger.log(`支付宝订单查询后处理成功: ${outTradeNo}, 金额: ${order.amount}`);

        return {
          status: PaymentStatus.PAID,
          amount: Number(order.amount),
        };
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error(`支付宝订单查询处理失败: ${outTradeNo}`, error);
        throw error;
      } finally {
        await queryRunner.release();
      }
    }

    return {
      status: paymentOrder.status,
      amount: Number(paymentOrder.amount),
    };
  }

  /**
   * 查询微信支付订单状态
   * 如果查询到已支付，使用事务处理防止重复入账
   */
  async queryWechatOrder(outTradeNo: string): Promise<{
    status: string;
    amount: number;
  }> {
    const paymentOrder = await this.paymentOrderRepository.findOne({
      where: { outTradeNo },
    });

    if (!paymentOrder) {
      throw new BadRequestException('订单不存在');
    }

    this.logger.log(`[queryWechatOrder] 查询微信订单: outTradeNo=${outTradeNo}, 当前状态=${paymentOrder.status}`);

    // 如果已经是支付成功状态，直接返回
    if (paymentOrder.status === PaymentStatus.PAID) {
      return {
        status: PaymentStatus.PAID,
        amount: Number(paymentOrder.amount),
      };
    }

    // 查询微信支付订单状态
    const result = await this.wechatPayService.queryOrder(outTradeNo);

    // 如果查询结果显示已支付，使用事务处理（带悲观锁）
    if (result.tradeState === 'SUCCESS') {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 重新查询订单并加锁
        const order = await queryRunner.manager.findOne(PaymentOrder, {
          where: { outTradeNo },
          lock: { mode: 'pessimistic_write' }
        });

        if (!order) {
          await queryRunner.rollbackTransaction();
          throw new BadRequestException('订单不存在');
        }

        // 再次检查状态（双重检查）
        if (order.status === PaymentStatus.PAID) {
          await queryRunner.commitTransaction();
          return {
            status: PaymentStatus.PAID,
            amount: Number(order.amount),
          };
        }

        // 更新订单状态
        order.status = PaymentStatus.PAID;
        order.tradeNo = result.transactionId || '';
        order.paidAt = new Date();
        order.notifyData = JSON.stringify(result);
        await queryRunner.manager.save(PaymentOrder, order);

        // 支付成功处理（认购直付或充值余额）
        await this.processPaymentSuccess(order, queryRunner);

        await queryRunner.commitTransaction();

        this.logger.log(`微信订单查询后处理成功: ${outTradeNo}, 金额: ${order.amount}`);

        return {
          status: PaymentStatus.PAID,
          amount: Number(order.amount),
        };
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error(`微信订单查询处理失败: ${outTradeNo}`, error);
        throw error;
      } finally {
        await queryRunner.release();
      }
    }

    return {
      status: paymentOrder.status,
      amount: Number(paymentOrder.amount),
    };
  }

  // ==================== H5 支付 ====================

  /**
   * 创建微信 H5 支付订单（移动端网页支付）
   */
  async createWechatH5Order(
    userId: string,
    amount: number,
    clientIp: string,
  ): Promise<{
    outTradeNo: string;
    mwebUrl: string;
    mockMode?: boolean;
  }> {
    // 校验用户审核状态
    await this.validateUserApproved(userId);

    const outTradeNo = this.generateOutTradeNo();

    let result: { mwebUrl: string; mockMode?: boolean };
    try {
      result = await this.wechatPayService.createH5Order(
        outTradeNo,
        amount,
        `零钱保账户充值`,
        clientIp,
      );
    } catch (error) {
      throw new BadRequestException(`微信H5支付创建失败: ${error.message}`);
    }

    if (result.mockMode) {
      const paymentOrder = this.paymentOrderRepository.create({
        userId,
        outTradeNo,
        channel: PaymentChannel.WECHAT,
        amount,
        status: PaymentStatus.PENDING,
      });
      await this.paymentOrderRepository.save(paymentOrder);
      this.logger.log(`[Mock模式] 创建微信H5支付订单: ${outTradeNo}, 金额: ${amount}`);
      return {
        outTradeNo,
        mwebUrl: result.mwebUrl,
        mockMode: true,
      };
    }

    const paymentOrder = this.paymentOrderRepository.create({
      userId,
      outTradeNo,
      channel: PaymentChannel.WECHAT,
      amount,
      status: PaymentStatus.PENDING,
    });
    await this.paymentOrderRepository.save(paymentOrder);

    return {
      outTradeNo,
      mwebUrl: result.mwebUrl,
    };
  }

  /**
   * 创建微信 JSAPI 支付订单（微信浏览器内支付）
   * 如果 openId 为空，降级为 H5 支付
   */
  async createWechatJsapiOrder(
    userId: string,
    amount: number,
    openId: string,
    clientIp: string,
  ): Promise<{
    outTradeNo: string;
    appId?: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: string;
    paySign: string;
    mockMode?: boolean;
  }> {
    // 校验用户审核状态
    await this.validateUserApproved(userId);

    // 如果 openId 为空，降级为 H5 支付
    if (!openId || openId.trim() === '') {
      this.logger.log(`[JSAPI] openId为空，降级为H5支付`);
      const h5Result = await this.createWechatH5Order(userId, amount, clientIp);
      return {
        outTradeNo: h5Result.outTradeNo,
        timeStamp: '',
        nonceStr: '',
        package: '',
        signType: '',
        paySign: '',
        mockMode: h5Result.mockMode,
      };
    }

    const outTradeNo = this.generateOutTradeNo();

    let result: {
      appId: string;
      timeStamp: string;
      nonceStr: string;
      package: string;
      signType: string;
      paySign: string;
      mockMode?: boolean;
    };
    try {
      result = await this.wechatPayService.createJsapiOrder(
        outTradeNo,
        amount,
        `零钱保账户充值`,
        clientIp,
        openId,
      );
    } catch (error) {
      throw new BadRequestException(`微信JSAPI支付创建失败: ${error.message}`);
    }

    if (result.mockMode) {
      const paymentOrder = this.paymentOrderRepository.create({
        userId,
        outTradeNo,
        channel: PaymentChannel.WECHAT,
        amount,
        status: PaymentStatus.PENDING,
      });
      await this.paymentOrderRepository.save(paymentOrder);
      this.logger.log(`[Mock模式] 创建微信JSAPI支付订单: ${outTradeNo}, 金额: ${amount}`);
    } else {
      const paymentOrder = this.paymentOrderRepository.create({
        userId,
        outTradeNo,
        channel: PaymentChannel.WECHAT,
        amount,
        status: PaymentStatus.PENDING,
      });
      await this.paymentOrderRepository.save(paymentOrder);
    }

    return {
      outTradeNo,
      appId: result.appId,
      timeStamp: result.timeStamp,
      nonceStr: result.nonceStr,
      package: result.package,
      signType: result.signType,
      paySign: result.paySign,
      mockMode: result.mockMode,
    };
  }

  // ==================== 认购 H5/JSAPI 支付 ====================

  /**
   * 认购直付：创建 H5 支付订单
   */
  async createSubscriptionH5Payment(
    userId: string,
    drugId: string,
    quantity: number,
    clientIp: string,
  ): Promise<{
    outTradeNo: string;
    mwebUrl: string;
    mockMode?: boolean;
  }> {
    // 0. 校验用户审核状态
    await this.validateUserApproved(userId);

    // 1. 校验药品
    const drug = await this.drugRepository.findOne({ where: { id: drugId } });
    if (!drug) {
      throw new BadRequestException('药品不存在');
    }
    if (drug.status !== DrugStatus.FUNDING) {
      throw new BadRequestException('该药品当前不可认购');
    }
    const remainingQuantity = drug.totalQuantity - drug.subscribedQuantity;
    if (remainingQuantity < quantity) {
      throw new BadRequestException(`剩余可认购数量不足，当前剩余：${remainingQuantity}盒`);
    }

    // 2. 计算认购金额
    const amount = Number((quantity * Number(drug.purchasePrice)).toFixed(2));

    // 3. 创建支付订单
    const outTradeNo = this.generateOutTradeNo();
    const subscriptionInfo = { drugId, quantity, amount };

    const result = await this.wechatPayService.createH5Order(
      outTradeNo,
      amount,
      `零钱保认购${drug.name}`,
      clientIp,
    );

    if (result.mockMode) {
      const paymentOrder = this.paymentOrderRepository.create({
        userId,
        outTradeNo,
        channel: PaymentChannel.WECHAT,
        amount,
        status: PaymentStatus.PENDING,
        subscriptionInfo,
      });
      await this.paymentOrderRepository.save(paymentOrder);
      return { outTradeNo, mwebUrl: result.mwebUrl, mockMode: true };
    }

    const paymentOrder = this.paymentOrderRepository.create({
      userId,
      outTradeNo,
      channel: PaymentChannel.WECHAT,
      amount,
      status: PaymentStatus.PENDING,
      subscriptionInfo,
    });
    await this.paymentOrderRepository.save(paymentOrder);
    return { outTradeNo, mwebUrl: result.mwebUrl };
  }

  /**
   * 认购直付：创建 JSAPI 支付订单
   * 如果 openId 为空，降级为 H5 支付
   */
  async createSubscriptionJsapiPayment(
    userId: string,
    drugId: string,
    quantity: number,
    openId: string,
    clientIp: string,
  ): Promise<{
    outTradeNo: string;
    appId?: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: string;
    paySign: string;
    mockMode?: boolean;
  }> {
    // 0. 校验用户审核状态
    await this.validateUserApproved(userId);

    // 如果 openId 为空，降级为 H5 支付
    if (!openId || openId.trim() === '') {
      this.logger.log(`[JSAPI认购] openId为空，降级为H5支付`);
      const h5Result = await this.createSubscriptionH5Payment(userId, drugId, quantity, clientIp);
      return {
        outTradeNo: h5Result.outTradeNo,
        timeStamp: '',
        nonceStr: '',
        package: '',
        signType: '',
        paySign: '',
        mockMode: h5Result.mockMode,
      };
    }

    // 1. 校验药品
    const drug = await this.drugRepository.findOne({ where: { id: drugId } });
    if (!drug) {
      throw new BadRequestException('药品不存在');
    }
    if (drug.status !== DrugStatus.FUNDING) {
      throw new BadRequestException('该药品当前不可认购');
    }
    const remainingQuantity = drug.totalQuantity - drug.subscribedQuantity;
    if (remainingQuantity < quantity) {
      throw new BadRequestException(`剩余可认购数量不足，当前剩余：${remainingQuantity}盒`);
    }

    // 2. 计算认购金额
    const amount = Number((quantity * Number(drug.purchasePrice)).toFixed(2));

    // 3. 创建支付订单
    const outTradeNo = this.generateOutTradeNo();
    const subscriptionInfo = { drugId, quantity, amount };

    const result = await this.wechatPayService.createJsapiOrder(
      outTradeNo,
      amount,
      `零钱保认购${drug.name}`,
      clientIp,
      openId,
    );

    if (result.mockMode) {
      const paymentOrder = this.paymentOrderRepository.create({
        userId,
        outTradeNo,
        channel: PaymentChannel.WECHAT,
        amount,
        status: PaymentStatus.PENDING,
        subscriptionInfo,
      });
      await this.paymentOrderRepository.save(paymentOrder);
    } else {
      const paymentOrder = this.paymentOrderRepository.create({
        userId,
        outTradeNo,
        channel: PaymentChannel.WECHAT,
        amount,
        status: PaymentStatus.PENDING,
        subscriptionInfo,
      });
      await this.paymentOrderRepository.save(paymentOrder);
    }

    return {
      outTradeNo,
      appId: result.appId,
      timeStamp: result.timeStamp,
      nonceStr: result.nonceStr,
      package: result.package,
      signType: result.signType,
      paySign: result.paySign,
      mockMode: result.mockMode,
    };
  }
}
