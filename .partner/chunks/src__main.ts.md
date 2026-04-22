# FILE: src/main.ts

path: src/main.ts
module: root
kind: file
language: ts
line_count: 40
size_bytes: 1039
sha256: d25ad8b0c6d9c99e0a62a79d1e1d1562514c0d53fc883583b4e02c66cfa1e49b
updated_at: 2026-04-13T15:21:46.252Z

## SYMBOLS
- bootstrap

## CODE

````ts
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port')!;
  const frontendUrl = configService.get<string>('app.frontendUrl')!;

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.use(cookieParser());

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  await app.listen(port);
}

bootstrap().catch((err) => {
  console.error('Lỗi khởi động server:', err);
});

````
