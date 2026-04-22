# FILE: src/modules/showtimes/showtimes.module.ts

path: src/modules/showtimes/showtimes.module.ts
module: showtimes
kind: module
language: ts
line_count: 17
size_bytes: 614
sha256: c227c8defccc468b78717abd3b2fefb2acf91c08bee9205669d6b6d0600cbb24
updated_at: 2026-04-22T14:33:51.771Z

## SYMBOLS
- ShowtimesModule

## CODE

````ts
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { ShowtimesController } from './showtimes.controller';
import { ShowtimesService } from './showtimes.service';
import { Showtime } from './entities/showtime.entity';
import { MoviesModule } from '../movies/movies.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [TypeOrmModule.forFeature([Showtime]), MoviesModule, RoomsModule],
  providers: [ShowtimesService],
  controllers: [ShowtimesController],
  exports: [TypeOrmModule, ShowtimesService],
})
export class ShowtimesModule {}

````
