import { SeatType } from '../../../common/constants/seat-type.constant';
import { Seat } from '../entities/seat.entity';

export class SeatResponseDto {
  id!: number;
  roomId!: number;
  seatKey!: string;
  rowLabel!: string;
  seatNumber!: number;
  seatType!: SeatType;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(entity: Seat): SeatResponseDto {
    const dto = new SeatResponseDto();
    dto.id = entity.id;
    dto.roomId = entity.roomId;
    dto.seatKey = entity.seatKey;
    dto.rowLabel = entity.rowLabel;
    dto.seatNumber = entity.seatNumber;
    dto.seatType = entity.seatType;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
