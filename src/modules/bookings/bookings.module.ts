import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';

@Module({
  providers: [BookingsService],
})
export class BookingsModule {}
