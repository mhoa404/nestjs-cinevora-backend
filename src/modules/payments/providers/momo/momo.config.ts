import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MomoConfig {
  constructor(private readonly configService: ConfigService) {}

  get accessKey(): string {
    return this.configService.getOrThrow<string>('MOMO_ACCESS_KEY');
  }

  get secretKey(): string {
    return this.configService.getOrThrow<string>('MOMO_SECRET_KEY');
  }

  get partnerCode(): string {
    return this.configService.getOrThrow<string>('MOMO_PARTNER_CODE');
  }

  get orderInfo(): string {
    return this.configService.getOrThrow<string>('MOMO_ORDER_INFO');
  }

  get redirectUrl(): string {
    return this.configService.getOrThrow<string>('MOMO_REDIRECT_URL');
  }

  get ipnUrl(): string {
    return this.configService.getOrThrow<string>('MOMO_IPN_URL');
  }

  get requestType(): string {
    return this.configService.get<string>('MOMO_REQUEST_TYPE', 'payWithMethod');
  }

  get extraData(): string {
    return this.configService.get<string>('MOMO_EXTRA_DATA', '');
  }

  get orderGroupId(): string {
    return this.configService.get<string>('MOMO_ORDER_GROUP_ID', '');
  }

  get autoCapture(): boolean {
    const value = this.configService.get<string>('MOMO_AUTO_CAPTURE', 'true');

    return value === 'true';
  }

  get lang(): string {
    return this.configService.get<string>('MOMO_LANG', 'vi');
  }

  get createEndpoint(): string {
    return this.configService.getOrThrow<string>('MOMO_CREATE_ENDPOINT');
  }

  get queryEndpoint(): string {
    return this.configService.getOrThrow<string>('MOMO_QUERY_ENDPOINT');
  }

  get partnerName(): string {
    return this.configService.get<string>('MOMO_PARTNER_NAME', 'Test');
  }

  get storeId(): string {
    return this.configService.get<string>('MOMO_STORE_ID', 'MomoTestStore');
  }
}
