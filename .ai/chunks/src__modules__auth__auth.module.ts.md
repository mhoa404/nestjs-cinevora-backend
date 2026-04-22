# FILE: src/modules/auth/auth.module.ts

path: src/modules/auth/auth.module.ts
module: auth
kind: module
language: ts
line_count: 37
size_bytes: 1202
sha256: 58fe6d71a96f3eca8196430078cb58c71c89420ff6d5bb8f588a404b3406af7d
updated_at: 2026-04-08T04:57:37.352Z

## SYMBOLS
- AuthModule

## CODE

````ts
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokenService } from './services/refresh-token.service';
import { AuthTokenService } from './services/auth-token.service';
import { RecaptchaService } from './services/recaptcha.service';
import { JwTStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthCookieService } from './services/auth-cookie.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([RefreshToken]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenService,
    RefreshTokenService,
    RecaptchaService,
    AuthCookieService,
    JwTStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}

````
