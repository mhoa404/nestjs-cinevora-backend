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
