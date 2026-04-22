# FILE: src/modules/rooms/dto/room-response.dto.ts

path: src/modules/rooms/dto/room-response.dto.ts
module: rooms
kind: dto
language: ts
line_count: 20
size_bytes: 489
sha256: aa4db01061f221aa867bb0f1ac13636757cd6aadafcd8a217d5f920c9345c463
updated_at: 2026-04-21T15:43:06.409Z

## SYMBOLS
- RoomResponseDto

## CODE

````ts
import { Room } from '../entities/room.entity';

export class RoomResponseDto {
  id!: number;
  name!: string;
  totalSeats!: number;
  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(entity: Room & { totalSeats?: number }): RoomResponseDto {
    const dto = new RoomResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.totalSeats = entity.totalSeats || 0;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

````
