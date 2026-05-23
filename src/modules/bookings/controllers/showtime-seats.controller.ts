import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';

import { BookingsService } from '../bookings.service';
import { SeatAvailabilityResponseDto } from '../dto/seat-availability-response.dto';

@Controller('showtimes')
export class ShowtimeSeatsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get(':id/seats')
  getShowtimeSeats(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SeatAvailabilityResponseDto[]> {
    return this.bookingsService.getShowtimeSeats(id);
  }
}
