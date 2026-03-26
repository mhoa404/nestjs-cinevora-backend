import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { SeatsController } from './seats.controller';
import { SeatsService } from './seats.service';
import { Seat } from './entities/seat.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Seat])],
  providers: [SeatsService],
  controllers: [SeatsController],
  exports: [TypeOrmModule, SeatsService],
})
export class SeatsModule {}
