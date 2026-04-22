# FILE: src/modules/genres/dto/genre-response.dto.ts

path: src/modules/genres/dto/genre-response.dto.ts
module: genres
kind: dto
language: ts
line_count: 18
size_bytes: 400
sha256: 151274a1e32c01e39e906e58d84aed4641ecaa934ddb9c47d8c8ad13945ed555
updated_at: 2026-04-08T04:56:34.037Z

## SYMBOLS
- GenreResponseDto

## CODE

````ts
import { Genre } from '../entities/genre.entity';

export class GenreResponseDto {
  id!: number;
  name!: string;
  slug!: string;
  createdAt!: Date;

  static fromEntity(genre: Genre): GenreResponseDto {
    const dto = new GenreResponseDto();
    dto.id = genre.id;
    dto.name = genre.name;
    dto.slug = genre.slug;
    dto.createdAt = genre.createdAt;
    return dto;
  }
}

````
