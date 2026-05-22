import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SeatType } from '../../../common/constants/seat-type.constant';

export class CreateSeatItemDto {
  @MaxLength(10, { message: 'rowLabel không được vượt quá 10 ký tự' })
  @IsString({ message: 'rowLabel phải là chuỗi' })
  @IsNotEmpty({ message: 'rowLabel không được để trống' })
  rowLabel!: string;

  @Type(() => Number)
  @Min(1, { message: 'seatNumber phải lớn hơn hoặc bằng 1' })
  @IsInt({ message: 'seatNumber phải là số nguyên' })
  @IsNotEmpty({ message: 'seatNumber không được để trống' })
  seatNumber!: number;

  @IsEnum(SeatType, {
    message: `seatType phải là một trong: ${Object.values(SeatType).join(', ')}`,
  })
  seatType!: SeatType;
}

export class CreateSeatsDto {
  @Type(() => Number)
  @IsInt({ message: 'roomId phải là số nguyên' })
  @Min(1, { message: 'roomId phải lớn hơn hoặc bằng 1' })
  roomId!: number;

  @IsArray({ message: 'seats phải là mảng' })
  @ArrayNotEmpty({ message: 'seats không được rỗng' })
  @ValidateNested({ each: true })
  @Type(() => CreateSeatItemDto)
  @IsDefined({ message: 'seats không được rỗng' })
  seats!: CreateSeatItemDto[];
}
