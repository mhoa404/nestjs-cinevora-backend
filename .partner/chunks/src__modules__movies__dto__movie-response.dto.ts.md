# FILE: src/modules/movies/dto/movie-response.dto.ts

path: src/modules/movies/dto/movie-response.dto.ts
module: movies
kind: dto
language: ts
line_count: 53
size_bytes: 1536
sha256: 6219d000b98b68e46dcdf704c971820729e355317bd63a8ea45d286dda5f51f1
updated_at: 2026-04-15T13:33:05.774Z

## SYMBOLS
- MovieResponseDto

## CODE

````ts
import { GenreResponseDto } from '../../genres/dto/genre-response.dto';
import { Movie, MovieStatus, AgeRating } from '../entities/movie.entity';

export class MovieResponseDto {
  id!: number;
  title!: string;
  slug!: string | null;
  posterUrl!: string;
  trailerUrl!: string | null;
  bannerUrl!: string | null;
  description!: string | null;
  duration!: number;
  director!: string | null;
  actor!: string | null;
  language!: string | null;
  ageRating!: AgeRating;
  rated!: string | null;
  status!: MovieStatus;
  releaseDate!: Date;
  endDate!: Date | null;
  avgRating!: number | null;
  createdAt!: Date;
  genres!: GenreResponseDto[];

  static fromEntity(movie: Movie): MovieResponseDto {
    const dto = new MovieResponseDto();

    dto.id = movie.id;
    dto.title = movie.title;
    dto.slug = movie.slug;
    dto.posterUrl = movie.posterUrl;
    dto.trailerUrl = movie.trailerUrl;
    dto.bannerUrl = movie.bannerUrl;
    dto.description = movie.description;
    dto.duration = movie.duration;
    dto.director = movie.director;
    dto.actor = movie.actor;
    dto.language = movie.language;
    dto.ageRating = movie.ageRating;
    dto.rated = movie.rated;
    dto.status = movie.status;
    dto.releaseDate = movie.releaseDate;
    dto.endDate = movie.endDate;
    dto.avgRating = movie.avgRating;
    dto.createdAt = movie.createdAt;
    dto.genres = (movie.genres ?? []).map((genre) =>
      GenreResponseDto.fromEntity(genre),
    );

    return dto;
  }
}

````
