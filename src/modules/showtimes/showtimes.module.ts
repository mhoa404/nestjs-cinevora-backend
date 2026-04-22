import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { ShowtimesController } from './showtimes.controller';
import { ShowtimesService } from './showtimes.service';
import { Showtime } from './entities/showtime.entity';
import { Movie } from '../movies/entities/movie.entity';
import { Room } from '../rooms/entities/room.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Showtime, Movie, Room])],
  providers: [ShowtimesService],
  controllers: [ShowtimesController],
  exports: [TypeOrmModule, ShowtimesService],
})
export class ShowtimesModule {}
