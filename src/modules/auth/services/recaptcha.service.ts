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
