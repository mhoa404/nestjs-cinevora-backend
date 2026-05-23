import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { RequestWithUser } from '../../common/types/request-user.type';
import { CheckMomoTransactionStatusDto } from './dto/check-momo-transaction-status.dto';
import { CreateMomoPaymentDto } from './dto/create-payment.dto';
import { MomoCallbackDto } from './dto/payment-callback.dto';
import { PaymentsService } from './payments.service';

@Controller('payments/momo')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  createMomoPayment(
    @Body() dto: CreateMomoPaymentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.paymentsService.createMomoPayment(dto, req.user);
  }

  @Public()
  @Post('callback')
  @HttpCode(HttpStatus.NO_CONTENT)
  async handleMomoCallback(@Body() dto: MomoCallbackDto): Promise<void> {
    await this.paymentsService.handleMomoCallback(dto);
  }

  @Post('check-status')
  @HttpCode(HttpStatus.OK)
  checkMomoTransactionStatus(
    @Body() dto: CheckMomoTransactionStatusDto,
    @Req() req: RequestWithUser,
  ) {
    return this.paymentsService.checkMomoTransactionStatus(dto, req.user);
  }
}
