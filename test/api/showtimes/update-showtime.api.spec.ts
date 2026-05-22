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

type UpdateShowtimeBody = {
  roomId?: unknown;
  startTime?: unknown;
  status?: unknown;
  priceStandard?: unknown;
  priceVip?: unknown;
  priceCouple?: unknown;
  unknownField?: unknown;
};

describe('[API] PATCH /showtimes/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let movieActive: Movie;
  let movieFuture: Movie;
  let movieShortRange: Movie;
  let room1: Room;
  let room2: Room;

  let targetShowtime: Showtime;

  const createdShowtimeIds: number[] = [];
  const createdMovieIds: number[] = [];
  const createdRoomIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'UST';
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

  const createShowtimeSeed = async (
    movie: Movie,
    room: Room,
    startTimeValue: string,
    overrides: Partial<Showtime> = {},
  ): Promise<Showtime> => {
    const startTime = new Date(startTimeValue);
    const endTime = new Date(startTime.getTime() + movie.duration * 60 * 1000);

    return dataSource.getRepository(Showtime).save(
      dataSource.getRepository(Showtime).create({
        movieId: movie.id,
        roomId: room.id,
        startTime,
        endTime,
        status: ShowtimeStatus.OPEN,
        priceStandard: 80000,
        priceVip: 120000,
        priceCouple: null,
        ...overrides,
      }),
    );
  };

  const reseedTarget = async (
    movie: Movie = movieActive,
    room: Room = room1,
    startTimeValue = addHours(48),
  ): Promise<void> => {
    if (targetShowtime?.id) {
      await dataSource.getRepository(Showtime).delete(targetShowtime.id);
    }

    targetShowtime = await createShowtimeSeed(movie, room, startTimeValue);
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

  const patchShowtime = (
    id: number | string,
    body: UpdateShowtimeBody | Record<string, unknown>,
    token = adminToken,
  ): Promise<Response> =>
    request(server)
      .patch('/showtimes/' + id)
      .set('Authorization', 'Bearer ' + token)
      .send(body);

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
        title: 'UST A ' + seed,
        slug: 'ust-a-' + seed,
        posterUrl: 'https://example.com/poster.jpg',
        duration: 120,
        ageRating: AgeRating.P,
        status: MovieStatus.SHOWING,
        releaseDate: addDays(0) as unknown as Date,
        endDate: addDays(365) as unknown as Date,
      }),
    );

    movieFuture = await movieRepo.save(
      movieRepo.create({
        title: 'UST F ' + seed,
        slug: 'ust-f-' + seed,
        posterUrl: 'https://example.com/poster.jpg',
        duration: 120,
        ageRating: AgeRating.P,
        status: MovieStatus.SHOWING,
        releaseDate: addDays(10) as unknown as Date,
        endDate: addDays(365) as unknown as Date,
      }),
    );

    movieShortRange = await movieRepo.save(
      movieRepo.create({
        title: 'UST R ' + seed,
        slug: 'ust-r-' + seed,
        posterUrl: 'https://example.com/poster.jpg',
        duration: 120,
        ageRating: AgeRating.P,
        status: MovieStatus.SHOWING,
        releaseDate: addDays(-10) as unknown as Date,
        endDate: addDays(1) as unknown as Date,
      }),
    );

    room1 = await roomRepo.save(
      roomRepo.create({
        name: 'U' + seed + 'A',
      }),
    );

    room2 = await roomRepo.save(
      roomRepo.create({
        name: 'U' + seed + 'B',
      }),
    );

    createdMovieIds.push(movieActive.id, movieFuture.id, movieShortRange.id);
    createdRoomIds.push(room1.id, room2.id);

    await reseedTarget();
  });

  afterAll(async () => {
    const allShowtimeIds = [
      ...createdShowtimeIds,
      ...(targetShowtime?.id ? [targetShowtime.id] : []),
    ];

    if (allShowtimeIds.length > 0) {
      await dataSource.getRepository(Showtime).delete(allShowtimeIds);
    }

    if (createdMovieIds.length > 0) {
      await dataSource.getRepository(Movie).delete(createdMovieIds);
    }

    if (createdRoomIds.length > 0) {
      await dataSource.getRepository(Room).delete(createdRoomIds);
    }

    await cleanupRefreshTokens(dataSource);

    await exportTestReport(results, PREFIX, 'Update_Showtime');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Cập nhật thất bại - Không truyền Authorization Token trả về đúng message', async () => {
      const body = {
        priceStandard: 90000,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không truyền token',
          description: 'Không gửi access token khi cập nhật suất chiếu.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không có',
        },
        () =>
          request(server)
            .patch('/showtimes/' + targetShowtime.id)
            .send(body),
        (response) => {
          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');
        },
      );
    });

    it('Cập nhật thất bại - Truyền Fake Token trả về đúng message', async () => {
      const body = {
        priceStandard: 90000,
      };

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
          preconditions: 'Không có',
        },
        () =>
          request(server)
            .patch('/showtimes/' + targetShowtime.id)
            .set('Authorization', 'Bearer fake.jwt.token')
            .send(body),
        (response) => {
          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');
        },
      );
    });

    it('Cập nhật thất bại - Role Customer bị chặn trả về đúng message', async () => {
      const body = {
        priceStandard: 90000,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Customer không có quyền',
          description: 'Tài khoản Customer cố cập nhật suất chiếu.',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: 'Token Customer',
        },
        () => patchShowtime(targetShowtime.id, body, customerToken),
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
    it('Cập nhật thất bại - ID không phải số nguyên', async () => {
      const body = {
        priceStandard: 90000,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Sai định dạng ID',
          description: 'Gửi id không thể parse sang số nguyên.',
          procedure: stringifyProcedure({
            params: {
              id: 'abc',
            },
            body,
          }),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        () => patchShowtime('abc', body),
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

    it('Cập nhật thất bại - Body rỗng trả về đúng message', async () => {
      await reseedTarget();

      const body = {};

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Body rỗng',
          description: 'Gửi body rỗng khi cập nhật suất chiếu.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Không có dữ liệu nào để cập nhật.');
        },
      );
    });

    it('Cập nhật thất bại - Set null trả về đúng message', async () => {
      await reseedTarget();

      const body = {
        priceVip: null,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Set null',
          description: 'Gửi null cho field trong PATCH.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Không hỗ trợ set null cho PATCH: priceVip.',
          );
        },
      );
    });

    it('Cập nhật thất bại - startTime rỗng trả về đúng message', async () => {
      await reseedTarget();

      const body = {
        startTime: '',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'startTime rỗng',
          description: 'Gửi chuỗi rỗng cho startTime.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng nhập thời gian bắt đầu.');
        },
      );
    });

    it('Cập nhật thất bại - Sai định dạng startTime trả về đúng message', async () => {
      await reseedTarget();

      const body = {
        startTime: '2026-10-01 10:00',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'startTime sai định dạng',
          description: 'Gửi startTime không đúng ISO 8601 UTC.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'startTime phải là ISO 8601 UTC');
        },
      );
    });

    it('Cập nhật thất bại - roomId không phải số nguyên', async () => {
      await reseedTarget();

      const body = {
        roomId: 'abc',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'roomId không hợp lệ',
          description: 'Gửi roomId không phải số nguyên.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'roomId phải là số nguyên.');
        },
      );
    });

    it('Cập nhật thất bại - Trạng thái không hợp lệ trả về đúng message', async () => {
      await reseedTarget();

      const body = {
        status: 'closed',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Trạng thái không hợp lệ',
          description: 'Gửi status ngoài enum cho phép.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'status phải là open hoặc sold_out.');
        },
      );
    });

    it('Cập nhật thất bại - Giá vé standard là số âm', async () => {
      await reseedTarget();

      const body = {
        priceStandard: -1,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Giá standard âm',
          description: 'Gửi priceStandard nhỏ hơn 0.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Giá vé standard phải >= 0.');
        },
      );
    });

    it('Cập nhật thất bại - Giá vé VIP là số âm', async () => {
      await reseedTarget();

      const body = {
        priceVip: -1,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Giá VIP âm',
          description: 'Gửi priceVip nhỏ hơn 0.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Giá vé VIP phải >= 0.');
        },
      );
    });

    it('Cập nhật thất bại - Giá vé couple là số âm', async () => {
      await reseedTarget();

      const body = {
        priceCouple: -1,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Giá couple âm',
          description: 'Gửi priceCouple nhỏ hơn 0.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Giá vé couple phải >= 0.');
        },
      );
    });

    it('Cập nhật thất bại - Gửi field không hợp lệ trả về đúng message', async () => {
      await reseedTarget();

      const body = {
        unknownField: true,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Body dư field',
          description: 'Gửi field không được khai báo trong UpdateShowtimeDto.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'property unknownField should not exist',
          );
        },
      );
    });
  });

  describe('Ràng buộc nghiệp vụ', () => {
    it('Cập nhật thất bại - Showtime không tồn tại trả về đúng message', async () => {
      const body = {
        priceStandard: 90000,
      };

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
            body,
          }),
          expectedResult: 404,
          preconditions: 'Token Admin',
        },
        () => patchShowtime(999999, body),
        (response) => {
          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Suất chiếu #999999 không tồn tại.');
        },
      );
    });

    it('Cập nhật thất bại - Phòng chiếu không tồn tại trả về đúng message', async () => {
      await reseedTarget();

      const body = {
        roomId: 999999,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Phòng không tồn tại',
          description: 'Gửi roomId không tồn tại trong hệ thống.',
          procedure: stringifyProcedure(body),
          expectedResult: 404,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
        (response) => {
          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Phòng chiếu #999999 không tồn tại.');
        },
      );
    });

    it('Cập nhật thất bại - Thời gian chiếu trong quá khứ trả về đúng message', async () => {
      await reseedTarget();

      const body = {
        startTime: addHours(-1),
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thời gian quá khứ',
          description: 'Gửi startTime nhỏ hơn thời gian hiện tại.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
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

    it('Cập nhật thất bại - Trước ngày khởi chiếu của phim', async () => {
      await reseedTarget(movieFuture, room1, addHours(300));

      const body = {
        startTime: addHours(48),
      };

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
        () => patchShowtime(targetShowtime.id, body),
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

    it('Cập nhật thất bại - Sau ngày kết thúc chiếu của phim', async () => {
      await reseedTarget(movieShortRange, room1, addHours(12));

      const body = {
        startTime: addHours(72),
      };

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
        () => patchShowtime(targetShowtime.id, body),
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

    it('Cập nhật thất bại - Trùng lịch chiếu trong cùng phòng', async () => {
      await reseedTarget();

      const conflictStart = new Date(
        targetShowtime.startTime.getTime() + 5 * 60 * 60 * 1000,
      )
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z');

      const conflictShowtime = await createShowtimeSeed(
        movieActive,
        room1,
        conflictStart,
      );

      createdShowtimeIds.push(conflictShowtime.id);

      const newStart = new Date(
        targetShowtime.startTime.getTime() + 4 * 60 * 60 * 1000,
      )
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z');

      const body = {
        startTime: newStart,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Trùng lịch phòng',
          description: 'Cập nhật startTime làm trùng lịch trong cùng phòng.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Phòng đã có lịch',
        },
        () => patchShowtime(targetShowtime.id, body),
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
  });

  describe('Luồng thành công', () => {
    it('Cập nhật thành công - Cập nhật giá vé', async () => {
      await reseedTarget();

      const body = {
        priceStandard: 100000,
        priceVip: 150000,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Cập nhật giá vé',
          description: 'Cập nhật priceStandard và priceVip.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto>(response);

          expect(data.id).toBe(targetShowtime.id);
          expect(data.priceStandard).toBe(100000);
          expect(data.priceVip).toBe(150000);
        },
      );
    });

    it('Cập nhật thành công - Cập nhật priceCouple', async () => {
      await reseedTarget();

      const body = {
        priceCouple: 200000,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Cập nhật giá couple',
          description: 'Cập nhật priceCouple hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto>(response);

          expect(data.id).toBe(targetShowtime.id);
          expect(data.priceCouple).toBe(200000);
        },
      );
    });

    it('Cập nhật thành công - Cập nhật trạng thái', async () => {
      await reseedTarget();

      const body = {
        status: ShowtimeStatus.SOLD_OUT,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Cập nhật trạng thái',
          description: 'Cập nhật status sang sold_out.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto>(response);

          expect(data.id).toBe(targetShowtime.id);
          expect(data.status).toBe(ShowtimeStatus.SOLD_OUT);
        },
      );
    });

    it('Cập nhật thành công - Cập nhật thời gian chiếu', async () => {
      await reseedTarget();

      const newStart = new Date(
        targetShowtime.startTime.getTime() + 10 * 60 * 60 * 1000,
      )
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z');

      const body = {
        startTime: newStart,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Cập nhật thời gian',
          description: 'Cập nhật startTime sang khung giờ hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto>(response);

          expect(data.id).toBe(targetShowtime.id);
          expect(data.startTime).toBe(newStart);

          const duration =
            new Date(data.endTime).getTime() -
            new Date(data.startTime).getTime();

          expect(duration).toBe(movieActive.duration * 60 * 1000);
        },
      );
    });

    it('Cập nhật thành công - Chuyển phòng chiếu', async () => {
      await reseedTarget();

      const body = {
        roomId: room2.id,
        startTime: addHours(300),
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Chuyển phòng chiếu',
          description: 'Cập nhật sang phòng chiếu khác còn trống lịch.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto>(response);

          expect(data.id).toBe(targetShowtime.id);
          expect(data.roomId).toBe(room2.id);
          expect(data.roomName).toBe(room2.name);
        },
      );
    });

    it('Cập nhật thành công - Kiểm tra response shape', async () => {
      await reseedTarget();

      const body = {
        priceStandard: 95000,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra response shape',
          description:
            'Kiểm tra response chỉ gồm các field của ShowtimeResponseDto.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Token Admin, có showtime',
        },
        () => patchShowtime(targetShowtime.id, body),
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
