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
import { parseApiData } from '../../helpers/http-test.helper';

describe('[API] DELETE /showtimes/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let movieActive: Movie;
  let movieEnded: Movie;
  let room: Room;

  const results: TestCaseRecord[] = [];
  const PREFIX = 'DST';
  let counter = 0;

  const nextId = () => `${PREFIX}${String(++counter).padStart(2, '0')}`;

  const addDays = (d: number): string => {
    const dt = new Date();
    dt.setDate(dt.getDate() + d);
    return dt.toISOString().slice(0, 10);
  };

  const seedShowtime = async (movie: Movie): Promise<Showtime> => {
    const repo = dataSource.getRepository(Showtime);
    const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
    startTime.setMilliseconds(0);
    const endTime = new Date(startTime.getTime() + movie.duration * 60 * 1000);
    return repo.save(
      repo.create({
        movieId: movie.id,
        roomId: room.id,
        startTime,
        endTime,
        priceStandard: 80000,
        priceVip: 120000,
      }),
    );
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
        title: 'DST Active Movie',
        posterUrl: 'https://example.com/poster.jpg',
        duration: 90,
        ageRating: AgeRating.P,
        status: MovieStatus.SHOWING,
        releaseDate: addDays(-10) as unknown as Date,
        endDate: addDays(365) as unknown as Date,
      }),
    );

    movieEnded = await movieRepo.save(
      movieRepo.create({
        title: 'DST Ended Movie',
        posterUrl: 'https://example.com/poster.jpg',
        duration: 90,
        ageRating: AgeRating.P,
        status: MovieStatus.ENDED,
        releaseDate: addDays(-60) as unknown as Date,
        endDate: addDays(-1) as unknown as Date,
      }),
    );

    room = await roomRepo.save(roomRepo.create({ name: 'D1' }));
  });

  afterAll(async () => {
    // Cleanup còn sót nếu có
    await dataSource
      .getRepository(Movie)
      .delete([movieActive.id, movieEnded.id]);
    await dataSource.getRepository(Room).delete(room.id);
    await exportTestReport(results, PREFIX, 'Delete_Showtime');
    await app.close();
  });

  // ─── Phân quyền ─────────────────────────────────────────────────────────────

  describe('Phân quyền', () => {
    it('DST – Không token → 401', async () => {
      const st = await seedShowtime(movieEnded);
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Missing Token',
          description: 'DELETE /showtimes/:id không có token.',
          procedure: 'No token',
          expectedResult: 401,
          preconditions: '',
        },
        async () => {
          const res = await request(server).delete(`/showtimes/${st.id}`);
          expect(res.status).toBe(401);
          return res;
        },
      );
      // Cleanup vì test không xóa được
      await dataSource.getRepository(Showtime).delete(st.id);
    });

    it('DST – Customer token → 403', async () => {
      const st = await seedShowtime(movieEnded);
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Customer Forbidden',
          description: 'Customer không được xóa showtime.',
          procedure: 'customerToken',
          expectedResult: 403,
          preconditions: '',
        },
        async () => {
          const res = await request(server)
            .delete(`/showtimes/${st.id}`)
            .set('Authorization', `Bearer ${customerToken}`);
          expect(res.status).toBe(403);
          return res;
        },
      );
      await dataSource.getRepository(Showtime).delete(st.id);
    });
  });

  // ─── Validation ─────────────────────────────────────────────────────────────

  describe('Validation', () => {
    it('DST – id không phải số → 400', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Non-integer ID',
          description: 'DELETE /showtimes/xyz.',
          procedure: 'id=xyz',
          expectedResult: 400,
          preconditions: '',
        },
        async () => {
          const res = await request(server)
            .delete('/showtimes/xyz')
            .set('Authorization', `Bearer ${adminToken}`);
          expect(res.status).toBe(400);
          return res;
        },
      );
    });
  });

  // ─── Business Rules ──────────────────────────────────────────────────────────

  describe('Ràng buộc nghiệp vụ', () => {
    it('DST – id không tồn tại → 404', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Not Found',
          description: 'DELETE /showtimes/999999.',
          procedure: 'id=999999',
          expectedResult: 404,
          preconditions: '',
        },
        async () => {
          const res = await request(server)
            .delete('/showtimes/999999')
            .set('Authorization', `Bearer ${adminToken}`);
          expect(res.status).toBe(404);
          return res;
        },
      );
    });

    it('DST – Phim chưa ended (now_showing) → 409 bị chặn xóa', async () => {
      const st = await seedShowtime(movieActive);
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Movie Not Ended',
          description: 'Xóa showtime của phim còn đang chiếu bị chặn.',
          procedure: `showtimeId=${st.id}, movie.status=now_showing`,
          expectedResult: 409,
          preconditions: 'movieActive.status = now_showing.',
        },
        async () => {
          const res = await request(server)
            .delete(`/showtimes/${st.id}`)
            .set('Authorization', `Bearer ${adminToken}`);
          expect(res.status).toBe(409);
          const err = parseApiError(res);
          expectErrorMessage(err, 409, 'ended');
          return res;
        },
      );
      // Cleanup — showtime không bị xóa vì bị chặn
      await dataSource.getRepository(Showtime).delete(st.id);
    });
  });

  // ─── Happy Path ──────────────────────────────────────────────────────────────

  describe('Luồng thành công', () => {
    it('DST – Xóa showtime của phim đã ended → 204', async () => {
      const st = await seedShowtime(movieEnded);
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Delete Ended Movie Showtime',
          description: 'Xóa thành công showtime khi phim có status=ended.',
          procedure: `showtimeId=${st.id}, movie.status=ended`,
          expectedResult: 204,
          preconditions: 'movieEnded.status = ended.',
        },
        async () => {
          const res = await request(server)
            .delete(`/showtimes/${st.id}`)
            .set('Authorization', `Bearer ${adminToken}`);
          expect(res.status).toBe(204);
          return res;
        },
      );
    });

    it('DST – Xóa lần 2 cùng id → 404', async () => {
      // Dùng lại id từ test trước (đã xóa)
      const repo = dataSource.getRepository(Showtime);
      // Seed rồi xóa trước để lấy id
      const st = await seedShowtime(movieEnded);
      await repo.delete(st.id);

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Double Delete',
          description: 'Xóa lần 2 cùng id → 404.',
          procedure: `id đã bị xóa`,
          expectedResult: 404,
          preconditions: 'Showtime đã bị xóa trước.',
        },
        async () => {
          const res = await request(server)
            .delete(`/showtimes/${st.id}`)
            .set('Authorization', `Bearer ${adminToken}`);
          expect(res.status).toBe(404);
          return res;
        },
      );
    });
  });
});
