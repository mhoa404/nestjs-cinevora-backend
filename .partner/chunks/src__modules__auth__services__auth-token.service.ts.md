# FILE: src/modules/auth/services/auth-token.service.ts

path: src/modules/auth/services/auth-token.service.ts
module: auth
kind: service
language: ts
line_count: 98
size_bytes: 2846
sha256: 0c5e193e7dea8c5ddb9ae843aafba8e76e2dbb443129e08c226d469e2bd5510c
updated_at: 2026-04-15T13:19:51.209Z

## SYMBOLS
- AuthTokenService

## CODE

````ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';

import { JwtPayload } from '../../../common/types/jwt-payload.type';
import { AuthTokens } from '../interfaces/auth-tokens.interface';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  generatePayload(user: User): JwtPayload {
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: randomUUID(),
    };
  }

  async generateTokens(user: User): Promise<AuthTokens> {
    const payload = this.generatePayload(user);

    const accessSecret = this.configService.get<string>('jwt.accessSecret');
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');
    const accessExpiresInSeconds = this.configService.get<number>(
      'jwt.accessExpiresInSeconds',
    );
    const refreshExpiresInSeconds = this.configService.get<number>(
      'jwt.refreshExpiresInSeconds',
    );

    if (
      !accessSecret ||
      !refreshSecret ||
      !accessExpiresInSeconds ||
      !refreshExpiresInSeconds
    ) {
      throw new InternalServerErrorException('Thiếu cấu hình JWT');
    }

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessExpiresInSeconds,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresInSeconds,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresInSeconds,
    };
  }

  verifyRefreshToken(refreshToken: string): JwtPayload {
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');

    if (!refreshSecret) {
      throw new InternalServerErrorException('Thiếu cấu hình refresh secret.');
    }

    return this.jwtService.verify<JwtPayload>(refreshToken, {
      secret: refreshSecret,
    });
  }

  getRefreshExpiresInSeconds(): number {
    const refreshExpiresInSeconds = this.configService.get<number>(
      'jwt.refreshExpiresInSeconds',
    );

    if (!refreshExpiresInSeconds) {
      throw new InternalServerErrorException(
        'Thiếu cấu hình thời gian sống của Refresh Token.',
      );
    }

    return refreshExpiresInSeconds;
  }

  getRefreshExpiresAt(): Date {
    return new Date(Date.now() + this.getRefreshExpiresInSeconds() * 1000);
  }

  getRefreshCookieMaxAgeMs(): number {
    return this.getRefreshExpiresInSeconds() * 1000;
  }
}

````
