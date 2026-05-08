import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { ShowtimesController } from './showtimes.controller';
import { ShowtimesService } from './showtimes.service';
import { Showtime } from './entities/showtime.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Showtime])],
  providers: [ShowtimesService],
  controllers: [ShowtimesController],
  exports: [TypeOrmModule, ShowtimesService],
})
export class ShowtimesModule {}
