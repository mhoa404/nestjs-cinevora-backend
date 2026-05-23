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
import {
  Showtime,
  ShowtimeStatus,
} from '../../../src/modules/showtimes/entities/showtime.entity';
import { ShowtimeResponseDto } from '../../../src/modules/showtimes/dto/showtime-response.dto';

type ShowtimeItemBody = {
  roomId?: unknown;
  startTime?: unknown;
  status?: unknown;
  priceStandard?: unknown;
  priceVip?: unknown;
  priceCouple?: unknown;
  extraField?: unknown;
};

type CreateShowtimeBody = {
  movieId?: unknown;
  showtimes?: unknown;
  extraField?: unknown;
};

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
  const createdRoomIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'CST';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return PREFIX + String(counter).padStart(2, '0');
  };

  const stringifyProcedure = (payload: unknown): string =>
    typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);

  const getActualResult = (response?: Response): number =>
    response?.status ?? 0;

  const addHours = (hours: number): string =>
    new Date(Date.now() + hours * 60 * 60 * 1000)
      .toISOString()
      .replace(/.\d{3}Z$/, '.000Z');

  const addDays = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);

    return date.toISOString().slice(0, 10);
  };

  const buildItem = (
    overrides: Partial<ShowtimeItemBody> = {},
  ): ShowtimeItemBody => ({
    roomId: room1.id,
    startTime: addHours(48),
    priceStandard: 80000,
    priceVip: 120000,
    ...overrides,
  });

  const buildValidBody = (
    overrides: Partial<CreateShowtimeBody> = {},
  ): CreateShowtimeBody => ({
    movieId: movieActive.id,
    showtimes: [buildItem()],
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

  const postShowtimes = (
    body: CreateShowtimeBody | Record<string, unknown>,
    token = adminToken,
  ): Promise<Response> =>
    request(server)
      .post('/showtimes')
      .set('Authorization', 'Bearer ' + token)
      .send(body);

  const rememberShowtimes = (showtimes: ShowtimeResponseDto[]): void => {
    showtimes.forEach((showtime) => {
      if (typeof showtime.id === 'number') {
        createdShowtimeIds.push(showtime.id);
      }
    });
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
        title: 'CST A ' + seed,
        slug: 'cst-a-' + seed,
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
        title: 'CST E ' + seed,
        slug: 'cst-e-' + seed,
        posterUrl: 'https://example.com/poster.jpg',
        duration: 90,
        ageRating: AgeRating.P,
        status: MovieStatus.ENDED,
        releaseDate: addDays(-30) as unknown as Date,
        endDate: addDays(-1) as unknown as Date,
      }),
    );

    room1 = await roomRepo.save(
      roomRepo.create({
        name: 'S' + seed + 'A',
      }),
    );

    room2 = await roomRepo.save(
      roomRepo.create({
        name: 'S' + seed + 'B',
      }),
    );

    createdMovieIds.push(movieActive.id, movieEnded.id);
    createdRoomIds.push(room1.id, room2.id);
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

    await cleanupRefreshTokens(dataSource);

    await exportTestReport(results, PREFIX, 'Create_Showtime');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Tạo thất bại - Không truyền Authorization Token trả về đúng message', async () => {
      const body = buildValidBody();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không truyền token',
          description: 'Không gửi access token khi tạo suất chiếu.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không có token',
        },
        () => request(server).post('/showtimes').send(body),
        (response) => {
          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');
        },
      );
    });

    it('Tạo thất bại - Truyền Fake Token trả về đúng message', async () => {
      const body = buildValidBody();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Token không hợp lệ',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: stringifyProcedure({
            body,
            token: 'Không hợp lệ',
          }),
          expectedResult: 401,
          preconditions: 'Token giả',
        },
        () =>
          request(server)
            .post('/showtimes')
            .set('Authorization', 'Bearer fake.jwt.token')
            .send(body),
        (response) => {
          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');
        },
      );
    });

    it('Tạo thất bại - Role Customer bị chặn trả về đúng message', async () => {
      const body = buildValidBody();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Customer không có quyền',
          description: 'Tài khoản Customer cố tạo suất chiếu.',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: 'Token Customer',
        },
        () => postShowtimes(body, customerToken),
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

  describe('Validation Payload', () => {
    it('Tạo thất bại - Thiếu movieId trả về đúng message', async () => {
      const body: CreateShowtimeBody = {
        showtimes: [buildItem()],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu mã phim',
          description: 'Không gửi movieId trong body.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng chọn phim.');
        },
      );
    });

    it('Tạo thất bại - movieId không phải số nguyên', async () => {
      const body = buildValidBody({
        movieId: 'abc',
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'movieId không hợp lệ',
          description: 'Gửi movieId không phải số nguyên.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'movieId phải là số nguyên.');
        },
      );
    });

    it('Tạo thất bại - Thiếu showtimes trả về đúng message', async () => {
      const body: CreateShowtimeBody = {
        movieId: movieActive.id,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu danh sách suất chiếu',
          description: 'Không gửi showtimes trong body.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng nhập danh sách suất chiếu.');
        },
      );
    });

    it('Tạo thất bại - showtimes không phải mảng', async () => {
      const body: CreateShowtimeBody = {
        movieId: movieActive.id,
        showtimes: {
          roomId: room1.id,
          startTime: addHours(48),
          priceStandard: 80000,
          priceVip: 120000,
        },
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'showtimes không phải mảng',
          description: 'Gửi showtimes dưới dạng object.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'showtimes phải là một mảng.');
        },
      );
    });

    it('Tạo thất bại - Showtimes là mảng rỗng', async () => {
      const body: CreateShowtimeBody = {
        movieId: movieActive.id,
        showtimes: [],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Danh sách rỗng',
          description: 'Gửi showtimes là mảng rỗng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Phải có ít nhất 1 suất chiếu.');
        },
      );
    });

    it('Tạo thất bại - Thiếu roomId trả về đúng message', async () => {
      const body = buildValidBody({
        showtimes: [
          {
            startTime: addHours(48),
            priceStandard: 80000,
            priceVip: 120000,
          },
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu phòng chiếu',
          description: 'Không gửi roomId trong item showtimes.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng chọn phòng chiếu.');
        },
      );
    });

    it('Tạo thất bại - roomId không phải số nguyên', async () => {
      const body = buildValidBody({
        showtimes: [
          buildItem({
            roomId: 'abc',
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'roomId không hợp lệ',
          description: 'Gửi roomId không phải số nguyên.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'roomId phải là số nguyên.');
        },
      );
    });

    it('Tạo thất bại - Thiếu startTime trả về đúng message', async () => {
      const body = buildValidBody({
        showtimes: [
          {
            roomId: room1.id,
            priceStandard: 80000,
            priceVip: 120000,
          },
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu thời gian bắt đầu',
          description: 'Không gửi startTime trong item showtimes.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng nhập thời gian bắt đầu.');
        },
      );
    });

    it('Tạo thất bại - Sai định dạng startTime', async () => {
      const body = buildValidBody({
        showtimes: [
          buildItem({
            startTime: '2026-05-10 09:00:00',
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'startTime sai định dạng',
          description: 'Gửi startTime không đúng ISO 8601 UTC.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'startTime phải là ISO 8601 UTC');
        },
      );
    });

    it('Tạo thất bại - Thiếu giá standard trả về đúng message', async () => {
      const body = buildValidBody({
        showtimes: [
          {
            roomId: room1.id,
            startTime: addHours(48),
            priceVip: 120000,
          },
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu giá standard',
          description: 'Không gửi priceStandard trong item showtimes.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng nhập giá vé standard.');
        },
      );
    });

    it('Tạo thất bại - Giá vé standard là số âm', async () => {
      const body = buildValidBody({
        showtimes: [
          buildItem({
            priceStandard: -1,
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Giá standard âm',
          description: 'Gửi priceStandard nhỏ hơn 0.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Giá vé standard phải >= 0.');
        },
      );
    });

    it('Tạo thất bại - Thiếu giá VIP trả về đúng message', async () => {
      const body = buildValidBody({
        showtimes: [
          {
            roomId: room1.id,
            startTime: addHours(48),
            priceStandard: 80000,
          },
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu giá VIP',
          description: 'Không gửi priceVip trong item showtimes.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng nhập giá vé VIP.');
        },
      );
    });

    it('Tạo thất bại - Giá vé VIP là số âm', async () => {
      const body = buildValidBody({
        showtimes: [
          buildItem({
            priceVip: -1,
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Giá VIP âm',
          description: 'Gửi priceVip nhỏ hơn 0.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Giá vé VIP phải >= 0.');
        },
      );
    });

    it('Tạo thất bại - Giá vé couple là số âm', async () => {
      const body = buildValidBody({
        showtimes: [
          buildItem({
            priceCouple: -1,
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Giá couple âm',
          description: 'Gửi priceCouple nhỏ hơn 0.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Giá vé couple phải >= 0.');
        },
      );
    });

    it('Tạo thất bại - Trạng thái không hợp lệ', async () => {
      const body = buildValidBody({
        showtimes: [
          buildItem({
            status: 'closed',
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Trạng thái không hợp lệ',
          description: 'Gửi status ngoài enum cho phép.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'status phải là open hoặc sold_out.');
        },
      );
    });

    it('Tạo thất bại - Gửi field không hợp lệ ở body', async () => {
      const body = buildValidBody({
        extraField: 'hack',
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Body dư field',
          description: 'Gửi field không được khai báo trong CreateShowtimeDto.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'property extraField should not exist',
          );
        },
      );
    });

    it('Tạo thất bại - Gửi field không hợp lệ ở item', async () => {
      const body = buildValidBody({
        showtimes: [
          buildItem({
            extraField: 'hack',
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Item dư field',
          description: 'Gửi field không được khai báo trong ShowtimeItemDto.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'property extraField should not exist',
          );
        },
      );
    });
  });

  describe('Ràng buộc nghiệp vụ', () => {
    it('Tạo thất bại - Phim không tồn tại', async () => {
      const body = buildValidBody({
        movieId: 999999,
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Phim không tồn tại',
          description: 'Gửi movieId không tồn tại trong hệ thống.',
          procedure: stringifyProcedure(body),
          expectedResult: 404,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Phim #999999 không tồn tại.');
        },
      );
    });

    it('Tạo thất bại - Phòng chiếu không tồn tại', async () => {
      const body = buildValidBody({
        showtimes: [
          buildItem({
            roomId: 999999,
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Phòng không tồn tại',
          description: 'Gửi roomId không tồn tại trong hệ thống.',
          procedure: stringifyProcedure(body),
          expectedResult: 404,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Phòng chiếu #999999 không tồn tại.');
        },
      );
    });

    it('Tạo thất bại - Phim đã kết thúc', async () => {
      const body = buildValidBody({
        movieId: movieEnded.id,
        showtimes: [
          buildItem({
            startTime: addHours(48),
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Phim đã kết thúc',
          description: 'Gửi movieId của phim có status ended.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Phim đã kết thúc',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            409,
            'Không thể tạo suất chiếu cho phim đã kết thúc.',
          );
        },
      );
    });

    it('Tạo thất bại - Thời gian chiếu trong quá khứ', async () => {
      const startTime = addHours(-24);
      const body = buildValidBody({
        showtimes: [
          buildItem({
            startTime,
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thời gian quá khứ',
          description: 'Gửi startTime nhỏ hơn thời gian hiện tại.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            409,
            'Không thể tạo hoặc cập nhật suất chiếu trong quá khứ',
          );
        },
      );
    });

    it('Tạo thất bại - Trước ngày khởi chiếu của phim', async () => {
      const movieRepo = dataSource.getRepository(Movie);
      const seed = String(Date.now()).slice(-6);

      const futureMovie = await movieRepo.save(
        movieRepo.create({
          title: 'CST F ' + seed,
          slug: 'cst-f-' + seed,
          posterUrl: 'https://example.com/poster.jpg',
          duration: 120,
          ageRating: AgeRating.P,
          status: MovieStatus.SHOWING,
          releaseDate: addDays(10) as unknown as Date,
          endDate: addDays(365) as unknown as Date,
        }),
      );

      createdMovieIds.push(futureMovie.id);

      const body = buildValidBody({
        movieId: futureMovie.id,
        showtimes: [
          buildItem({
            startTime: addHours(48),
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Trước ngày khởi chiếu',
          description: 'Gửi startTime trước releaseDate của phim.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Phim chưa khởi chiếu',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            409,
            'Không thể tạo hoặc cập nhật suất chiếu trước ngày khởi chiếu của phim.',
          );
        },
      );
    });

    it('Tạo thất bại - Sau ngày kết thúc chiếu của phim', async () => {
      const movieRepo = dataSource.getRepository(Movie);
      const seed = String(Date.now()).slice(-6);

      const endedRangeMovie = await movieRepo.save(
        movieRepo.create({
          title: 'CST R ' + seed,
          slug: 'cst-r-' + seed,
          posterUrl: 'https://example.com/poster.jpg',
          duration: 120,
          ageRating: AgeRating.P,
          status: MovieStatus.SHOWING,
          releaseDate: addDays(-10) as unknown as Date,
          endDate: addDays(1) as unknown as Date,
        }),
      );

      createdMovieIds.push(endedRangeMovie.id);

      const body = buildValidBody({
        movieId: endedRangeMovie.id,
        showtimes: [
          buildItem({
            startTime: addHours(72),
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Sau ngày kết thúc',
          description: 'Gửi startTime sau endDate của phim.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Quá hạn chiếu',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            409,
            'Không thể tạo hoặc cập nhật suất chiếu sau ngày kết thúc chiếu của phim.',
          );
        },
      );
    });

    it('Tạo thất bại - Trùng lịch chiếu trong cùng phòng', async () => {
      const showtimeRepo = dataSource.getRepository(Showtime);
      const startTime = new Date(addHours(96));
      const endTime = new Date(startTime.getTime() + 120 * 60 * 1000);

      const existingShowtime = await showtimeRepo.save(
        showtimeRepo.create({
          movieId: movieActive.id,
          roomId: room1.id,
          startTime,
          endTime,
          status: ShowtimeStatus.OPEN,
          priceStandard: 80000,
          priceVip: 120000,
        }),
      );

      createdShowtimeIds.push(existingShowtime.id);

      const overlapStart = new Date(startTime.getTime() + 120 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z');

      const body = buildValidBody({
        showtimes: [
          buildItem({
            roomId: room1.id,
            startTime: overlapStart,
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Trùng lịch phòng',
          description: 'Tạo suất chiếu trong buffer 30 phút của cùng phòng.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Phòng đã có lịch',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            409,
            `Phòng #${room1.id} bị trùng lịch chiếu lúc`,
          );
        },
      );
    });

    it('Tạo thất bại - Các suất chiếu trong request bị trùng nhau', async () => {
      const firstStartTime = addHours(120);
      const secondStartTime = new Date(
        new Date(firstStartTime).getTime() + 120 * 60 * 1000,
      )
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z');

      const body = buildValidBody({
        showtimes: [
          buildItem({
            roomId: room2.id,
            startTime: firstStartTime,
          }),
          buildItem({
            roomId: room2.id,
            startTime: secondStartTime,
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Trùng lịch trong request',
          description: 'Gửi nhiều item bị trùng buffer trong cùng phòng.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            409,
            `Danh sách suất chiếu bị trùng phòng #${room2.id}`,
          );
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Tạo thành công - Một suất chiếu', async () => {
      const startTime = addHours(200);
      const body = buildValidBody({
        showtimes: [
          buildItem({
            roomId: room1.id,
            startTime,
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Một suất chiếu',
          description: 'Tạo một suất chiếu hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Token Admin, đủ dữ liệu',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(201);

          const data = parseApiData<ShowtimeResponseDto[]>(response);

          expect(Array.isArray(data)).toBe(true);
          expect(data).toHaveLength(1);

          const showtime = data[0];

          expect(showtime.id).toBeDefined();
          expect(showtime.movieId).toBe(movieActive.id);
          expect(showtime.movieTitle).toBe(movieActive.title);
          expect(showtime.roomId).toBe(room1.id);
          expect(showtime.roomName).toBe(room1.name);
          expect(showtime.startTime).toBe(startTime);
          expect(showtime.status).toBe(ShowtimeStatus.OPEN);
          expect(showtime.priceStandard).toBe(80000);
          expect(showtime.priceVip).toBe(120000);
          expect(showtime.priceCouple).toBeNull();

          rememberShowtimes(data);
        },
      );
    });

    it('Tạo thành công - Nhiều suất chiếu', async () => {
      const firstStartTime = addHours(220);
      const secondStartTime = addHours(230);

      const body = buildValidBody({
        showtimes: [
          buildItem({
            roomId: room1.id,
            startTime: firstStartTime,
          }),
          buildItem({
            roomId: room2.id,
            startTime: secondStartTime,
            priceStandard: 90000,
            priceVip: 130000,
            priceCouple: 200000,
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Nhiều suất chiếu',
          description: 'Tạo nhiều suất chiếu hợp lệ trong cùng request.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Token Admin, đủ dữ liệu',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(201);

          const data = parseApiData<ShowtimeResponseDto[]>(response);

          expect(data).toHaveLength(2);
          expect(data[0].roomId).toBe(room1.id);
          expect(data[0].priceCouple).toBeNull();
          expect(data[1].roomId).toBe(room2.id);
          expect(data[1].priceStandard).toBe(90000);
          expect(data[1].priceVip).toBe(130000);
          expect(data[1].priceCouple).toBe(200000);

          rememberShowtimes(data);
        },
      );
    });

    it('Tạo thành công - Trạng thái sold_out', async () => {
      const startTime = addHours(240);
      const body = buildValidBody({
        showtimes: [
          buildItem({
            roomId: room2.id,
            startTime,
            status: ShowtimeStatus.SOLD_OUT,
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Trạng thái sold_out',
          description: 'Tạo suất chiếu với status sold_out.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Token Admin, đủ dữ liệu',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(201);

          const data = parseApiData<ShowtimeResponseDto[]>(response);

          expect(data).toHaveLength(1);
          expect(data[0].status).toBe(ShowtimeStatus.SOLD_OUT);

          rememberShowtimes(data);
        },
      );
    });

    it('Tạo thành công - Tự tính giờ kết thúc', async () => {
      const startTime = addHours(260);
      const body = buildValidBody({
        showtimes: [
          buildItem({
            roomId: room1.id,
            startTime,
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tự tính giờ kết thúc',
          description: 'Kiểm tra endTime được tính theo duration của phim.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Token Admin',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(201);

          const data = parseApiData<ShowtimeResponseDto[]>(response);
          const showtime = data[0];

          const duration =
            new Date(showtime.endTime).getTime() -
            new Date(showtime.startTime).getTime();

          expect(duration).toBe(120 * 60 * 1000);

          rememberShowtimes(data);
        },
      );
    });

    it('Tạo thành công - Giữ thứ tự response', async () => {
      const firstStartTime = addHours(280);
      const secondStartTime = addHours(300);

      const body = buildValidBody({
        showtimes: [
          buildItem({
            roomId: room2.id,
            startTime: secondStartTime,
            priceStandard: 90000,
            priceVip: 130000,
          }),
          buildItem({
            roomId: room1.id,
            startTime: firstStartTime,
            priceStandard: 80000,
            priceVip: 120000,
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Giữ thứ tự response',
          description: 'Response trả về đúng thứ tự item client gửi lên.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Token Admin, đủ dữ liệu',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(201);

          const data = parseApiData<ShowtimeResponseDto[]>(response);

          expect(data).toHaveLength(2);
          expect(data[0].roomId).toBe(room2.id);
          expect(data[0].startTime).toBe(secondStartTime);
          expect(data[1].roomId).toBe(room1.id);
          expect(data[1].startTime).toBe(firstStartTime);

          rememberShowtimes(data);
        },
      );
    });

    it('Tạo thành công - Kiểm tra response shape', async () => {
      const startTime = addHours(320);
      const body = buildValidBody({
        showtimes: [
          buildItem({
            roomId: room1.id,
            startTime,
          }),
        ],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra response shape',
          description:
            'Kiểm tra response chỉ gồm các field của ShowtimeResponseDto.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Token Admin, đủ dữ liệu',
        },
        () => postShowtimes(body),
        (response) => {
          expect(response.status).toBe(201);

          const data = parseApiData<ShowtimeResponseDto[]>(response);

          expect(data).toHaveLength(1);

          const showtime = data[0];

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

          rememberShowtimes(data);
        },
      );
    });
  });
});
