// src/modules/bookings/bookings.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { UserRole } from '../../common/constants/role.constant';
import { SeatType } from '../../common/constants/seat-type.constant';
import { Seat } from '../seats/entities/seat.entity';
import {
  Showtime,
  ShowtimeStatus,
} from '../showtimes/entities/showtime.entity';
import {
  BookingResponseDto,
  BookingSeatResponseInput,
} from './dto/booking-response.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  SeatAvailabilityResponseDto,
  SeatAvailabilityStatus,
} from './dto/seat-availability-response.dto';
import { BookingSeat } from './entities/booking-seat.entity';
import { Booking, BookingStatus } from './entities/booking.entity';
import { SeatHoldService } from './services/seat-hold.service';

interface CreateBookingTransactionResult {
  booking: Booking;
  seats: Seat[];
  showtime: Showtime;
}

interface ActiveBookingSeatRow {
  seatId: number | string;
  seatKey: string;
  status: BookingStatus;
}

interface SeatStatusRow {
  seatId: number | string;
  status: BookingStatus;
}

@Injectable()
export class BookingsService {
  private readonly holdTtlMs = 600_000;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,

    @InjectRepository(BookingSeat)
    private readonly bookingSeatRepository: Repository<BookingSeat>,

    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,

    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,

    private readonly seatHoldService: SeatHoldService,
    private readonly dataSource: DataSource,
  ) {}

  async createBooking(
    dto: CreateBookingDto,
    userId: string,
  ): Promise<BookingResponseDto> {
    const result = await this.dataSource.transaction(
      'SERIALIZABLE',
      async (manager) => this.createBookingInTransaction(manager, dto, userId),
    );

    let conflictingSeatIds: number[];

    try {
      conflictingSeatIds = await this.seatHoldService.holdSeats(
        result.booking.showtimeId,
        result.seats.map((seat) => seat.id),
        userId,
        result.booking.id,
        result.booking.expiresAt,
      );
    } catch {
      await this.bookingRepository.update(result.booking.id, {
        status: BookingStatus.CANCELLED,
      });

      throw new ServiceUnavailableException(
        'Không thể giữ ghế do Redis không khả dụng.',
      );
    }

    if (conflictingSeatIds.length > 0) {
      await this.bookingRepository.update(result.booking.id, {
        status: BookingStatus.CANCELLED,
      });

      const conflictKeys = this.getSeatKeysByIds(
        result.seats,
        conflictingSeatIds,
      );

      throw new ConflictException(
        `Ghế đang được người khác giữ: ${conflictKeys.join(', ')}`,
      );
    }

    return BookingResponseDto.fromEntity(
      result.booking,
      this.buildBookingSeatResponse(result.seats, result.showtime),
    );
  }

  async cancelBooking(
    bookingId: number,
    userId: string,
    userRole: UserRole,
  ): Promise<{ message: string }> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ['bookingSeats'],
    });

    if (!booking) {
      throw new NotFoundException('Booking không tồn tại.');
    }

    const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(userRole);

    if (booking.userId !== userId && !isAdmin) {
      throw new ForbiddenException('Bạn không có quyền huỷ booking này.');
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Không thể huỷ booking trạng thái "${booking.status}".`,
      );
    }

    if (booking.expiresAt <= new Date()) {
      await this.bookingRepository.update(booking.id, {
        status: BookingStatus.EXPIRED,
      });

      await this.releaseBookingSeats(booking);

      throw new BadRequestException('Booking đã hết hạn, không thể huỷ.');
    }

    await this.bookingRepository.update(booking.id, {
      status: BookingStatus.CANCELLED,
    });

    await this.releaseBookingSeats(booking);

    return { message: 'Huỷ booking thành công.' };
  }

  async getShowtimeSeats(
    showtimeId: number,
  ): Promise<SeatAvailabilityResponseDto[]> {
    const showtime = await this.showtimeRepository.findOne({
      where: { id: showtimeId },
    });

    if (!showtime) {
      throw new NotFoundException('Suất chiếu không tồn tại.');
    }

    const seats = await this.seatRepository.find({
      where: { roomId: showtime.roomId },
      order: { rowLabel: 'ASC', seatNumber: 'ASC' },
    });

    if (seats.length === 0) {
      return [];
    }

    const seatIds = seats.map((seat) => seat.id);
    const now = new Date();

    const seatStatusRows = await this.findActiveSeatStatusRows(
      showtimeId,
      seatIds,
      now,
    );

    const bookedSeatIds = new Set<number>();
    const pendingSeatIds = new Set<number>();

    for (const row of seatStatusRows) {
      const seatId = Number(row.seatId);

      if (!Number.isInteger(seatId)) {
        continue;
      }

      if (row.status === BookingStatus.CONFIRMED) {
        bookedSeatIds.add(seatId);
      }

      if (row.status === BookingStatus.PENDING) {
        pendingSeatIds.add(seatId);
      }
    }

    const redisHeldSeatIds = new Set(
      await this.seatHoldService.getHeldSeatIds(showtimeId),
    );

    return seats.map((seat) =>
      this.toSeatAvailabilityResponse(
        seat,
        showtime,
        bookedSeatIds,
        pendingSeatIds,
        redisHeldSeatIds,
      ),
    );
  }

  private async createBookingInTransaction(
    manager: EntityManager,
    dto: CreateBookingDto,
    userId: string,
  ): Promise<CreateBookingTransactionResult> {
    const showtime = await manager
      .getRepository(Showtime)
      .createQueryBuilder('showtime')
      .leftJoinAndSelect('showtime.movie', 'movie')
      .leftJoinAndSelect('showtime.room', 'room')
      .setLock('pessimistic_write')
      .where('showtime.id = :showtimeId', { showtimeId: dto.showtimeId })
      .getOne();

    if (!showtime) {
      throw new NotFoundException('Suất chiếu không tồn tại.');
    }

    const now = new Date();

    if (showtime.startTime <= now) {
      throw new BadRequestException('Suất chiếu đã bắt đầu.');
    }

    if (showtime.status !== ShowtimeStatus.OPEN) {
      throw new BadRequestException('Suất chiếu không cho phép đặt vé.');
    }

    const seats = await manager.getRepository(Seat).find({
      where: { id: In(dto.seatIds) },
      order: { rowLabel: 'ASC', seatNumber: 'ASC' },
    });

    this.assertSeatsExist(dto.seatIds, seats);
    this.assertSeatsBelongToRoom(seats, showtime.roomId);
    this.assertSeatsAreActive(seats);

    const activeBookingSeats = await this.findActiveBookingSeatRows(
      manager,
      showtime.id,
      dto.seatIds,
      now,
    );

    this.assertSeatsAreNotBlocked(activeBookingSeats);

    const redisConflictingSeatIds =
      await this.seatHoldService.getConflictingSeatIds(
        showtime.id,
        dto.seatIds,
        userId,
      );

    if (redisConflictingSeatIds.length > 0) {
      const conflictKeys = this.getSeatKeysByIds(
        seats,
        redisConflictingSeatIds,
      );

      throw new ConflictException(
        `Ghế đang được người khác giữ: ${conflictKeys.join(', ')}`,
      );
    }

    const totalPrice = seats.reduce(
      (sum, seat) => sum + this.getSeatPrice(seat.seatType, showtime),
      0,
    );

    const expiresAt = new Date(Date.now() + this.holdTtlMs);

    const booking = manager.getRepository(Booking).create({
      userId,
      showtimeId: showtime.id,
      ticketCount: seats.length,
      totalPrice,
      expiresAt,
      status: BookingStatus.PENDING,
      snapshotMovieTitle: showtime.movie.title,
      snapshotRoomName: showtime.room.name,
      snapshotShowtimeStart: showtime.startTime,
    });

    const savedBooking = await manager.getRepository(Booking).save(booking);

    const bookingSeats = seats.map((seat) =>
      manager.getRepository(BookingSeat).create({
        bookingId: savedBooking.id,
        seatId: seat.id,
        seatKey: seat.seatKey,
        price: this.getSeatPrice(seat.seatType, showtime),
        snapshotSeatType: seat.seatType,
      }),
    );

    await manager.getRepository(BookingSeat).save(bookingSeats);

    return {
      booking: savedBooking,
      seats,
      showtime,
    };
  }

  private async findActiveBookingSeatRows(
    manager: EntityManager,
    showtimeId: number,
    seatIds: number[],
    now: Date,
  ): Promise<ActiveBookingSeatRow[]> {
    return manager
      .getRepository(BookingSeat)
      .createQueryBuilder('bookingSeat')
      .innerJoin('bookingSeat.booking', 'booking')
      .select('bookingSeat.seat_id', 'seatId')
      .addSelect('bookingSeat.seat_key', 'seatKey')
      .addSelect('booking.status', 'status')
      .where('booking.showtime_id = :showtimeId', { showtimeId })
      .andWhere('bookingSeat.seat_id IN (:...seatIds)', { seatIds })
      .andWhere(
        `
        (
          booking.status = :confirmedStatus
          OR (
            booking.status = :pendingStatus
            AND booking.expires_at > :now
          )
        )
        `,
        {
          confirmedStatus: BookingStatus.CONFIRMED,
          pendingStatus: BookingStatus.PENDING,
          now,
        },
      )
      .getRawMany<ActiveBookingSeatRow>();
  }

  private async findActiveSeatStatusRows(
    showtimeId: number,
    seatIds: number[],
    now: Date,
  ): Promise<SeatStatusRow[]> {
    return this.bookingSeatRepository
      .createQueryBuilder('bookingSeat')
      .innerJoin('bookingSeat.booking', 'booking')
      .select('bookingSeat.seat_id', 'seatId')
      .addSelect('booking.status', 'status')
      .where('booking.showtime_id = :showtimeId', { showtimeId })
      .andWhere('bookingSeat.seat_id IN (:...seatIds)', { seatIds })
      .andWhere(
        `
        (
          booking.status = :confirmedStatus
          OR (
            booking.status = :pendingStatus
            AND booking.expires_at > :now
          )
        )
        `,
        {
          confirmedStatus: BookingStatus.CONFIRMED,
          pendingStatus: BookingStatus.PENDING,
          now,
        },
      )
      .getRawMany<SeatStatusRow>();
  }

  private assertSeatsExist(requestedSeatIds: number[], seats: Seat[]): void {
    if (seats.length === requestedSeatIds.length) {
      return;
    }

    const foundSeatIds = new Set(seats.map((seat) => seat.id));
    const missingSeatIds = requestedSeatIds.filter(
      (seatId) => !foundSeatIds.has(seatId),
    );

    throw new NotFoundException(
      `Ghế không tồn tại: ${missingSeatIds.join(', ')}`,
    );
  }

  private assertSeatsBelongToRoom(seats: Seat[], roomId: number): void {
    const wrongRoomSeats = seats.filter((seat) => seat.roomId !== roomId);

    if (wrongRoomSeats.length === 0) {
      return;
    }

    throw new BadRequestException(
      `Ghế không thuộc phòng chiếu: ${wrongRoomSeats
        .map((seat) => seat.seatKey)
        .join(', ')}`,
    );
  }

  private assertSeatsAreActive(seats: Seat[]): void {
    const inactiveSeats = seats.filter((seat) => !seat.isActive);

    if (inactiveSeats.length === 0) {
      return;
    }

    throw new BadRequestException(
      `Ghế không khả dụng: ${inactiveSeats
        .map((seat) => seat.seatKey)
        .join(', ')}`,
    );
  }

  private assertSeatsAreNotBlocked(rows: ActiveBookingSeatRow[]): void {
    if (rows.length === 0) {
      return;
    }

    const confirmedSeatKeys = rows
      .filter((row) => row.status === BookingStatus.CONFIRMED)
      .map((row) => row.seatKey);

    if (confirmedSeatKeys.length > 0) {
      throw new ConflictException(
        `Ghế đã được đặt: ${confirmedSeatKeys.join(', ')}`,
      );
    }

    const pendingSeatKeys = rows
      .filter((row) => row.status === BookingStatus.PENDING)
      .map((row) => row.seatKey);

    throw new ConflictException(
      `Ghế đang được giữ: ${pendingSeatKeys.join(', ')}`,
    );
  }

  private toSeatAvailabilityResponse(
    seat: Seat,
    showtime: Showtime,
    bookedSeatIds: Set<number>,
    pendingSeatIds: Set<number>,
    redisHeldSeatIds: Set<number>,
  ): SeatAvailabilityResponseDto {
    const dto = new SeatAvailabilityResponseDto();

    dto.id = seat.id;
    dto.seatKey = seat.seatKey;
    dto.rowLabel = seat.rowLabel;
    dto.seatNumber = seat.seatNumber;
    dto.seatType = seat.seatType;
    dto.isActive = seat.isActive;

    if (!seat.isActive) {
      dto.status = SeatAvailabilityStatus.UNAVAILABLE;
      dto.price = null;
      return dto;
    }

    if (bookedSeatIds.has(seat.id)) {
      dto.status = SeatAvailabilityStatus.BOOKED;
      dto.price = this.getSeatPrice(seat.seatType, showtime);
      return dto;
    }

    if (redisHeldSeatIds.has(seat.id) || pendingSeatIds.has(seat.id)) {
      dto.status = SeatAvailabilityStatus.HOLDING;
      dto.price = this.getSeatPrice(seat.seatType, showtime);
      return dto;
    }

    dto.status = SeatAvailabilityStatus.AVAILABLE;
    dto.price = this.getSeatPrice(seat.seatType, showtime);

    return dto;
  }

  private buildBookingSeatResponse(
    seats: Seat[],
    showtime: Showtime,
  ): BookingSeatResponseInput[] {
    return seats.map((seat) => ({
      id: seat.id,
      seatKey: seat.seatKey,
      seatType: seat.seatType,
      price: this.getSeatPrice(seat.seatType, showtime),
    }));
  }

  private getSeatKeysByIds(seats: Seat[], seatIds: number[]): string[] {
    const seatIdSet = new Set(seatIds);

    return seats
      .filter((seat) => seatIdSet.has(seat.id))
      .map((seat) => seat.seatKey);
  }

  private getSeatPrice(seatType: SeatType, showtime: Showtime): number {
    if (seatType === SeatType.VIP) {
      return Number(showtime.priceVip);
    }

    if (seatType === SeatType.COUPLE) {
      return Number(showtime.priceCouple ?? showtime.priceVip);
    }

    return Number(showtime.priceStandard);
  }

  private async releaseBookingSeats(booking: Booking): Promise<void> {
    await this.seatHoldService.releaseSeats(
      booking.showtimeId,
      booking.bookingSeats.map((bookingSeat) => bookingSeat.seatId),
    );
  }
}
