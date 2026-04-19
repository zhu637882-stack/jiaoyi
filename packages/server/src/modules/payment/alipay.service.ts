import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlipaySdk, AlipayFormData } from 'alipay-sdk';

@Injectable()
export class AlipayService {
  private readonly logger = new Logger(AlipayService.name);
  private alipaySdk: any;
  private privateKey: string;
  private alipayPublicKey: string;
  private paymentMode: string;

  constructor(private configService: ConfigService) {
    this.privateKey = this.configService.get('ALIPAY_PRIVATE_KEY') || '';
    this.alipayPublicKey = this.configService.get('ALIPAY_PUBLIC_KEY') || '';
    this.paymentMode = this.configService.get('PAYMENT_MODE') || 'real';

    // 检查是否为 Mock 模式
    const isMock = this.paymentMode.toLowerCase() === 'mock' || 
                   !this.privateKey || 
                   this.privateKey.includes('placeholder') || 
                   this.privateKey.startsWith('your_');

    // 只在非 Mock 模式下初始化 AlipaySdk
    if (!isMock) {
      // 根据支付模式选择网关地址
      let gateway = 'https://openapi.alipay.com/gateway.do';
      if (this.paymentMode.toLowerCase() === 'sandbox') {
        gateway = 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';
      }

      this.alipaySdk = new AlipaySdk({
        appId: this.configService.get('ALIPAY_APP_ID'),
        privateKey: this.privateKey,
        alipayPublicKey: this.alipayPublicKey,
        keyType: 'PKCS8', // 支付宝密钥工具默认生成PKCS8格式
        gateway,
      });
    } else {
      this.logger.warn('[支付配置] 支付宝使用 Mock 模式');
    }
  }

  /**
   * 检测是否为Mock模式
   * 条件：
   * 1. PAYMENT_MODE 环境变量设置为 'mock'
   * 2. 私钥不存在
   * 3. 私钥包含 placeholder 或以 your_ 开头
   */
  private isMockMode(): boolean {
    // 1. PAYMENT_MODE 显式设置为 mock
    if (this.paymentMode.toLowerCase() === 'mock') {
      this.logger.warn('[支付配置] PAYMENT_MODE 设置为 mock，使用 Mock 模式');
      return true;
    }

    // 2. 私钥不存在
    if (!this.privateKey) {
      this.logger.warn('[支付配置] ALIPAY_PRIVATE_KEY 未配置，使用 Mock 模式');
      return true;
    }

    // 3. 私钥包含 placeholder 或以 your_ 开头
    if (this.privateKey.includes('placeholder') || this.privateKey.startsWith('your_')) {
      this.logger.warn('[支付配置] ALIPAY_PRIVATE_KEY 为占位符值，使用 Mock 模式');
      return true;
    }

    return false;
  }

  /**
   * 是否为沙箱模式
   */
  private isSandboxMode(): boolean {
    return this.paymentMode.toLowerCase() === 'sandbox';
  }

  /**
   * 创建当面付扫码订单
   * @param outTradeNo 商户订单号
   * @param amount 金额（元）
   * @param subject 订单标题
   * @returns 二维码内容和Mock模式标识
   */
  async createOrder(
    outTradeNo: string,
    amount: number,
    subject: string,
  ): Promise<{ qrCode: string; mockMode?: boolean }> {
    // Mock模式：返回模拟响应
    if (this.isMockMode()) {
      const mockTradeNo = `MOCK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.logger.log(`[Mock模式] 创建支付宝订单: ${outTradeNo}, 金额: ${amount}`);
      return {
        qrCode: `https://mock-payment.example.com/alipay/${mockTradeNo}`,
        mockMode: true,
      };
    }

    const notifyUrl = this.configService.get('ALIPAY_NOTIFY_URL');

    try {
      const result = await this.alipaySdk.exec(
        'alipay.trade.precreate',
        {
          notifyUrl,
          bizContent: {
            out_trade_no: outTradeNo,
            total_amount: amount.toFixed(2),
            subject: subject,
            timeout_express: '30m',
          },
        },
      );

      this.logger.log(`Alipay create order result: ${JSON.stringify(result)}`);

      if (result.code === '10000' && result.qrCode) {
        // 返回二维码内容，前端生成二维码图片
        return { qrCode: result.qrCode };
      } else {
        throw new Error(result.msg || '创建支付宝订单失败');
      }
    } catch (error) {
      this.logger.error(`Alipay create order error: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 验证支付宝异步通知签名
   * @param params 回调参数
   * @returns 验证结果
   */
  verifyNotify(params: Record<string, string>): boolean {
    try {
      const sign = params.sign;
      const signType = params.sign_type;
      const paramsCopy = { ...params };
      delete paramsCopy.sign;
      delete paramsCopy.sign_type;

      const verified = this.alipaySdk.checkNotifySign(paramsCopy, sign, signType);
      return verified;
    } catch (error) {
      this.logger.error(`Alipay verify notify error: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 查询订单状态
   * @param outTradeNo 商户订单号
   * @returns 订单信息
   */
  async queryOrder(outTradeNo: string): Promise<{
    tradeStatus: string;
    tradeNo?: string;
    totalAmount?: number;
  }> {
    try {
      const result = await this.alipaySdk.exec(
        'alipay.trade.query',
        {
          bizContent: {
            out_trade_no: outTradeNo,
          },
        },
      );

      this.logger.log(`Alipay query order result: ${JSON.stringify(result)}`);

      if (result.code === '10000') {
        return {
          tradeStatus: result.tradeStatus,
          tradeNo: result.tradeNo,
          totalAmount: Number(result.totalAmount),
        };
      } else {
        return {
          tradeStatus: 'UNKNOWN',
        };
      }
    } catch (error) {
      this.logger.error(`Alipay query order error: ${(error as Error).message}`);
      throw error;
    }
  }
}
