# FILE: src/modules/showtimes/showtimes.service.ts

path: src/modules/showtimes/showtimes.service.ts
module: showtimes
kind: service
language: ts
line_count: 287
size_bytes: 8728
sha256: a5e3456ad4eed0ca4ea0ef6eaffdef85a0541569837af2e93b859b04977170a8
updated_at: 2026-04-22T16:11:35.684Z

## SYMBOLS
- ShowtimesService

## CODE

````ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Showtime } from './entities/showtime.entity';
import { Movie, MovieStatus } from '../movies/entities/movie.entity';
import { Room } from '../rooms/entities/room.entity';
import { CreateShowtimeDto } from './dto/create-showtime.dto';
import { UpdateShowtimeDto } from './dto/update-showtime.dto';
import { ShowtimeQueryDto } from './dto/showtime-query.dto';
import { ShowtimeResponseDto } from './dto/showtime-response.dto';

@Injectable()
export class ShowtimesService {
  constructor(
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: ShowtimeQueryDto): Promise<ShowtimeResponseDto[]> {
    const qb = this.showtimeRepository
      .createQueryBuilder('showtime')
      .leftJoinAndSelect('showtime.movie', 'movie')
      .leftJoinAndSelect('showtime.room', 'room')
      .orderBy('showtime.startTime', 'ASC');

    if (query.movieId) {
      qb.andWhere('showtime.movie_id = :movieId', { movieId: query.movieId });
    }

    if (query.roomId) {
      qb.andWhere('showtime.room_id = :roomId', { roomId: query.roomId });
    }

    if (query.date) {
      const startOfDay = new Date(`${query.date}T00:00:00Z`);
      const endOfDay = new Date(`${query.date}T23:59:59.999Z`);

      qb.andWhere('showtime.start_time >= :startOfDay', {
        startOfDay,
      }).andWhere('showtime.start_time <= :endOfDay', {
        endOfDay,
      });
    }

    const showtimes = await qb.getMany();
    return showtimes.map((showtime) =>
      ShowtimeResponseDto.fromEntity(showtime),
    );
  }

  async findOne(id: number): Promise<ShowtimeResponseDto> {
    const showtime = await this.showtimeRepository.findOne({
      where: { id },
      relations: ['movie', 'room'],
    });

    if (!showtime) {
      throw new NotFoundException(`Suất chiếu #${id} không tồn tại.`);
    }

    return ShowtimeResponseDto.fromEntity(showtime);
  }

  async create(dto: CreateShowtimeDto): Promise<ShowtimeResponseDto[]> {
    const movie = await this.movieRepository.findOne({
      where: { id: dto.movieId },
    });

    if (!movie) {
      throw new NotFoundException(`Phim #${dto.movieId} không tồn tại.`);
    }

    const createdShowtimes: Showtime[] = [];
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      for (const item of dto.showtimes) {
        const room = await queryRunner.manager.findOne(Room, {
          where: { id: item.roomId },
        });

        if (!room) {
          throw new NotFoundException(
            `Phòng chiếu #${item.roomId} không tồn tại.`,
          );
        }

        const startTime = new Date(item.startTime);
        const endTime = this.calculateEndTime(startTime, movie.duration);

        const occupiedStart = startTime;
        const occupiedEnd = new Date(endTime.getTime());
        occupiedEnd.setMinutes(occupiedEnd.getMinutes() + 30);

        const overlapCount = await queryRunner.manager
          .createQueryBuilder(Showtime, 'showtime')
          .where('showtime.room_id = :roomId', { roomId: item.roomId })
          .andWhere('showtime.start_time < :occupiedEnd', { occupiedEnd })
          .andWhere(
            'DATE_ADD(showtime.end_time, INTERVAL 30 MINUTE) > :occupiedStart',
            { occupiedStart },
          )
          .setLock('pessimistic_write')
          .getCount();

        if (overlapCount > 0) {
          throw new ConflictException(
            `Phòng #${item.roomId} bị trùng lịch chiếu lúc ${item.startTime}`,
          );
        }

        const showtime = queryRunner.manager.create(Showtime, {
          movieId: dto.movieId,
          roomId: item.roomId,
          startTime,
          endTime,
          priceStandard: item.priceStandard,
          priceVip: item.priceVip,
          pricePremium: item.pricePremium ?? null,
          priceCouple: item.priceCouple ?? null,
        });

        const saved = await queryRunner.manager.save(showtime);

        saved.movie = movie;
        saved.room = room;
        createdShowtimes.push(saved);
      }

      await queryRunner.commitTransaction();

      return createdShowtimes.map((showtime) =>
        ShowtimeResponseDto.fromEntity(showtime),
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(
    id: number,
    dto: UpdateShowtimeDto,
  ): Promise<ShowtimeResponseDto> {
    const showtime = await this.showtimeRepository.findOne({
      where: { id },
      relations: ['movie', 'room'],
    });

    if (!showtime) {
      throw new NotFoundException(`Suất chiếu #${id} không tồn tại.`);
    }

    const roomId = dto.roomId ?? showtime.roomId;
    let startTime = showtime.startTime;
    let endTime = showtime.endTime;

    if (dto.startTime) {
      startTime = new Date(dto.startTime);
      endTime = this.calculateEndTime(startTime, showtime.movie.duration);
    }

    if (dto.startTime || dto.roomId) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction('SERIALIZABLE');

      try {
        if (dto.roomId) {
          const room = await queryRunner.manager.findOne(Room, {
            where: { id: dto.roomId },
          });

          if (!room) {
            throw new NotFoundException(
              `Phòng chiếu #${dto.roomId} không tồn tại.`,
            );
          }

          showtime.room = room;
        }

        const occupiedStart = startTime;
        const occupiedEnd = new Date(endTime.getTime());
        occupiedEnd.setMinutes(occupiedEnd.getMinutes() + 30);

        const overlapCount = await queryRunner.manager
          .createQueryBuilder(Showtime, 'showtime')
          .where('showtime.room_id = :roomId', { roomId })
          .andWhere('showtime.id != :id', { id })
          .andWhere('showtime.start_time < :occupiedEnd', { occupiedEnd })
          .andWhere(
            'DATE_ADD(showtime.end_time, INTERVAL 30 MINUTE) > :occupiedStart',
            { occupiedStart },
          )
          .setLock('pessimistic_write')
          .getCount();

        if (overlapCount > 0) {
          throw new ConflictException(
            `Phòng #${roomId} bị trùng lịch chiếu lúc ${startTime.toISOString()}`,
          );
        }

        showtime.roomId = roomId;
        showtime.startTime = startTime;
        showtime.endTime = endTime;

        this.updatePrices(showtime, dto);

        const saved = await queryRunner.manager.save(showtime);
        await queryRunner.commitTransaction();

        return ShowtimeResponseDto.fromEntity(saved);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    }

    this.updatePrices(showtime, dto);

    const saved = await this.showtimeRepository.save(showtime);
    return ShowtimeResponseDto.fromEntity(saved);
  }

  async remove(id: number): Promise<void> {
    const showtime = await this.showtimeRepository.findOne({
      where: { id },
      relations: ['movie'],
    });

    if (!showtime) {
      throw new NotFoundException(`Suất chiếu #${id} không tồn tại.`);
    }

    if (showtime.movie.status !== MovieStatus.ENDED) {
      throw new ConflictException(
        'Chỉ có thể xoá suất chiếu khi phim đã kết thúc chiếu (ended).',
      );
    }

    await this.showtimeRepository.remove(showtime);
  }

  private calculateEndTime(startTime: Date, duration: number): Date {
    const endTime = new Date(startTime.getTime());
    endTime.setMinutes(endTime.getMinutes() + duration + 15);
    return endTime;
  }

  private updatePrices(showtime: Showtime, dto: UpdateShowtimeDto): void {
    if (dto.priceStandard !== undefined) {
      showtime.priceStandard = dto.priceStandard;
    }

    if (dto.priceVip !== undefined) {
      showtime.priceVip = dto.priceVip;
    }

    if (dto.pricePremium !== undefined) {
      showtime.pricePremium = dto.pricePremium;
    }

    if (dto.priceCouple !== undefined) {
      showtime.priceCouple = dto.priceCouple;
    }
  }
}

````
