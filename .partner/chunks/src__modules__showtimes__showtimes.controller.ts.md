# FILE: src/modules/showtimes/showtimes.controller.ts

path: src/modules/showtimes/showtimes.controller.ts
module: showtimes
kind: controller
language: ts
line_count: 66
size_bytes: 1872
sha256: b687945a82c52e79f6ca0b0f0d91652dc4e2368551e192f95264860dba2e1887
updated_at: 2026-04-22T13:41:58.564Z

## SYMBOLS
- ShowtimesController

## CODE

````ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/constants/role.constant';
import { ShowtimesService } from './showtimes.service';
import { CreateShowtimeDto } from './dto/create-showtime.dto';
import { UpdateShowtimeDto } from './dto/update-showtime.dto';
import { ShowtimeQueryDto } from './dto/showtime-query.dto';
import { ShowtimeResponseDto } from './dto/showtime-response.dto';

@Controller('showtimes')
@UseGuards(RolesGuard)
export class ShowtimesController {
  constructor(private readonly showtimesService: ShowtimesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateShowtimeDto): Promise<ShowtimeResponseDto[]> {
    return this.showtimesService.create(dto);
  }

  @Get()
  @Public()
  findAll(@Query() query: ShowtimeQueryDto): Promise<ShowtimeResponseDto[]> {
    return this.showtimesService.findAll(query);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ShowtimeResponseDto> {
    return this.showtimesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShowtimeDto,
  ): Promise<ShowtimeResponseDto> {
    return this.showtimesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.showtimesService.remove(id);
  }
}

````
