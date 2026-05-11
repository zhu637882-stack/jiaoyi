import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as https from 'https';
import { User } from '../../database/entities/user.entity';

@Injectable()
export class WechatOauthService {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * 规范化OAuth回调域名：裸域名自动映射为带www的版本，与微信后台配置保持一致
   */
  private normalizeOAuthHost(host: string): string {
    // 去掉端口号
    const hostname = host.split(':')[0];
    // 裸域名映射为微信后台配置的带www域名
    if (hostname === 'duokeer.com') return 'www.duokeer.com';
    if (hostname === 'mufend.com') return 'www.mufend.com';
    return hostname;
  }

  /**
   * 构建微信OAuth2授权URL（snsapi_base静默授权）
   */
  getAuthorizeUrl(redirectUrl: string, host?: string): string {
    const appId = this.configService.get<string>('WECHAT_APP_ID');
    const normalizedHost = host ? this.normalizeOAuthHost(host) : 'www.duokeer.com';
    const callbackUrl = `http://${normalizedHost}/api/wechat/oauth/callback`;
    const state = Buffer.from(redirectUrl).toString('base64url');

    const params = new URLSearchParams({
      appid: appId!,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'snsapi_base',
      state,
    });

    return `https://open.weixin.qq.com/connect/oauth2/authorize?${params.toString()}#wechat_redirect`;
  }

  /**
   * 用code换取openId
   */
  async getOpenIdByCode(code: string): Promise<string> {
    const appId = this.configService.get<string>('WECHAT_APP_ID');
    const appSecret = this.configService.get<string>('WECHAT_APP_SECRET');

    console.log('[WechatOAuth] getOpenIdByCode called, appId:', appId ? `${appId.substring(0, 6)}***` : 'UNDEFINED');

    if (!appId || !appSecret) {
      console.error('[WechatOAuth] Missing config! appId:', appId || 'EMPTY', 'appSecret:', appSecret ? 'SET' : 'EMPTY');
      throw new Error('微信OAuth配置缺失: APP_ID或APP_SECRET未设置');
    }

    const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;
    console.log('[WechatOAuth] Requesting access_token with code:', code.substring(0, 4) + '***');

    let data: any;
    try {
      data = await this.httpsGet(url);
    } catch (err) {
      console.error('[WechatOAuth] HTTPS request failed:', err);
      throw new Error('微信OAuth网络请求失败');
    }

    console.log('[WechatOAuth] WeChat API response errcode:', data.errcode || 'none', 'openid:', data.openid ? `${String(data.openid).substring(0, 6)}***` : 'none');

    if (data.errcode) {
      console.error('[WechatOAuth] WeChat API error:', data.errcode, data.errmsg);
      throw new Error(`微信OAuth错误: ${data.errcode} - ${data.errmsg}`);
    }

    if (!data.openid) {
      console.error('[WechatOAuth] No openid in response, full data:', JSON.stringify(data).substring(0, 200));
      throw new Error('微信OAuth返回数据异常: 未获取到openid');
    }

    return data.openid;
  }

  /**
   * 保存openId到用户
   */
  async saveOpenId(userId: string, openId: string): Promise<void> {
    await this.userRepository.update(userId, { wechatOpenId: openId });
  }

  /**
   * 获取用户openId
   */
  async getOpenId(userId: string): Promise<string | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return user?.wechatOpenId || null;
  }

  /**
   * HTTPS GET请求工具方法
   */
  private httpsGet(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`解析微信响应失败: ${data}`));
            }
          });
        })
        .on('error', (err) => reject(err));
    });
  }
}
