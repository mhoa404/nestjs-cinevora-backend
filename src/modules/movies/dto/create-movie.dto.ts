import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { AgeRating, MovieStatus } from '../entities/movie.entity';

export class CreateMovieDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsUrl()
  @IsNotEmpty()
  posterUrl!: string;

  @IsUrl()
  @IsOptional()
  trailerUrl?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsNotEmpty()
  duration!: number;

  @IsString()
  @IsOptional()
  director?: string;

  @IsString()
  @IsOptional()
  actor?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsEnum(AgeRating)
  @IsNotEmpty()
  ageRating!: AgeRating;

  @IsString()
  @IsOptional()
  rated?: string;

  @IsEnum(MovieStatus)
  @IsOptional()
  status?: MovieStatus;

  @IsDateString()
  @IsNotEmpty()
  releaseDate!: Date;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  genreIds?: number[];
}
