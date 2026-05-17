import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

import { ShowtimeStatus } from '../entities/showtime.entity';

const UTC_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export class ShowtimeItemDto {
  @IsPositive()
  @Type(() => Number)
  @IsInt({ message: 'roomId phải là số nguyên.' })
  @IsNotEmpty({ message: 'Vui lòng chọn phòng chiếu.' })
  roomId!: number;

  @Matches(UTC_DATE_REGEX, {
    message: 'startTime phải là ISO 8601 UTC, ví dụ: 2026-04-25T09:34:00.000Z.',
  })
  @IsDateString({}, { message: 'startTime phải là ISO 8601 UTC.' })
  @IsNotEmpty({ message: 'Vui lòng nhập thời gian bắt đầu.' })
  startTime!: string;

  @IsOptional()
  @IsEnum(ShowtimeStatus, { message: 'status phải là open hoặc sold_out.' })
  status?: ShowtimeStatus;

  @Min(0, { message: 'Giá vé standard phải >= 0.' })
  @Type(() => Number)
  @IsInt({ message: 'Giá vé standard phải là số nguyên.' })
  @IsNotEmpty({ message: 'Vui lòng nhập giá vé standard.' })
  priceStandard!: number;

  @Min(0, { message: 'Giá vé VIP phải >= 0.' })
  @Type(() => Number)
  @IsInt({ message: 'Giá vé VIP phải là số nguyên.' })
  @IsNotEmpty({ message: 'Vui lòng nhập giá vé VIP.' })
  priceVip!: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0, { message: 'Giá vé couple phải >= 0.' })
  @IsInt({ message: 'Giá vé couple phải là số nguyên.' })
  priceCouple?: number;
}

export class CreateShowtimeDto {
  @Type(() => Number)
  @Type(() => Number)
  @IsInt({ message: 'movieId phải là số nguyên.' })
  @IsNotEmpty({ message: 'Vui lòng chọn phim.' })
  movieId!: number;

  @IsArray({ message: 'showtimes phải là một mảng.' })
  @ArrayMinSize(1, { message: 'Phải có ít nhất 1 suất chiếu.' })
  @ValidateNested({ each: true })
  @Type(() => ShowtimeItemDto)
  showtimes!: ShowtimeItemDto[];
}
