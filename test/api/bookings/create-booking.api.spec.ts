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
import { BookingResponseDto } from '../../../src/modules/bookings/dto/booking-response.dto';
import { User } from '../../../src/modules/users/entities/user.entity';
import { SeatHoldService } from '../../../src/modules/bookings/services/seat-hold.service';

type CreateBookingBody = {
  showtimeId?: unknown;
  seatIds?: unknown;
  extraField?: unknown;
};

type HeldSeats = {
  showtimeId: number;
  seatIds: number[];
};

describe('[API] POST /bookings', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;
  let seatHoldService: SeatHoldService;

  let customerToken = '';
  let movieId = 0;

  let showtimeForAuthId = 0;
  let showtimeForSuccessId = 0;
  let showtimeForPriceId = 0;
  let startedShowtimeId = 0;
  let soldOutShowtimeId = 0;
  let wrongRoomShowtimeId = 0;
  let inactiveShowtimeId = 0;
  let confirmedShowtimeId = 0;
  let pendingShowtimeId = 0;
  let redisHeldShowtimeId = 0;
  let notFoundShowtimeId = 0;
  let notFoundSeatId = 0;

  let authSeatId = 0;
  let successStandardSeatId = 0;
  let successVipSeatId = 0;
  let priceStandardSeatId = 0;
  let priceVipSeatId = 0;
  let priceCoupleSeatId = 0;
  let wrongRoomSeatId = 0;
  let inactiveSeatId = 0;
  let confirmedSeatId = 0;
  let pendingSeatId = 0;
  let redisHeldSeatId = 0;

  const createdRoomIds: number[] = [];
  const createdSeatIds: number[] = [];
  const createdShowtimeIds: number[] = [];
  const createdBookingIds: number[] = [];
  const heldSeats: HeldSeats[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'CBK';
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

  const rememberBooking = (
    booking: BookingResponseDto,
    showtimeId: number,
  ): void => {
    createdBookingIds.push(booking.id);
    heldSeats.push({
      showtimeId,
      seatIds: booking.seats.map((seat) => seat.id),
    });
  };

  const createShowtime = (
    movie: Movie,
    room: Room,
    overrides: Partial<Showtime> = {},
  ): Showtime => {
    const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
    startTime.setMilliseconds(0);

    return dataSource.getRepository(Showtime).create({
      movieId: movie.id,
      roomId: room.id,
      startTime,
      endTime: new Date(startTime.getTime() + movie.duration * 60 * 1000),
      status: ShowtimeStatus.OPEN,
      priceStandard: 75000,
      priceVip: 110000,
      priceCouple: 180000,
      ...overrides,
    });
  };

  beforeAll(async () => {
    process.env.ENABLE_RECAPTCHA = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = app.get<DataSource>(DataSource);
    seatHoldService = app.get<SeatHoldService>(SeatHoldService);

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
        title: 'Create Booking Movie ' + seed,
        slug: 'create-booking-movie-' + seed,
        posterUrl: 'https://example.com/create-booking-poster.jpg',
        trailerUrl: null,
        bannerUrl: null,
        description: 'Movie for create booking e2e',
        duration: 120,
        director: 'Director CBK',
        actor: 'Actor CBK',
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
      roomRepository.create({ name: 'CBK' + seed.slice(0, 6) + 'A' }),
      roomRepository.create({ name: 'CBK' + seed.slice(0, 6) + 'B' }),
      roomRepository.create({ name: 'CBK' + seed.slice(0, 6) + 'C' }),
      roomRepository.create({ name: 'CBK' + seed.slice(0, 6) + 'D' }),
      roomRepository.create({ name: 'CBK' + seed.slice(0, 6) + 'E' }),
      roomRepository.create({ name: 'CBK' + seed.slice(0, 6) + 'F' }),
      roomRepository.create({ name: 'CBK' + seed.slice(0, 6) + 'G' }),
      roomRepository.create({ name: 'CBK' + seed.slice(0, 6) + 'H' }),
    ]);

    createdRoomIds.push(...rooms.map((room) => room.id));

    const seats = await seatRepository.save([
      seatRepository.create({
        roomId: rooms[0].id,
        seatKey: 'A1',
        rowLabel: 'A',
        seatNumber: 1,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
      seatRepository.create({
        roomId: rooms[1].id,
        seatKey: 'A1',
        rowLabel: 'A',
        seatNumber: 1,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
      seatRepository.create({
        roomId: rooms[1].id,
        seatKey: 'A2',
        rowLabel: 'A',
        seatNumber: 2,
        seatType: SeatType.VIP,
        isActive: true,
      }),
      seatRepository.create({
        roomId: rooms[2].id,
        seatKey: 'A1',
        rowLabel: 'A',
        seatNumber: 1,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
      seatRepository.create({
        roomId: rooms[2].id,
        seatKey: 'A2',
        rowLabel: 'A',
        seatNumber: 2,
        seatType: SeatType.VIP,
        isActive: true,
      }),
      seatRepository.create({
        roomId: rooms[2].id,
        seatKey: 'B1',
        rowLabel: 'B',
        seatNumber: 1,
        seatType: SeatType.COUPLE,
        isActive: true,
      }),
      seatRepository.create({
        roomId: rooms[3].id,
        seatKey: 'Z1',
        rowLabel: 'Z',
        seatNumber: 1,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
      seatRepository.create({
        roomId: rooms[4].id,
        seatKey: 'A1',
        rowLabel: 'A',
        seatNumber: 1,
        seatType: SeatType.STANDARD,
        isActive: false,
      }),
      seatRepository.create({
        roomId: rooms[5].id,
        seatKey: 'A1',
        rowLabel: 'A',
        seatNumber: 1,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
      seatRepository.create({
        roomId: rooms[6].id,
        seatKey: 'A1',
        rowLabel: 'A',
        seatNumber: 1,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
      seatRepository.create({
        roomId: rooms[7].id,
        seatKey: 'A1',
        rowLabel: 'A',
        seatNumber: 1,
        seatType: SeatType.STANDARD,
        isActive: true,
      }),
    ]);

    createdSeatIds.push(...seats.map((seat) => seat.id));

    authSeatId = seats[0].id;
    successStandardSeatId = seats[1].id;
    successVipSeatId = seats[2].id;
    priceStandardSeatId = seats[3].id;
    priceVipSeatId = seats[4].id;
    priceCoupleSeatId = seats[5].id;
    wrongRoomSeatId = seats[6].id;
    inactiveSeatId = seats[7].id;
    confirmedSeatId = seats[8].id;
    pendingSeatId = seats[9].id;
    redisHeldSeatId = seats[10].id;

    const pastStartTime = new Date(Date.now() - 60 * 60 * 1000);
    pastStartTime.setMilliseconds(0);

    const showtimes = await showtimeRepository.save([
      createShowtime(movie, rooms[0]),
      createShowtime(movie, rooms[1]),
      createShowtime(movie, rooms[2]),
      createShowtime(movie, rooms[0], {
        startTime: pastStartTime,
        endTime: new Date(pastStartTime.getTime() + movie.duration * 60 * 1000),
      }),
      createShowtime(movie, rooms[0], {
        status: ShowtimeStatus.SOLD_OUT,
      }),
      createShowtime(movie, rooms[0]),
      createShowtime(movie, rooms[4]),
      createShowtime(movie, rooms[5]),
      createShowtime(movie, rooms[6]),
      createShowtime(movie, rooms[7]),
    ]);

    showtimeForAuthId = showtimes[0].id;
    showtimeForSuccessId = showtimes[1].id;
    showtimeForPriceId = showtimes[2].id;
    startedShowtimeId = showtimes[3].id;
    soldOutShowtimeId = showtimes[4].id;
    wrongRoomShowtimeId = showtimes[5].id;
    inactiveShowtimeId = showtimes[6].id;
    confirmedShowtimeId = showtimes[7].id;
    pendingShowtimeId = showtimes[8].id;
    redisHeldShowtimeId = showtimes[9].id;

    createdShowtimeIds.push(...showtimes.map((showtime) => showtime.id));

    const customer = await userRepository.findOne({
      where: { email: 'api_client@gmail.com' },
    });

    if (!customer) {
      throw new Error(
        'Không tìm thấy user api_client@gmail.com để seed booking.',
      );
    }

    const confirmedBooking = await bookingRepository.save(
      bookingRepository.create({
        userId: customer.id,
        showtimeId: confirmedShowtimeId,
        ticketCount: 1,
        totalPrice: 75000,
        bookedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        status: BookingStatus.CONFIRMED,
        snapshotMovieTitle: movie.title,
        snapshotRoomName: rooms[5].name,
        snapshotShowtimeStart: showtimes[7].startTime,
      }),
    );

    const pendingBooking = await bookingRepository.save(
      bookingRepository.create({
        userId: customer.id,
        showtimeId: pendingShowtimeId,
        ticketCount: 1,
        totalPrice: 75000,
        bookedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        status: BookingStatus.PENDING,
        snapshotMovieTitle: movie.title,
        snapshotRoomName: rooms[6].name,
        snapshotShowtimeStart: showtimes[8].startTime,
      }),
    );

    createdBookingIds.push(confirmedBooking.id, pendingBooking.id);

    await bookingSeatRepository.save([
      bookingSeatRepository.create({
        bookingId: confirmedBooking.id,
        seatId: confirmedSeatId,
        seatKey: 'A1',
        price: 75000,
        snapshotSeatType: SeatType.STANDARD,
      }),
      bookingSeatRepository.create({
        bookingId: pendingBooking.id,
        seatId: pendingSeatId,
        seatKey: 'A1',
        price: 75000,
        snapshotSeatType: SeatType.STANDARD,
      }),
    ]);

    await seatHoldService.holdSeats(
      redisHeldShowtimeId,
      [redisHeldSeatId],
      'other-user-id',
      999999,
      new Date(Date.now() + 30 * 60 * 1000),
    );
    heldSeats.push({
      showtimeId: redisHeldShowtimeId,
      seatIds: [redisHeldSeatId],
    });

    const maxShowtime = await showtimeRepository
      .createQueryBuilder('showtime')
      .select('MAX(showtime.id)', 'max')
      .getRawOne<{ max: string | null }>();

    const maxSeat = await seatRepository
      .createQueryBuilder('seat')
      .select('MAX(seat.id)', 'max')
      .getRawOne<{ max: string | null }>();

    notFoundShowtimeId = Number(maxShowtime?.max ?? 0) + 999999;
    notFoundSeatId = Number(maxSeat?.max ?? 0) + 999999;
  });

  afterAll(async () => {
    const bookingSeatRepository = dataSource.getRepository(BookingSeat);
    const bookingRepository = dataSource.getRepository(Booking);
    const showtimeRepository = dataSource.getRepository(Showtime);
    const seatRepository = dataSource.getRepository(Seat);
    const roomRepository = dataSource.getRepository(Room);
    const movieRepository = dataSource.getRepository(Movie);

    for (const held of heldSeats) {
      await seatHoldService.releaseSeats(held.showtimeId, held.seatIds);
    }

    if (createdBookingIds.length > 0) {
      await bookingSeatRepository.delete({ bookingId: In(createdBookingIds) });
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

    await exportTestReport(results, PREFIX, 'Create_Booking');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Tạo booking thất bại - Không truyền Authorization Token trả về đúng message', async () => {
      const body: CreateBookingBody = {
        showtimeId: showtimeForAuthId,
        seatIds: [authSeatId],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không truyền token',
          description: 'Không gửi access token khi gọi API tạo booking.',
          procedure: `{
  "showtimeId": ${showtimeForAuthId},
  "seatIds": [
    ${authSeatId}
  ]
}`,
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server).post('/bookings').send(body);

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Tạo booking thất bại - Truyền Fake Token trả về đúng message', async () => {
      const body: CreateBookingBody = {
        showtimeId: showtimeForAuthId,
        seatIds: [authSeatId],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Token không hợp lệ',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: `{
  "showtimeId": ${showtimeForAuthId},
  "seatIds": [
    ${authSeatId}
  ]
}`,
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer fake.jwt.token')
            .send(body);

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });
  });

  describe('Validation Payload', () => {
    it('Tạo booking thất bại - Thiếu showtimeId trả về đúng message', async () => {
      const body: CreateBookingBody = {
        seatIds: [authSeatId],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu showtimeId',
          description: 'Gửi body thiếu trường showtimeId.',
          procedure: `{
  "seatIds": [
    ${authSeatId}
  ]
}`,
          expectedResult: 400,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'showtimeId must be an integer number',
          );

          return response;
        },
      );
    });

    it('Tạo booking thất bại - seatIds rỗng trả về đúng message', async () => {
      const body: CreateBookingBody = {
        showtimeId: showtimeForAuthId,
        seatIds: [],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'seatIds rỗng',
          description: 'Gửi seatIds là mảng rỗng.',
          procedure: `{
  "showtimeId": ${showtimeForAuthId},
  "seatIds": []
}`,
          expectedResult: 400,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'seatIds must contain at least 1 elements',
          );

          return response;
        },
      );
    });

    it('Tạo booking thất bại - seatIds trùng lặp trả về đúng message', async () => {
      const body: CreateBookingBody = {
        showtimeId: showtimeForAuthId,
        seatIds: [authSeatId, authSeatId],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Trùng seatIds',
          description: 'Gửi danh sách seatIds có phần tử trùng lặp.',
          procedure: `{
  "showtimeId": ${showtimeForAuthId},
  "seatIds": [
    ${authSeatId},
    ${authSeatId}
  ]
}`,
          expectedResult: 400,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            "All seatIds's elements must be unique",
          );

          return response;
        },
      );
    });

    it('Tạo booking thất bại - seatIds có phần tử không phải số nguyên trả về đúng message', async () => {
      const body: CreateBookingBody = {
        showtimeId: showtimeForAuthId,
        seatIds: ['abc'],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'seatIds sai định dạng',
          description:
            'Gửi seatIds có phần tử không parse được sang số nguyên.',
          procedure: `{
  "showtimeId": ${showtimeForAuthId},
  "seatIds": [
    "abc"
  ]
}`,
          expectedResult: 400,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'each value in seatIds must be an integer number',
          );

          return response;
        },
      );
    });

    it('Tạo booking thất bại - Payload dư field trả về đúng message', async () => {
      const body: CreateBookingBody = {
        showtimeId: showtimeForAuthId,
        seatIds: [authSeatId],
        extraField: 'hack',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Payload dư field',
          description: 'Gửi thêm field không được khai báo trong DTO.',
          procedure: `{
  "showtimeId": ${showtimeForAuthId},
  "seatIds": [
    ${authSeatId}
  ],
  "extraField": "hack"
}`,
          expectedResult: 400,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'property extraField should not exist',
          );

          return response;
        },
      );
    });
  });

  describe('Validation & lỗi nghiệp vụ', () => {
    it('Tạo booking thất bại - Suất chiếu không tồn tại trả về đúng message', async () => {
      const body: CreateBookingBody = {
        showtimeId: notFoundShowtimeId,
        seatIds: [authSeatId],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Suất chiếu không tồn tại',
          description: 'Tạo booking với showtimeId không tồn tại trong DB.',
          procedure: `{
  "showtimeId": ${notFoundShowtimeId},
  "seatIds": [
    ${authSeatId}
  ]
}`,
          expectedResult: 404,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Suất chiếu không tồn tại.');

          return response;
        },
      );
    });

    it('Tạo booking thất bại - Suất chiếu đã bắt đầu trả về đúng message', async () => {
      const body: CreateBookingBody = {
        showtimeId: startedShowtimeId,
        seatIds: [authSeatId],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Suất chiếu đã bắt đầu',
          description: 'Tạo booking cho suất chiếu có startTime trong quá khứ.',
          procedure: `{
  "showtimeId": ${startedShowtimeId},
  "seatIds": [
    ${authSeatId}
  ]
}`,
          expectedResult: 400,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Suất chiếu đã bắt đầu.');

          return response;
        },
      );
    });

    it('Tạo booking thất bại - Suất chiếu không mở bán trả về đúng message', async () => {
      const body: CreateBookingBody = {
        showtimeId: soldOutShowtimeId,
        seatIds: [authSeatId],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Suất chiếu không mở bán',
          description: 'Tạo booking cho suất chiếu không ở trạng thái open.',
          procedure: `{
  "showtimeId": ${soldOutShowtimeId},
  "seatIds": [
    ${authSeatId}
  ]
}`,
          expectedResult: 400,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Suất chiếu không cho phép đặt vé.');

          return response;
        },
      );
    });

    it('Tạo booking thất bại - Ghế không tồn tại trả về đúng message', async () => {
      const body: CreateBookingBody = {
        showtimeId: showtimeForAuthId,
        seatIds: [notFoundSeatId],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Ghế không tồn tại',
          description: 'Tạo booking với seatId không tồn tại trong DB.',
          procedure: `{
  "showtimeId": ${showtimeForAuthId},
  "seatIds": [
    ${notFoundSeatId}
  ]
}`,
          expectedResult: 404,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            404,
            'Ghế không tồn tại: ' + notFoundSeatId,
          );

          return response;
        },
      );
    });

    it('Tạo booking thất bại - Ghế không thuộc phòng chiếu trả về đúng message', async () => {
      const body: CreateBookingBody = {
        showtimeId: wrongRoomShowtimeId,
        seatIds: [wrongRoomSeatId],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Ghế sai phòng',
          description: 'Tạo booking với ghế không thuộc phòng của suất chiếu.',
          procedure: `{
  "showtimeId": ${wrongRoomShowtimeId},
  "seatIds": [
    ${wrongRoomSeatId}
  ]
}`,
          expectedResult: 400,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Ghế không thuộc phòng chiếu: Z1');

          return response;
        },
      );
    });

    it('Tạo booking thất bại - Ghế không khả dụng trả về đúng message', async () => {
      const body: CreateBookingBody = {
        showtimeId: inactiveShowtimeId,
        seatIds: [inactiveSeatId],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Ghế không khả dụng',
          description: 'Tạo booking với ghế đang bị inactive.',
          procedure: `{
  "showtimeId": ${inactiveShowtimeId},
  "seatIds": [
    ${inactiveSeatId}
  ]
}`,
          expectedResult: 400,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Ghế không khả dụng: A1');

          return response;
        },
      );
    });

    it('Tạo booking thất bại - Ghế đã được đặt trả về đúng message', async () => {
      const body: CreateBookingBody = {
        showtimeId: confirmedShowtimeId,
        seatIds: [confirmedSeatId],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Ghế đã được đặt',
          description: 'Tạo booking với ghế đã thuộc booking confirmed.',
          procedure: `{
  "showtimeId": ${confirmedShowtimeId},
  "seatIds": [
    ${confirmedSeatId}
  ]
}`,
          expectedResult: 409,
          preconditions: 'Token customer hợp lệ, ghế đã được đặt',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(error, 409, 'Ghế đã được đặt: A1');

          return response;
        },
      );
    });

    it('Tạo booking thất bại - Ghế đang được giữ bởi booking pending trả về đúng message', async () => {
      const body: CreateBookingBody = {
        showtimeId: pendingShowtimeId,
        seatIds: [pendingSeatId],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Ghế đang được giữ',
          description: 'Tạo booking với ghế đã thuộc booking pending còn hạn.',
          procedure: `{
  "showtimeId": ${pendingShowtimeId},
  "seatIds": [
    ${pendingSeatId}
  ]
}`,
          expectedResult: 409,
          preconditions: 'Token customer hợp lệ, ghế đang được giữ',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(error, 409, 'Ghế đang được giữ: A1');

          return response;
        },
      );
    });

    it('Tạo booking thất bại - Ghế đang được người khác giữ trong Redis trả về đúng message', async () => {
      const body: CreateBookingBody = {
        showtimeId: redisHeldShowtimeId,
        seatIds: [redisHeldSeatId],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Ghế bị giữ Redis',
          description:
            'Tạo booking với ghế đang được user khác giữ trong Redis.',
          procedure: `{
  "showtimeId": ${redisHeldShowtimeId},
  "seatIds": [
    ${redisHeldSeatId}
  ]
}`,
          expectedResult: 409,
          preconditions: 'Token customer hợp lệ, ghế đang được giữ',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(error, 409, 'Ghế đang được người khác giữ: A1');

          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Tạo booking thành công - Tạo booking pending và kiểm tra response shape', async () => {
      const body: CreateBookingBody = {
        showtimeId: showtimeForSuccessId,
        seatIds: [successVipSeatId, successStandardSeatId],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo booking pending',
          description: 'Tạo booking thành công với nhiều ghế hợp lệ.',
          procedure: `{
  "showtimeId": ${showtimeForSuccessId},
  "seatIds": [
    ${successVipSeatId},
    ${successStandardSeatId}
  ]
}`,
          expectedResult: 201,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

          expect(response.status).toBe(201);

          const data = parseApiData<BookingResponseDto>(response);
          expect(typeof data.id).toBe('number');
          expect(data.status).toBe(BookingStatus.PENDING);
          expect(data.totalPrice).toBe(185000);
          expect(typeof data.expiresAt).toBe('string');
          expect(Array.isArray(data.seats)).toBe(true);
          expect(data.seats).toHaveLength(2);

          data.seats.forEach((seat) => {
            expect(typeof seat.id).toBe('number');
            expect(typeof seat.seatKey).toBe('string');
            expect(Object.values(SeatType)).toContain(seat.seatType);
            expect(typeof seat.price).toBe('number');

            expect(Object.keys(seat).sort()).toEqual([
              'id',
              'price',
              'seatKey',
              'seatType',
            ]);
          });

          expect(Object.keys(data).sort()).toEqual([
            'expiresAt',
            'id',
            'seats',
            'status',
            'totalPrice',
          ]);

          expect(data.seats.map((seat) => seat.seatKey)).toEqual(['A1', 'A2']);
          expect(data.seats.map((seat) => seat.price)).toEqual([75000, 110000]);

          const bookingRepository = dataSource.getRepository(Booking);
          const savedBooking = await bookingRepository.findOne({
            where: { id: data.id },
          });

          expect(savedBooking).not.toBeNull();
          expect(savedBooking?.status).toBe(BookingStatus.PENDING);
          expect(savedBooking?.ticketCount).toBe(2);
          expect(Number(savedBooking?.totalPrice)).toBe(185000);

          rememberBooking(data, showtimeForSuccessId);

          return response;
        },
      );
    });

    it('Tạo booking thành công - Tính đúng tổng tiền theo loại ghế', async () => {
      const body: CreateBookingBody = {
        showtimeId: showtimeForPriceId,
        seatIds: [priceCoupleSeatId, priceVipSeatId, priceStandardSeatId],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tính đúng tổng tiền',
          description:
            'Tạo booking thành công và tính tổng tiền theo standard, vip, couple.',
          procedure: `{
  "showtimeId": ${showtimeForPriceId},
  "seatIds": [
    ${priceCoupleSeatId},
    ${priceVipSeatId},
    ${priceStandardSeatId}
  ]
}`,
          expectedResult: 201,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/bookings')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

          expect(response.status).toBe(201);

          const data = parseApiData<BookingResponseDto>(response);
          expect(data.status).toBe(BookingStatus.PENDING);
          expect(data.totalPrice).toBe(365000);
          expect(data.seats.map((seat) => seat.seatKey)).toEqual([
            'A1',
            'A2',
            'B1',
          ]);
          expect(data.seats.map((seat) => seat.price)).toEqual([
            75000, 110000, 180000,
          ]);

          rememberBooking(data, showtimeForPriceId);

          return response;
        },
      );
    });
  });
});
