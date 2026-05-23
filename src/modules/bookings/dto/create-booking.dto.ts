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
  @IsPositive()
  @IsInt()
  showtimeId!: number;

  @Type(() => Number)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsPositive({ each: true })
  @IsInt({ each: true })
  seatIds!: number[];
}
