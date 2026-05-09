// src/modules/seats/seats.module.ts
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { SeatsController } from './seats.controller';
import { SeatsService } from './seats.service';
import { Seat } from './entities/seat.entity';
import { Room } from '../rooms/entities/room.entity';
import { BookingSeat } from '../bookings/entities/booking-seat.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Seat, Room, BookingSeat])],
  providers: [SeatsService],
  controllers: [SeatsController],
  exports: [TypeOrmModule, SeatsService],
})
export class SeatsModule {}
