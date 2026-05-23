import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { Server } from 'http';

import {
  parseApiError,
  expectErrorMessage,
  getActualStatus,
  parseApiData,
} from '../../helpers/http-test.helper';
import { AppModule } from '../../../src/app.module';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';
import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import { cleanupRefreshTokens } from '../../helpers/cleanup-refresh-token';
import { Room } from '../../../src/modules/rooms/entities/room.entity';
import { Seat } from '../../../src/modules/seats/entities/seat.entity';
import { SeatType } from '../../../src/common/constants/seat-type.constant';
import {
  Movie,
  AgeRating,
  MovieStatus,
} from '../../../src/modules/movies/entities/movie.entity';
import { Showtime } from '../../../src/modules/showtimes/entities/showtime.entity';
import { User } from '../../../src/modules/users/entities/user.entity';
import {
  Booking,
  BookingStatus,
} from '../../../src/modules/bookings/entities/booking.entity';
import { BookingSeat } from '../../../src/modules/bookings/entities/booking-seat.entity';

describe('[API] DELETE /seats/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let cleanSeatId = 0;
  let bookedSeatId = 0;
  let notFoundSeatId = 0;

  let seededMovieId = 0;
  let seededShowtimeId = 0;
  let seededBookingId = 0;
  let seededBookingSeatId = 0;

  const createdRoomIds: number[] = [];
  const createdSeatIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'DSE';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return PREFIX + String(counter).padStart(2, '0');
  };

  const record = async (
    meta: Omit<TestCaseRecord, 'passed' | 'testDate' | 'actualResult'>,
    executor: () => Promise<Response>,
  ): Promise<void> => {
    const testDate = new Date();
    let passed = false;
    let actualResult: number | null = null;

    try {
      const response = await executor();
      actualResult = response.status;
      passed = true;
    } catch (error: unknown) {
      actualResult = getActualStatus(error);
      passed = false;
      throw error;
    } finally {
      results.push({ ...meta, actualResult, passed, testDate });
    }
  };

  beforeAll(async () => {
    process.env.ENABLE_RECAPTCHA = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = app.get<DataSource>(DataSource);

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        stopAtFirstError: true,
      }),
    );
    app.use(cookieParser());

    await app.init();
    server = app.getHttpServer() as Server;

    const adminLoginRes = await request(server)
      .post('/auth/mobile/login')
      .send({ email: 'api_tester@gmail.com', password: 'Api_tester_123' });

    adminToken = parseApiData<AuthResponseDto>(adminLoginRes).accessToken;

    const customerLoginRes = await request(server)
      .post('/auth/mobile/login')
      .send({ email: 'api_client@gmail.com', password: 'Api_client_123' });

    customerToken = parseApiData<AuthResponseDto>(customerLoginRes).accessToken;

    const roomRepository = dataSource.getRepository(Room);
    const seatRepository = dataSource.getRepository(Seat);
    const movieRepository = dataSource.getRepository(Movie);
    const showtimeRepository = dataSource.getRepository(Showtime);
    const userRepository = dataSource.getRepository(User);
    const bookingRepository = dataSource.getRepository(Booking);
    const bookingSeatRepository = dataSource.getRepository(BookingSeat);

    const seed = String(Date.now()).slice(-8);

    const rooms = await roomRepository.save([
      roomRepository.create({ name: 'DS' + seed.slice(0, 6) + 'A' }),
      roomRepository.create({ name: 'DS' + seed.slice(0, 6) + 'B' }),
    ]);

    createdRoomIds.push(...rooms.map((room) => room.id));

    const seats = await seatRepository.save([
      seatRepository.create({
        roomId: rooms[0].id,
        seatKey: 'A1',
        rowLabel: 'A',
        seatNumber: 1,
        seatType: SeatType.STANDARD,
      }),
      seatRepository.create({
        roomId: rooms[1].id,
        seatKey: 'B1',
        rowLabel: 'B',
        seatNumber: 1,
        seatType: SeatType.VIP,
      }),
    ]);

    cleanSeatId = seats[0].id;
    bookedSeatId = seats[1].id;
    createdSeatIds.push(...seats.map((seat) => seat.id));

    const user = await userRepository.findOne({
      where: { email: 'api_client@gmail.com' },
    });

    if (!user) {
      throw new Error(
        'Không tìm thấy user api_client@gmail.com để seed booking.',
      );
    }

    const movie = await movieRepository.save(
      movieRepository.create({
        title: 'Delete Seat Movie ' + seed,
        slug: 'delete-seat-movie-' + seed,
        posterUrl: 'https://example.com/delete-seat-movie.jpg',
        trailerUrl: null,
        bannerUrl: null,
        description: 'Movie linked to seat delete e2e',
        duration: 120,
        director: 'Director X',
        actor: 'Actor X',
        language: 'VI',
        ageRating: AgeRating.P,
        rated: 'P',
        status: MovieStatus.SHOWING,
        releaseDate: new Date(),
        endDate: null,
      }),
    );
    seededMovieId = movie.id;

    const startTime = new Date(Date.now() + 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

    const showtime = await showtimeRepository.save(
      showtimeRepository.create({
        movieId: movie.id,
        roomId: rooms[1].id,
        startTime,
        endTime,
        priceStandard: 90000,
        priceVip: 120000,
        priceCouple: null,
      }),
    );
    seededShowtimeId = showtime.id;

    const booking = await bookingRepository.save(
      bookingRepository.create({
        userId: user.id,
        showtimeId: showtime.id,
        ticketCount: 1,
        totalPrice: 120000,
        bookedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        status: BookingStatus.CONFIRMED,
        snapshotMovieTitle: movie.title,
        snapshotRoomName: rooms[1].name,
        snapshotShowtimeStart: showtime.startTime,
      }),
    );
    seededBookingId = booking.id;

    const bookingSeat = await bookingSeatRepository.save(
      bookingSeatRepository.create({
        bookingId: booking.id,
        seatId: bookedSeatId,
        seatKey: 'B1',
        price: 120000,
        snapshotSeatType: SeatType.VIP,
      }),
    );
    seededBookingSeatId = bookingSeat.id;

    const maxSeat = await seatRepository
      .createQueryBuilder('seat')
      .select('MAX(seat.id)', 'max')
      .getRawOne<{ max: string | null }>();

    notFoundSeatId = Number(maxSeat?.max ?? 0) + 999999;
  });

  afterAll(async () => {
    const bookingSeatRepository = dataSource.getRepository(BookingSeat);
    const bookingRepository = dataSource.getRepository(Booking);
    const showtimeRepository = dataSource.getRepository(Showtime);
    const movieRepository = dataSource.getRepository(Movie);
    const seatRepository = dataSource.getRepository(Seat);
    const roomRepository = dataSource.getRepository(Room);

    if (seededBookingSeatId) {
      await bookingSeatRepository.delete(seededBookingSeatId);
    }

    if (seededBookingId) {
      await bookingRepository.delete(seededBookingId);
    }

    if (seededShowtimeId) {
      await showtimeRepository.delete(seededShowtimeId);
    }

    if (seededMovieId) {
      await movieRepository.delete(seededMovieId);
    }

    if (createdSeatIds.length > 0) {
      await seatRepository.delete(createdSeatIds);
    }

    if (createdRoomIds.length > 0) {
      await roomRepository.delete(createdRoomIds);
    }

    await cleanupRefreshTokens(dataSource);
    await exportTestReport(results, PREFIX, 'Delete_Seat');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Xoá ghế thất bại - Không truyền Authorization Token trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không truyền token',
          description: 'Không gửi access token khi gọi API xoá ghế.',
          procedure: `{ "id": ${cleanSeatId} }`,
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server).delete(
            '/seats/' + cleanSeatId,
          );
          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Xoá ghế thất bại - Truyền Fake Token trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Token không hợp lệ',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: `{ "id": ${cleanSeatId} }`,
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server)
            .delete('/seats/' + cleanSeatId)
            .set('Authorization', 'Bearer fake.jwt.token');

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Xoá ghế thất bại - Role Customer bị chặn trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Customer không có quyền',
          description: 'Tài khoản Customer cố xoá ghế.',
          procedure: `{ "id": ${cleanSeatId} }`,
          expectedResult: 403,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .delete('/seats/' + cleanSeatId)
            .set('Authorization', 'Bearer ' + customerToken);

          expect(response.status).toBe(403);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            403,
            'Bạn không có quyền thực hiện hành động này.',
          );

          return response;
        },
      );
    });
  });

  describe('Validation & lỗi nghiệp vụ', () => {
    it('Xoá ghế thất bại - ID không phải số nguyên trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'ID sai định dạng',
          description:
            'Truyền id là chuỗi chữ cái, ParseIntPipe không thể parse sang number.',
          procedure: `{ "id": "abc" }`,
          expectedResult: 400,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .delete('/seats/abc')
            .set('Authorization', 'Bearer ' + adminToken);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Validation failed (numeric string is expected)',
          );

          return response;
        },
      );
    });

    it('Xoá ghế thất bại - Ghế không tồn tại trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Ghế không tồn tại',
          description: 'Xoá ghế với ID không tồn tại trong DB.',
          procedure: `{ "id": ${notFoundSeatId} }`,
          expectedResult: 404,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .delete('/seats/' + notFoundSeatId)
            .set('Authorization', 'Bearer ' + adminToken);

          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            404,
            'Ghế #' + notFoundSeatId + ' không tồn tại.',
          );

          return response;
        },
      );
    });

    it('Xoá ghế thất bại - Ghế đã có lịch sử đặt vé trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Ghế đã có đặt vé',
          description: 'Cố xoá ghế đã có lịch sử đặt vé trong booking_seats.',
          procedure: `{ "id": ${bookedSeatId} }`,
          expectedResult: 409,
          preconditions: 'Token admin hợp lệ, ghế đã có đặt vé',
        },
        async () => {
          const response = await request(server)
            .delete('/seats/' + bookedSeatId)
            .set('Authorization', 'Bearer ' + adminToken);

          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            409,
            'Không thể xoá ghế đã có lịch sử đặt vé',
          );

          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Xoá ghế thành công - Ghế chưa có lịch sử đặt vé', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Xoá ghế hợp lệ',
          description: 'Xoá thành công một ghế chưa có lịch sử đặt vé.',
          procedure: `{ "id": ${cleanSeatId} }`,
          expectedResult: 204,
          preconditions: 'Token admin hợp lệ, ghế chưa có đặt vé',
        },
        async () => {
          const response = await request(server)
            .delete('/seats/' + cleanSeatId)
            .set('Authorization', 'Bearer ' + adminToken);

          expect(response.status).toBe(204);
          expect(response.text).toBe('');

          const seatRepository = dataSource.getRepository(Seat);
          const deletedSeat = await seatRepository.findOne({
            where: { id: cleanSeatId },
          });

          expect(deletedSeat).toBeNull();

          return response;
        },
      );
    });
  });
});
