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
  const results: TestCaseRecord[] = [];
  const PREFIX = 'DST';

  let counter = 0;
  let seedCounter = 0;

  const nextId = () => `${PREFIX}${String(++counter).padStart(2, '0')}`;

  const stringifyProcedure = (payload: unknown): string =>
    JSON.stringify(payload, null, 2);

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

    const adminRes = await request(server).post('/auth/mobile/login').send({
      email: 'api_tester@gmail.com',
      password: 'Api_tester_123',
    });

    adminToken = parseApiData<AuthResponseDto>(adminRes).accessToken;

    const customerRes = await request(server).post('/auth/mobile/login').send({
      email: 'api_client@gmail.com',
      password: 'Api_client_123',
    });

    customerToken = parseApiData<AuthResponseDto>(customerRes).accessToken;

    const movieRepo = dataSource.getRepository(Movie);
    const roomRepo = dataSource.getRepository(Room);

    movieActive = await movieRepo.save(
      movieRepo.create({
        title: 'DST Active Movie',
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
        title: 'DST Ended Movie',
        posterUrl: 'https://example.com/poster.jpg',
        duration: 90,
        ageRating: AgeRating.P,
        status: MovieStatus.ENDED,
        releaseDate: addDays(-60) as unknown as Date,
        endDate: addDays(-1) as unknown as Date,
      }),
    );

    room = await roomRepo.save(roomRepo.create({ name: 'D1' }));
  });

  afterAll(async () => {
    const uniqueShowtimeIds = [...new Set(createdShowtimeIds)];

    if (uniqueShowtimeIds.length > 0) {
      await dataSource.getRepository(Showtime).delete(uniqueShowtimeIds);
    }

    if (movieActive?.id && movieEnded?.id) {
      await dataSource
        .getRepository(Movie)
        .delete([movieActive.id, movieEnded.id]);
    }

    if (room?.id) {
      await dataSource.getRepository(Room).delete(room.id);
    }

    await exportTestReport(results, PREFIX, 'Delete_Showtime');
    await app.close();
  });

  describe('Kiểm tra dữ liệu đầu vào', () => {
    it('Xóa showtime thất bại – Id không phải số nguyên', async () => {
      const procedure = {
        params: {
          id: 'xyz',
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Xóa showtime thất bại do id không hợp lệ',
          description: 'Xóa showtime với id trên URL không phải là số nguyên.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 400,
          preconditions: 'Tài khoản admin đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .delete('/showtimes/xyz')
            .set('Authorization', `Bearer ${adminToken}`),
        (response) => {
          expect(response.status).toBe(400);
          parseApiError(response);
        },
      );
    });
  });

  describe('Phân quyền', () => {
    it('Xóa showtime thất bại – Thiếu token', async () => {
      const showtime = await seedShowtime(movieEnded);

      const procedure = {
        params: {
          id: showtime.id,
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Xóa showtime thất bại do thiếu token',
          description: 'Xóa showtime khi chưa đăng nhập bằng tài khoản admin.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 401,
          preconditions: 'Không gửi access token trong request.',
        },
        () => request(server).delete(`/showtimes/${showtime.id}`),
        (response) => {
          expect(response.status).toBe(401);
          parseApiError(response);
        },
      );
    });

    it('Xóa showtime thất bại – Tài khoản không đủ quyền', async () => {
      const showtime = await seedShowtime(movieEnded);

      const procedure = {
        params: {
          id: showtime.id,
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Xóa showtime thất bại do không đủ quyền',
          description: 'Xóa showtime bằng tài khoản khách hàng thông thường.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 403,
          preconditions: 'Tài khoản customer đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .delete(`/showtimes/${showtime.id}`)
            .set('Authorization', `Bearer ${customerToken}`),
        (response) => {
          expect(response.status).toBe(403);
          parseApiError(response);
        },
      );
    });
  });

  describe('Ràng buộc nghiệp vụ', () => {
    it('Xóa showtime thất bại – Showtime không tồn tại', async () => {
      const procedure = {
        params: {
          id: 999999,
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Xóa showtime thất bại do showtime không tồn tại',
          description: 'Xóa showtime với id không tồn tại trong hệ thống.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 404,
          preconditions: 'Tài khoản admin đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .delete('/showtimes/999999')
            .set('Authorization', `Bearer ${adminToken}`),
        (response) => {
          expect(response.status).toBe(404);
          parseApiError(response);
        },
      );
    });

    it('Xóa showtime thất bại – Phim chưa kết thúc', async () => {
      const showtime = await seedShowtime(movieActive);

      const procedure = {
        params: {
          id: showtime.id,
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Xóa showtime thất bại do phim chưa kết thúc',
          description: 'Xóa showtime của phim vẫn đang trong thời gian chiếu.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 409,
          preconditions: 'Phim của showtime đang có trạng thái đang chiếu.',
        },
        () =>
          request(server)
            .delete(`/showtimes/${showtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`),
        (response) => {
          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(error, 409, 'ended');
        },
      );
    });

    it('Xóa showtime thất bại – Showtime đã bị xóa trước đó', async () => {
      const showtime = await seedShowtime(movieEnded);

      await dataSource.getRepository(Showtime).delete(showtime.id);

      const procedure = {
        params: {
          id: showtime.id,
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Xóa showtime thất bại do showtime đã bị xóa',
          description: 'Xóa showtime với id đã bị xóa khỏi hệ thống trước đó.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 404,
          preconditions: 'Showtime đã bị xóa trước khi gửi request.',
        },
        () =>
          request(server)
            .delete(`/showtimes/${showtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`),
        (response) => {
          expect(response.status).toBe(404);
          parseApiError(response);
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Xóa showtime thành công – Phim đã kết thúc', async () => {
      const showtime = await seedShowtime(movieEnded);

      const procedure = {
        params: {
          id: showtime.id,
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Xóa showtime thành công',
          description: 'Xóa showtime của phim đã kết thúc thời gian chiếu.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 204,
          preconditions:
            'Tài khoản admin đã đăng nhập thành công và phim của showtime đã kết thúc.',
        },
        () =>
          request(server)
            .delete(`/showtimes/${showtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`),
        async (response) => {
          expect(response.status).toBe(204);

          const deleted = await dataSource
            .getRepository(Showtime)
            .findOne({ where: { id: showtime.id } });

          expect(deleted).toBeNull();
        },
      );
    });
  });
});
