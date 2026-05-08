import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';

import { ShowtimeStatus } from '../entities/showtime.entity';

const UTC_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export class UpdateShowtimeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'roomId phải là số nguyên.' })
  roomId?: number;

  @IsOptional()
  @Matches(UTC_DATE_REGEX, {
    message: 'startTime phải là ISO 8601 UTC, ví dụ: 2026-04-25T09:34:00.000Z.',
  })
  @IsDateString({}, { message: 'startTime phải là ISO 8601 UTC.' })
  startTime?: string;

  @IsOptional()
  @IsEnum(ShowtimeStatus, { message: 'status phải là open hoặc sold_out.' })
  status?: ShowtimeStatus;

  @IsOptional()
  @Type(() => Number)
  @Min(0, { message: 'Giá vé standard phải >= 0.' })
  @IsInt({ message: 'Giá vé standard phải là số nguyên.' })
  priceStandard?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0, { message: 'Giá vé VIP phải >= 0.' })
  @IsInt({ message: 'Giá vé VIP phải là số nguyên.' })
  priceVip?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0, { message: 'Giá vé couple phải >= 0.' })
  @IsInt({ message: 'Giá vé couple phải là số nguyên.' })
  priceCouple?: number;
}
