import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { DataSource, In } from 'typeorm';
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
import {
  Movie,
  AgeRating,
  MovieStatus,
} from '../../../src/modules/movies/entities/movie.entity';
import { Room } from '../../../src/modules/rooms/entities/room.entity';
import { Seat } from '../../../src/modules/seats/entities/seat.entity';
import { SeatType } from '../../../src/common/constants/seat-type.constant';
import {
  Showtime,
  ShowtimeStatus,
} from '../../../src/modules/showtimes/entities/showtime.entity';
import {
  Booking,
  BookingStatus,
} from '../../../src/modules/bookings/entities/booking.entity';
import { BookingSeat } from '../../../src/modules/bookings/entities/booking-seat.entity';
import { User } from '../../../src/modules/users/entities/user.entity';

describe('[API] PATCH /bookings/:id/cancel', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let customerToken = '';
  let adminToken = '';

  let movieId = 0;
  let roomId = 0;
  let showtimeId = 0;

  let noTokenBookingId = 0;
  let fakeTokenBookingId = 0;
  let customerOwnBookingId = 0;
  let adminCancelBookingId = 0;
  let otherUserBookingId = 0;
  let confirmedBookingId = 0;
  let cancelledBookingId = 0;
  let expiredPendingBookingId = 0;
  let notFoundBookingId = 0;

  const createdSeatIds: number[] = [];
  const createdBookingIds: number[] = [];
  const results: TestCaseRecord[] = [];

  const PREFIX = 'CAB';
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

  const createBookingSeed = async (
    userId: string,
    seat: Seat,
    status: BookingStatus,
    expiresAt: Date,
  ): Promise<Booking> => {
    const bookingRepository = dataSource.getRepository(Booking);
    const bookingSeatRepository = dataSource.getRepository(BookingSeat);

    const booking = await bookingRepository.save(
      bookingRepository.create({
        userId,
        showtimeId,
        ticketCount: 1,
        totalPrice: 75000,
        bookedAt: new Date(),
        expiresAt,
        status,
        snapshotMovieTitle: 'Cancel Booking Movie',
        snapshotRoomName: 'Cancel Booking Room',
        snapshotShowtimeStart: new Date(Date.now() + 48 * 60 * 60 * 1000),
      }),
    );

    await bookingSeatRepository.save(
      bookingSeatRepository.create({
        bookingId: booking.id,
        seatId: seat.id,
        seatKey: seat.seatKey,
        price: 75000,
        snapshotSeatType: seat.seatType,
      }),
    );

    createdBookingIds.push(booking.id);

    return booking;
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

    const customerLoginRes = await request(server)
      .post('/auth/mobile/login')
      .send({ email: 'api_client@gmail.com', password: 'Api_client_123' });

    customerToken = parseApiData<AuthResponseDto>(customerLoginRes).accessToken;

    const adminLoginRes = await request(server)
      .post('/auth/mobile/login')
      .send({ email: 'api_tester@gmail.com', password: 'Api_tester_123' });

    adminToken = parseApiData<AuthResponseDto>(adminLoginRes).accessToken;

    const movieRepository = dataSource.getRepository(Movie);
    const roomRepository = dataSource.getRepository(Room);
    const seatRepository = dataSource.getRepository(Seat);
    const showtimeRepository = dataSource.getRepository(Showtime);
    const userRepository = dataSource.getRepository(User);
    const bookingRepository = dataSource.getRepository(Booking);

    const seed = String(Date.now()).slice(-8);

    const movie = await movieRepository.save(
      movieRepository.create({
        title: 'Cancel Booking Movie ' + seed,
        slug: 'cancel-booking-movie-' + seed,
        posterUrl: 'https://example.com/cancel-booking-poster.jpg',
        trailerUrl: null,
        bannerUrl: null,
        description: 'Movie for cancel booking e2e',
        duration: 120,
        director: 'Director CAB',
        actor: 'Actor CAB',
        language: 'VI',
        ageRating: AgeRating.P,
        rated: 'P',
        status: MovieStatus.SHOWING,
        releaseDate: new Date(),
        endDate: null,
      }),
    );
    movieId = movie.id;

    const room = await roomRepository.save(
      roomRepository.create({ name: 'CAB' + seed.slice(0, 6) }),
    );
    roomId = room.id;

    const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
    startTime.setMilliseconds(0);

    const showtime = await showtimeRepository.save(
      showtimeRepository.create({
        movieId,
        roomId,
        startTime,
        endTime: new Date(startTime.getTime() + movie.duration * 60 * 1000),
        status: ShowtimeStatus.OPEN,
        priceStandard: 75000,
        priceVip: 110000,
        priceCouple: 180000,
      }),
    );
    showtimeId = showtime.id;

    const seats = await seatRepository.save([
      seatRepository.create({
        roomId,
        seatKey: 'A1',
        rowLabel: 'A',
        seatNumber: 1,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
      seatRepository.create({
        roomId,
        seatKey: 'A2',
        rowLabel: 'A',
        seatNumber: 2,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
      seatRepository.create({
        roomId,
        seatKey: 'A3',
        rowLabel: 'A',
        seatNumber: 3,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
      seatRepository.create({
        roomId,
        seatKey: 'A4',
        rowLabel: 'A',
        seatNumber: 4,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
      seatRepository.create({
        roomId,
        seatKey: 'A5',
        rowLabel: 'A',
        seatNumber: 5,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
      seatRepository.create({
        roomId,
        seatKey: 'A6',
        rowLabel: 'A',
        seatNumber: 6,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
      seatRepository.create({
        roomId,
        seatKey: 'A7',
        rowLabel: 'A',
        seatNumber: 7,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
      seatRepository.create({
        roomId,
        seatKey: 'A8',
        rowLabel: 'A',
        seatNumber: 8,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
    ]);
    createdSeatIds.push(...seats.map((seat) => seat.id));

    const customer = await userRepository.findOne({
      where: { email: 'api_client@gmail.com' },
    });

    const admin = await userRepository.findOne({
      where: { email: 'api_tester@gmail.com' },
    });

    if (!customer) {
      throw new Error(
        'Không tìm thấy user api_client@gmail.com để seed booking.',
      );
    }

    if (!admin) {
      throw new Error(
        'Không tìm thấy user api_tester@gmail.com để seed booking.',
      );
    }

    const futureExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const pastExpiresAt = new Date(Date.now() - 30 * 60 * 1000);

    noTokenBookingId = (
      await createBookingSeed(
        customer.id,
        seats[0],
        BookingStatus.PENDING,
        futureExpiresAt,
      )
    ).id;

    fakeTokenBookingId = (
      await createBookingSeed(
        customer.id,
        seats[1],
        BookingStatus.PENDING,
        futureExpiresAt,
      )
    ).id;

    customerOwnBookingId = (
      await createBookingSeed(
        customer.id,
        seats[2],
        BookingStatus.PENDING,
        futureExpiresAt,
      )
    ).id;

    adminCancelBookingId = (
      await createBookingSeed(
        customer.id,
        seats[3],
        BookingStatus.PENDING,
        futureExpiresAt,
      )
    ).id;

    otherUserBookingId = (
      await createBookingSeed(
        admin.id,
        seats[4],
        BookingStatus.PENDING,
        futureExpiresAt,
      )
    ).id;

    confirmedBookingId = (
      await createBookingSeed(
        customer.id,
        seats[5],
        BookingStatus.CONFIRMED,
        futureExpiresAt,
      )
    ).id;

    cancelledBookingId = (
      await createBookingSeed(
        customer.id,
        seats[6],
        BookingStatus.CANCELLED,
        futureExpiresAt,
      )
    ).id;

    expiredPendingBookingId = (
      await createBookingSeed(
        customer.id,
        seats[7],
        BookingStatus.PENDING,
        pastExpiresAt,
      )
    ).id;

    const maxBooking = await bookingRepository
      .createQueryBuilder('booking')
      .select('MAX(booking.id)', 'max')
      .getRawOne<{ max: string | null }>();

    notFoundBookingId = Number(maxBooking?.max ?? 0) + 999999;
  });

  afterAll(async () => {
    const bookingSeatRepository = dataSource.getRepository(BookingSeat);
    const bookingRepository = dataSource.getRepository(Booking);
    const showtimeRepository = dataSource.getRepository(Showtime);
    const seatRepository = dataSource.getRepository(Seat);
    const roomRepository = dataSource.getRepository(Room);
    const movieRepository = dataSource.getRepository(Movie);

    if (createdBookingIds.length > 0) {
      await bookingSeatRepository.delete({ bookingId: In(createdBookingIds) });
      await bookingRepository.delete(createdBookingIds);
    }

    if (showtimeId) {
      await showtimeRepository.delete(showtimeId);
    }

    if (createdSeatIds.length > 0) {
      await seatRepository.delete(createdSeatIds);
    }

    if (roomId) {
      await roomRepository.delete(roomId);
    }

    if (movieId) {
      await movieRepository.delete(movieId);
    }

    await cleanupRefreshTokens(dataSource);

    await exportTestReport(results, PREFIX, 'Cancel_Booking');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Huỷ booking thất bại - Không truyền Authorization Token trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không truyền token',
          description: 'Không gửi access token khi gọi API huỷ booking.',
          procedure: `{ "id": ${noTokenBookingId} }`,
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server).patch(
            `/bookings/${noTokenBookingId}/cancel`,
          );

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Huỷ booking thất bại - Truyền Fake Token trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Token không hợp lệ',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: `{ "id": ${fakeTokenBookingId} }`,
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server)
            .patch(`/bookings/${fakeTokenBookingId}/cancel`)
            .set('Authorization', 'Bearer fake.jwt.token');

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Huỷ booking thất bại - Customer huỷ booking của người khác trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Huỷ booking người khác',
          description: 'Customer cố huỷ booking không thuộc sở hữu của mình.',
          procedure: `{ "id": ${otherUserBookingId} }`,
          expectedResult: 403,
          preconditions: 'Token customer hợp lệ, booking của người khác',
        },
        async () => {
          const response = await request(server)
            .patch(`/bookings/${otherUserBookingId}/cancel`)
            .set('Authorization', `Bearer ${customerToken}`);

          expect(response.status).toBe(403);

          const error = parseApiError(response);
          expectErrorMessage(error, 403, 'Bạn không có quyền huỷ booking này.');

          return response;
        },
      );
    });
  });

  describe('Validation & lỗi nghiệp vụ', () => {
    it('Huỷ booking thất bại - ID không phải số nguyên trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'ID sai định dạng',
          description:
            'Truyền id là chuỗi chữ cái, ParseIntPipe không thể parse sang number.',
          procedure: `{ "id": "abc" }`,
          expectedResult: 400,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .patch('/bookings/abc/cancel')
            .set('Authorization', `Bearer ${customerToken}`);

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

    it('Huỷ booking thất bại - Booking không tồn tại trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Booking không tồn tại',
          description: 'Huỷ booking với id không tồn tại trong DB.',
          procedure: `{ "id": ${notFoundBookingId} }`,
          expectedResult: 404,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .patch(`/bookings/${notFoundBookingId}/cancel`)
            .set('Authorization', `Bearer ${customerToken}`);

          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Booking không tồn tại.');

          return response;
        },
      );
    });

    it('Huỷ booking thất bại - Booking đã confirmed trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Booking đã confirmed',
          description: 'Huỷ booking đang ở trạng thái confirmed.',
          procedure: `{ "id": ${confirmedBookingId} }`,
          expectedResult: 400,
          preconditions: 'Token customer hợp lệ, booking confirmed',
        },
        async () => {
          const response = await request(server)
            .patch(`/bookings/${confirmedBookingId}/cancel`)
            .set('Authorization', `Bearer ${customerToken}`);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Không thể huỷ booking trạng thái "confirmed".',
          );

          return response;
        },
      );
    });

    it('Huỷ booking thất bại - Booking đã cancelled trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Booking đã cancelled',
          description: 'Huỷ booking đang ở trạng thái cancelled.',
          procedure: `{ "id": ${cancelledBookingId} }`,
          expectedResult: 400,
          preconditions: 'Token customer hợp lệ, booking cancelled',
        },
        async () => {
          const response = await request(server)
            .patch(`/bookings/${cancelledBookingId}/cancel`)
            .set('Authorization', `Bearer ${customerToken}`);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Không thể huỷ booking trạng thái "cancelled".',
          );

          return response;
        },
      );
    });

    it('Huỷ booking thất bại - Booking pending đã hết hạn trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Booking hết hạn',
          description: 'Huỷ booking pending nhưng expiresAt đã qua.',
          procedure: `{ "id": ${expiredPendingBookingId} }`,
          expectedResult: 400,
          preconditions: 'Token customer hợp lệ, booking hết hạn',
        },
        async () => {
          const response = await request(server)
            .patch(`/bookings/${expiredPendingBookingId}/cancel`)
            .set('Authorization', `Bearer ${customerToken}`);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Booking đã hết hạn, không thể huỷ.');

          const bookingRepository = dataSource.getRepository(Booking);
          const expiredBooking = await bookingRepository.findOne({
            where: { id: expiredPendingBookingId },
          });

          expect(expiredBooking?.status).toBe(BookingStatus.EXPIRED);

          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Huỷ booking thành công - Customer huỷ booking của chính mình', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Customer huỷ booking',
          description:
            'Customer huỷ thành công booking pending của chính mình.',
          procedure: `{ "id": ${customerOwnBookingId} }`,
          expectedResult: 200,
          preconditions: 'Token customer hợp lệ, booking pending',
        },
        async () => {
          const response = await request(server)
            .patch(`/bookings/${customerOwnBookingId}/cancel`)
            .set('Authorization', `Bearer ${customerToken}`);

          expect(response.status).toBe(200);
          expect(parseApiData<{ message: string }>(response)).toEqual({
            message: 'Huỷ booking thành công.',
          });

          const bookingRepository = dataSource.getRepository(Booking);
          const cancelledBooking = await bookingRepository.findOne({
            where: { id: customerOwnBookingId },
          });

          expect(cancelledBooking?.status).toBe(BookingStatus.CANCELLED);

          return response;
        },
      );
    });

    it('Huỷ booking thành công - Admin huỷ booking của người khác', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Admin huỷ booking',
          description: 'Admin huỷ thành công booking pending của customer.',
          procedure: `{ "id": ${adminCancelBookingId} }`,
          expectedResult: 200,
          preconditions: 'Token admin hợp lệ, booking pending',
        },
        async () => {
          const response = await request(server)
            .patch(`/bookings/${adminCancelBookingId}/cancel`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(200);
          expect(parseApiData<{ message: string }>(response)).toEqual({
            message: 'Huỷ booking thành công.',
          });

          const bookingRepository = dataSource.getRepository(Booking);
          const cancelledBooking = await bookingRepository.findOne({
            where: { id: adminCancelBookingId },
          });

          expect(cancelledBooking?.status).toBe(BookingStatus.CANCELLED);

          return response;
        },
      );
    });
  });
});
