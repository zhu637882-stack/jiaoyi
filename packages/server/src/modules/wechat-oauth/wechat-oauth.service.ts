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
   * 构建微信OAuth2授权URL（snsapi_base静默授权）
   */
  getAuthorizeUrl(redirectUrl: string, host?: string): string {
    const appId = this.configService.get<string>('WECHAT_APP_ID');
    const callbackUrl = host
      ? `http://${host}/api/wechat/oauth/callback`
      : 'http://www.mufend.com/api/wechat/oauth/callback';
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

    const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;

    const data = await this.httpsGet(url);

    if (data.errcode) {
      throw new Error(`微信OAuth错误: ${data.errcode} - ${data.errmsg}`);
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
