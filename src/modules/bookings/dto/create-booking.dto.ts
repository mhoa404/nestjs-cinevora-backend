import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsPositive,
} from 'class-validator';

export class CreateBookingDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  showtimeId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  seatIds!: number[];
}
