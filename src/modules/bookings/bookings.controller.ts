import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { RolesGuard } from '../../common/guards/roles.guard';
import { RequestWithUser } from '../../common/types/request-user.type';
import { BookingsService } from './bookings.service';
import { BookingResponseDto } from './dto/booking-response.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('bookings')
@UseGuards(RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createBooking(
    @Body() dto: CreateBookingDto,
    @Req() req: RequestWithUser,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.createBooking(dto, req.user.id);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelBooking(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string }> {
    return this.bookingsService.cancelBooking(id, req.user.id, req.user.role);
  }
}
