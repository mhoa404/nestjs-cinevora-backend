import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, CookieOptions } from 'express';

@Injectable()
export class AuthCookieService {
  private static readonly REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

  constructor(private readonly configService: ConfigService) {}

  getCookieName(): string {
    return AuthCookieService.REFRESH_TOKEN_COOKIE_NAME;
  }

  getCookieOptions(): CookieOptions {
    const refreshExpiresInSeconds = this.configService.get<number>(
      'jwt.refreshExpiresInSeconds',
    );

    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: (refreshExpiresInSeconds ?? 30 * 24 * 60 * 60) * 1000,
    };
  }

  setCookie(res: Response, refreshToken: string): void {
    res.cookie(this.getCookieName(), refreshToken, this.getCookieOptions());
  }

  clearCookie(res: Response): void {
    res.clearCookie(this.getCookieName(), this.getCookieOptions());
  }

  extractCookie(
    req: Request,
    exceptionType: 'bad_request' | 'unauthorized' = 'unauthorized',
  ): string {
    const cookies = req.cookies as Record<string, string | undefined>;
    const token = cookies?.[this.getCookieName()];

    if (token) {
      return token;
    }

    if (exceptionType === 'bad_request') {
      throw new BadRequestException(
        'Không tìm thấy refresh token trong Cookie',
      );
    }

    throw new UnauthorizedException(
      'Không tìm thấy refresh token trong Cookie',
    );
  }
}
