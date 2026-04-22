# FILE: src/modules/showtimes/dto/showtime-query.dto.ts

path: src/modules/showtimes/dto/showtime-query.dto.ts
module: showtimes
kind: dto
language: ts
line_count: 19
size_bytes: 489
sha256: 57cde02687a98d9ac710c226481973e96aa9f9e8f5b80b5a8aeb31941fdfc3a7
updated_at: 2026-04-22T13:29:53.877Z

## SYMBOLS
- ShowtimeQueryDto

## CODE

````ts
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class ShowtimeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'movieId phải là số nguyên.' })
  movieId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'roomId phải là số nguyên.' })
  roomId?: number;

  @IsOptional()
  @IsDateString({}, { message: 'date phải theo định dạng YYYY-MM-DD.' })
  date?: string;
}

````
