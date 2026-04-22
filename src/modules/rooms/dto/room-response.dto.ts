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
