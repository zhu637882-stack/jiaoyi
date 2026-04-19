import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';
import * as xml2js from 'xml2js';
// @ts-ignore - wechatpay-node-v3 无类型声明
import WxPay from 'wechatpay-node-v3';

/**
 * 微信支付服务 - 支持 V2 + V3 双模式自动切换
 * 
 * 优先级：V3 > V2 > Mock
 * - V3：需要 APIv3密钥 + 商户私钥 + 证书序列号 + 公钥ID
 * - V2：需要 API密钥（V2密钥）
 * - Mock：密钥为占位符时自动降级
 */
@Injectable()
export class WechatPayService implements OnModuleInit {
  private readonly logger = new Logger(WechatPayService.name);

  // 模式: v3 / v2 / mock
  private payMode: 'v3' | 'v2' | 'mock' = 'mock';
  private paymentMode: string;

  // V2 配置
  private apiKey = '';

  // V3 SDK 实例
  private wxpayV3: any = null;
  private apiV3Key = '';
  private certSerialNo = '';
  private publicKeyId = '';

  constructor(private configService: ConfigService) {
    this.paymentMode = this.configService.get('PAYMENT_MODE') || 'real';
  }

  onModuleInit() {
    this.detectPayMode();
  }

  /**
   * 检测支付模式：V3 > V2 > Mock
   */
  private detectPayMode() {
    // 1. 显式 mock
    if (this.paymentMode.toLowerCase() === 'mock') {
      this.payMode = 'mock';
      this.logger.warn('[微信支付] PAYMENT_MODE=mock，使用 Mock 模式');
      return;
    }

    // 2. 尝试初始化 V3
    const apiV3Key = this.configService.get('WECHAT_API_V3_KEY') || '';
    const certSerialNo = this.configService.get('WECHAT_CERT_SERIAL_NO') || '';
    const publicKeyId = this.configService.get('WECHAT_PUBLIC_KEY_ID') || '';
    const privateKeyPath = this.configService.get('WECHAT_PRIVATE_KEY_PATH') || '';

    const v3Configured = 
      apiV3Key && !this.isPlaceholder(apiV3Key) &&
      certSerialNo && !this.isPlaceholder(certSerialNo) &&
      publicKeyId && !this.isPlaceholder(publicKeyId) &&
      privateKeyPath && !this.isPlaceholder(privateKeyPath);

    if (v3Configured) {
      try {
        const privateKey = this.loadPrivateKey(privateKeyPath);
        if (privateKey) {
          this.wxpayV3 = new WxPay({
            appid: this.configService.get('WECHAT_APP_ID') as string,
            mchid: this.configService.get('WECHAT_MCH_ID') as string,
            publicKey: Buffer.from(''),
            privateKey: Buffer.from(privateKey),
          });
          this.apiV3Key = apiV3Key;
          this.certSerialNo = certSerialNo;
          this.publicKeyId = publicKeyId;
          this.payMode = 'v3';
          this.logger.log('[微信支付] ✅ V3 模式初始化成功');
          return;
        }
      } catch (err) {
        this.logger.warn(`[微信支付] V3 初始化失败: ${err.message}，尝试降级到 V2`);
      }
    }

    // 3. 尝试 V2
    this.apiKey = this.configService.get('WECHAT_API_KEY') || '';
    if (this.apiKey && !this.isPlaceholder(this.apiKey)) {
      this.payMode = 'v2';
      this.logger.log('[微信支付] ✅ V2 模式（MD5签名）');
      return;
    }

    // 4. 降级到 Mock
    this.payMode = 'mock';
    this.logger.warn('[微信支付] 密钥均未配置，使用 Mock 模式');
  }

  private isPlaceholder(value: string): boolean {
    return !value || value.includes('placeholder') || value.startsWith('your_');
  }

  /**
   * 加载商户API私钥
   */
  private loadPrivateKey(keyPath: string): string | null {
    try {
      const fullPath = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        // 验证是PEM格式
        if (content.includes('-----BEGIN')) {
          return content;
        }
        this.logger.warn(`[微信支付] 私钥文件格式不正确: ${fullPath}`);
        return null;
      }
      this.logger.warn(`[微信支付] 私钥文件不存在: ${fullPath}`);
      return null;
    } catch (err) {
      this.logger.warn(`[微信支付] 读取私钥文件失败: ${err.message}`);
      return null;
    }
  }

  /**
   * 当前是否为Mock模式
   */
  private isMockMode(): boolean {
    return this.payMode === 'mock';
  }

  // ==================== V2 辅助方法 ====================

  private generateNonceStr(length = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateSign(params: Record<string, string>, key: string): string {
    const sortedKeys = Object.keys(params).sort();
    const stringA = sortedKeys
      .filter((k) => params[k] !== '' && params[k] !== undefined)
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    const stringSignTemp = `${stringA}&key=${key}`;
    return crypto.createHash('md5').update(stringSignTemp).digest('hex').toUpperCase();
  }

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

  private async parseXml(xml: string): Promise<Record<string, string>> {
    const parser = new xml2js.Parser({ explicitArray: false, explicitRoot: false });
    return parser.parseStringPromise(xml);
  }

  // ==================== 创建支付订单 ====================

  /**
   * 创建 NATIVE 扫码支付订单
   */
  async createOrder(
    outTradeNo: string,
    amount: number,
    description: string,
    clientIp: string,
  ): Promise<{ codeUrl: string; mockMode?: boolean }> {
    if (this.isMockMode()) {
      const mockTradeNo = `MOCK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.logger.log(`[Mock模式] 创建微信支付订单: ${outTradeNo}, 金额: ${amount}`);
      return {
        codeUrl: `https://mock-payment.example.com/wechat/${mockTradeNo}`,
        mockMode: true,
      };
    }

    if (this.payMode === 'v3') {
      return this.createOrderV3(outTradeNo, amount, description);
    } else {
      return this.createOrderV2(outTradeNo, amount, description, clientIp);
    }
  }

  /**
   * V3 创建订单
   */
  private async createOrderV3(
    outTradeNo: string,
    amount: number,
    description: string,
  ): Promise<{ codeUrl: string }> {
    const params: Record<string, any> = {
      appid: this.configService.get('WECHAT_APP_ID'),
      mchid: this.configService.get('WECHAT_MCH_ID'),
      description,
      out_trade_no: outTradeNo,
      notify_url: this.configService.get('WECHAT_NOTIFY_URL'),
      amount: {
        total: Math.round(amount * 100), // 转为分
        currency: 'CNY',
      },
    };

    try {
      const result = await this.wxpayV3.transactions_native(params);
      this.logger.log(`[V3] 微信创建订单成功: ${outTradeNo}`);

      if (result.code_url) {
        return { codeUrl: result.code_url };
      } else {
        throw new Error(result.message || 'V3创建订单未返回code_url');
      }
    } catch (error) {
      this.logger.error(`[V3] 微信创建订单失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * V2 创建订单
   */
  private async createOrderV2(
    outTradeNo: string,
    amount: number,
    description: string,
    clientIp: string,
  ): Promise<{ codeUrl: string }> {
    const appId = this.configService.get('WECHAT_APP_ID');
    const mchId = this.configService.get('WECHAT_MCH_ID');
    const notifyUrl = this.configService.get('WECHAT_NOTIFY_URL');
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

    params.sign = this.generateSign(params, this.apiKey);
    const xml = this.buildXml(params);

    try {
      const response = await axios.post(
        'https://api.mch.weixin.qq.com/pay/unifiedorder',
        xml,
        { headers: { 'Content-Type': 'application/xml' } },
      );

      const result = await this.parseXml(response.data);
      this.logger.log(`[V2] 微信创建订单结果: ${JSON.stringify(result)}`);

      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        return { codeUrl: result.code_url };
      } else {
        throw new Error(result.return_msg || result.err_code_des || 'V2创建微信支付订单失败');
      }
    } catch (error) {
      this.logger.error(`[V2] 微信创建订单失败: ${error.message}`);
      throw error;
    }
  }

  // ==================== 验证回调签名 ====================

  /**
   * 验证微信支付回调签名
   * V3 回调是 JSON + HTTP头签名；V2 回调是 XML + MD5签名
   */
  async verifyNotify(
    body: string,
    headers?: Record<string, string>,
  ): Promise<{
    verified: boolean;
    data?: Record<string, any>;
  }> {
    if (this.isMockMode()) {
      // Mock模式下直接解析
      try {
        const data = await this.parseXml(body);
        return { verified: true, data };
      } catch {
        try {
          return { verified: true, data: JSON.parse(body) };
        } catch {
          return { verified: false };
        }
      }
    }

    if (this.payMode === 'v3') {
      return this.verifyNotifyV3(body, headers);
    } else {
      return this.verifyNotifyV2(body);
    }
  }

  /**
   * V3 验证回调签名
   * V3回调：JSON body + HTTP头中包含签名信息
   */
  private async verifyNotifyV3(
    body: string,
    headers?: Record<string, string>,
  ): Promise<{ verified: boolean; data?: Record<string, any> }> {
    try {
      if (!headers) {
        this.logger.error('[V3] 回调缺少HTTP头信息，无法验签');
        return { verified: false };
      }

      // V3回调签名验证
      const signature = headers['wechatpay-signature'] || '';
      const timestamp = headers['wechatpay-timestamp'] || '';
      const nonce = headers['wechatpay-nonce'] || '';
      const serial = headers['wechatpay-serial'] || '';

      if (!signature || !timestamp || !nonce) {
        this.logger.error('[V3] 回调缺少必要的签名头');
        return { verified: false };
      }

      // 使用微信支付公钥验签
      const message = `${timestamp}\n${nonce}\n${body}\n`;
      
      // wechatpay-node-v3 SDK 的验签方法
      const verified = this.wxpayV3.verifySign({
        body,
        signature,
        timestamp,
        nonce,
        serial,
      });

      if (!verified) {
        this.logger.error('[V3] 回调签名验证失败');
        return { verified: false };
      }

      // 解密回调数据
      const bodyObj = JSON.parse(body);
      let decryptedData: Record<string, any> = {};

      if (bodyObj.resource) {
        const decrypted = this.wxpayV3.decipher(
          bodyObj.resource.ciphertext,
          bodyObj.resource.associated_data,
          bodyObj.resource.nonce,
          this.apiV3Key,
        );
        decryptedData = JSON.parse(decrypted);
      } else {
        decryptedData = bodyObj;
      }

      this.logger.log(`[V3] 回调验签成功，交易状态: ${decryptedData.trade_state}`);

      // 统一返回格式（兼容 V2 字段名）
      return {
        verified: true,
        data: {
          out_trade_no: decryptedData.out_trade_no,
          trade_state: decryptedData.trade_state,
          transaction_id: decryptedData.transaction_id,
          total_fee: decryptedData.amount?.total,
          ...decryptedData,
        },
      };
    } catch (error) {
      this.logger.error(`[V3] 回调验签失败: ${error.message}`);
      return { verified: false };
    }
  }

  /**
   * V2 验证回调签名（MD5）
   */
  private async verifyNotifyV2(body: string): Promise<{ verified: boolean; data?: Record<string, string> }> {
    try {
      const data = await this.parseXml(body);
      const sign = data.sign;
      delete data.sign;
      const calculatedSign = this.generateSign(data, this.apiKey);

      return {
        verified: calculatedSign === sign,
        data: { ...data, sign },
      };
    } catch (error) {
      this.logger.error(`[V2] 回调验签失败: ${error.message}`);
      return { verified: false };
    }
  }

  // ==================== 回调响应 ====================

  /**
   * 生成回调成功响应
   * V3返回JSON，V2返回XML
   */
  buildSuccessResponse(): string {
    if (this.payMode === 'v3') {
      return JSON.stringify({ code: 'SUCCESS', message: '成功' });
    }
    return '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
  }

  /**
   * 生成回调失败响应
   */
  buildFailResponse(message: string): string {
    if (this.payMode === 'v3') {
      return JSON.stringify({ code: 'FAIL', message });
    }
    return `<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[${message}]]></return_msg></xml>`;
  }

  // 兼容旧方法名
  buildSuccessXml(): string {
    return this.buildSuccessResponse();
  }

  buildFailXml(message: string): string {
    return this.buildFailResponse(message);
  }

  // ==================== 查询订单 ====================

  /**
   * 查询订单状态
   */
  async queryOrder(outTradeNo: string): Promise<{
    tradeState: string;
    transactionId?: string;
    totalFee?: number;
  }> {
    if (this.isMockMode()) {
      return { tradeState: 'NOTPAY' };
    }

    if (this.payMode === 'v3') {
      return this.queryOrderV3(outTradeNo);
    } else {
      return this.queryOrderV2(outTradeNo);
    }
  }

  /**
   * V3 查询订单
   */
  private async queryOrderV3(outTradeNo: string): Promise<{
    tradeState: string;
    transactionId?: string;
    totalFee?: number;
  }> {
    try {
      const mchid = this.configService.get('WECHAT_MCH_ID');
      const result = await this.wxpayV3.query({ out_trade_no: outTradeNo }, { params: { mchid } });

      this.logger.log(`[V3] 查询订单结果: ${JSON.stringify(result)}`);

      return {
        tradeState: result.trade_state,
        transactionId: result.transaction_id,
        totalFee: result.amount?.total,
      };
    } catch (error) {
      this.logger.error(`[V3] 查询订单失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * V2 查询订单
   */
  private async queryOrderV2(outTradeNo: string): Promise<{
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
        { headers: { 'Content-Type': 'application/xml' } },
      );

      const result = await this.parseXml(response.data);
      this.logger.log(`[V2] 查询订单结果: ${JSON.stringify(result)}`);

      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        return {
          tradeState: result.trade_state,
          transactionId: result.transaction_id,
          totalFee: result.total_fee ? Number(result.total_fee) : undefined,
        };
      } else {
        return { tradeState: 'UNKNOWN' };
      }
    } catch (error) {
      this.logger.error(`[V2] 查询订单失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取当前支付模式
   */
  getPayMode(): string {
    return this.payMode;
  }
}
