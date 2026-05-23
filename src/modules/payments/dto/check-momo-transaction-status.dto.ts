import { IsNotEmpty, IsString } from 'class-validator';

export class CheckMomoTransactionStatusDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;
}
