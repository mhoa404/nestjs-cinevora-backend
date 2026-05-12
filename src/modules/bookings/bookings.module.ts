// src/modules/bookings/bookings.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Seat } from '../seats/entities/seat.entity';
import { Showtime } from '../showtimes/entities/showtime.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { ShowtimeSeatsController } from './controllers/showtime-seats.controller';
import { BookingSeat } from './entities/booking-seat.entity';
import { Booking } from './entities/booking.entity';
import { SeatHoldService } from './services/seat-hold.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, BookingSeat, Showtime, Seat])],
  controllers: [BookingsController, ShowtimeSeatsController],
  providers: [BookingsService, SeatHoldService],
  exports: [BookingsService],
})
export class BookingsModule {}
