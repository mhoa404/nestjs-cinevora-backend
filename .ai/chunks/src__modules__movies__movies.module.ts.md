# FILE: src/modules/movies/movies.module.ts

path: src/modules/movies/movies.module.ts
module: movies
kind: module
language: ts
line_count: 15
size_bytes: 507
sha256: ef0367d7c6cddfc657aec3626e5538b17f09f6cd3814075ea862f617f8f71816
updated_at: 2026-04-08T04:56:34.037Z

## SYMBOLS
- MoviesModule

## CODE

````ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoviesService } from './movies.service';
import { MoviesController } from './movies.controller';
import { Movie } from './entities/movie.entity';
import { Genre } from '../genres/entities/genre.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Movie, Genre])],
  controllers: [MoviesController],
  providers: [MoviesService],
  exports: [MoviesService],
})
export class MoviesModule {}

````
