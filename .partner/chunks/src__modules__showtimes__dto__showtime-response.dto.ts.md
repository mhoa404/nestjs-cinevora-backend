# FILE: src/modules/showtimes/dto/showtime-response.dto.ts

path: src/modules/showtimes/dto/showtime-response.dto.ts
module: showtimes
kind: dto
language: ts
line_count: 40
size_bytes: 1122
sha256: 24fe6f69425bbacb46144453b2d1707a1fac4dc604ecbe023a5f96137211603f
updated_at: 2026-04-22T14:34:51.349Z

## SYMBOLS
- ShowtimeResponseDto

## CODE

````ts
import { Showtime } from '../entities/showtime.entity';

export class ShowtimeResponseDto {
  id!: number;
  movieId!: number;
  movieTitle!: string;
  roomId!: number;
  roomName!: string;
  startTime!: Date;
  endTime!: Date;
  priceStandard!: number;
  priceVip!: number;
  pricePremium!: number | null;
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
    dto.priceStandard = Number(entity.priceStandard);
    dto.priceVip = Number(entity.priceVip);
    dto.pricePremium =
      entity.pricePremium != null ? Number(entity.pricePremium) : null;
    dto.priceCouple =
      entity.priceCouple != null ? Number(entity.priceCouple) : null;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;

    return dto;
  }
}

````
