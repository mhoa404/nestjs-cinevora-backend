import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { CreateShowtimeDto, ShowtimeItemDto } from './dto/create-showtime.dto';
import { ShowtimeQueryDto } from './dto/showtime-query.dto';
import { ShowtimeResponseDto } from './dto/showtime-response.dto';
import { UpdateShowtimeDto } from './dto/update-showtime.dto';
import { Showtime, ShowtimeStatus } from './entities/showtime.entity';
import { Movie, MovieStatus } from '../movies/entities/movie.entity';
import { Room } from '../rooms/entities/room.entity';

const BUFFER_MINUTES = 30;

interface OrderedItem {
  item: ShowtimeItemDto;
  originalIndex: number;
}

interface TimeWindow {
  startTime: Date;
  endTime: Date;
}

interface AvailabilityParams extends TimeWindow {
  roomId: number;
  excludeId?: number;
}

@Injectable()
export class ShowtimesService {
  constructor(
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: ShowtimeQueryDto): Promise<ShowtimeResponseDto[]> {
    const qb = this.showtimeRepository
      .createQueryBuilder('showtime')
      .leftJoinAndSelect('showtime.movie', 'movie')
      .leftJoinAndSelect('showtime.room', 'room')
      .orderBy('showtime.start_time', 'ASC');

    if (query.movieId) {
      qb.andWhere('showtime.movie_id = :movieId', {
        movieId: query.movieId,
      });
    }

    if (query.roomId) {
      qb.andWhere('showtime.room_id = :roomId', {
        roomId: query.roomId,
      });
    }

    if (query.date) {
      const startOfDay = new Date(`${query.date}T00:00:00.000Z`);
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
    return this.dataSource.transaction(
      'SERIALIZABLE',
      async (manager): Promise<ShowtimeResponseDto[]> => {
        const movie = await this.findMovie(manager, dto.movieId);
        const orderedItems = this.orderCreateItems(dto.showtimes);

        this.assertCreateBatch(orderedItems, movie.duration);

        const createdShowtimes: Array<{
          originalIndex: number;
          showtime: Showtime;
        }> = [];

        for (const { item, originalIndex } of orderedItems) {
          const showtime = await this.createOne(
            manager,
            movie,
            dto.movieId,
            item,
          );

          createdShowtimes.push({
            originalIndex,
            showtime,
          });
        }

        return createdShowtimes
          .sort((current, next) => current.originalIndex - next.originalIndex)
          .map(({ showtime }) => ShowtimeResponseDto.fromEntity(showtime));
      },
    );
  }

  async update(
    id: number,
    dto: UpdateShowtimeDto,
  ): Promise<ShowtimeResponseDto> {
    return this.dataSource.transaction(
      'SERIALIZABLE',
      async (manager): Promise<ShowtimeResponseDto> => {
        const showtime = await this.findShowtime(manager, id);

        await this.applyUpdateSchedule(manager, showtime, dto);

        this.applyUpdateFields(showtime, dto);

        const savedShowtime = await manager.save(showtime);

        return ShowtimeResponseDto.fromEntity(savedShowtime);
      },
    );
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

  private async createOne(
    manager: EntityManager,
    movie: Movie,
    movieId: number,
    item: ShowtimeItemDto,
  ): Promise<Showtime> {
    const { startTime, endTime } = this.buildWindow(
      item.startTime,
      movie.duration,
    );

    this.assertFuture(startTime);
    this.assertInRange(movie, startTime);

    const room = await this.lockRoom(manager, item.roomId);

    await this.assertAvailable(manager, {
      roomId: item.roomId,
      startTime,
      endTime,
    });

    const showtime = manager.create(Showtime, {
      movieId,
      roomId: item.roomId,
      startTime,
      endTime,
      status: item.status ?? ShowtimeStatus.OPEN,
      priceStandard: item.priceStandard,
      priceVip: item.priceVip,
      priceCouple: item.priceCouple ?? null,
    });

    const savedShowtime = await manager.save(showtime);

    savedShowtime.movie = movie;
    savedShowtime.room = room;

    return savedShowtime;
  }

  private assertCreateBatch(items: OrderedItem[], duration: number): void {
    const windowsByRoom = new Map<number, TimeWindow[]>();

    for (const { item } of items) {
      const window = this.buildWindow(item.startTime, duration);
      const windows = windowsByRoom.get(item.roomId) ?? [];

      windows.push(window);
      windowsByRoom.set(item.roomId, windows);
    }

    for (const [roomId, windows] of windowsByRoom.entries()) {
      const orderedWindows = windows.sort(
        (current, next) =>
          current.startTime.getTime() - next.startTime.getTime(),
      );

      for (let index = 1; index < orderedWindows.length; index += 1) {
        const previous = orderedWindows[index - 1];
        const current = orderedWindows[index];
        const previousEndWithBuffer = this.addMinutes(
          previous.endTime,
          BUFFER_MINUTES,
        );

        if (current.startTime < previousEndWithBuffer) {
          throw new ConflictException(
            `Danh sách suất chiếu bị trùng phòng #${roomId} tại ${current.startTime.toISOString()}.`,
          );
        }
      }
    }
  }

  private orderCreateItems(showtimeItems: ShowtimeItemDto[]): OrderedItem[] {
    return showtimeItems
      .map((item, originalIndex) => ({
        item,
        originalIndex,
      }))
      .sort((current, next) => {
        const roomCompare = current.item.roomId - next.item.roomId;

        if (roomCompare !== 0) {
          return roomCompare;
        }

        const currentStartTime = this.parseUtc(
          current.item.startTime,
        ).getTime();
        const nextStartTime = this.parseUtc(next.item.startTime).getTime();

        if (currentStartTime !== nextStartTime) {
          return currentStartTime - nextStartTime;
        }

        return current.originalIndex - next.originalIndex;
      });
  }

  private async applyUpdateSchedule(
    manager: EntityManager,
    showtime: Showtime,
    dto: UpdateShowtimeDto,
  ): Promise<void> {
    const hasScheduleChange =
      dto.startTime !== undefined || dto.roomId !== undefined;

    if (!hasScheduleChange) {
      return;
    }

    const roomId = dto.roomId ?? showtime.roomId;
    const { startTime, endTime } = this.resolveUpdateWindow(showtime, dto);

    const room = await this.lockRoom(manager, roomId);

    this.assertFuture(startTime);
    this.assertInRange(showtime.movie, startTime);

    await this.assertAvailable(manager, {
      roomId,
      startTime,
      endTime,
      excludeId: showtime.id,
    });

    showtime.room = room;
    showtime.roomId = roomId;
    showtime.startTime = startTime;
    showtime.endTime = endTime;
  }

  private resolveUpdateWindow(
    showtime: Showtime,
    dto: UpdateShowtimeDto,
  ): TimeWindow {
    if (dto.startTime === undefined) {
      return {
        startTime: showtime.startTime,
        endTime: showtime.endTime,
      };
    }

    return this.buildWindow(dto.startTime, showtime.movie.duration);
  }

  private applyUpdateFields(showtime: Showtime, dto: UpdateShowtimeDto): void {
    if (dto.priceStandard !== undefined) {
      showtime.priceStandard = dto.priceStandard;
    }

    if (dto.priceVip !== undefined) {
      showtime.priceVip = dto.priceVip;
    }

    if (dto.priceCouple !== undefined) {
      showtime.priceCouple = dto.priceCouple;
    }

    if (dto.status !== undefined) {
      showtime.status = dto.status;
    }
  }

  private async findMovie(
    manager: EntityManager,
    movieId: number,
  ): Promise<Movie> {
    const movie = await manager.findOne(Movie, {
      where: { id: movieId },
    });

    if (!movie) {
      throw new NotFoundException(`Phim #${movieId} không tồn tại.`);
    }

    if (movie.status === MovieStatus.ENDED) {
      throw new ConflictException(
        'Không thể tạo suất chiếu cho phim đã kết thúc.',
      );
    }

    return movie;
  }

  private async findShowtime(
    manager: EntityManager,
    id: number,
  ): Promise<Showtime> {
    const showtime = await manager.findOne(Showtime, {
      where: { id },
      relations: ['movie', 'room'],
      lock: { mode: 'pessimistic_write' },
    });

    if (!showtime) {
      throw new NotFoundException(`Suất chiếu #${id} không tồn tại.`);
    }

    return showtime;
  }

  private async lockRoom(
    manager: EntityManager,
    roomId: number,
  ): Promise<Room> {
    const room = await manager.findOne(Room, {
      where: { id: roomId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!room) {
      throw new NotFoundException(`Phòng chiếu #${roomId} không tồn tại.`);
    }

    return room;
  }

  private async assertAvailable(
    manager: EntityManager,
    params: AvailabilityParams,
  ): Promise<void> {
    const occupiedStart = this.addMinutes(params.startTime, -BUFFER_MINUTES);
    const occupiedEnd = this.addMinutes(params.endTime, BUFFER_MINUTES);

    const qb = manager
      .createQueryBuilder(Showtime, 'showtime')
      .select(['showtime.id'])
      .where('showtime.room_id = :roomId', { roomId: params.roomId })
      .andWhere('showtime.start_time < :occupiedEnd', { occupiedEnd })
      .andWhere('showtime.end_time > :occupiedStart', { occupiedStart })
      .setLock('pessimistic_write')
      .limit(1);

    if (params.excludeId !== undefined) {
      qb.andWhere('showtime.id != :excludeId', {
        excludeId: params.excludeId,
      });
    }

    const overlapShowtime = await qb.getOne();

    if (overlapShowtime) {
      throw new ConflictException(
        `Phòng #${params.roomId} bị trùng lịch chiếu lúc ${params.startTime.toISOString()}`,
      );
    }
  }

  private buildWindow(startTimeValue: string, duration: number): TimeWindow {
    const startTime = this.parseUtc(startTimeValue);
    const endTime = this.addMinutes(startTime, duration);

    return {
      startTime,
      endTime,
    };
  }

  private parseUtc(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Thời gian suất chiếu không hợp lệ.');
    }

    if (date.toISOString() !== value) {
      throw new BadRequestException(
        'Thời gian phải dùng UTC format, ví dụ: 2026-04-25T09:34:00.000Z.',
      );
    }

    return date;
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  private assertFuture(startTime: Date): void {
    if (startTime.getTime() <= Date.now()) {
      throw new ConflictException(
        `Không thể tạo hoặc cập nhật suất chiếu trong quá khứ: ${startTime.toISOString()}`,
      );
    }
  }

  private assertInRange(movie: Movie, startTime: Date): void {
    const releaseDate = new Date(movie.releaseDate);

    releaseDate.setUTCHours(0, 0, 0, 0);

    if (startTime < releaseDate) {
      throw new ConflictException(
        'Không thể tạo hoặc cập nhật suất chiếu trước ngày khởi chiếu của phim.',
      );
    }

    if (movie.endDate) {
      const endDate = new Date(movie.endDate);

      endDate.setUTCHours(23, 59, 59, 999);

      if (startTime > endDate) {
        throw new ConflictException(
          'Không thể tạo hoặc cập nhật suất chiếu sau ngày kết thúc chiếu của phim.',
        );
      }
    }
  }
}
