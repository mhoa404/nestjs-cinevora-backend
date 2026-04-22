# FILE: src/modules/rooms/rooms.module.ts

path: src/modules/rooms/rooms.module.ts
module: rooms
kind: module
language: ts
line_count: 15
size_bytes: 448
sha256: 5156443a68b4bb409644dbcfcce515bc2af8fad3530f01f653fea361dc858261
updated_at: 2026-04-02T08:59:54.817Z

## SYMBOLS
- RoomsModule

## CODE

````ts
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { Room } from './entities/room.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Room])],
  providers: [RoomsService],
  controllers: [RoomsController],
  exports: [TypeOrmModule, RoomsService],
})
export class RoomsModule {}

````
