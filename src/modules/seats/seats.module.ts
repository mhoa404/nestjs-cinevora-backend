import { Module } from '@nestjs/common';
import { SeatsService } from './seats.service';

@Module({
  providers: [SeatsService],
})
export class SeatsModule {}
