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

describe('[API] PATCH /showtimes/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let movieActive: Movie;
  let room1: Room;
  let room2: Room;

  let targetShowtime: Showtime;
  let conflictShowtime: Showtime;

  const createdShowtimeIds: number[] = [];
  const results: TestCaseRecord[] = [];
  const PREFIX = 'UST';
  let counter = 0;

  const nextId = () => `${PREFIX}${String(++counter).padStart(2, '0')}`;

  const stringifyProcedure = (payload: unknown): string =>
    JSON.stringify(payload, null, 2);

  const getActualResult = (response?: Response): number =>
    response?.status ?? 0;

  const addHours = (hours: number): string =>
    new Date(Date.now() + hours * 60 * 60 * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, '.000Z');

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

  const reseedTarget = async (): Promise<void> => {
    if (targetShowtime?.id) {
      await dataSource.getRepository(Showtime).delete(targetShowtime.id);
    }

    const showtimeRepo = dataSource.getRepository(Showtime);

    const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
    startTime.setMilliseconds(0);

    const endTime = new Date(
      startTime.getTime() + movieActive.duration * 60 * 1000,
    );

    targetShowtime = await showtimeRepo.save(
      showtimeRepo.create({
        movieId: movieActive.id,
        roomId: room1.id,
        startTime,
        endTime,
        priceStandard: 80000,
        priceVip: 120000,
      }),
    );
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
        title: 'UST Active Movie',
        posterUrl: 'https://example.com/poster.jpg',
        duration: 120,
        ageRating: AgeRating.P,
        status: MovieStatus.SHOWING,
        releaseDate: addDays(0) as unknown as Date,
        endDate: addDays(365) as unknown as Date,
      }),
    );

    room1 = await roomRepo.save(roomRepo.create({ name: 'U1' }));
    room2 = await roomRepo.save(roomRepo.create({ name: 'U2' }));

    await reseedTarget();

    const conflictStart = new Date(
      targetShowtime.startTime.getTime() + 5 * 60 * 60 * 1000,
    );

    const conflictEnd = new Date(
      conflictStart.getTime() + movieActive.duration * 60 * 1000,
    );

    const showtimeRepo = dataSource.getRepository(Showtime);

    conflictShowtime = await showtimeRepo.save(
      showtimeRepo.create({
        movieId: movieActive.id,
        roomId: room1.id,
        startTime: conflictStart,
        endTime: conflictEnd,
        priceStandard: 80000,
        priceVip: 120000,
      }),
    );

    createdShowtimeIds.push(conflictShowtime.id);
  });

  afterAll(async () => {
    const allShowtimeIds = [
      ...createdShowtimeIds,
      ...(targetShowtime?.id ? [targetShowtime.id] : []),
    ];

    if (allShowtimeIds.length > 0) {
      await dataSource.getRepository(Showtime).delete(allShowtimeIds);
    }

    if (movieActive?.id) {
      await dataSource.getRepository(Movie).delete(movieActive.id);
    }

    if (room1?.id && room2?.id) {
      await dataSource.getRepository(Room).delete([room1.id, room2.id]);
    }

    await exportTestReport(results, PREFIX, 'Update_Showtime');
    await app.close();
  });

  describe('Kiểm tra dữ liệu đầu vào', () => {
    it('Cập nhật showtime thất bại – Id không phải số nguyên', async () => {
      const body = {};

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Cập nhật showtime thất bại do id không hợp lệ',
          description:
            'Cập nhật showtime với id trên URL không phải là số nguyên.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Tài khoản admin đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .patch('/showtimes/abc')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (response) => {
          expect(response.status).toBe(400);
          parseApiError(response);
        },
      );
    });

    it('Cập nhật showtime thất bại – Sai định dạng startTime', async () => {
      const body = {
        startTime: '2026-10-01 10:00',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Cập nhật showtime thất bại do sai định dạng thời gian',
          description:
            'Cập nhật showtime với thời gian bắt đầu không đúng định dạng UTC ISO 8601.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions:
            'Tài khoản admin đã đăng nhập thành công và showtime cần cập nhật đã tồn tại.',
        },
        () =>
          request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'startTime');
        },
      );
    });

    it('Cập nhật showtime thất bại – Giá vé VIP là số âm', async () => {
      const body = {
        priceVip: -1,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Cập nhật showtime thất bại do giá vé VIP không hợp lệ',
          description: 'Cập nhật showtime với giá vé VIP là số âm.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions:
            'Tài khoản admin đã đăng nhập thành công và showtime cần cập nhật đã tồn tại.',
        },
        () =>
          request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (response) => {
          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'VIP');
        },
      );
    });

    it('Cập nhật showtime thất bại – Gửi field không hợp lệ', async () => {
      const body = {
        unknownField: true,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Cập nhật showtime thất bại do gửi field không hợp lệ',
          description:
            'Cập nhật showtime với field không được khai báo trong DTO.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'ValidationPipe đang bật forbidNonWhitelisted.',
        },
        () =>
          request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (response) => {
          expect(response.status).toBe(400);
          parseApiError(response);
        },
      );
    });
  });

  describe('Phân quyền', () => {
    it('Cập nhật showtime thất bại – Thiếu token', async () => {
      const body = {
        priceStandard: 90000,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Cập nhật showtime thất bại do thiếu token',
          description:
            'Cập nhật showtime khi chưa đăng nhập bằng tài khoản admin.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không gửi access token trong request.',
        },
        () =>
          request(server).patch(`/showtimes/${targetShowtime.id}`).send(body),
        (response) => {
          expect(response.status).toBe(401);
        },
      );
    });

    it('Cập nhật showtime thất bại – Tài khoản không đủ quyền', async () => {
      const body = {
        priceStandard: 90000,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Cập nhật showtime thất bại do không đủ quyền',
          description:
            'Cập nhật showtime bằng tài khoản khách hàng thông thường.',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: 'Tài khoản customer đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${customerToken}`)
            .send(body),
        (response) => {
          expect(response.status).toBe(403);
        },
      );
    });
  });

  describe('Ràng buộc nghiệp vụ', () => {
    it('Cập nhật showtime thất bại – Showtime không tồn tại', async () => {
      const body = {
        priceStandard: 90000,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Cập nhật showtime thất bại do showtime không tồn tại',
          description: 'Cập nhật showtime với id không tồn tại trong hệ thống.',
          procedure: stringifyProcedure(body),
          expectedResult: 404,
          preconditions: 'Tài khoản admin đã đăng nhập thành công.',
        },
        () =>
          request(server)
            .patch('/showtimes/999999')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (response) => {
          expect(response.status).toBe(404);
        },
      );
    });

    it('Cập nhật showtime thất bại – Thời gian chiếu trong quá khứ', async () => {
      await reseedTarget();

      const pastTime = new Date(Date.now() - 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z');

      const body = {
        startTime: pastTime,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase:
            'Cập nhật showtime thất bại do thời gian chiếu trong quá khứ',
          description:
            'Cập nhật showtime với thời gian bắt đầu nhỏ hơn thời điểm hiện tại.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions:
            'Tài khoản admin đã đăng nhập thành công và showtime cần cập nhật đã tồn tại.',
        },
        () =>
          request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (response) => {
          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(error, 409, 'quá khứ');
        },
      );
    });

    it('Cập nhật showtime thất bại – Trùng lịch chiếu trong cùng phòng', async () => {
      await reseedTarget();

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
          testCase: 'Cập nhật showtime thất bại do trùng lịch chiếu',
          description:
            'Cập nhật thời gian bắt đầu của showtime làm trùng với lịch chiếu khác trong cùng phòng.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions:
            'Phòng chiếu đã có một showtime khác trong khung giờ gần với thời gian cập nhật.',
        },
        () =>
          request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (response) => {
          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(error, 409, 'trùng lịch');
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Cập nhật showtime thành công – Gửi body rỗng', async () => {
      await reseedTarget();

      const body = {};

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Cập nhật showtime thành công khi gửi body rỗng',
          description:
            'Cập nhật showtime với body rỗng và dữ liệu hiện tại được giữ nguyên.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions:
            'Tài khoản admin đã đăng nhập thành công và showtime cần cập nhật đã tồn tại.',
        },
        () =>
          request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto>(response);

          expect(data.id).toBe(targetShowtime.id);
          expect(data.priceStandard).toBe(80000);
          expect(data.priceVip).toBe(120000);
        },
      );
    });

    it('Cập nhật showtime thành công – Cập nhật giá vé', async () => {
      await reseedTarget();

      const body = {
        priceStandard: 100000,
        priceVip: 150000,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Cập nhật showtime thành công với giá vé mới',
          description:
            'Cập nhật showtime bằng cách thay đổi giá vé tiêu chuẩn và giá vé VIP.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions:
            'Tài khoản admin đã đăng nhập thành công và showtime cần cập nhật đã tồn tại.',
        },
        () =>
          request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto>(response);

          expect(data.priceStandard).toBe(100000);
          expect(data.priceVip).toBe(150000);
        },
      );
    });

    it('Cập nhật showtime thành công – Cập nhật trạng thái', async () => {
      await reseedTarget();

      const body = {
        status: 'sold_out',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Cập nhật showtime thành công với trạng thái mới',
          description:
            'Cập nhật showtime bằng cách chuyển trạng thái sang đã bán hết.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions:
            'Tài khoản admin đã đăng nhập thành công và showtime cần cập nhật đã tồn tại.',
        },
        () =>
          request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto>(response);

          expect(data.status).toBe('sold_out');
        },
      );
    });

    it('Cập nhật showtime thành công – Cập nhật thời gian chiếu', async () => {
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
          testCase: 'Cập nhật showtime thành công với thời gian chiếu mới',
          description:
            'Cập nhật showtime bằng cách chuyển thời gian bắt đầu sang một khung giờ hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions:
            'Tài khoản admin đã đăng nhập thành công, showtime cần cập nhật đã tồn tại và khung giờ mới chưa có lịch chiếu khác.',
        },
        () =>
          request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto>(response);

          expect(new Date(data.startTime).toISOString()).toBe(
            new Date(newStart).toISOString(),
          );

          const diffMs =
            new Date(data.endTime).getTime() -
            new Date(data.startTime).getTime();

          expect(diffMs).toBe(movieActive.duration * 60 * 1000);
        },
      );
    });

    it('Cập nhật showtime thành công – Chuyển sang phòng chiếu khác', async () => {
      await reseedTarget();

      const newStart = addHours(300);

      const body = {
        roomId: room2.id,
        startTime: newStart,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Cập nhật showtime thành công với phòng chiếu mới',
          description:
            'Cập nhật showtime bằng cách chuyển sang phòng chiếu khác còn trống lịch.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions:
            'Tài khoản admin đã đăng nhập thành công, showtime cần cập nhật đã tồn tại và phòng chiếu mới chưa có lịch trong khung giờ đó.',
        },
        () =>
          request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body),
        (response) => {
          expect(response.status).toBe(200);

          const data = parseApiData<ShowtimeResponseDto>(response);

          expect(data.roomId).toBe(room2.id);
        },
      );
    });
  });
});
