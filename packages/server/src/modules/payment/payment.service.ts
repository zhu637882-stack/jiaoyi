import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Redis from 'ioredis';
import { PaymentOrder, PaymentChannel, PaymentStatus } from '../../database/entities/payment-order.entity';
import { Drug, DrugStatus } from '../../database/entities/drug.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AccountTransaction, TransactionType } from '../../database/entities/account-transaction.entity';
import { AlipayService } from './alipay.service';
import { WechatPayService } from './wechat-pay.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { REDIS_CLIENT } from '../../database/database.module';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentOrder)
    private paymentOrderRepository: Repository<PaymentOrder>,
    @InjectRepository(Drug)
    private drugRepository: Repository<Drug>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private alipayService: AlipayService,
    private wechatPayService: WechatPayService,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
    private dataSource: DataSource,
  ) {}

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
    queryRunner: import('typeorm').QueryRunner,
  ): Promise<void> {
    if (order.subscriptionInfo) {
      // 认购直付：直接创建认购订单
      const { drugId, quantity, amount } = order.subscriptionInfo;
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
      let balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId: order.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        balance = queryRunner.manager.create(AccountBalance, {
          userId: order.userId,
          availableBalance: 0,
          frozenBalance: 0,
          totalProfit: 0,
          totalInvested: 0,
        });
        await queryRunner.manager.save(balance);
      }

      const balanceBefore = Number(balance.availableBalance);
      balance.availableBalance = Number((balanceBefore + Number(order.amount)).toFixed(2));
      await queryRunner.manager.save(balance);

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
      await queryRunner.manager.save(transaction);

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
    const outTradeNo = this.generateOutTradeNo();

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
    const outTradeNo = this.generateOutTradeNo();

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
      await queryRunner.manager.save(paymentOrder);

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
      await queryRunner.manager.save(order);

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
      await queryRunner.manager.save(order);

      // 支付成功处理（认购直付或充值余额）
      await this.processPaymentSuccess(order, queryRunner);

      await queryRunner.commitTransaction();

      this.logger.log(`支付宝回调处理成功: ${outTradeNo}, 金额: ${order.amount}`);

      // 事务成功后设置 Redis 缓存（24小时过期）
      try {
        await this.redis.setex(redisKey, 86400, '1');
      } catch (redisError) {
        this.logger.warn(`Redis缓存设置失败: ${redisError.message}`);
      }

      return 'success';
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`支付宝回调处理失败: ${outTradeNo}`, error);
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

    // V2 body是XML字符串，V3 body是JSON对象
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

    // 验证签名并解析数据
    const { verified, data } = await this.wechatPayService.verifyNotify(bodyStr, headers);
    if (!verified || !data) {
      this.logger.error('微信支付签名验证失败');
      return this.wechatPayService.buildFailResponse('签名验证失败');
    }

    const outTradeNo = data.out_trade_no;
    const tradeState = data.trade_state;
    const transactionId = data.transaction_id;

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
      await queryRunner.manager.save(order);

      // 支付成功处理（认购直付或充值余额）
      await this.processPaymentSuccess(order, queryRunner);

      await queryRunner.commitTransaction();

      this.logger.log(`微信回调处理成功: ${outTradeNo}, 金额: ${order.amount}`);

      // 事务成功后设置 Redis 缓存（24小时过期）
      try {
        await this.redis.setex(redisKey, 86400, '1');
      } catch (redisError) {
        this.logger.warn(`Redis缓存设置失败: ${redisError.message}`);
      }

      return this.wechatPayService.buildSuccessResponse();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`微信回调处理失败: ${outTradeNo}`, error);
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
        await queryRunner.manager.save(order);

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
        await queryRunner.manager.save(order);

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
}
