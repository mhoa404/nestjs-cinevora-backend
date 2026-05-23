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
import {
  SeatAvailabilityResponseDto,
  SeatAvailabilityStatus,
} from '../../../src/modules/bookings/dto/seat-availability-response.dto';
import { User } from '../../../src/modules/users/entities/user.entity';

describe('[API] GET /showtimes/:id/seats', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let customerToken = '';

  let movieId = 0;
  let roomWithSeatsId = 0;
  let emptyRoomId = 0;
  let showtimeWithSeatsId = 0;
  let emptyShowtimeId = 0;
  let notFoundShowtimeId = 0;

  const createdSeatIds: number[] = [];
  const createdBookingSeatIds: number[] = [];
  const createdBookingIds: number[] = [];
  const createdShowtimeIds: number[] = [];
  const createdRoomIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'GSS';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return `${PREFIX}${String(counter).padStart(2, '0')}`;
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

    const customerLoginRes = await request(server)
      .post('/auth/mobile/login')
      .send({ email: 'api_client@gmail.com', password: 'Api_client_123' });
    customerToken = parseApiData<AuthResponseDto>(customerLoginRes).accessToken;

    const movieRepository = dataSource.getRepository(Movie);
    const roomRepository = dataSource.getRepository(Room);
    const seatRepository = dataSource.getRepository(Seat);
    const showtimeRepository = dataSource.getRepository(Showtime);
    const userRepository = dataSource.getRepository(User);
    const bookingRepository = dataSource.getRepository(Booking);
    const bookingSeatRepository = dataSource.getRepository(BookingSeat);

    const seed = String(Date.now()).slice(-8);

    const movie = await movieRepository.save(
      movieRepository.create({
        title: `GSS Movie ${seed}`,
        slug: `gss-movie-${seed}`,
        posterUrl: 'https://example.com/gss-poster.jpg',
        trailerUrl: null,
        bannerUrl: null,
        description: 'Movie for get showtime seats e2e',
        duration: 120,
        director: 'Director GSS',
        actor: 'Actor GSS',
        language: 'VI',
        ageRating: AgeRating.P,
        rated: 'P',
        status: MovieStatus.SHOWING,
        releaseDate: new Date(),
        endDate: null,
      }),
    );
    movieId = movie.id;

    const rooms = await roomRepository.save([
      roomRepository.create({ name: `GSS-A-${seed}` }),
      roomRepository.create({ name: `GSS-E-${seed}` }),
    ]);

    roomWithSeatsId = rooms[0].id;
    emptyRoomId = rooms[1].id;
    createdRoomIds.push(...rooms.map((room) => room.id));

    const seats = await seatRepository.save([
      seatRepository.create({
        roomId: roomWithSeatsId,
        seatKey: 'B1',
        rowLabel: 'B',
        seatNumber: 1,
        seatType: SeatType.VIP,
        isActive: true,
      }),
      seatRepository.create({
        roomId: roomWithSeatsId,
        seatKey: 'A2',
        rowLabel: 'A',
        seatNumber: 2,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
      seatRepository.create({
        roomId: roomWithSeatsId,
        seatKey: 'A1',
        rowLabel: 'A',
        seatNumber: 1,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
      seatRepository.create({
        roomId: roomWithSeatsId,
        seatKey: 'C1',
        rowLabel: 'C',
        seatNumber: 1,
        seatType: SeatType.COUPLE,
        isActive: false,
      }),
    ]);
    createdSeatIds.push(...seats.map((seat) => seat.id));

    const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
    startTime.setMilliseconds(0);
    const endTime = new Date(startTime.getTime() + movie.duration * 60 * 1000);

    const showtimes = await showtimeRepository.save([
      showtimeRepository.create({
        movieId,
        roomId: roomWithSeatsId,
        startTime,
        endTime,
        status: ShowtimeStatus.OPEN,
        priceStandard: 75000,
        priceVip: 110000,
        priceCouple: 190000,
      }),
      showtimeRepository.create({
        movieId,
        roomId: emptyRoomId,
        startTime: new Date(startTime.getTime() + 24 * 60 * 60 * 1000),
        endTime: new Date(endTime.getTime() + 24 * 60 * 60 * 1000),
        status: ShowtimeStatus.OPEN,
        priceStandard: 75000,
        priceVip: 110000,
        priceCouple: 190000,
      }),
    ]);

    showtimeWithSeatsId = showtimes[0].id;
    emptyShowtimeId = showtimes[1].id;
    createdShowtimeIds.push(...showtimes.map((showtime) => showtime.id));

    const customer = await userRepository.findOne({
      where: { email: 'api_client@gmail.com' },
    });

    if (!customer) {
      throw new Error(
        'Không tìm thấy user api_client@gmail.com để seed booking.',
      );
    }

    const confirmedSeat = seats.find((seat) => seat.seatKey === 'B1');
    const pendingSeat = seats.find((seat) => seat.seatKey === 'A2');

    if (!confirmedSeat || !pendingSeat) {
      throw new Error('Không tìm thấy seat để seed trạng thái booked/holding.');
    }

    const confirmedBooking = await bookingRepository.save(
      bookingRepository.create({
        userId: customer.id,
        showtimeId: showtimeWithSeatsId,
        ticketCount: 1,
        totalPrice: 110000,
        bookedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        status: BookingStatus.CONFIRMED,
        snapshotMovieTitle: movie.title,
        snapshotRoomName: rooms[0].name,
        snapshotShowtimeStart: showtimes[0].startTime,
      }),
    );

    const pendingBooking = await bookingRepository.save(
      bookingRepository.create({
        userId: customer.id,
        showtimeId: showtimeWithSeatsId,
        ticketCount: 1,
        totalPrice: 75000,
        bookedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        status: BookingStatus.PENDING,
        snapshotMovieTitle: movie.title,
        snapshotRoomName: rooms[0].name,
        snapshotShowtimeStart: showtimes[0].startTime,
      }),
    );

    createdBookingIds.push(confirmedBooking.id, pendingBooking.id);

    const bookingSeats = await bookingSeatRepository.save([
      bookingSeatRepository.create({
        bookingId: confirmedBooking.id,
        seatId: confirmedSeat.id,
        seatKey: confirmedSeat.seatKey,
        price: 110000,
        snapshotSeatType: SeatType.VIP,
      }),
      bookingSeatRepository.create({
        bookingId: pendingBooking.id,
        seatId: pendingSeat.id,
        seatKey: pendingSeat.seatKey,
        price: 75000,
        snapshotSeatType: SeatType.STANDARD,
      }),
    ]);

    createdBookingSeatIds.push(
      ...bookingSeats.map((bookingSeat) => bookingSeat.id),
    );

    const maxShowtimeRaw = (await showtimeRepository
      .createQueryBuilder('showtime')
      .select('MAX(showtime.id)', 'max')
      .getRawOne()) as { max: string | number | null };

    notFoundShowtimeId = Number(maxShowtimeRaw.max ?? 0) + 9999;
  });

  afterAll(async () => {
    const bookingSeatRepository = dataSource.getRepository(BookingSeat);
    const bookingRepository = dataSource.getRepository(Booking);
    const showtimeRepository = dataSource.getRepository(Showtime);
    const seatRepository = dataSource.getRepository(Seat);
    const roomRepository = dataSource.getRepository(Room);
    const movieRepository = dataSource.getRepository(Movie);

    if (createdBookingSeatIds.length > 0) {
      await bookingSeatRepository.delete(createdBookingSeatIds);
    }

    if (createdBookingIds.length > 0) {
      await bookingRepository.delete(createdBookingIds);
    }

    if (createdShowtimeIds.length > 0) {
      await showtimeRepository.delete(createdShowtimeIds);
    }

    if (createdSeatIds.length > 0) {
      await seatRepository.delete(createdSeatIds);
    }

    if (createdRoomIds.length > 0) {
      await roomRepository.delete(createdRoomIds);
    }

    if (movieId) {
      await movieRepository.delete(movieId);
    }

    await cleanupRefreshTokens(dataSource);
    await exportTestReport(results, PREFIX, 'Get_Showtime_Seats');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Lấy sơ đồ ghế thất bại - Không truyền Authorization Token trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không truyền token',
          description: 'Không gửi access token khi gọi API lấy sơ đồ ghế.',
          procedure: `{ "id": ${showtimeWithSeatsId} }`,
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server).get(
            `/showtimes/${showtimeWithSeatsId}/seats`,
          );

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Lấy sơ đồ ghế thất bại - Truyền Fake Token trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Token không hợp lệ',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: `{ "id": ${showtimeWithSeatsId} }`,
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server)
            .get(`/showtimes/${showtimeWithSeatsId}/seats`)
            .set('Authorization', 'Bearer fake.jwt.token');

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });
  });

  describe('Validation & lỗi nghiệp vụ', () => {
    it('Lấy sơ đồ ghế thất bại - ID không phải số nguyên trả về đúng message', async () => {
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
            .get('/showtimes/abc/seats')
            .set('Authorization', 'Bearer ' + customerToken);

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

    it('Lấy sơ đồ ghế thất bại - Suất chiếu không tồn tại trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Suất chiếu không tồn tại',
          description:
            'Lấy sơ đồ ghế với id suất chiếu không tồn tại trong DB.',
          procedure: `{ "id": ${notFoundShowtimeId} }`,
          expectedResult: 404,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get(`/showtimes/${notFoundShowtimeId}/seats`)
            .set('Authorization', 'Bearer ' + customerToken);

          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Suất chiếu không tồn tại.');

          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Lấy sơ đồ ghế thành công - Kiểm tra response shape và trạng thái ghế', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra sơ đồ ghế',
          description:
            'Lấy sơ đồ ghế và kiểm tra trạng thái available, holding, booked, unavailable.',
          procedure: `{ "id": ${showtimeWithSeatsId} }`,
          expectedResult: 200,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get(`/showtimes/${showtimeWithSeatsId}/seats`)
            .set('Authorization', 'Bearer ' + customerToken);

          expect(response.status).toBe(200);

          const data = parseApiData<SeatAvailabilityResponseDto[]>(response);
          expect(Array.isArray(data)).toBe(true);
          expect(data).toHaveLength(4);

          data.forEach((seat) => {
            expect(typeof seat.id).toBe('number');
            expect(typeof seat.seatKey).toBe('string');
            expect(typeof seat.rowLabel).toBe('string');
            expect(typeof seat.seatNumber).toBe('number');
            expect(Object.values(SeatType)).toContain(seat.seatType);
            expect(typeof seat.isActive).toBe('boolean');
            expect(Object.values(SeatAvailabilityStatus)).toContain(
              seat.status,
            );

            if (seat.status === SeatAvailabilityStatus.UNAVAILABLE) {
              expect(seat.price).toBeNull();
            } else {
              expect(typeof seat.price).toBe('number');
            }

            expect(Object.keys(seat).sort()).toEqual([
              'id',
              'isActive',
              'price',
              'rowLabel',
              'seatKey',
              'seatNumber',
              'seatType',
              'status',
            ]);
          });

          const seatMap = new Map(data.map((seat) => [seat.seatKey, seat]));

          expect(seatMap.get('A1')?.status).toBe(
            SeatAvailabilityStatus.AVAILABLE,
          );
          expect(seatMap.get('A1')?.price).toBe(75000);

          expect(seatMap.get('A2')?.status).toBe(
            SeatAvailabilityStatus.HOLDING,
          );
          expect(seatMap.get('A2')?.price).toBe(75000);

          expect(seatMap.get('B1')?.status).toBe(SeatAvailabilityStatus.BOOKED);
          expect(seatMap.get('B1')?.price).toBe(110000);

          expect(seatMap.get('C1')?.status).toBe(
            SeatAvailabilityStatus.UNAVAILABLE,
          );
          expect(seatMap.get('C1')?.price).toBeNull();

          return response;
        },
      );
    });

    it('Lấy sơ đồ ghế thành công - Kiểm tra sắp xếp theo rowLabel ASC và seatNumber ASC', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra sắp xếp ghế',
          description:
            'Lấy sơ đồ ghế thành công, kết quả được sắp xếp theo rowLabel ASC và seatNumber ASC.',
          procedure: `{ "id": ${showtimeWithSeatsId} }`,
          expectedResult: 200,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get(`/showtimes/${showtimeWithSeatsId}/seats`)
            .set('Authorization', 'Bearer ' + customerToken);

          expect(response.status).toBe(200);

          const data = parseApiData<SeatAvailabilityResponseDto[]>(response);
          expect(data.map((seat) => seat.seatKey)).toEqual([
            'A1',
            'A2',
            'B1',
            'C1',
          ]);

          return response;
        },
      );
    });

    it('Lấy sơ đồ ghế thành công - Phòng chưa có ghế trả về mảng rỗng', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Phòng chưa có ghế',
          description: 'Lấy sơ đồ ghế của suất chiếu thuộc phòng chưa có ghế.',
          procedure: `{ "id": ${emptyShowtimeId} }`,
          expectedResult: 200,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get(`/showtimes/${emptyShowtimeId}/seats`)
            .set('Authorization', 'Bearer ' + customerToken);

          expect(response.status).toBe(200);

          const data = parseApiData<SeatAvailabilityResponseDto[]>(response);
          expect(Array.isArray(data)).toBe(true);
          expect(data).toEqual([]);

          return response;
        },
      );
    });
  });
});
