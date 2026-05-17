import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SeatType } from '../../../common/constants/seat-type.constant';

export class GenerateSeatRowDto {
  @IsString({ message: 'rowLabel phải là chuỗi' })
  @IsNotEmpty({ message: 'rowLabel không được để trống' })
  @MaxLength(10, { message: 'rowLabel không được vượt quá 10 ký tự' })
  rowLabel!: string;

  @Type(() => Number)
  @IsInt({ message: 'count phải là số nguyên' })
  @Min(1, { message: 'count phải lớn hơn hoặc bằng 1' })
  @Max(100, { message: 'count không được vượt quá 100 ghế mỗi hàng' })
  count!: number;

  @IsEnum(SeatType, {
    message: `seatType phải là một trong: ${Object.values(SeatType).join(', ')}`,
  })
  seatType!: SeatType;
}

export class GenerateSeatsDto {
  @Type(() => Number)
  @IsInt({ message: 'roomId phải là số nguyên' })
  @Min(1, { message: 'roomId phải lớn hơn hoặc bằng 1' })
  roomId!: number;

  @IsArray({ message: 'rows phải là mảng' })
  @ArrayNotEmpty({ message: 'rows không được rỗng' })
  @ValidateNested({ each: true })
  @Type(() => GenerateSeatRowDto)
  rows!: GenerateSeatRowDto[];
}
