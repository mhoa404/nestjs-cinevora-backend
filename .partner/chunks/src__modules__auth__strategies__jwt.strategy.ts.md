# FILE: src/modules/auth/strategies/jwt.strategy.ts

path: src/modules/auth/strategies/jwt.strategy.ts
module: auth
kind: strategy
language: ts
line_count: 42
size_bytes: 1219
sha256: 39d8dc082612d5e9b70560a8e6cb93b93f602a14cf159066a29fbb10bc4af960
updated_at: 2026-04-08T04:57:37.366Z

## SYMBOLS
- JwTStrategy

## CODE

````ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

import { JwtPayload } from '../../../common/types/jwt-payload.type';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwTStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const accessSecret = configService.get<string>('jwt.accessSecret');

    if (!accessSecret) {
      throw new Error('Missing jwt.accessSecret');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản không hợp lệ hoặc bị khoá');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}

````
