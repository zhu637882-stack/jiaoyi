import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WechatOauthService } from './wechat-oauth.service';
import { WechatOauthController } from './wechat-oauth.controller';
import { User } from '../../database/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [WechatOauthController],
  providers: [WechatOauthService],
  exports: [WechatOauthService],
})
export class WechatOauthModule {}
