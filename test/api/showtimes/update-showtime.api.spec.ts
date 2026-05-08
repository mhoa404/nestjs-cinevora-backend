import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { Server } from 'http';

import {
  parseApiError,
  expectErrorMessage,
  getActualStatus,
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

  // showtime chính dùng để update
  let targetShowtime: Showtime;

  // showtime dùng để tạo tình huống overlap
  let conflictShowtime: Showtime;

  const createdShowtimeIds: number[] = [];
  const results: TestCaseRecord[] = [];
  const PREFIX = 'UST';
  let counter = 0;

  const nextId = () => `${PREFIX}${String(++counter).padStart(2, '0')}`;

  const addHours = (h: number): string =>
    new Date(Date.now() + h * 60 * 60 * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, '.000Z');

  const addDays = (d: number): string => {
    const dt = new Date();
    dt.setDate(dt.getDate() + d);
    return dt.toISOString().slice(0, 10);
  };

  const record = async (
    meta: Omit<TestCaseRecord, 'passed' | 'testDate' | 'actualResult'>,
    executor: () => Promise<Response>,
  ) => {
    const testDate = new Date();
    let passed = false;
    let actualResult: number | null = null;
    try {
      const res = await executor();
      actualResult = res.status;
      passed = true;
    } catch (e: unknown) {
      actualResult = getActualStatus(e);
      passed = false;
      throw e;
    } finally {
      results.push({ ...meta, actualResult, passed, testDate });
    }
  };

  // Re-seed targetShowtime trước mỗi test có thể ghi đè nó
  const reseedTarget = async () => {
    if (targetShowtime?.id) {
      await dataSource.getRepository(Showtime).delete(targetShowtime.id);
    }
    const repo = dataSource.getRepository(Showtime);
    const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
    startTime.setMilliseconds(0);
    const endTime = new Date(
      startTime.getTime() + movieActive.duration * 60 * 1000,
    );
    targetShowtime = await repo.save(
      repo.create({
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

    // Seed conflict showtime: 5 giờ sau targetShowtime (trong buffer khi target bị move lại gần)
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
    const allIds = [
      ...createdShowtimeIds,
      ...(targetShowtime?.id ? [targetShowtime.id] : []),
    ];
    if (allIds.length > 0) {
      await dataSource.getRepository(Showtime).delete(allIds);
    }
    await dataSource.getRepository(Movie).delete(movieActive.id);
    await dataSource.getRepository(Room).delete([room1.id, room2.id]);
    await exportTestReport(results, PREFIX, 'Update_Showtime');
    await app.close();
  });

  // ─── Phân quyền ─────────────────────────────────────────────────────────────

  describe('Phân quyền', () => {
    it('UST – Không token → 401', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Missing Token',
          description: 'Gọi PATCH /showtimes/:id không có token.',
          procedure: 'No token',
          expectedResult: 401,
          preconditions: '',
        },
        async () => {
          const res = await request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .send({});
          expect(res.status).toBe(401);
          return res;
        },
      );
    });

    it('UST – Customer token → 403', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Customer Forbidden',
          description: 'Customer không được update showtime.',
          procedure: 'customerToken',
          expectedResult: 403,
          preconditions: '',
        },
        async () => {
          const res = await request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ priceStandard: 90000 });
          expect(res.status).toBe(403);
          return res;
        },
      );
    });
  });

  // ─── Validation ─────────────────────────────────────────────────────────────

  describe('Validation DTO', () => {
    it('UST – id không phải số nguyên → 400', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Non-integer ID param',
          description: 'Gọi PATCH /showtimes/abc.',
          procedure: 'id=abc',
          expectedResult: 400,
          preconditions: '',
        },
        async () => {
          const res = await request(server)
            .patch('/showtimes/abc')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});
          expect(res.status).toBe(400);
          return res;
        },
      );
    });

    it('UST – startTime sai format → 400', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Wrong startTime format',
          description: 'startTime không đúng UTC ISO.',
          procedure: 'startTime: "2026-10-01 10:00"',
          expectedResult: 400,
          preconditions: '',
        },
        async () => {
          const res = await request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ startTime: '2026-10-01 10:00' });
          expect(res.status).toBe(400);
          const err = parseApiError(res);
          expectErrorMessage(err, 400, 'startTime');
          return res;
        },
      );
    });

    it('UST – priceVip âm → 400', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Negative priceVip',
          description: 'priceVip < 0.',
          procedure: 'priceVip: -1',
          expectedResult: 400,
          preconditions: '',
        },
        async () => {
          const res = await request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ priceVip: -1 });
          expect(res.status).toBe(400);
          const err = parseApiError(res);
          expectErrorMessage(err, 400, 'VIP');
          return res;
        },
      );
    });

    it('UST – Field lạ → 400', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Extra Fields',
          description: 'Gửi field không khai báo.',
          procedure: 'unknownField: true',
          expectedResult: 400,
          preconditions: '',
        },
        async () => {
          const res = await request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ unknownField: true });
          expect(res.status).toBe(400);
          parseApiError(res);
          return res;
        },
      );
    });
  });

  // ─── Business Rules ──────────────────────────────────────────────────────────

  describe('Ràng buộc nghiệp vụ', () => {
    it('UST – id không tồn tại → 404', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Showtime Not Found',
          description: 'PATCH /showtimes/999999.',
          procedure: 'id=999999',
          expectedResult: 404,
          preconditions: '',
        },
        async () => {
          const res = await request(server)
            .patch('/showtimes/999999')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ priceStandard: 90000 });
          expect(res.status).toBe(404);
          return res;
        },
      );
    });

    it('UST – Update startTime vào quá khứ → 409', async () => {
      await reseedTarget();
      const pastTime = new Date(Date.now() - 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z');

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Past StartTime',
          description: 'startTime <= now.',
          procedure: `startTime = ${pastTime}`,
          expectedResult: 409,
          preconditions: 'targetShowtime fresh.',
        },
        async () => {
          const res = await request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ startTime: pastTime });
          expect(res.status).toBe(409);
          const err = parseApiError(res);
          expectErrorMessage(err, 409, 'quá khứ');
          return res;
        },
      );
    });

    it('UST – Update startTime gây overlap với showtime khác → 409', async () => {
      await reseedTarget();
      // conflictShowtime bắt đầu 5h sau targetShowtime hiện tại
      // Nếu move targetShowtime lên 4h sau vị trí gốc: endTime = targetStart+4h+120min
      // conflictStart = targetStart+5h, buffer trước conflict = targetStart+4h+120+30 = targetStart+5.5h
      // 5h < 5.5h → overlap
      const newStart = new Date(
        targetShowtime.startTime.getTime() + 4 * 60 * 60 * 1000,
      )
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z');

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Update Overlap',
          description:
            'Update startTime gây overlap với conflictShowtime trong cùng phòng.',
          procedure: `newStart = targetStart+4h, conflictStart = targetStart+5h`,
          expectedResult: 409,
          preconditions: 'conflictShowtime trong room1.',
        },
        async () => {
          const res = await request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ startTime: newStart });
          expect(res.status).toBe(409);
          const err = parseApiError(res);
          expectErrorMessage(err, 409, 'trùng lịch');
          return res;
        },
      );
    });
  });

  // ─── Happy Path ──────────────────────────────────────────────────────────────

  describe('Luồng thành công', () => {
    it('UST – Update body rỗng {} → 200, data không đổi', async () => {
      await reseedTarget();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Empty Body No-op',
          description:
            'Gửi body rỗng → trả 200, data giữ nguyên. (Submit mà không thay đổi gì)',
          procedure: 'body: {}',
          expectedResult: 200,
          preconditions: 'targetShowtime fresh.',
        },
        async () => {
          const res = await request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});
          expect(res.status).toBe(200);
          const data = parseApiData<ShowtimeResponseDto>(res);
          expect(data.id).toBe(targetShowtime.id);
          expect(data.priceStandard).toBe(80000);
          expect(data.priceVip).toBe(120000);
          return res;
        },
      );
    });

    it('UST – Chỉ update giá → 200', async () => {
      await reseedTarget();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Price Only',
          description: 'Update priceStandard và priceVip.',
          procedure: 'priceStandard=100000, priceVip=150000',
          expectedResult: 200,
          preconditions: 'targetShowtime fresh.',
        },
        async () => {
          const res = await request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ priceStandard: 100000, priceVip: 150000 });
          expect(res.status).toBe(200);
          const data = parseApiData<ShowtimeResponseDto>(res);
          expect(data.priceStandard).toBe(100000);
          expect(data.priceVip).toBe(150000);
          return res;
        },
      );
    });

    it('UST – Chỉ update status → 200', async () => {
      await reseedTarget();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Status Only',
          description: 'Update status = sold_out.',
          procedure: 'status: sold_out',
          expectedResult: 200,
          preconditions: 'targetShowtime fresh.',
        },
        async () => {
          const res = await request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'sold_out' });
          expect(res.status).toBe(200);
          const data = parseApiData<ShowtimeResponseDto>(res);
          expect(data.status).toBe('sold_out');
          return res;
        },
      );
    });

    it('UST – Update startTime sang slot hợp lệ → 200, endTime được recalculate', async () => {
      await reseedTarget();
      // Dời sang +10h so với gốc — đủ xa conflict (conflict ở +5h từ gốc, ta dời qua +10h)
      const newStart = new Date(
        targetShowtime.startTime.getTime() + 10 * 60 * 60 * 1000,
      )
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z');

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Valid StartTime',
          description:
            'Update startTime sang slot hợp lệ (+10h), kiểm tra endTime recalculate.',
          procedure: `newStart = ${newStart}`,
          expectedResult: 200,
          preconditions: 'targetShowtime fresh.',
        },
        async () => {
          const res = await request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ startTime: newStart });
          expect(res.status).toBe(200);
          const data = parseApiData<ShowtimeResponseDto>(res);
          expect(new Date(data.startTime).toISOString()).toBe(
            new Date(newStart).toISOString(),
          );
          const diffMs =
            new Date(data.endTime).getTime() -
            new Date(data.startTime).getTime();
          expect(diffMs).toBe(movieActive.duration * 60 * 1000);
          return res;
        },
      );
    });

    it('UST – Update sang phòng khác hợp lệ → 200', async () => {
      await reseedTarget();

      const newStart = addHours(300); // slot trống hoàn toàn ở room2

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Change Room',
          description: 'Update roomId sang room2 hợp lệ.',
          procedure: `roomId=${room2.id}, startTime=${newStart}`,
          expectedResult: 200,
          preconditions: 'room2 không có showtime nào.',
        },
        async () => {
          const res = await request(server)
            .patch(`/showtimes/${targetShowtime.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ roomId: room2.id, startTime: newStart });
          expect(res.status).toBe(200);
          const data = parseApiData<ShowtimeResponseDto>(res);
          expect(data.roomId).toBe(room2.id);
          return res;
        },
      );
    });
  });
});
