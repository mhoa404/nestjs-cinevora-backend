import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { Server } from 'http';

import {
  parseApiError,
  expectErrorMessage,
  parseApiData,
} from '../../helpers/http-test.helper';
import { AppModule } from '../../../src/app.module';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';
import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import { cleanupRefreshTokens } from '../../helpers/cleanup-refresh-token';
import {
  Movie,
  MovieStatus,
  AgeRating,
} from '../../../src/modules/movies/entities/movie.entity';
import { Room } from '../../../src/modules/rooms/entities/room.entity';
import { Showtime } from '../../../src/modules/showtimes/entities/showtime.entity';

describe('[API] DELETE /showtimes/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let movieActive: Movie;
  let movieEnded: Movie;
  let room: Room;

  const createdShowtimeIds: number[] = [];
  const createdMovieIds: number[] = [];
  const createdRoomIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'DST';

  let counter = 0;
  let seedCounter = 0;

  const nextId = (): string => {
    counter += 1;
    return PREFIX + String(counter).padStart(2, '0');
  };

  const stringifyProcedure = (payload: unknown): string =>
    typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);

  const getActualResult = (response?: Response): number =>
    response?.status ?? 0;

  const addDays = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);

    return date.toISOString().slice(0, 10);
  };

  const seedShowtime = async (movie: Movie): Promise<Showtime> => {
    const showtimeRepo = dataSource.getRepository(Showtime);

    seedCounter += 1;

    const startTime = new Date(
      Date.now() + (48 + seedCounter * 4) * 60 * 60 * 1000,
    );
    startTime.setMilliseconds(0);

    const endTime = new Date(startTime.getTime() + movie.duration * 60 * 1000);

    const showtime = await showtimeRepo.save(
      showtimeRepo.create({
        movieId: movie.id,
        roomId: room.id,
        startTime,
        endTime,
        priceStandard: 80000,
        priceVip: 120000,
      }),
    );

    createdShowtimeIds.push(showtime.id);

    return showtime;
  };

  const deleteShowtime = (
    id: number | string,
    token = adminToken,
  ): Promise<Response> =>
    request(server)
      .delete('/showtimes/' + id)
      .set('Authorization', 'Bearer ' + token);

  const record = async (
    meta: Omit<TestCaseRecord, 'passed' | 'testDate' | 'actualResult'>,
    action: () => Promise<Response>,
    assertion: (response: Response) => void | Promise<void>,
  ): Promise<Response> => {
    const testDate = new Date();
    let response: Response | undefined;
    let passed = false;

    try {
      response = await action();
      await assertion(response);
      passed = true;

      return response;
    } finally {
      results.push({
        ...meta,
        actualResult: getActualResult(response),
        passed,
        testDate,
      });
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

    const adminLoginResponse = await request(server)
      .post('/auth/mobile/login')
      .send({ email: 'api_tester@gmail.com', password: 'Api_tester_123' });

    adminToken = parseApiData<AuthResponseDto>(adminLoginResponse).accessToken;

    const customerLoginResponse = await request(server)
      .post('/auth/mobile/login')
      .send({ email: 'api_client@gmail.com', password: 'Api_client_123' });

    customerToken = parseApiData<AuthResponseDto>(
      customerLoginResponse,
    ).accessToken;

    const movieRepo = dataSource.getRepository(Movie);
    const roomRepo = dataSource.getRepository(Room);
    const seed = String(Date.now()).slice(-6);

    movieActive = await movieRepo.save(
      movieRepo.create({
        title: 'DST A ' + seed,
        slug: 'dst-a-' + seed,
        posterUrl: 'https://example.com/poster.jpg',
        duration: 90,
        ageRating: AgeRating.P,
        status: MovieStatus.SHOWING,
        releaseDate: addDays(-10) as unknown as Date,
        endDate: addDays(365) as unknown as Date,
      }),
    );

    movieEnded = await movieRepo.save(
      movieRepo.create({
        title: 'DST E ' + seed,
        slug: 'dst-e-' + seed,
        posterUrl: 'https://example.com/poster.jpg',
        duration: 90,
        ageRating: AgeRating.P,
        status: MovieStatus.ENDED,
        releaseDate: addDays(-60) as unknown as Date,
        endDate: addDays(-1) as unknown as Date,
      }),
    );

    room = await roomRepo.save(
      roomRepo.create({
        name: 'D' + seed,
      }),
    );

    createdMovieIds.push(movieActive.id, movieEnded.id);
    createdRoomIds.push(room.id);
  });

  afterAll(async () => {
    const uniqueShowtimeIds = [...new Set(createdShowtimeIds)];

    if (uniqueShowtimeIds.length > 0) {
      await dataSource.getRepository(Showtime).delete(uniqueShowtimeIds);
    }

    if (createdMovieIds.length > 0) {
      await dataSource.getRepository(Movie).delete(createdMovieIds);
    }

    if (createdRoomIds.length > 0) {
      await dataSource.getRepository(Room).delete(createdRoomIds);
    }

    await cleanupRefreshTokens(dataSource);

    await exportTestReport(results, PREFIX, 'Delete_Showtime');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Xóa thất bại - Không truyền Authorization Token trả về đúng message', async () => {
      const showtime = await seedShowtime(movieEnded);

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không truyền token',
          description: 'Không gửi access token khi xóa suất chiếu.',
          procedure: stringifyProcedure({
            params: {
              id: showtime.id,
            },
          }),
          expectedResult: 401,
          preconditions: 'Không có',
        },
        () => request(server).delete('/showtimes/' + showtime.id),
        (response) => {
          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');
        },
      );
    });

    it('Xóa thất bại - Truyền Fake Token trả về đúng message', async () => {
      const showtime = await seedShowtime(movieEnded);

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Token không hợp lệ',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: stringifyProcedure({
            params: {
              id: showtime.id,
            },
            token: 'Không hợp lệ',
          }),
          expectedResult: 401,
          preconditions: 'Không có',
        },
        () =>
          request(server)
            .delete('/showtimes/' + showtime.id)
            .set('Authorization', 'Bearer fake.jwt.token'),
        (response) => {
          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');
        },
      );
    });

    it('Xóa thất bại - Role Customer bị chặn trả về đúng message', async () => {
      const showtime = await seedShowtime(movieEnded);

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Customer không có quyền',
          description: 'Tài khoản Customer cố xóa suất chiếu.',
          procedure: stringifyProcedure({
            params: {
              id: showtime.id,
            },
          }),
          expectedResult: 403,
          preconditions: 'Token Customer hợp lệ',
        },
        () => deleteShowtime(showtime.id, customerToken),
        (response) => {
          expect(response.status).toBe(403);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            403,
            'Bạn không có quyền thực hiện hành động này.',
          );
        },
      );
    });
  });

  describe('Kiểm tra dữ liệu đầu vào', () => {
    it('Xóa thất bại - ID không phải số nguyên', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Sai định dạng ID',
          description: 'Gửi id không thể parse sang số nguyên.',
          procedure: stringifyProcedure({
            params: {
              id: 'xyz',
            },
          }),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ',
        },
        () => deleteShowtime('xyz'),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Validation failed (numeric string is expected)',
          );
        },
      );
    });
  });

  describe('Ràng buộc nghiệp vụ', () => {
    it('Xóa thất bại - Showtime không tồn tại', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Showtime không tồn tại',
          description: 'Gửi id không tồn tại trong hệ thống.',
          procedure: stringifyProcedure({
            params: {
              id: 999999,
            },
          }),
          expectedResult: 404,
          preconditions: 'Token Admin hợp lệ',
        },
        () => deleteShowtime(999999),
        (response) => {
          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Suất chiếu #999999 không tồn tại.');
        },
      );
    });

    it('Xóa thất bại - Phim chưa kết thúc trả về đúng message', async () => {
      const showtime = await seedShowtime(movieActive);

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Phim chưa kết thúc',
          description: 'Xóa suất chiếu của phim chưa có trạng thái ended.',
          procedure: stringifyProcedure({
            params: {
              id: showtime.id,
            },
          }),
          expectedResult: 409,
          preconditions: 'Phim đang chiếu',
        },
        () => deleteShowtime(showtime.id),
        (response) => {
          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            409,
            'Chỉ có thể xoá suất chiếu khi phim đã kết thúc chiếu (ended).',
          );
        },
      );
    });

    it('Xóa thất bại - Showtime đã bị xóa trước đó', async () => {
      const showtime = await seedShowtime(movieEnded);

      await dataSource.getRepository(Showtime).delete(showtime.id);

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Showtime đã bị xóa',
          description: 'Gửi id của suất chiếu đã bị xóa khỏi hệ thống.',
          procedure: stringifyProcedure({
            params: {
              id: showtime.id,
            },
          }),
          expectedResult: 404,
          preconditions: 'Showtime đã bị xóa',
        },
        () => deleteShowtime(showtime.id),
        (response) => {
          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            404,
            `Suất chiếu #${showtime.id} không tồn tại.`,
          );
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Xóa thành công - Phim đã kết thúc', async () => {
      const showtime = await seedShowtime(movieEnded);

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Phim đã kết thúc',
          description: 'Xóa suất chiếu của phim đã có trạng thái ended.',
          procedure: stringifyProcedure({
            params: {
              id: showtime.id,
            },
          }),
          expectedResult: 204,
          preconditions: 'Phim đã kết thúc',
        },
        () => deleteShowtime(showtime.id),
        async (response) => {
          expect(response.status).toBe(204);
          expect(response.body).toEqual({});

          const deleted = await dataSource
            .getRepository(Showtime)
            .findOne({ where: { id: showtime.id } });

          expect(deleted).toBeNull();
        },
      );
    });
  });
});
