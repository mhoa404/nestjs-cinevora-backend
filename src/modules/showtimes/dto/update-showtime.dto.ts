import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateShowtimeDto {
  @IsOptional()
  @IsInt({ message: 'roomId phải là số nguyên.' })
  roomId?: number;

  @IsOptional()
  @IsDateString({}, { message: 'startTime phải là ISO 8601 (UTC).' })
  startTime?: string;

  @IsOptional()
  @Min(0, { message: 'Giá vé standard phải >= 0.' })
  @IsInt({ message: 'Giá vé standard phải là số nguyên.' })
  priceStandard?: number;

  @IsOptional()
  @Min(0, { message: 'Giá vé VIP phải >= 0.' })
  @IsInt({ message: 'Giá vé VIP phải là số nguyên.' })
  priceVip?: number;

  @IsOptional()
  @Min(0, { message: 'Giá vé premium phải >= 0.' })
  @IsInt({ message: 'Giá vé premium phải là số nguyên.' })
  pricePremium?: number;

  @IsOptional()
  @Min(0, { message: 'Giá vé couple phải >= 0.' })
  @IsInt({ message: 'Giá vé couple phải là số nguyên.' })
  priceCouple?: number;
}
