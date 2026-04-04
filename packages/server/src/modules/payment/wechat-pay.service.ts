import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as xml2js from 'xml2js';
import * as crypto from 'crypto';

@Injectable()
export class WechatPayService {
  private readonly logger = new Logger(WechatPayService.name);
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get('WECHAT_API_KEY') || '';
  }

  /**
   * 检测是否为Mock模式
   * 当API密钥不存在或包含placeholder时，使用Mock模式
   */
  private isMockMode(): boolean {
    return !this.apiKey || this.apiKey.includes('placeholder');
  }

  /**
   * 生成随机字符串
   */
  private generateNonceStr(length = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成 MD5 签名
   * @param params 参数对象
   * @param key API密钥
   */
  private generateSign(params: Record<string, string>, key: string): string {
    // 按字典序排列
    const sortedKeys = Object.keys(params).sort();
    const stringA = sortedKeys
      .filter((k) => params[k] !== '' && params[k] !== undefined)
      .map((k) => `${k}=${params[k]}`)
      .join('&');

    const stringSignTemp = `${stringA}&key=${key}`;
    return crypto.createHash('md5').update(stringSignTemp).digest('hex').toUpperCase();
  }

  /**
   * 对象转 XML
   */
  private buildXml(params: Record<string, string>): string {
    let xml = '<xml>';
    for (const key of Object.keys(params)) {
      const value = params[key];
      if (value !== undefined && value !== '') {
        xml += `<${key}><![CDATA[${value}]]></${key}>`;
      }
    }
    xml += '</xml>';
    return xml;
  }

  /**
   * XML 转对象
   */
  private async parseXml(xml: string): Promise<Record<string, string>> {
    const parser = new xml2js.Parser({
      explicitArray: false,
      explicitRoot: false,
    });
    const result = await parser.parseStringPromise(xml);
    return result;
  }

  /**
   * 创建 NATIVE 扫码支付订单
   * @param outTradeNo 商户订单号
   * @param amount 金额（元）
   * @param description 商品描述
   * @param clientIp 客户端IP
   * @returns code_url 支付二维码链接和Mock模式标识
   */
  async createOrder(
    outTradeNo: string,
    amount: number,
    description: string,
    clientIp: string,
  ): Promise<{ codeUrl: string; mockMode?: boolean }> {
    // Mock模式：返回模拟响应
    if (this.isMockMode()) {
      const mockTradeNo = `MOCK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.logger.log(`[Mock模式] 创建微信支付订单: ${outTradeNo}, 金额: ${amount}`);
      return {
        codeUrl: `https://mock-payment.example.com/wechat/${mockTradeNo}`,
        mockMode: true,
      };
    }

    const appId = this.configService.get('WECHAT_APP_ID');
    const mchId = this.configService.get('WECHAT_MCH_ID');
    const notifyUrl = this.configService.get('WECHAT_NOTIFY_URL');

    // 金额转换为分
    const totalFee = Math.round(amount * 100);

    const params: Record<string, string> = {
      appid: appId,
      mch_id: mchId,
      nonce_str: this.generateNonceStr(),
      body: description,
      out_trade_no: outTradeNo,
      total_fee: String(totalFee),
      spbill_create_ip: clientIp,
      notify_url: notifyUrl,
      trade_type: 'NATIVE',
    };

    // 生成签名
    params.sign = this.generateSign(params, this.apiKey);

    const xml = this.buildXml(params);

    try {
      const response = await axios.post(
        'https://api.mch.weixin.qq.com/pay/unifiedorder',
        xml,
        {
          headers: {
            'Content-Type': 'application/xml',
          },
        },
      );

      const result = await this.parseXml(response.data);

      this.logger.log(`Wechat create order result: ${JSON.stringify(result)}`);

      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        return { codeUrl: result.code_url };
      } else {
        throw new Error(result.return_msg || result.err_code_des || '创建微信支付订单失败');
      }
    } catch (error) {
      this.logger.error(`Wechat create order error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 验证微信支付回调签名
   * @param xmlBody XML格式的回调数据
   * @returns 验证结果和解析后的数据
   */
  async verifyNotify(xmlBody: string): Promise<{
    verified: boolean;
    data?: Record<string, string>;
  }> {
    try {
      const data = await this.parseXml(xmlBody);

      const sign = data.sign;
      delete data.sign;

      const calculatedSign = this.generateSign(data, this.apiKey);

      return {
        verified: calculatedSign === sign,
        data: { ...data, sign },
      };
    } catch (error) {
      this.logger.error(`Wechat verify notify error: ${error.message}`);
      return { verified: false };
    }
  }

  /**
   * 生成回调成功响应 XML
   */
  buildSuccessXml(): string {
    return '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
  }

  /**
   * 生成回调失败响应 XML
   */
  buildFailXml(message: string): string {
    return `<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[${message}]]></return_msg></xml>`;
  }

  /**
   * 查询订单状态
   * @param outTradeNo 商户订单号
   */
  async queryOrder(outTradeNo: string): Promise<{
    tradeState: string;
    transactionId?: string;
    totalFee?: number;
  }> {
    const appId = this.configService.get('WECHAT_APP_ID');
    const mchId = this.configService.get('WECHAT_MCH_ID');

    const params: Record<string, string> = {
      appid: appId,
      mch_id: mchId,
      out_trade_no: outTradeNo,
      nonce_str: this.generateNonceStr(),
    };

    params.sign = this.generateSign(params, this.apiKey);

    const xml = this.buildXml(params);

    try {
      const response = await axios.post(
        'https://api.mch.weixin.qq.com/pay/orderquery',
        xml,
        {
          headers: {
            'Content-Type': 'application/xml',
          },
        },
      );

      const result = await this.parseXml(response.data);

      this.logger.log(`Wechat query order result: ${JSON.stringify(result)}`);

      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        return {
          tradeState: result.trade_state,
          transactionId: result.transaction_id,
          totalFee: result.total_fee ? Number(result.total_fee) : undefined,
        };
      } else {
        return {
          tradeState: 'UNKNOWN',
        };
      }
    } catch (error) {
      this.logger.error(`Wechat query order error: ${error.message}`);
      throw error;
    }
  }
}
