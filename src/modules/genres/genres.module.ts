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
