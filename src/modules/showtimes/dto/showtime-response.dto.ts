import { Showtime, ShowtimeStatus } from '../entities/showtime.entity';

export class ShowtimeResponseDto {
  id!: number;
  movieId!: number;
  movieTitle!: string;
  roomId!: number;
  roomName!: string;
  startTime!: Date;
  endTime!: Date;
  status!: ShowtimeStatus;
  priceStandard!: number;
  priceVip!: number;
  priceCouple!: number | null;
  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(entity: Showtime): ShowtimeResponseDto {
    const dto = new ShowtimeResponseDto();

    dto.id = entity.id;
    dto.movieId = entity.movieId;
    dto.movieTitle = entity.movie?.title ?? '';
    dto.roomId = entity.roomId;
    dto.roomName = entity.room?.name ?? '';
    dto.startTime = entity.startTime;
    dto.endTime = entity.endTime;
    dto.status = entity.status;
    dto.priceStandard = Number(entity.priceStandard);
    dto.priceVip = Number(entity.priceVip);
    dto.priceCouple =
      entity.priceCouple != null ? Number(entity.priceCouple) : null;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;

    return dto;
  }
}
