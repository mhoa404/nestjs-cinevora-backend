# FILE: src/modules/seats/seats.module.ts

path: src/modules/seats/seats.module.ts
module: seats
kind: module
language: ts
line_count: 15
size_bytes: 448
sha256: b88383d8924892ee8ec7380141f172cc3b8d6aae8aa46a9cdd5cba1ab8d5f20b
updated_at: 2026-04-02T08:59:54.818Z

## SYMBOLS
- SeatsModule

## CODE

````ts
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

````
