# FILE: src/modules/showtimes/dto/update-showtime.dto.ts

path: src/modules/showtimes/dto/update-showtime.dto.ts
module: showtimes
kind: dto
language: ts
line_count: 33
size_bytes: 1015
sha256: 5231c717ea4e6d4a38718072eb64c9dd9135499aaae81e0df12953865e776e04
updated_at: 2026-04-22T13:29:49.009Z

## SYMBOLS
- UpdateShowtimeDto

## CODE

````ts
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

// movieId là immutable – KHÔNG có trong DTO này
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

````
