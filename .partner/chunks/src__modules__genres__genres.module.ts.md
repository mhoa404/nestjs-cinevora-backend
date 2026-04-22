# FILE: src/modules/genres/genres.module.ts

path: src/modules/genres/genres.module.ts
module: genres
kind: module
language: ts
line_count: 15
size_bytes: 459
sha256: 83dd16d35a3eeeb99a365b62ea427e0c58ff4a6b1cad1039b1b061e72b26c123
updated_at: 2026-04-08T04:56:34.037Z

## SYMBOLS
- GenresModule

## CODE

````ts
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { GenresController } from './genres.controller';
import { GenresService } from './genres.service';
import { Genre } from './entities/genre.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Genre])],
  controllers: [GenresController],
  providers: [GenresService],
  exports: [TypeOrmModule, GenresService],
})
export class GenresModule {}

````
