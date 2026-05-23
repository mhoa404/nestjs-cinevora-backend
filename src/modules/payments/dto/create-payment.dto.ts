import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class CreateMomoPaymentDto {
  @Type(() => Number)
  @IsPositive()
  @IsInt()
  bookingId!: number;
}
