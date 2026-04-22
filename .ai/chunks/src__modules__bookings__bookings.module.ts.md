# FILE: src/modules/bookings/bookings.module.ts

path: src/modules/bookings/bookings.module.ts
module: bookings
kind: module
language: ts
line_count: 16
size_bytes: 557
sha256: 2b6635b078033c6e3cfb02f34fa15a13bc1d868e4bd0886ad90bf7b8e201f0a0
updated_at: 2026-04-02T08:59:54.793Z

## SYMBOLS
- BookingsModule

## CODE

````ts
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { BookingSeat } from './entities/booking-seat.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, BookingSeat])],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [TypeOrmModule, BookingsService],
})
export class BookingsModule {}

````
