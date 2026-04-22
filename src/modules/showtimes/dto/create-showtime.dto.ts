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
