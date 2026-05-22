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
import {
  Showtime,
  ShowtimeStatus,
} from '../../../src/modules/showtimes/entities/showtime.entity';
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
    const seed = String(Date.now()).slice(-6);

    movie = await movieRepo.save(
      movieRepo.create({
        title: 'GSD ' + seed,
        slug: 'gsd-' + seed,
        posterUrl: 'https://example.com/p.jpg',
        duration: 105,
        ageRating: AgeRating.P,
        status: MovieStatus.SHOWING,
        releaseDate: addDays(-1) as unknown as Date,
        endDate: addDays(365) as unknown as Date,
      }),
    );

    room = await roomRepo.save(
      roomRepo.create({
        name: 'R' + seed,
      }),
    );

    const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
    startTime.setMilliseconds(0);

    const endTime = new Date(startTime.getTime() + movie.duration * 60 * 1000);

    targetShowtime = await showtimeRepo.save(
      showtimeRepo.create({
        movieId: movie.id,
        roomId: room.id,
        startTime,
        endTime,
        status: ShowtimeStatus.OPEN,
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

  describe('Phân quyền', () => {
    it('Lấy chi tiết thành công - Không cần Access Token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không gửi Header',
          description: 'Gọi API public mà không gửi Authorization header.',
          procedure: stringifyProcedure({
            params: {
              id: targetShowtime.id,
            },
          }),
          expectedResult: 200,
          preconditions: 'Có showtime',
        },
        () => request(server).get(`/showtimes/${targetShowtime.id}`),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto>(response);
          expect(data.id).toBe(targetShowtime.id);
        },
      );
    });

    it('Lấy chi tiết thành công - Gửi token giả', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi token giả',
          description: 'Gọi API public với Bearer token không hợp lệ.',
          procedure: stringifyProcedure({
            params: {
              id: targetShowtime.id,
            },
            token: 'Không hợp lệ',
          }),
          expectedResult: 200,
          preconditions: 'Có showtime',
        },
        () =>
          request(server)
            .get(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', 'Bearer fake.jwt.token'),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto>(response);
          expect(data.id).toBe(targetShowtime.id);
        },
      );
    });
  });

  describe('Kiểm tra dữ liệu đầu vào', () => {
    it('Lấy chi tiết thất bại - ID không phải số nguyên', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Sai định dạng ID',
          description: 'Gửi ID không thể parse sang số nguyên.',
          procedure: stringifyProcedure({
            params: {
              id: 'abc',
            },
          }),
          expectedResult: 400,
          preconditions: 'Không có',
        },
        () => request(server).get('/showtimes/abc'),
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
    it('Lấy chi tiết thất bại - Showtime không tồn tại', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi ID không tồn tại',
          description: 'Gửi ID không tồn tại trong hệ thống.',
          procedure: stringifyProcedure({
            params: {
              id: 999999,
            },
          }),
          expectedResult: 404,
          preconditions: 'Không có showtime',
        },
        () => request(server).get('/showtimes/999999'),
        (response) => {
          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Suất chiếu #999999 không tồn tại.');
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Lấy chi tiết thành công - Đúng dữ liệu', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Đúng dữ liệu',
          description: 'Gửi ID hợp lệ và kiểm tra dữ liệu trả về.',
          procedure: stringifyProcedure({
            params: {
              id: targetShowtime.id,
            },
          }),
          expectedResult: 200,
          preconditions: 'Có showtime',
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
          expect(data.status).toBe(ShowtimeStatus.OPEN);
          expect(data.priceStandard).toBe(75000);
          expect(data.priceVip).toBe(110000);
          expect(data.priceCouple).toBe(190000);
          expect(data.startTime).toBe(targetShowtime.startTime.toISOString());
          expect(data.endTime).toBe(targetShowtime.endTime.toISOString());
          expect(data.createdAt).toBeDefined();
          expect(data.updatedAt).toBeDefined();
        },
      );
    });

    it('Lấy chi tiết thành công - Kiểm tra response shape', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra response shape',
          description:
            'Kiểm tra response chỉ gồm các field của ShowtimeResponseDto.',
          procedure: stringifyProcedure({
            params: {
              id: targetShowtime.id,
            },
          }),
          expectedResult: 200,
          preconditions: 'Có showtime',
        },
        () => request(server).get(`/showtimes/${targetShowtime.id}`),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto>(response);

          expect(typeof data.id).toBe('number');
          expect(typeof data.movieId).toBe('number');
          expect(typeof data.movieTitle).toBe('string');
          expect(typeof data.roomId).toBe('number');
          expect(typeof data.roomName).toBe('string');
          expect(typeof data.startTime).toBe('string');
          expect(typeof data.endTime).toBe('string');
          expect(typeof data.status).toBe('string');
          expect(typeof data.priceStandard).toBe('number');
          expect(typeof data.priceVip).toBe('number');
          expect(
            typeof data.priceCouple === 'number' || data.priceCouple === null,
          ).toBe(true);
          expect(typeof data.createdAt).toBe('string');
          expect(typeof data.updatedAt).toBe('string');

          expect(Object.keys(data).sort()).toEqual([
            'createdAt',
            'endTime',
            'id',
            'movieId',
            'movieTitle',
            'priceCouple',
            'priceStandard',
            'priceVip',
            'roomId',
            'roomName',
            'startTime',
            'status',
            'updatedAt',
          ]);
        },
      );
    });
  });
});
