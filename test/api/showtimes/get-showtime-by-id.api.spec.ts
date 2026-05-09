import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { Server } from 'http';

import {
  parseApiData,
  parseApiError,
  expectErrorMessage,
} from '../../helpers/http-test.helper';
import { AppModule } from '../../../src/app.module';
import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import {
  Movie,
  MovieStatus,
  AgeRating,
} from '../../../src/modules/movies/entities/movie.entity';
import { Room } from '../../../src/modules/rooms/entities/room.entity';
import { Showtime } from '../../../src/modules/showtimes/entities/showtime.entity';
import { ShowtimeResponseDto } from '../../../src/modules/showtimes/dto/showtime-response.dto';

describe('[API] GET /showtimes/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let movie: Movie;
  let room: Room;
  let targetShowtime: Showtime;

  const results: TestCaseRecord[] = [];
  const PREFIX = 'GSD';
  let counter = 0;

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

    const movieRepo = dataSource.getRepository(Movie);
    const roomRepo = dataSource.getRepository(Room);
    const showtimeRepo = dataSource.getRepository(Showtime);

    movie = await movieRepo.save(
      movieRepo.create({
        title: 'GSD Movie',
        posterUrl: 'https://example.com/p.jpg',
        duration: 105,
        ageRating: AgeRating.P,
        status: MovieStatus.SHOWING,
        releaseDate: addDays(-1) as unknown as Date,
        endDate: addDays(365) as unknown as Date,
      }),
    );

    room = await roomRepo.save(roomRepo.create({ name: 'H1' }));

    const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
    startTime.setMilliseconds(0);

    const endTime = new Date(startTime.getTime() + movie.duration * 60 * 1000);

    targetShowtime = await showtimeRepo.save(
      showtimeRepo.create({
        movieId: movie.id,
        roomId: room.id,
        startTime,
        endTime,
        priceStandard: 75000,
        priceVip: 110000,
        priceCouple: 190000,
      }),
    );
  });

  afterAll(async () => {
    if (targetShowtime?.id) {
      await dataSource.getRepository(Showtime).delete(targetShowtime.id);
    }

    if (movie?.id) {
      await dataSource.getRepository(Movie).delete(movie.id);
    }

    if (room?.id) {
      await dataSource.getRepository(Room).delete(room.id);
    }

    await exportTestReport(results, PREFIX, 'Get_Showtime_By_Id');
    await app.close();
  });

  describe('Kiểm tra dữ liệu đầu vào', () => {
    it('Lấy showtime thất bại – Id không phải số nguyên', async () => {
      const procedure = {
        params: {
          id: 'abc',
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Lấy showtime thất bại do id không hợp lệ',
          description:
            'Lấy chi tiết showtime với id trên URL không phải là số nguyên.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 400,
          preconditions: 'Showtime cần lấy chi tiết đã tồn tại trong hệ thống.',
        },
        () => request(server).get('/showtimes/abc'),
        (response) => {
          expect(response.status).toBe(400);
          parseApiError(response);
        },
      );
    });
  });

  describe('Ràng buộc nghiệp vụ', () => {
    it('Lấy showtime thất bại – Showtime không tồn tại', async () => {
      const procedure = {
        params: {
          id: 999999,
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Lấy showtime thất bại do showtime không tồn tại',
          description:
            'Lấy chi tiết showtime với id không tồn tại trong hệ thống.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 404,
          preconditions:
            'Không có showtime nào trong hệ thống sử dụng id được gửi lên.',
        },
        () => request(server).get('/showtimes/999999'),
        (response) => {
          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'không tồn tại');
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Lấy showtime thành công – Không cần token', async () => {
      const procedure = {
        params: {
          id: targetShowtime.id,
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Lấy showtime thành công khi không cần token',
          description:
            'Lấy chi tiết showtime theo id hợp lệ mà không cần đăng nhập.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 200,
          preconditions: 'Showtime cần lấy chi tiết đã tồn tại trong hệ thống.',
        },
        () => request(server).get(`/showtimes/${targetShowtime.id}`),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto>(response);

          expect(data.id).toBe(targetShowtime.id);
          expect(data.movieId).toBe(movie.id);
          expect(data.movieTitle).toBe(movie.title);
          expect(data.roomId).toBe(room.id);
          expect(data.roomName).toBe(room.name);
          expect(data.priceStandard).toBe(75000);
          expect(data.priceVip).toBe(110000);
          expect(data.priceCouple).toBe(190000);
          expect(data.startTime).toBeDefined();
          expect(data.endTime).toBeDefined();
          expect(data.createdAt).toBeDefined();
          expect(data.updatedAt).toBeDefined();
        },
      );
    });
  });
});
