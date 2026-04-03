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
