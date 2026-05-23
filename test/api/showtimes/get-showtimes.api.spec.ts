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

describe('[API] GET /showtimes', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let movie1: Movie;
  let movie2: Movie;
  let room1: Room;
  let room2: Room;

  let stM1R1Day1: Showtime;
  let stM1R2Day1: Showtime;
  let stM2R1Day2: Showtime;

  let targetDateStr: string;

  const createdShowtimeIds: number[] = [];
  const createdMovieIds: number[] = [];
  const createdRoomIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'GST';
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
    const seed = Date.now();

    movie1 = await movieRepo.save(
      movieRepo.create({
        title: 'GST Movie One ' + seed,
        slug: 'gst-movie-one-' + seed,
        posterUrl: 'https://example.com/p.jpg',
        duration: 90,
        ageRating: AgeRating.P,
        status: MovieStatus.SHOWING,
        releaseDate: addDays(-5) as unknown as Date,
        endDate: addDays(300) as unknown as Date,
      }),
    );

    movie2 = await movieRepo.save(
      movieRepo.create({
        title: 'GST Movie Two ' + seed,
        slug: 'gst-movie-two-' + seed,
        posterUrl: 'https://example.com/p.jpg',
        duration: 100,
        ageRating: AgeRating.C13,
        status: MovieStatus.SHOWING,
        releaseDate: addDays(-5) as unknown as Date,
        endDate: addDays(300) as unknown as Date,
      }),
    );

    createdMovieIds.push(movie1.id, movie2.id);

    room1 = await roomRepo.save(roomRepo.create({ name: 'G1' + seed }));
    room2 = await roomRepo.save(roomRepo.create({ name: 'G2' + seed }));

    createdRoomIds.push(room1.id, room2.id);

    const tomorrowUTC = new Date();
    tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);
    tomorrowUTC.setUTCHours(0, 0, 0, 0);

    targetDateStr = tomorrowUTC.toISOString().slice(0, 10);

    const t1 = new Date(targetDateStr + 'T10:00:00.000Z');
    const t2 = new Date(targetDateStr + 'T14:00:00.000Z');
    const nextDayStr = addDays(2);
    const t3 = new Date(nextDayStr + 'T09:00:00.000Z');

    stM1R1Day1 = await showtimeRepo.save(
      showtimeRepo.create({
        movieId: movie1.id,
        roomId: room1.id,
        startTime: t1,
        endTime: new Date(t1.getTime() + movie1.duration * 60 * 1000),
        priceStandard: 80000,
        priceVip: 120000,
      }),
    );

    stM1R2Day1 = await showtimeRepo.save(
      showtimeRepo.create({
        movieId: movie1.id,
        roomId: room2.id,
        startTime: t2,
        endTime: new Date(t2.getTime() + movie1.duration * 60 * 1000),
        priceStandard: 80000,
        priceVip: 120000,
      }),
    );

    stM2R1Day2 = await showtimeRepo.save(
      showtimeRepo.create({
        movieId: movie2.id,
        roomId: room1.id,
        startTime: t3,
        endTime: new Date(t3.getTime() + movie2.duration * 60 * 1000),
        priceStandard: 90000,
        priceVip: 130000,
      }),
    );

    createdShowtimeIds.push(stM1R1Day1.id, stM1R2Day1.id, stM2R1Day2.id);
  });

  afterAll(async () => {
    if (createdShowtimeIds.length > 0) {
      await dataSource.getRepository(Showtime).delete(createdShowtimeIds);
    }

    if (createdMovieIds.length > 0) {
      await dataSource.getRepository(Movie).delete(createdMovieIds);
    }

    if (createdRoomIds.length > 0) {
      await dataSource.getRepository(Room).delete(createdRoomIds);
    }

    await exportTestReport(results, PREFIX, 'Get_Showtimes');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Lấy danh sách thành công - Không cần Access Token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không cần token',
          description: 'Gọi API public mà không gửi Authorization header.',
          procedure: stringifyProcedure('Không có'),
          expectedResult: 200,
          preconditions: 'Không có',
        },
        () => request(server).get('/showtimes'),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto[]>(response);
          expect(Array.isArray(data)).toBe(true);
        },
      );
    });

    it('Lấy danh sách thành công - Không validate token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi token không hợp lệ',
          description: 'Gọi API public với Bearer token không hợp lệ.',
          procedure: stringifyProcedure({
            token: 'Không hợp lệ',
          }),
          expectedResult: 200,
          preconditions: 'Không có',
        },
        () =>
          request(server)
            .get('/showtimes')
            .set('Authorization', 'Bearer fake.jwt.token'),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto[]>(response);
          expect(Array.isArray(data)).toBe(true);
        },
      );
    });
  });

  describe('Kiểm tra dữ liệu đầu vào', () => {
    it('Lấy danh sách thất bại - movieId không phải số nguyên', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'movieId không hợp lệ',
          description: 'Gửi movieId không phải số nguyên.',
          procedure: stringifyProcedure({
            query: {
              movieId: 'abc',
            },
          }),
          expectedResult: 400,
          preconditions: 'Không có',
        },
        () => request(server).get('/showtimes?movieId=abc'),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'movieId phải là số nguyên.');
        },
      );
    });

    it('Lấy danh sách thất bại - roomId không phải số nguyên', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'roomId không hợp lệ',
          description: 'Gửi roomId không phải số nguyên.',
          procedure: stringifyProcedure({
            query: {
              roomId: 'abc',
            },
          }),
          expectedResult: 400,
          preconditions: 'Không có',
        },
        () => request(server).get('/showtimes?roomId=abc'),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'roomId phải là số nguyên.');
        },
      );
    });

    it('Lấy danh sách thất bại - Sai định dạng date', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'date sai định dạng',
          description: 'Gửi date không đúng định dạng ISO date.',
          procedure: stringifyProcedure({
            query: {
              date: '20-05-2026',
            },
          }),
          expectedResult: 400,
          preconditions: 'Không có',
        },
        () => request(server).get('/showtimes?date=20-05-2026'),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'date sai định dạng.');
        },
      );
    });

    it('Lấy danh sách thất bại - Query không hợp lệ', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Query không hợp lệ',
          description: 'Gửi query không được định nghĩa trong DTO.',
          procedure: stringifyProcedure({
            query: {
              keyword: 'movie',
            },
          }),
          expectedResult: 400,
          preconditions: 'Không có',
        },
        () => request(server).get('/showtimes?keyword=movie'),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'property keyword should not exist');
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Lấy danh sách thành công - Lọc theo movieId', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Lọc theo phim',
          description: 'Gửi movieId hợp lệ.',
          procedure: stringifyProcedure({
            query: {
              movieId: movie1.id,
            },
          }),
          expectedResult: 200,
          preconditions: 'Có showtime theo phim',
        },
        () => request(server).get('/showtimes?movieId=' + movie1.id),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto[]>(response);

          expect(data.length).toBeGreaterThanOrEqual(2);
          expect(data.every((showtime) => showtime.movieId === movie1.id)).toBe(
            true,
          );
        },
      );
    });

    it('Lấy danh sách thành công - Lọc theo roomId', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Lọc theo phòng',
          description: 'Gửi roomId hợp lệ.',
          procedure: stringifyProcedure({
            query: {
              roomId: room1.id,
            },
          }),
          expectedResult: 200,
          preconditions: 'Có showtime theo phòng',
        },
        () => request(server).get('/showtimes?roomId=' + room1.id),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto[]>(response);

          expect(data.length).toBeGreaterThanOrEqual(2);
          expect(data.every((showtime) => showtime.roomId === room1.id)).toBe(
            true,
          );
        },
      );
    });

    it('Lấy danh sách thành công - Lọc theo date', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Lọc theo ngày chiếu',
          description: 'Gửi date hợp lệ.',
          procedure: stringifyProcedure({
            query: {
              date: targetDateStr,
            },
          }),
          expectedResult: 200,
          preconditions: 'Có showtime trong ngày',
        },
        () => request(server).get('/showtimes?date=' + targetDateStr),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto[]>(response);

          expect(data.some((showtime) => showtime.id === stM1R1Day1.id)).toBe(
            true,
          );
          expect(data.some((showtime) => showtime.id === stM1R2Day1.id)).toBe(
            true,
          );
          expect(data.some((showtime) => showtime.id === stM2R1Day2.id)).toBe(
            false,
          );
        },
      );
    });

    it('Lấy danh sách thành công - Lọc kết hợp phim, phòng và ngày chiếu', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Lọc kết hợp phim, phòng và ngày chiếu',
          description: 'Gửi đồng thời movieId, roomId và date hợp lệ.',
          procedure: stringifyProcedure({
            query: {
              movieId: movie1.id,
              roomId: room1.id,
              date: targetDateStr,
            },
          }),
          expectedResult: 200,
          preconditions: 'Có showtime khớp điều kiện',
        },
        () =>
          request(server).get(
            '/showtimes?movieId=' +
              movie1.id +
              '&roomId=' +
              room1.id +
              '&date=' +
              targetDateStr,
          ),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto[]>(response);

          expect(data.some((showtime) => showtime.id === stM1R1Day1.id)).toBe(
            true,
          );
          expect(data.some((showtime) => showtime.id === stM1R2Day1.id)).toBe(
            false,
          );
          expect(data.some((showtime) => showtime.id === stM2R1Day2.id)).toBe(
            false,
          );

          expect(
            data.every(
              (showtime) =>
                showtime.movieId === movie1.id &&
                showtime.roomId === room1.id &&
                showtime.startTime.startsWith(targetDateStr),
            ),
          ).toBe(true);
        },
      );
    });

    it('Lấy danh sách thành công - Không có dữ liệu phù hợp', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không có dữ liệu phù hợp',
          description: 'Gửi bộ lọc hợp lệ nhưng không có showtime khớp.',
          procedure: stringifyProcedure({
            query: {
              movieId: movie2.id,
              date: targetDateStr,
            },
            dữLiệu: 'Không có showtime khớp điều kiện',
          }),
          expectedResult: 200,
          preconditions: 'Không có showtime khớp điều kiện',
        },
        () =>
          request(server).get(
            '/showtimes?movieId=' + movie2.id + '&date=' + targetDateStr,
          ),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto[]>(response);
          expect(data).toEqual([]);
        },
      );
    });

    it('Lấy danh sách thành công - Kiểm tra response shape', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra response shape',
          description:
            'Kiểm tra response chỉ gồm các field của ShowtimeResponseDto.',
          procedure: stringifyProcedure({
            query: {
              movieId: movie1.id,
            },
          }),
          expectedResult: 200,
          preconditions: 'Có dữ liệu showtime',
        },
        () => request(server).get('/showtimes?movieId=' + movie1.id),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto[]>(response);
          const seededShowtimes = data.filter((showtime) =>
            [stM1R1Day1.id, stM1R2Day1.id].includes(showtime.id),
          );

          expect(seededShowtimes.length).toBe(2);

          seededShowtimes.forEach((showtime) => {
            expect(typeof showtime.id).toBe('number');
            expect(typeof showtime.movieId).toBe('number');
            expect(typeof showtime.movieTitle).toBe('string');
            expect(typeof showtime.roomId).toBe('number');
            expect(typeof showtime.roomName).toBe('string');
            expect(typeof showtime.startTime).toBe('string');
            expect(typeof showtime.endTime).toBe('string');
            expect(typeof showtime.status).toBe('string');
            expect(typeof showtime.priceStandard).toBe('number');
            expect(typeof showtime.priceVip).toBe('number');
            expect(
              typeof showtime.priceCouple === 'number' ||
                showtime.priceCouple === null,
            ).toBe(true);
            expect(typeof showtime.createdAt).toBe('string');
            expect(typeof showtime.updatedAt).toBe('string');

            expect(Object.keys(showtime).sort()).toEqual([
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
          });
        },
      );
    });

    it('Lấy danh sách thành công - Sắp xếp theo startTime ASC', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Sắp xếp theo startTime ASC',
          description: 'Kiểm tra kết quả được sắp xếp tăng dần theo startTime.',
          procedure: stringifyProcedure({
            query: {
              movieId: movie1.id,
            },
          }),
          expectedResult: 200,
          preconditions: 'Có nhiều showtime',
        },
        () => request(server).get('/showtimes?movieId=' + movie1.id),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto[]>(response);

          for (let index = 1; index < data.length; index += 1) {
            const previousStartTime = new Date(
              data[index - 1].startTime,
            ).getTime();
            const currentStartTime = new Date(data[index].startTime).getTime();

            expect(currentStartTime).toBeGreaterThanOrEqual(previousStartTime);
          }
        },
      );
    });
  });
});
