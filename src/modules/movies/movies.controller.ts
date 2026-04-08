import {
<<<<<<< HEAD
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/constants/role.constant';
import { CreateMovieDto } from './dto/create-movie.dto';
import { MovieResponseDto } from './dto/movie-response.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { MoviesService } from './movies.service';

@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) { }
=======
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MoviesService } from './movies.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../shared/constants/role.constant';

@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}
>>>>>>> origin/main

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
<<<<<<< HEAD
  create(@Body() dto: CreateMovieDto): Promise<MovieResponseDto> {
    return this.moviesService.create(dto);
=======
  create(@Body() createMovieDto: CreateMovieDto) {
    return this.moviesService.create(createMovieDto);
>>>>>>> origin/main
  }

  @Public()
  @Get()
<<<<<<< HEAD
  findAll(): Promise<MovieResponseDto[]> {
=======
  findAll() {
>>>>>>> origin/main
    return this.moviesService.findAll();
  }

  @Public()
  @Get(':slugOrId')
<<<<<<< HEAD
  findOne(@Param('slugOrId') slugOrId: string): Promise<MovieResponseDto> {
    return this.moviesService.findOneBySlugOrId(slugOrId);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMovieDto,
  ): Promise<MovieResponseDto> {
    return this.moviesService.update(id, dto);
=======
  findOne(@Param('slugOrId') slugOrId: string) {
    return this.moviesService.findOneBySlugOrId(slugOrId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() updateMovieDto: UpdateMovieDto) {
    return this.moviesService.update(+id, updateMovieDto);
>>>>>>> origin/main
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
<<<<<<< HEAD
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.moviesService.remove(id);
=======
  remove(@Param('id') id: string) {
    return this.moviesService.remove(+id);
>>>>>>> origin/main
  }
}
