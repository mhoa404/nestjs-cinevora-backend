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
import { ShowtimeResponseDto } from '../../../src/modules/showtimes/dto/showtime-response.dto';

describe('[API] POST /showtimes', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let movieActive: Movie;
  let movieEnded: Movie;
  let room1: Room;
  let room2: Room;

  const createdShowtimeIds: number[] = [];
  const createdMovieIds: number[] = [];
  const results: TestCaseRecord[] = [];
  const PREFIX = 'CST';
  let counter = 0;

  const nextId = () => `${PREFIX}${String(++counter).padStart(2, '0')}`;

  const stringifyProcedure = (payload: unknown): string =>
    JSON.stringify(payload, null, 2);

  const getActualResult = (response?: Response): number => {
    return response?.status ?? 0;
  };

  const addHours = (h: number): string =>
    new Date(Date.now() + h * 60 * 60 * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, '.000Z');

  const addDays = (d: number): string => {
    const dt = new Date();
    dt.setDate(dt.getDate() + d);
    return dt.toISOString().slice(0, 10);
  };

  const buildValidBody = (overrides = {}) => ({
    movieId: movieActive.id,
    showtimes: [
      {
        roomId: room1.id,
        startTime: addHours(48),
        priceStandard: 80000,
        priceVip: 120000,
      },
    ],
    ...overrides,
  });

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

    const adminRes = await request(server)
      .post('/auth/mobile/login')
      .send({ email: 'api_tester@gmail.com', password: 'Api_tester_123' });
    adminToken = parseApiData<AuthResponseDto>(adminRes).accessToken;

    const customerRes = await request(server)
      .post('/auth/mobile/login')
      .send({ email: 'api_client@gmail.com', password: 'Api_client_123' });
    customerToken = parseApiData<AuthResponseDto>(customerRes).accessToken;

    const movieRepo = dataSource.getRepository(Movie);
    const roomRepo = dataSource.getRepository(Room);

    movieActive = await movieRepo.save(
      movieRepo.create({
        title: 'CST Active Movie',
        posterUrl: 'https://example.com/poster.jpg',
        duration: 120,
        ageRating: AgeRating.P,
        status: MovieStatus.SHOWING,
        releaseDate: addDays(0) as unknown as Date,
        endDate: addDays(365) as unknown as Date,
      }),
    );

    movieEnded = await movieRepo.save(
      movieRepo.create({
        title: 'CST Ended Movie',
        posterUrl: 'https://example.com/poster.jpg',
        duration: 90,
        ageRating: AgeRating.P,
        status: MovieStatus.ENDED,
        releaseDate: addDays(-30) as unknown as Date,
        endDate: addDays(-1) as unknown as Date,
      }),
    );

    room1 = await roomRepo.save(roomRepo.create({ name: 'C1' }));
    room2 = await roomRepo.save(roomRepo.create({ name: 'C2' }));
  });

  afterAll(async () => {
    if (createdShowtimeIds.length > 0) {
      await dataSource.getRepository(Showtime).delete(createdShowtimeIds);
    }

    const movieIds = [
      movieActive?.id,
      movieEnded?.id,
      ...createdMovieIds,
    ].filter(Boolean);

    if (movieIds.length > 0) {
      await dataSource.getRepository(Movie).delete(movieIds);
    }

    if (room1?.id && room2?.id) {
      await dataSource.getRepository(Room).delete([room1.id, room2.id]);
    }

    await exportTestReport(results, PREFIX, 'Create_Showtime');
    await app.close();
  });

  describe('Kiểm tra dữ liệu đầu vào', () => {
    it('Tạo showtime thất bại – Thiếu movieId', async () => {
      const body = {
        showtimes: [
          {
            roomId: room1.id,
            startTime: addHours(48),
            priceStandard: 80000,
            priceVip: 120000,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do thiếu mã phim',
          description: 'Tạo showtime khi không gửi mã phim trong request.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Tài khoản admin đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(400);
          parseApiError(res);
        },
      );
    });

    it('Tạo showtime thất bại – Thiếu showtimes', async () => {
      const body = {
        movieId: movieActive.id,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do thiếu danh sách suất chiếu',
          description:
            'Tạo showtime khi không gửi danh sách suất chiếu trong request.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Tài khoản admin đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(400);
          parseApiError(res);
        },
      );
    });

    it('Tạo showtime thất bại – Showtimes là mảng rỗng', async () => {
      const body = {
        movieId: movieActive.id,
        showtimes: [],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do không có suất chiếu',
          description: 'Tạo showtime với danh sách suất chiếu rỗng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Tài khoản admin đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(400);
          parseApiError(res);
        },
      );
    });

    it('Tạo showtime thất bại – Sai định dạng startTime', async () => {
      const body = {
        movieId: movieActive.id,
        showtimes: [
          {
            roomId: room1.id,
            startTime: '2026-05-10 09:00:00',
            priceStandard: 80000,
            priceVip: 120000,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do sai định dạng thời gian',
          description:
            'Tạo showtime với thời gian bắt đầu không đúng định dạng UTC ISO 8601.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Tài khoản admin đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(400);
          const err = parseApiError(res);
          expectErrorMessage(err, 400, 'startTime');
        },
      );
    });

    it('Tạo showtime thất bại – Giá vé tiêu chuẩn là số âm', async () => {
      const body = {
        movieId: movieActive.id,
        showtimes: [
          {
            roomId: room1.id,
            startTime: addHours(48),
            priceStandard: -1,
            priceVip: 120000,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do giá vé tiêu chuẩn không hợp lệ',
          description: 'Tạo showtime với giá vé tiêu chuẩn là số âm.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Tài khoản admin đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(400);
          const err = parseApiError(res);
          expectErrorMessage(err, 400, 'standard');
        },
      );
    });

    it('Tạo showtime thất bại – Trạng thái không hợp lệ', async () => {
      const body = {
        movieId: movieActive.id,
        showtimes: [
          {
            roomId: room1.id,
            startTime: addHours(48),
            priceStandard: 80000,
            priceVip: 120000,
            status: 'invalid',
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do trạng thái không hợp lệ',
          description:
            'Tạo showtime với trạng thái suất chiếu không nằm trong danh sách cho phép.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Tài khoản admin đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(400);
          const err = parseApiError(res);
          expectErrorMessage(err, 400, 'status');
        },
      );
    });

    it('Tạo showtime thất bại – Gửi field không hợp lệ', async () => {
      const body = {
        ...buildValidBody(),
        extraField: 'hack',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do gửi field không hợp lệ',
          description: 'Tạo showtime với field không được khai báo trong DTO.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'ValidationPipe đang bật forbidNonWhitelisted.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(400);
          parseApiError(res);
        },
      );
    });
  });

  describe('Phân quyền', () => {
    it('Tạo showtime thất bại – Thiếu token', async () => {
      const body = buildValidBody();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do thiếu token',
          description: 'Tạo showtime khi chưa đăng nhập bằng tài khoản admin.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không gửi access token trong request.',
        },
        () => request(server).post('/showtimes').send(body),
        (res) => {
          expect(res.status).toBe(401);
        },
      );
    });

    it('Tạo showtime thất bại – Token không hợp lệ', async () => {
      const body = buildValidBody();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do token không hợp lệ',
          description: 'Tạo showtime với access token không hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Request gửi kèm Bearer token giả.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', 'Bearer fake.jwt.token')
            .send(body),
        (res) => {
          expect(res.status).toBe(401);
        },
      );
    });

    it('Tạo showtime thất bại – Tài khoản không đủ quyền', async () => {
      const body = buildValidBody();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do không đủ quyền',
          description: 'Tạo showtime bằng tài khoản khách hàng thông thường.',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: 'Tài khoản customer đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${customerToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(403);
        },
      );
    });
  });

  describe('Ràng buộc nghiệp vụ', () => {
    it('Tạo showtime thất bại – Phim không tồn tại', async () => {
      const body = {
        movieId: 999999,
        showtimes: [
          {
            roomId: room1.id,
            startTime: addHours(48),
            priceStandard: 80000,
            priceVip: 120000,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do phim không tồn tại',
          description: 'Tạo showtime với mã phim không tồn tại trong hệ thống.',
          procedure: stringifyProcedure(body),
          expectedResult: 404,
          preconditions: 'Tài khoản admin đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(404);
        },
      );
    });

    it('Tạo showtime thất bại – Phòng chiếu không tồn tại', async () => {
      const body = {
        movieId: movieActive.id,
        showtimes: [
          {
            roomId: 999999,
            startTime: addHours(48),
            priceStandard: 80000,
            priceVip: 120000,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do phòng chiếu không tồn tại',
          description:
            'Tạo showtime với mã phòng chiếu không tồn tại trong hệ thống.',
          procedure: stringifyProcedure(body),
          expectedResult: 404,
          preconditions: 'Tài khoản admin đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(404);
        },
      );
    });

    it('Tạo showtime thất bại – Phim đã kết thúc', async () => {
      const body = {
        movieId: movieEnded.id,
        showtimes: [
          {
            roomId: room1.id,
            startTime: addHours(48),
            priceStandard: 80000,
            priceVip: 120000,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do phim đã kết thúc',
          description: 'Tạo showtime cho phim đã kết thúc thời gian chiếu.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions:
            'Phim có trạng thái đã kết thúc đã tồn tại trong hệ thống.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(409);
          const err = parseApiError(res);
          expectErrorMessage(err, 409, 'kết thúc');
        },
      );
    });

    it('Tạo showtime thất bại – Thời gian chiếu trong quá khứ', async () => {
      const pastTime = new Date(Date.now() - 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z');

      const body = {
        movieId: movieActive.id,
        showtimes: [
          {
            roomId: room1.id,
            startTime: pastTime,
            priceStandard: 80000,
            priceVip: 120000,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do thời gian chiếu trong quá khứ',
          description:
            'Tạo showtime với thời gian bắt đầu nhỏ hơn thời điểm hiện tại.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Tài khoản admin đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(409);
          const err = parseApiError(res);
          expectErrorMessage(err, 409, 'quá khứ');
        },
      );
    });

    it('Tạo showtime thất bại – Trước ngày khởi chiếu của phim', async () => {
      const movieRepo = dataSource.getRepository(Movie);
      const futureMovie = await movieRepo.save(
        movieRepo.create({
          title: 'CST Future Release Movie',
          posterUrl: 'https://example.com/poster.jpg',
          duration: 90,
          ageRating: AgeRating.P,
          status: MovieStatus.COMING,
          releaseDate: addDays(10) as unknown as Date,
          endDate: addDays(100) as unknown as Date,
        }),
      );

      createdMovieIds.push(futureMovie.id);

      const body = {
        movieId: futureMovie.id,
        showtimes: [
          {
            roomId: room1.id,
            startTime: addHours(120),
            priceStandard: 80000,
            priceVip: 120000,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do trước ngày khởi chiếu',
          description:
            'Tạo showtime có thời gian bắt đầu trước ngày khởi chiếu của phim.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions:
            'Phim có ngày khởi chiếu sau thời gian bắt đầu của showtime.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(409);
          const err = parseApiError(res);
          expectErrorMessage(err, 409, 'khởi chiếu');
        },
      );
    });

    it('Tạo showtime thất bại – Sau ngày kết thúc chiếu của phim', async () => {
      const movieRepo = dataSource.getRepository(Movie);
      const shortMovie = await movieRepo.save(
        movieRepo.create({
          title: 'CST Short Run Movie',
          posterUrl: 'https://example.com/poster.jpg',
          duration: 60,
          ageRating: AgeRating.P,
          status: MovieStatus.SHOWING,
          releaseDate: addDays(-5) as unknown as Date,
          endDate: addDays(1) as unknown as Date,
        }),
      );

      createdMovieIds.push(shortMovie.id);

      const body = {
        movieId: shortMovie.id,
        showtimes: [
          {
            roomId: room1.id,
            startTime: addHours(300),
            priceStandard: 80000,
            priceVip: 120000,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do sau ngày kết thúc chiếu',
          description:
            'Tạo showtime có thời gian bắt đầu sau ngày kết thúc chiếu của phim.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions:
            'Phim có ngày kết thúc chiếu trước thời gian bắt đầu của showtime.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(409);
          const err = parseApiError(res);
          expectErrorMessage(err, 409, 'kết thúc chiếu');
        },
      );
    });

    it('Tạo showtime thất bại – Trùng lịch chiếu trong cùng phòng', async () => {
      const showtimeRepo = dataSource.getRepository(Showtime);
      const baseTime = new Date(Date.now() + 72 * 60 * 60 * 1000);
      baseTime.setMilliseconds(0);

      const endTime = new Date(baseTime.getTime() + 120 * 60 * 1000);

      const existing = await showtimeRepo.save(
        showtimeRepo.create({
          movieId: movieActive.id,
          roomId: room1.id,
          startTime: baseTime,
          endTime,
          priceStandard: 80000,
          priceVip: 120000,
        }),
      );

      createdShowtimeIds.push(existing.id);

      const overlapStart = new Date(baseTime.getTime() + 2 * 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z');

      const body = {
        movieId: movieActive.id,
        showtimes: [
          {
            roomId: room1.id,
            startTime: overlapStart,
            priceStandard: 80000,
            priceVip: 120000,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do trùng lịch chiếu',
          description:
            'Tạo showtime trong cùng phòng chiếu và bị trùng với lịch chiếu đã tồn tại.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions:
            'Phòng chiếu đã có một showtime trong khung giờ gần với thời gian gửi lên.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(409);
          const err = parseApiError(res);
          expectErrorMessage(err, 409, 'trùng lịch');
        },
      );
    });

    it('Tạo showtime thất bại – Các suất chiếu trong request bị trùng nhau', async () => {
      const t1 = addHours(96);
      const t2 = new Date(new Date(t1).getTime() + 2 * 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z');

      const body = {
        movieId: movieActive.id,
        showtimes: [
          {
            roomId: room2.id,
            startTime: t1,
            priceStandard: 80000,
            priceVip: 120000,
          },
          {
            roomId: room2.id,
            startTime: t2,
            priceStandard: 80000,
            priceVip: 120000,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thất bại do các suất chiếu bị trùng nhau',
          description:
            'Tạo nhiều showtime trong cùng một request nhưng các suất chiếu bị trùng khung giờ trong cùng phòng.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Tài khoản admin đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(409);
          const err = parseApiError(res);
          expectErrorMessage(err, 409, 'trùng');
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Tạo showtime thành công – Tạo một suất chiếu', async () => {
      const startTime = addHours(200);

      const body = {
        movieId: movieActive.id,
        showtimes: [
          {
            roomId: room1.id,
            startTime,
            priceStandard: 80000,
            priceVip: 120000,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thành công',
          description:
            'Tạo một showtime với phim, phòng chiếu, thời gian chiếu và giá vé hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions:
            'Tài khoản admin đã đăng nhập, phim và phòng chiếu đã tồn tại.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(201);

          const data = parseApiData<ShowtimeResponseDto[]>(res);

          expect(Array.isArray(data)).toBe(true);
          expect(data).toHaveLength(1);

          const st = data[0];

          expect(st.id).toBeDefined();
          expect(st.movieId).toBe(movieActive.id);
          expect(st.roomId).toBe(room1.id);
          expect(st.startTime).toBeDefined();
          expect(st.endTime).toBeDefined();
          expect(st.status).toBe('open');
          expect(st.priceStandard).toBe(80000);
          expect(st.priceVip).toBe(120000);
          expect(st.priceCouple).toBeNull();

          createdShowtimeIds.push(st.id);
        },
      );
    });

    it('Tạo showtime thành công – Tạo nhiều suất chiếu ở nhiều phòng', async () => {
      const t1 = addHours(210);
      const t2 = addHours(220);

      const body = {
        movieId: movieActive.id,
        showtimes: [
          {
            roomId: room1.id,
            startTime: t1,
            priceStandard: 80000,
            priceVip: 120000,
          },
          {
            roomId: room2.id,
            startTime: t2,
            priceStandard: 90000,
            priceVip: 130000,
            priceCouple: 200000,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo nhiều showtime thành công',
          description:
            'Tạo hai showtime hợp lệ cho hai phòng chiếu khác nhau trong cùng một request.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions:
            'Tài khoản admin đã đăng nhập, phim và các phòng chiếu đã tồn tại.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(201);

          const data = parseApiData<ShowtimeResponseDto[]>(res);

          expect(data).toHaveLength(2);
          expect(data[0].roomId).toBe(room1.id);
          expect(data[1].roomId).toBe(room2.id);
          expect(data[1].priceCouple).toBe(200000);

          data.forEach((st) => createdShowtimeIds.push(st.id));
        },
      );
    });

    it('Tạo showtime thành công – Tạo suất chiếu đã bán hết', async () => {
      const startTime = addHours(230);

      const body = {
        movieId: movieActive.id,
        showtimes: [
          {
            roomId: room2.id,
            startTime,
            status: 'sold_out',
            priceStandard: 80000,
            priceVip: 120000,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime đã bán hết thành công',
          description: 'Tạo showtime hợp lệ với trạng thái đã bán hết.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions:
            'Tài khoản admin đã đăng nhập, phim và phòng chiếu đã tồn tại.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(201);

          const data = parseApiData<ShowtimeResponseDto[]>(res);

          expect(data[0].status).toBe('sold_out');
          data.forEach((st) => createdShowtimeIds.push(st.id));
        },
      );
    });

    it('Tạo showtime thành công – Tự tính giờ kết thúc theo phim', async () => {
      const startTime = addHours(240);

      const body = {
        movieId: movieActive.id,
        showtimes: [
          {
            roomId: room1.id,
            startTime,
            priceStandard: 80000,
            priceVip: 120000,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo showtime thành công và tự tính giờ kết thúc',
          description:
            'Tạo showtime hợp lệ và hệ thống tự tính thời gian kết thúc dựa trên thời lượng phim.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions:
            'Phim có thời lượng 120 phút đã tồn tại trong hệ thống.',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (res) => {
          expect(res.status).toBe(201);

          const data = parseApiData<ShowtimeResponseDto[]>(res);
          const st = data[0];

          const diffMs =
            new Date(st.endTime).getTime() - new Date(st.startTime).getTime();

          expect(diffMs).toBe(120 * 60 * 1000);

          createdShowtimeIds.push(st.id);
        },
      );
    });
  });
});
