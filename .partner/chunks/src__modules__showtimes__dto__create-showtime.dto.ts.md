# FILE: src/modules/showtimes/dto/create-showtime.dto.ts

path: src/modules/showtimes/dto/create-showtime.dto.ts
module: showtimes
kind: dto
language: ts
line_count: 54
size_bytes: 1670
sha256: 95f22a394cc87716f5f4054d421e0e5af1c2e697cec11e8180681e1fcde6c11e
updated_at: 2026-04-22T13:29:45.161Z

## SYMBOLS
- ShowtimeItemDto
- CreateShowtimeDto

## CODE

````ts
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

export class ShowtimeItemDto {
  @IsInt({ message: 'roomId phải là số nguyên.' })
  @IsNotEmpty({ message: 'Vui lòng chọn phòng chiếu.' })
  roomId!: number;

  @IsDateString({}, { message: 'startTime phải là ISO 8601 (UTC).' })
  @IsNotEmpty({ message: 'Vui lòng nhập thời gian bắt đầu.' })
  startTime!: string;

  @Min(0, { message: 'Giá vé standard phải >= 0.' })
  @IsInt({ message: 'Giá vé standard phải là số nguyên.' })
  @IsNotEmpty({ message: 'Vui lòng nhập giá vé standard.' })
  priceStandard!: number;

  @Min(0, { message: 'Giá vé VIP phải >= 0.' })
  @IsInt({ message: 'Giá vé VIP phải là số nguyên.' })
  @IsNotEmpty({ message: 'Vui lòng nhập giá vé VIP.' })
  priceVip!: number;

  @IsOptional()
  @Min(0, { message: 'Giá vé premium phải >= 0.' })
  @IsInt({ message: 'Giá vé premium phải là số nguyên.' })
  pricePremium?: number;

  @IsOptional()
  @Min(0, { message: 'Giá vé couple phải >= 0.' })
  @IsInt({ message: 'Giá vé couple phải là số nguyên.' })
  priceCouple?: number;
}

export class CreateShowtimeDto {
  @IsInt({ message: 'movieId phải là số nguyên.' })
  @IsNotEmpty({ message: 'Vui lòng chọn phim.' })
  movieId!: number;

  @IsArray({ message: 'showtimes phải là một mảng.' })
  @ArrayMinSize(1, { message: 'Phải có ít nhất 1 suất chiếu.' })
  @ValidateNested({ each: true })
  @Type(() => ShowtimeItemDto)
  showtimes!: ShowtimeItemDto[];
}

````
