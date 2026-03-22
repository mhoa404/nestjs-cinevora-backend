import { Module } from '@nestjs/common';
import { ShowtimesService } from './showtimes.service';
import { ShowtimesController } from './showtimes.controller';

@Module({
  providers: [ShowtimesService],
  controllers: [ShowtimesController],
})
export class ShowtimesModule {}
