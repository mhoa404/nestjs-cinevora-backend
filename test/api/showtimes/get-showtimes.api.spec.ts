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
  const results: TestCaseRecord[] = [];
  const PREFIX = 'GST';
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

    movie1 = await movieRepo.save(
      movieRepo.create({
        title: 'GST Movie One',
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
        title: 'GST Movie Two',
        posterUrl: 'https://example.com/p.jpg',
        duration: 100,
        ageRating: AgeRating.C13,
        status: MovieStatus.SHOWING,
        releaseDate: addDays(-5) as unknown as Date,
        endDate: addDays(300) as unknown as Date,
      }),
    );

    room1 = await roomRepo.save(roomRepo.create({ name: 'G1' }));
    room2 = await roomRepo.save(roomRepo.create({ name: 'G2' }));

    const tomorrowUTC = new Date();
    tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);
    tomorrowUTC.setUTCHours(0, 0, 0, 0);

    targetDateStr = tomorrowUTC.toISOString().slice(0, 10);

    const t1 = new Date(`${targetDateStr}T10:00:00.000Z`);
    const t2 = new Date(`${targetDateStr}T14:00:00.000Z`);
    const nextDayStr = addDays(2);
    const t3 = new Date(`${nextDayStr}T09:00:00.000Z`);

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

    if (movie1?.id && movie2?.id) {
      await dataSource.getRepository(Movie).delete([movie1.id, movie2.id]);
    }

    if (room1?.id && room2?.id) {
      await dataSource.getRepository(Room).delete([room1.id, room2.id]);
    }

    await exportTestReport(results, PREFIX, 'Get_Showtimes');
    await app.close();
  });

  describe('Kiểm tra dữ liệu đầu vào', () => {
    it('Lấy danh sách showtime thất bại – movieId không phải số nguyên', async () => {
      const procedure = {
        query: {
          movieId: 'abc',
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Lấy danh sách showtime thất bại do movieId không hợp lệ',
          description:
            'Lấy danh sách showtime với movieId không phải là số nguyên.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 400,
          preconditions: 'Dữ liệu showtime đã tồn tại trong hệ thống.',
        },
        () => request(server).get('/showtimes?movieId=abc'),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'movieId');
        },
      );
    });

    it('Lấy danh sách showtime thất bại – roomId không phải số nguyên', async () => {
      const procedure = {
        query: {
          roomId: 'abc',
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Lấy danh sách showtime thất bại do roomId không hợp lệ',
          description:
            'Lấy danh sách showtime với roomId không phải là số nguyên.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 400,
          preconditions: 'Dữ liệu showtime đã tồn tại trong hệ thống.',
        },
        () => request(server).get('/showtimes?roomId=abc'),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'roomId');
        },
      );
    });

    it('Lấy danh sách showtime thất bại – Sai định dạng date', async () => {
      const procedure = {
        query: {
          date: '20-05-2026',
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Lấy danh sách showtime thất bại do sai định dạng ngày',
          description:
            'Lấy danh sách showtime với ngày lọc không đúng định dạng năm-tháng-ngày.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 400,
          preconditions: 'Dữ liệu showtime đã tồn tại trong hệ thống.',
        },
        () => request(server).get('/showtimes?date=20-05-2026'),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'date');
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Lấy danh sách showtime thành công – Không cần token', async () => {
      const procedure = {
        query: {},
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Lấy danh sách showtime thành công khi không cần token',
          description: 'Lấy danh sách showtime mà không cần gửi access token.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 200,
          preconditions: 'Dữ liệu showtime đã tồn tại trong hệ thống.',
        },
        () => request(server).get('/showtimes'),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto[]>(response);

          expect(Array.isArray(data)).toBe(true);
        },
      );
    });

    it('Lấy danh sách showtime thành công – Lọc theo movieId', async () => {
      const procedure = {
        query: {
          movieId: movie1.id,
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Lấy danh sách showtime thành công khi lọc theo phim',
          description: 'Lấy danh sách showtime theo mã phim hợp lệ.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 200,
          preconditions: 'Phim cần lọc đã có showtime trong hệ thống.',
        },
        () => request(server).get(`/showtimes?movieId=${movie1.id}`),
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

    it('Lấy danh sách showtime thành công – Lọc theo roomId', async () => {
      const procedure = {
        query: {
          roomId: room1.id,
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase:
            'Lấy danh sách showtime thành công khi lọc theo phòng chiếu',
          description: 'Lấy danh sách showtime theo mã phòng chiếu hợp lệ.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 200,
          preconditions: 'Phòng chiếu cần lọc đã có showtime trong hệ thống.',
        },
        () => request(server).get(`/showtimes?roomId=${room1.id}`),
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

    it('Lấy danh sách showtime thành công – Lọc theo ngày chiếu', async () => {
      const procedure = {
        query: {
          date: targetDateStr,
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Lấy danh sách showtime thành công khi lọc theo ngày chiếu',
          description: 'Lấy danh sách showtime theo ngày chiếu hợp lệ.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 200,
          preconditions:
            'Có hai showtime trong ngày cần lọc và một showtime ở ngày khác.',
        },
        () => request(server).get(`/showtimes?date=${targetDateStr}`),
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

    it('Lấy danh sách showtime thành công – Lọc kết hợp phim và ngày chiếu', async () => {
      const procedure = {
        query: {
          movieId: movie1.id,
          date: targetDateStr,
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase:
            'Lấy danh sách showtime thành công khi lọc theo phim và ngày chiếu',
          description:
            'Lấy danh sách showtime bằng cách kết hợp mã phim và ngày chiếu hợp lệ.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 200,
          preconditions:
            'Phim cần lọc có showtime trong ngày chiếu được gửi lên.',
        },
        () =>
          request(server).get(
            `/showtimes?movieId=${movie1.id}&date=${targetDateStr}`,
          ),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto[]>(response);

          expect(data.length).toBeGreaterThanOrEqual(2);
          expect(data.every((showtime) => showtime.movieId === movie1.id)).toBe(
            true,
          );
          expect(data.some((showtime) => showtime.id === stM2R1Day2.id)).toBe(
            false,
          );
        },
      );
    });

    it('Lấy danh sách showtime thành công – Trả về đúng cấu trúc dữ liệu', async () => {
      const procedure = {
        query: {
          movieId: movie1.id,
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase:
            'Lấy danh sách showtime thành công với cấu trúc dữ liệu hợp lệ',
          description:
            'Lấy danh sách showtime và kiểm tra response trả về đầy đủ các field quan trọng.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 200,
          preconditions: 'Phim cần lọc đã có showtime trong hệ thống.',
        },
        () => request(server).get(`/showtimes?movieId=${movie1.id}`),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto[]>(response);

          expect(data.length).toBeGreaterThan(0);

          const showtime = data[0];

          expect(typeof showtime.id).toBe('number');
          expect(typeof showtime.movieId).toBe('number');
          expect(typeof showtime.movieTitle).toBe('string');
          expect(typeof showtime.roomId).toBe('number');
          expect(typeof showtime.roomName).toBe('string');
          expect(showtime.startTime).toBeDefined();
          expect(showtime.endTime).toBeDefined();
          expect(typeof showtime.status).toBe('string');
          expect(typeof showtime.priceStandard).toBe('number');
          expect(typeof showtime.priceVip).toBe('number');
        },
      );
    });

    it('Lấy danh sách showtime thành công – Sắp xếp tăng dần theo thời gian chiếu', async () => {
      const procedure = {
        query: {
          movieId: movie1.id,
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Lấy danh sách showtime thành công và sắp xếp đúng thứ tự',
          description:
            'Lấy danh sách showtime và kiểm tra kết quả được sắp xếp tăng dần theo thời gian bắt đầu.',
          procedure: stringifyProcedure(procedure),
          expectedResult: 200,
          preconditions: 'Phim cần lọc có nhiều showtime trong hệ thống.',
        },
        () => request(server).get(`/showtimes?movieId=${movie1.id}`),
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
