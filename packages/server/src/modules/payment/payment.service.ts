import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Redis from 'ioredis';
import { PaymentOrder, PaymentChannel, PaymentStatus } from '../../database/entities/payment-order.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AccountTransaction, TransactionType } from '../../database/entities/account-transaction.entity';
import { AlipayService } from './alipay.service';
import { WechatPayService } from './wechat-pay.service';
import { REDIS_CLIENT } from '../../database/database.module';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentOrder)
    private paymentOrderRepository: Repository<PaymentOrder>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private alipayService: AlipayService,
    private wechatPayService: WechatPayService,
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
      `药赚赚账户充值-${outTradeNo}`,
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
      `药赚赚账户充值`,
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

      // 充值到用户余额
      let balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        balance = queryRunner.manager.create(AccountBalance, {
          userId,
          availableBalance: 0,
          frozenBalance: 0,
          totalProfit: 0,
          totalInvested: 0,
        });
        await queryRunner.manager.save(balance);
      }

      const balanceBefore = Number(balance.availableBalance);
      balance.availableBalance = Number((balanceBefore + amount).toFixed(2));
      await queryRunner.manager.save(balance);

      // 记录资金流水
      const transaction = queryRunner.manager.create(AccountTransaction, {
        userId,
        type: TransactionType.RECHARGE,
        amount,
        balanceBefore,
        balanceAfter: balance.availableBalance,
        description: `${channel === PaymentChannel.ALIPAY ? '支付宝' : '微信支付'}充值(Mock) (${outTradeNo})`,
        relatedOrderId: paymentOrder.id,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      this.logger.log(`[Mock模式] 支付完成: ${outTradeNo}, 充值金额: ${amount}`);

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

      // 充值到用户余额
      let balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId: order.userId },
        lock: { mode: 'pessimistic_write' }
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

      // 记录资金流水
      const transaction = queryRunner.manager.create(AccountTransaction, {
        userId: order.userId,
        type: TransactionType.RECHARGE,
        amount: order.amount,
        balanceBefore,
        balanceAfter: balance.availableBalance,
        description: `${order.channel === PaymentChannel.ALIPAY ? '支付宝' : '微信支付'}充值(Mock确认) (${outTradeNo})`,
        relatedOrderId: order.id,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      this.logger.log(`[Mock模式] 支付确认成功: ${outTradeNo}, 充值金额: ${order.amount}`);

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

      // 充值到用户余额（在同一事务内）
      let balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId: order.userId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!balance) {
        // 如果余额记录不存在，创建一个
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

      // 记录资金流水
      const transaction = queryRunner.manager.create(AccountTransaction, {
        userId: order.userId,
        type: TransactionType.RECHARGE,
        amount: order.amount,
        balanceBefore: balanceBefore,
        balanceAfter: balance.availableBalance,
        description: `支付宝充值 (${outTradeNo})`,
        relatedOrderId: order.id,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      this.logger.log(`支付宝回调处理成功: ${outTradeNo}, 充值金额: ${order.amount}`);

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
   */
  async handleWechatNotify(xmlBody: string): Promise<string> {
    this.logger.log(`收到微信支付回调通知`);

    // 验证签名并解析数据
    const { verified, data } = await this.wechatPayService.verifyNotify(xmlBody);
    if (!verified || !data) {
      this.logger.error('微信支付签名验证失败');
      return this.wechatPayService.buildFailXml('签名验证失败');
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
        return this.wechatPayService.buildSuccessXml();
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
        return this.wechatPayService.buildFailXml('订单不存在');
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
        return this.wechatPayService.buildSuccessXml();
      }

      // 检查交易状态
      if (tradeState !== 'SUCCESS') {
        this.logger.log(`交易状态非成功: ${tradeState}`);
        await queryRunner.commitTransaction();
        return this.wechatPayService.buildSuccessXml();
      }

      // 更新订单状态
      order.status = PaymentStatus.PAID;
      order.tradeNo = transactionId;
      order.paidAt = new Date();
      order.notifyData = JSON.stringify(data);
      await queryRunner.manager.save(order);

      // 充值到用户余额（在同一事务内）
      let balance = await queryRunner.manager.findOne(AccountBalance, {
        where: { userId: order.userId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!balance) {
        // 如果余额记录不存在，创建一个
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

      // 记录资金流水
      const transaction = queryRunner.manager.create(AccountTransaction, {
        userId: order.userId,
        type: TransactionType.RECHARGE,
        amount: order.amount,
        balanceBefore: balanceBefore,
        balanceAfter: balance.availableBalance,
        description: `微信支付充值 (${outTradeNo})`,
        relatedOrderId: order.id,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      this.logger.log(`微信回调处理成功: ${outTradeNo}, 充值金额: ${order.amount}`);

      // 事务成功后设置 Redis 缓存（24小时过期）
      try {
        await this.redis.setex(redisKey, 86400, '1');
      } catch (redisError) {
        this.logger.warn(`Redis缓存设置失败: ${redisError.message}`);
      }

      return this.wechatPayService.buildSuccessXml();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`微信回调处理失败: ${outTradeNo}`, error);
      return this.wechatPayService.buildFailXml('处理失败');
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

        // 充值到用户余额
        let balance = await queryRunner.manager.findOne(AccountBalance, {
          where: { userId: order.userId },
          lock: { mode: 'pessimistic_write' }
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

        // 记录资金流水
        const transaction = queryRunner.manager.create(AccountTransaction, {
          userId: order.userId,
          type: TransactionType.RECHARGE,
          amount: order.amount,
          balanceBefore: balanceBefore,
          balanceAfter: balance.availableBalance,
          description: `支付宝充值 (${outTradeNo})`,
          relatedOrderId: order.id,
        });
        await queryRunner.manager.save(transaction);

        await queryRunner.commitTransaction();

        this.logger.log(`支付宝订单查询后处理成功: ${outTradeNo}, 充值金额: ${order.amount}`);

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

        // 充值到用户余额
        let balance = await queryRunner.manager.findOne(AccountBalance, {
          where: { userId: order.userId },
          lock: { mode: 'pessimistic_write' }
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

        // 记录资金流水
        const transaction = queryRunner.manager.create(AccountTransaction, {
          userId: order.userId,
          type: TransactionType.RECHARGE,
          amount: order.amount,
          balanceBefore: balanceBefore,
          balanceAfter: balance.availableBalance,
          description: `微信支付充值 (${outTradeNo})`,
          relatedOrderId: order.id,
        });
        await queryRunner.manager.save(transaction);

        await queryRunner.commitTransaction();

        this.logger.log(`微信订单查询后处理成功: ${outTradeNo}, 充值金额: ${order.amount}`);

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
