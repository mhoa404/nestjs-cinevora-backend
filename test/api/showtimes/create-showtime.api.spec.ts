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
  const results: TestCaseRecord[] = [];
  const PREFIX = 'CST';
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

    // Seed movies
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
    await dataSource
      .getRepository(Movie)
      .delete([movieActive.id, movieEnded.id]);
    await dataSource.getRepository(Room).delete([room1.id, room2.id]);
    await exportTestReport(results, PREFIX, 'Create_Showtime');
    await app.close();
  });

  // ─── Phân quyền ─────────────────────────────────────────────────────────────

  describe('Phân quyền', () => {
    it('CST – Không truyền token → 401', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Missing Token',
          description: 'Gọi POST /showtimes không có Authorization header.',
          procedure: 'No token',
          expectedResult: 401,
          preconditions: 'Không có token.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .send(buildValidBody());
          expect(res.status).toBe(401);
          return res;
        },
      );
    });

    it('CST – Fake token → 401', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Fake Token',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: 'fake.jwt.token',
          expectedResult: 401,
          preconditions: 'Token giả.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', 'Bearer fake.jwt.token')
            .send(buildValidBody());
          expect(res.status).toBe(401);
          return res;
        },
      );
    });

    it('CST – Customer token → 403', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Customer Forbidden',
          description: 'Tài khoản Customer không được tạo showtime.',
          procedure: 'customerToken',
          expectedResult: 403,
          preconditions: 'Dùng token Customer.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${customerToken}`)
            .send(buildValidBody());
          expect(res.status).toBe(403);
          return res;
        },
      );
    });
  });

  // ─── Validation DTO ──────────────────────────────────────────────────────────

  describe('Validation DTO', () => {
    it('CST – Thiếu movieId → 400', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Missing movieId',
          description: 'Không truyền movieId.',
          procedure: '{}',
          expectedResult: 400,
          preconditions: 'Admin token.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              showtimes: [
                {
                  roomId: room1.id,
                  startTime: addHours(48),
                  priceStandard: 80000,
                  priceVip: 120000,
                },
              ],
            });
          expect(res.status).toBe(400);
          parseApiError(res);
          return res;
        },
      );
    });

    it('CST – Thiếu showtimes → 400', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Missing showtimes',
          description: 'Không truyền mảng showtimes.',
          procedure: '{ movieId }',
          expectedResult: 400,
          preconditions: 'Admin token.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ movieId: movieActive.id });
          expect(res.status).toBe(400);
          parseApiError(res);
          return res;
        },
      );
    });

    it('CST – showtimes là mảng rỗng → 400', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Empty showtimes array',
          description: 'Gửi showtimes = [].',
          procedure: 'showtimes: []',
          expectedResult: 400,
          preconditions: 'Admin token.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ movieId: movieActive.id, showtimes: [] });
          expect(res.status).toBe(400);
          parseApiError(res);
          return res;
        },
      );
    });

    it('CST – startTime sai format (không phải UTC ISO) → 400', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Wrong startTime format',
          description: 'startTime không đúng UTC ISO 8601.',
          procedure: 'startTime: "2026-05-10 09:00:00"',
          expectedResult: 400,
          preconditions: 'Admin token.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              movieId: movieActive.id,
              showtimes: [
                {
                  roomId: room1.id,
                  startTime: '2026-05-10 09:00:00',
                  priceStandard: 80000,
                  priceVip: 120000,
                },
              ],
            });
          expect(res.status).toBe(400);
          const err = parseApiError(res);
          expectErrorMessage(err, 400, 'startTime');
          return res;
        },
      );
    });

    it('CST – priceStandard âm → 400', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Negative priceStandard',
          description: 'priceStandard < 0.',
          procedure: 'priceStandard: -1',
          expectedResult: 400,
          preconditions: 'Admin token.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              movieId: movieActive.id,
              showtimes: [
                {
                  roomId: room1.id,
                  startTime: addHours(48),
                  priceStandard: -1,
                  priceVip: 120000,
                },
              ],
            });
          expect(res.status).toBe(400);
          const err = parseApiError(res);
          expectErrorMessage(err, 400, 'standard');
          return res;
        },
      );
    });

    it('CST – status không hợp lệ → 400', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Invalid status enum',
          description: 'status không thuộc open | sold_out.',
          procedure: 'status: "invalid"',
          expectedResult: 400,
          preconditions: 'Admin token.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
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
            });
          expect(res.status).toBe(400);
          const err = parseApiError(res);
          expectErrorMessage(err, 400, 'status');
          return res;
        },
      );
    });

    it('CST – Gửi field lạ → 400 (forbidNonWhitelisted)', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Extra Fields',
          description: 'Gửi field không có trong DTO.',
          procedure: 'extraField: "hack"',
          expectedResult: 400,
          preconditions: 'ValidationPipe forbidNonWhitelisted.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ ...buildValidBody(), extraField: 'hack' });
          expect(res.status).toBe(400);
          parseApiError(res);
          return res;
        },
      );
    });
  });

  // ─── Business Rules ──────────────────────────────────────────────────────────

  describe('Ràng buộc nghiệp vụ', () => {
    it('CST – movieId không tồn tại → 404', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Movie Not Found',
          description: 'movieId trỏ đến phim không tồn tại.',
          procedure: 'movieId: 999999',
          expectedResult: 404,
          preconditions: 'Admin token.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              movieId: 999999,
              showtimes: [
                {
                  roomId: room1.id,
                  startTime: addHours(48),
                  priceStandard: 80000,
                  priceVip: 120000,
                },
              ],
            });
          expect(res.status).toBe(404);
          return res;
        },
      );
    });

    it('CST – roomId không tồn tại → 404', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Room Not Found',
          description: 'roomId trỏ đến phòng không tồn tại.',
          procedure: 'roomId: 999999',
          expectedResult: 404,
          preconditions: 'Admin token.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              movieId: movieActive.id,
              showtimes: [
                {
                  roomId: 999999,
                  startTime: addHours(48),
                  priceStandard: 80000,
                  priceVip: 120000,
                },
              ],
            });
          expect(res.status).toBe(404);
          return res;
        },
      );
    });

    it('CST – Phim đã ended → 409', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Movie Ended',
          description: 'Tạo showtime cho phim có status=ended.',
          procedure: `movieId: ${movieEnded.id}`,
          expectedResult: 409,
          preconditions: 'movieEnded đã seed.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              movieId: movieEnded.id,
              showtimes: [
                {
                  roomId: room1.id,
                  startTime: addHours(48),
                  priceStandard: 80000,
                  priceVip: 120000,
                },
              ],
            });
          expect(res.status).toBe(409);
          const err = parseApiError(res);
          expectErrorMessage(err, 409, 'kết thúc');
          return res;
        },
      );
    });

    it('CST – startTime trong quá khứ → 409', async () => {
      // Tạo movie với releaseDate quá khứ để không bị chặn bởi assertInRange
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Past StartTime',
          description: 'startTime <= now.',
          procedure: 'startTime: 1 giờ trước',
          expectedResult: 409,
          preconditions: 'Admin token.',
        },
        async () => {
          const pastTime = new Date(Date.now() - 60 * 60 * 1000)
            .toISOString()
            .replace(/\.\d{3}Z$/, '.000Z');
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              movieId: movieActive.id,
              showtimes: [
                {
                  roomId: room1.id,
                  startTime: pastTime,
                  priceStandard: 80000,
                  priceVip: 120000,
                },
              ],
            });
          expect(res.status).toBe(409);
          const err = parseApiError(res);
          expectErrorMessage(err, 409, 'quá khứ');
          return res;
        },
      );
    });

    it('CST – startTime trước releaseDate của phim → 409', async () => {
      // Tạo movie với releaseDate = +10 ngày
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

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: StartTime Before ReleaseDate',
          description: 'startTime trước ngày khởi chiếu.',
          procedure: 'startTime = +5 ngày, releaseDate = +10 ngày',
          expectedResult: 409,
          preconditions: 'futureMovie có releaseDate = now + 10d.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              movieId: futureMovie.id,
              showtimes: [
                {
                  roomId: room1.id,
                  startTime: addHours(120),
                  priceStandard: 80000,
                  priceVip: 120000,
                },
              ],
            });
          expect(res.status).toBe(409);
          const err = parseApiError(res);
          expectErrorMessage(err, 409, 'khởi chiếu');
          return res;
        },
      );

      await movieRepo.delete(futureMovie.id);
    });

    it('CST – startTime sau endDate của phim → 409', async () => {
      const movieRepo = dataSource.getRepository(Movie);
      const shortMovie = await movieRepo.save(
        movieRepo.create({
          title: 'CST Short Run Movie',
          posterUrl: 'https://example.com/poster.jpg',
          duration: 60,
          ageRating: AgeRating.P,
          status: MovieStatus.SHOWING,
          releaseDate: addDays(-5) as unknown as Date,
          endDate: addDays(1) as unknown as Date, // kết thúc ngày mai
        }),
      );

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: StartTime After EndDate',
          description: 'startTime sau endDate của phim.',
          procedure: 'startTime = +10 ngày, endDate = +1 ngày',
          expectedResult: 409,
          preconditions: 'shortMovie.endDate = now + 1d.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              movieId: shortMovie.id,
              showtimes: [
                {
                  roomId: room1.id,
                  startTime: addHours(300),
                  priceStandard: 80000,
                  priceVip: 120000,
                },
              ],
            });
          expect(res.status).toBe(409);
          const err = parseApiError(res);
          expectErrorMessage(err, 409, 'kết thúc chiếu');
          return res;
        },
      );

      await movieRepo.delete(shortMovie.id);
    });

    it('CST – Overlap với showtime đã có trong cùng phòng → 409', async () => {
      // Seed một showtime trước
      const showtimeRepo = dataSource.getRepository(Showtime);
      const baseTime = new Date(Date.now() + 72 * 60 * 60 * 1000);
      baseTime.setMilliseconds(0);
      const baseTimeStr = baseTime.toISOString().replace(/\.\d{3}Z$/, '.000Z');
      const endTime = new Date(baseTime.getTime() + 120 * 60 * 1000); // +120 min

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

      // Thử tạo showtime overlap: bắt đầu 2 giờ sau (120 min = nằm trong buffer 150 min)
      const overlapStart = new Date(baseTime.getTime() + 2 * 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z');

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Room Schedule Overlap',
          description:
            'Tạo showtime bị trùng lịch với suất chiếu đã có trong phòng (kể cả buffer 30 min).',
          procedure: `startTime = baseTime + 2h, existingShowtime = ${baseTimeStr}`,
          expectedResult: 409,
          preconditions: `Showtime tại ${baseTimeStr} trong room1 đã được seed.`,
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              movieId: movieActive.id,
              showtimes: [
                {
                  roomId: room1.id,
                  startTime: overlapStart,
                  priceStandard: 80000,
                  priceVip: 120000,
                },
              ],
            });
          expect(res.status).toBe(409);
          const err = parseApiError(res);
          expectErrorMessage(err, 409, 'trùng lịch');
          return res;
        },
      );
    });

    it('CST – Batch tự overlap trong cùng 1 request → 409', async () => {
      const t1 = addHours(96);
      // t2 chỉ cách t1 2 giờ (120 min) = nằm trong buffer 150 min → tự overlap
      const t2 = new Date(new Date(t1).getTime() + 2 * 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z');

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Batch Self-Overlap',
          description:
            'Batch gồm 2 item trong cùng phòng, cách nhau 2 giờ (< buffer 150 min).',
          procedure: `t1=${t1}, t2=${t2}, cùng room2`,
          expectedResult: 409,
          preconditions: 'Admin token.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
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
            });
          expect(res.status).toBe(409);
          const err = parseApiError(res);
          expectErrorMessage(err, 409, 'trùng');
          return res;
        },
      );
    });
  });

  // ─── Happy Path ──────────────────────────────────────────────────────────────

  describe('Luồng thành công', () => {
    it('CST – Tạo 1 showtime → 201 với đầy đủ response fields', async () => {
      const startTime = addHours(200);

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Single Showtime',
          description: 'Tạo 1 showtime hợp lệ.',
          procedure: `startTime=${startTime}`,
          expectedResult: 201,
          preconditions: 'Admin token, movieActive, room1.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              movieId: movieActive.id,
              showtimes: [
                {
                  roomId: room1.id,
                  startTime,
                  priceStandard: 80000,
                  priceVip: 120000,
                },
              ],
            });
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
          return res;
        },
      );
    });

    it('CST – Tạo batch 2 showtime ở 2 phòng khác nhau → 201, trả đúng thứ tự gốc', async () => {
      const t1 = addHours(210);
      const t2 = addHours(220);

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Batch 2 Showtimes',
          description: 'Tạo batch 2 showtime ở room1 và room2.',
          procedure: `t1=${t1} (room1), t2=${t2} (room2)`,
          expectedResult: 201,
          preconditions: 'Admin token.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
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
            });
          expect(res.status).toBe(201);
          const data = parseApiData<ShowtimeResponseDto[]>(res);
          expect(data).toHaveLength(2);
          // Response giữ đúng thứ tự gốc: index 0 = room1, index 1 = room2
          expect(data[0].roomId).toBe(room1.id);
          expect(data[1].roomId).toBe(room2.id);
          expect(data[1].priceCouple).toBe(200000);
          data.forEach((st) => createdShowtimeIds.push(st.id));
          return res;
        },
      );
    });

    it('CST – Tạo showtime với status=sold_out → 201', async () => {
      const startTime = addHours(230);

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Sold Out Status',
          description: 'Tạo showtime với status=sold_out.',
          procedure: `status=sold_out, startTime=${startTime}`,
          expectedResult: 201,
          preconditions: 'Admin token.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
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
            });
          expect(res.status).toBe(201);
          const data = parseApiData<ShowtimeResponseDto[]>(res);
          expect(data[0].status).toBe('sold_out');
          data.forEach((st) => createdShowtimeIds.push(st.id));
          return res;
        },
      );
    });

    it('CST – endTime được tự tính = startTime + duration (120 min)', async () => {
      const startTime = addHours(240);

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Auto endTime',
          description: 'endTime = startTime + movie.duration (120 phút).',
          procedure: `startTime=${startTime}`,
          expectedResult: 201,
          preconditions: 'movieActive.duration = 120.',
        },
        async () => {
          const res = await request(server)
            .post('/showtimes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              movieId: movieActive.id,
              showtimes: [
                {
                  roomId: room1.id,
                  startTime,
                  priceStandard: 80000,
                  priceVip: 120000,
                },
              ],
            });
          expect(res.status).toBe(201);
          const data = parseApiData<ShowtimeResponseDto[]>(res);
          const st = data[0];
          const diffMs =
            new Date(st.endTime).getTime() - new Date(st.startTime).getTime();
          expect(diffMs).toBe(120 * 60 * 1000);
          createdShowtimeIds.push(st.id);
          return res;
        },
      );
    });
  });
});
