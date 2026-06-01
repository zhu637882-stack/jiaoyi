import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  // 环境变量启动校验
  const requiredEnvVars = [
    'JWT_SECRET',
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_DATABASE',
  ];

  const optionalPaymentVars = [
    'ALIPAY_APP_ID',
    'WECHAT_APP_ID',
  ];

  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`❌ 缺少必需环境变量: ${missing.join(', ')}`);
    process.exit(1);
  }

  const missingPayment = optionalPaymentVars.filter(v => !process.env[v]);
  if (missingPayment.length > 0) {
    console.warn(`⚠️ 支付相关环境变量未配置（支付功能将不可用）: ${missingPayment.join(', ')}`);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 静态文件服务 - 提供上传图片的访问
  app.useStaticAssets(join(process.cwd(), 'public'));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // 设置全局路由前缀
  app.setGlobalPrefix('api');

  // 微信支付回调路由：手动读取原始 XML body（NestJS默认body-parser不解析text/xml）
  app.use('/api/payment/wechat/notify', (req: any, _res: any, next: any) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => { data += chunk; });
    req.on('end', () => { req.body = data; next(); });
    req.on('error', () => { req.body = ''; next(); });
  });

  // 请求体调试日志（仅开发环境）
  if (process.env.NODE_ENV === 'development') {
    app.use((req: any, _res: any, next: any) => {
      if (req.body && (typeof req.body === 'string' || Object.keys(req.body).length > 0)) {
        console.log('[DEBUG] Request:', req.method, req.url, typeof req.body === 'string' ? req.body.substring(0, 200) : JSON.stringify(req.body).substring(0, 200));
      }
      next();
    });
  }

  // 启用全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
  
  // 启用CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://103.43.188.127',
      'http://www.duokeer.com',
      'https://www.duokeer.com',
      'http://duokeer.com',
      'https://duokeer.com',
      'http://www.mufend.com',
      'https://www.mufend.com',
      'http://mufend.com',
      'https://mufend.com',
      'http://localhost:5173',
      'http://localhost:5174',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server running on http://localhost:${port}`);
}
bootstrap();
