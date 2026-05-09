import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';

import { Room } from '../rooms/entities/room.entity';
import { BookingSeat } from '../bookings/entities/booking-seat.entity';
import { Seat } from './entities/seat.entity';
import { CreateSeatsDto } from './dto/create-seats.dto';
import { GenerateSeatsDto } from './dto/generate-seats.dto';
import { SeatResponseDto } from './dto/seat-response.dto';

@Injectable()
export class SeatsService {
  constructor(
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,

    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,

    @InjectRepository(BookingSeat)
    private readonly bookingSeatRepository: Repository<BookingSeat>,

    private readonly dataSource: DataSource,
  ) {}

  // findAll
  async findAll(roomId: number): Promise<SeatResponseDto[]> {
    await this.findRoomOrThrow(roomId);

    const seats = await this.seatRepository.find({
      where: { roomId },
      order: { rowLabel: 'ASC', seatNumber: 'ASC' },
    });

    return seats.map((seat) => SeatResponseDto.fromEntity(seat));
  }

  async create(dto: CreateSeatsDto): Promise<SeatResponseDto[]> {
    await this.findRoomOrThrow(dto.roomId);

    const normalizedSeats = dto.seats.map((item) => {
      const rowLabel = this.normalizeRowLabel(item.rowLabel);
      const seatKey = this.buildSeatKey(rowLabel, item.seatNumber);

      return {
        ...item,
        rowLabel,
        seatKey,
      };
    });

    // [RR-03 guard] kiểm tra trùng lặp seatKey trong chính mảng gửi lên
    const incomingKeys = normalizedSeats.map((seat) => seat.seatKey);
    const uniqueIncoming = new Set(incomingKeys);

    if (uniqueIncoming.size !== incomingKeys.length) {
      throw new ConflictException(
        'Danh sách ghế gửi lên có seatKey bị trùng lặp',
      );
    }

    const existing = await this.seatRepository
      .createQueryBuilder('seat')
      .where('seat.roomId = :roomId', { roomId: dto.roomId })
      .andWhere('seat.seatKey IN (:...keys)', { keys: incomingKeys })
      .getMany();

    if (existing.length > 0) {
      const conflictKeys = existing.map((seat) => seat.seatKey).join(', ');

      throw new ConflictException(
        `Các ghế sau đã tồn tại trong phòng: ${conflictKeys}`,
      );
    }

    const entities = normalizedSeats.map((item) =>
      this.seatRepository.create({
        roomId: dto.roomId,
        rowLabel: item.rowLabel,
        seatNumber: item.seatNumber,
        seatKey: item.seatKey,
        seatType: item.seatType,
      }),
    );

    try {
      const saved = await this.seatRepository.save(entities);
      return saved.map((seat) => SeatResponseDto.fromEntity(seat));
    } catch (err) {
      // [RR-02 guard] bắt duplicate key ở DB-level (race condition)
      if (
        err instanceof QueryFailedError &&
        (err as { code?: string }).code === 'ER_DUP_ENTRY'
      ) {
        throw new ConflictException(
          'Một hoặc nhiều ghế đã tồn tại trong phòng',
        );
      }

      throw err;
    }
  }

  async generateSeats(dto: GenerateSeatsDto): Promise<SeatResponseDto[]> {
    const normalizedRows = dto.rows.map((row) => ({
      ...row,
      rowLabel: this.normalizeRowLabel(row.rowLabel),
    }));

    // [RR-03 guard] kiểm tra rowLabel trùng trong mảng rows gửi lên
    const rowLabels = normalizedRows.map((row) => row.rowLabel);
    const uniqueLabels = new Set(rowLabels);

    if (uniqueLabels.size !== rowLabels.length) {
      throw new ConflictException(
        'Danh sách rows gửi lên có rowLabel bị trùng lặp',
      );
    }

    // [RR-01 guard] transaction SERIALIZABLE + pessimistic write lock
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      // lock row Room để chặn concurrent generate
      const room = await manager
        .getRepository(Room)
        .createQueryBuilder('room')
        .setLock('pessimistic_write')
        .where('room.id = :id', { id: dto.roomId })
        .getOne();

      if (!room) {
        throw new NotFoundException(`Phòng #${dto.roomId} không tồn tại.`);
      }

      const seatCount = await manager
        .getRepository(Seat)
        .count({ where: { roomId: dto.roomId } });

      if (seatCount > 0) {
        throw new ConflictException(
          'Phòng đã có ghế, không thể generate tự động',
        );
      }

      const entities: Seat[] = [];

      for (const row of normalizedRows) {
        for (let seatNumber = 1; seatNumber <= row.count; seatNumber++) {
          entities.push(
            manager.getRepository(Seat).create({
              roomId: dto.roomId,
              rowLabel: row.rowLabel,
              seatNumber,
              seatKey: this.buildSeatKey(row.rowLabel, seatNumber),
              seatType: row.seatType,
            }),
          );
        }
      }

      try {
        const saved = await manager.getRepository(Seat).save(entities);
        return saved.map((seat) => SeatResponseDto.fromEntity(seat));
      } catch (err) {
        // [RR-02 guard] bắt duplicate key ở DB-level (race condition)
        if (
          err instanceof QueryFailedError &&
          (err as { code?: string }).code === 'ER_DUP_ENTRY'
        ) {
          throw new ConflictException(
            'Một hoặc nhiều ghế đã tồn tại trong phòng',
          );
        }

        throw err;
      }
    });
  }

  async remove(id: number): Promise<void> {
    const seat = await this.seatRepository.findOne({ where: { id } });
    if (!seat) {
      throw new NotFoundException(`Ghế #${id} không tồn tại.`);
    }

    const bookingCount = await this.bookingSeatRepository.count({
      where: { seatId: id },
    });

    if (bookingCount > 0) {
      throw new ConflictException('Không thể xoá ghế đã có lịch sử đặt vé');
    }

    await this.seatRepository.remove(seat);
  }

  // private helpers
  private async findRoomOrThrow(id: number): Promise<Room> {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) {
      throw new NotFoundException(`Phòng #${id} không tồn tại.`);
    }
    return room;
  }

  private normalizeRowLabel(rowLabel: string): string {
    if (typeof rowLabel !== 'string') {
      throw new BadRequestException('rowLabel phải là chuỗi.');
    }

    const normalizedRowLabel = rowLabel.trim().toUpperCase();

    if (!normalizedRowLabel) {
      throw new BadRequestException('rowLabel không được để trống.');
    }

    return normalizedRowLabel;
  }

  private buildSeatKey(rowLabel: string, seatNumber: number): string {
    return `${rowLabel}${seatNumber}`;
  }
}
