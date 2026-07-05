import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/constants/role.constant';
import { SeatsService } from './seats.service';
import { CreateSeatsDto } from './dto/create-seats.dto';
import { GenerateSeatsDto } from './dto/generate-seats.dto';
import { SeatResponseDto } from './dto/seat-response.dto';

@Controller('seats')
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll(
    @Query('roomId', ParseIntPipe) roomId: number,
  ): Promise<SeatResponseDto[]> {
    return this.seatsService.findAll(roomId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSeatsDto): Promise<SeatResponseDto[]> {
    return this.seatsService.create(dto);
  }

  @Post('generate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  generateSeats(@Body() dto: GenerateSeatsDto): Promise<SeatResponseDto[]> {
    return this.seatsService.generateSeats(dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.seatsService.remove(id);
  }
}
