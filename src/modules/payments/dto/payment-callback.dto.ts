import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class MomoCallbackDto {
  @IsString()
  @IsNotEmpty()
  partnerCode!: string;

  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  requestId!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  orderInfo!: string;

  @IsString()
  @IsNotEmpty()
  orderType!: string;

  @Type(() => Number)
  @IsInt()
  transId!: number;

  @Type(() => Number)
  @IsInt()
  resultCode!: number;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsString()
  @IsNotEmpty()
  payType!: string;

  @Type(() => Number)
  @IsInt()
  responseTime!: number;

  @IsOptional()
  @IsString()
  extraData?: string;

  @IsString()
  @IsNotEmpty()
  signature!: string;
}
