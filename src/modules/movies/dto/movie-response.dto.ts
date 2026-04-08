import { GenreResponseDto } from '../../genres/dto/genre-response.dto';
import { Movie, MovieStatus, AgeRating } from '../entities/movie.entity';

export class MovieResponseDto {
  id!: number;
  title!: string;
  slug!: string | null;
  posterUrl!: string;
  trailerUrl!: string | null;
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
