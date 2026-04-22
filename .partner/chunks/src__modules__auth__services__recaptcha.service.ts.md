# FILE: src/modules/auth/services/recaptcha.service.ts

path: src/modules/auth/services/recaptcha.service.ts
module: auth
kind: service
language: ts
line_count: 52
size_bytes: 1310
sha256: a3464f005721fad2c74302cc2d966fac116475b4cf78c48036fd3db7303534b0
updated_at: 2026-04-08T04:57:37.360Z

## SYMBOLS
- RecaptchaService

## CODE

````ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class RecaptchaService {
  constructor(private readonly configService: ConfigService) {}

  async verify(token: string): Promise<void> {
    const isEnabled =
      this.configService.get<string>('ENABLE_RECAPTCHA') === 'true';

    if (!isEnabled) {
      return;
    }

    const secretKey = this.configService.get<string>('RECAPTCHA_SECRET_KEY');

    if (!secretKey) {
      throw new InternalServerErrorException(
        'Thiếu cấu hình RECAPTCHA_SECRET_KEY',
      );
    }

    try {
      const response = await axios.post<{
        success: boolean;
        score?: number;
      }>('https://www.google.com/recaptcha/api/siteverify', null, {
        params: {
          secret: secretKey,
          response: token,
        },
      });

      if (!response.data.success) {
        throw new BadRequestException('Xác minh reCAPTCHA thất bại');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Không thể xác minh reCAPTCHA');
    }
  }
}

````
