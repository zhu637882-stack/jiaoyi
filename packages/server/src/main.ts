import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  
  // 设置全局路由前缀
  app.setGlobalPrefix('api');

  // DEBUG: 打印所有请求体（用于排查DTO校验问题）
  app.use((req: any, _res: any, next: any) => {
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('[DEBUG] Request:', req.method, req.url, JSON.stringify(req.body));
    }
    next();
  });

  // 启用全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
  
  // 启用CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });
  
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server running on http://localhost:${port}`);
}
bootstrap();
