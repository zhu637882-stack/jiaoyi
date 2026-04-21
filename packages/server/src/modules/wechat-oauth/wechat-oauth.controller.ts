import {
  Controller,
  Get,
  Query,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WechatOauthService } from './wechat-oauth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller('wechat/oauth')
export class WechatOauthController {
  constructor(private readonly wechatOauthService: WechatOauthService) {}

  /**
   * GET /api/wechat/oauth/authorize?redirectUrl=xxx
   * 重定向到微信OAuth2授权页，不需要JWT认证
   */
  @Get('authorize')
  @Public()
  @Redirect()
  authorize(
    @Query('redirectUrl') redirectUrl: string,
    @Req() req: any,
  ) {
    const host = req.headers.host;
    const url = this.wechatOauthService.getAuthorizeUrl(redirectUrl || '/', host);
    return { url, statusCode: 302 };
  }

  /**
   * GET /api/wechat/oauth/callback?code=xxx&state=xxx
   * 微信回调，用code换openId，然后重定向回原始URL
   * 不需要JWT认证
   */
  @Get('callback')
  @Public()
  @Redirect()
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    let redirectUrl = '/';
    try {
      // 从state解码出原始redirectUrl
      if (state) {
        redirectUrl = Buffer.from(state, 'base64url').toString('utf-8');
      }

      // 用code换openId
      const openId = await this.wechatOauthService.getOpenIdByCode(code);

      // 将openId附加到redirectUrl
      const separator = redirectUrl.includes('?') ? '&' : '?';
      const url = `${redirectUrl}${separator}openId=${openId}`;

      return { url, statusCode: 302 };
    } catch (error) {
      // 出错时仍然重定向回原URL，附加错误信息
      const separator = redirectUrl.includes('?') ? '&' : '?';
      const url = `${redirectUrl}${separator}wechatError=oauth_failed`;
      return { url, statusCode: 302 };
    }
  }

  /**
   * GET /api/wechat/oauth/openid
   * 需要JWT认证，返回当前用户的openId
   */
  @Get('openid')
  @UseGuards(JwtAuthGuard)
  async getOpenId(@Req() req: any) {
    const userId = req.user.id;
    const openId = await this.wechatOauthService.getOpenId(userId);
    return { openId: openId || '' };
  }
}
