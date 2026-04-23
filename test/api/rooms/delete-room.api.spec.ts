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
import { Room } from '../../../src/modules/rooms/entities/room.entity';
import { Showtime } from '../../../src/modules/showtimes/entities/showtime.entity';
import {
  Movie,
  AgeRating,
  MovieStatus,
} from '../../../src/modules/movies/entities/movie.entity';
import { AppModule } from '../../../src/app.module';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';
import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';

describe('[API] DELETE /rooms/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  // Phòng sạch (không có showtime) => có thể xoá
  let cleanRoomId = 0;
  // Phòng đang có showtime => không thể xoá
  let linkedRoomId = 0;

  let seededMovieId = 0;
  let seededShowtimeId = 0;

  const results: TestCaseRecord[] = [];
  const PREFIX = 'DRM';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return `${PREFIX}${String(counter).padStart(2, '0')}`;
  };

  const record = async (
    meta: Omit<TestCaseRecord, 'passed' | 'testDate' | 'actualResult'>,
    executor: () => Promise<Response>,
  ): Promise<void> => {
    const testDate = new Date();
    let passed = false;
    let actualResult: number | null = null;

    try {
      const response = await executor();
      actualResult = response.status;
      passed = true;
    } catch (error: unknown) {
      actualResult = getActualStatus(error);
      passed = false;
      throw error;
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

    const adminLoginRes = await request(server)
      .post('/auth/mobile/login')
      .send({ email: 'api_tester@gmail.com', password: 'Api_tester_123' });
    adminToken = parseApiData<AuthResponseDto>(adminLoginRes).accessToken;

    const customerLoginRes = await request(server)
      .post('/auth/mobile/login')
      .send({ email: 'api_client@gmail.com', password: 'Api_client_123' });
    customerToken = parseApiData<AuthResponseDto>(customerLoginRes).accessToken;

    const roomRepository = dataSource.getRepository(Room);
    const movieRepository = dataSource.getRepository(Movie);
    const showtimeRepository = dataSource.getRepository(Showtime);
    const unique = Date.now();

    // Seed phòng sạch
    const cleanRoom = await roomRepository.save(
      roomRepository.create({ name: '50' }),
    );
    cleanRoomId = cleanRoom.id;

    // Seed phòng có showtime (để test 409)
    const linkedRoom = await roomRepository.save(
      roomRepository.create({ name: '51' }),
    );
    linkedRoomId = linkedRoom.id;

    // Seed một movie tối giản để làm FK cho showtime
    const movie = await movieRepository.save(
      movieRepository.create({
        title: `Delete Room Test Movie ${unique}`,
        slug: `delete-room-test-movie-${unique}`,
        posterUrl: 'https://example.com/poster.jpg',
        duration: 120,
        ageRating: AgeRating.P,
        status: MovieStatus.SHOWING,
        releaseDate: new Date(),
      }),
    );
    seededMovieId = movie.id;

    // Seed showtime liên kết với linkedRoom
    const now = new Date();
    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 giờ
    const showtime = await showtimeRepository.save(
      showtimeRepository.create({
        movieId: String(movie.id),
        roomId: linkedRoom.id,
        startTime: now,
        endTime: later,
        priceStandard: 90000,
        priceVip: 120000,
        priceCouple: null,
      }),
    );
    seededShowtimeId = showtime.id;
  });

  afterAll(async () => {
    // Teardown: xoá showtime -> movie -> rooms (thứ tự đúng để tránh FK constraint)
    const showtimeRepository = dataSource.getRepository(Showtime);
    const movieRepository = dataSource.getRepository(Movie);
    const roomRepository = dataSource.getRepository(Room);

    if (seededShowtimeId) {
      await showtimeRepository.delete(seededShowtimeId);
    }
    if (seededMovieId) {
      await movieRepository.delete(seededMovieId);
    }
    // linkedRoom vẫn còn sau test (không bị xoá thành công), cleanRoom đã bị xoá bởi happy path
    // Nếu cleanRoom chưa bị xoá (test fail), dọn nốt
    const remaining = await roomRepository.findOne({
      where: { id: cleanRoomId },
    });
    if (remaining) {
      await roomRepository.delete(cleanRoomId);
    }
    await roomRepository.delete(linkedRoomId);

    await exportTestReport(results, PREFIX, 'Delete_Room');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Xoá thất bại - Không truyền Authorization Token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Missing Token',
          description: 'Không gửi access token khi gọi API xoá phòng.',
          procedure: 'Không có dữ liệu',
          expectedResult: 401,
          preconditions: 'Không có token.',
        },
        async () => {
          const response = await request(server).delete(
            `/rooms/${cleanRoomId}`,
          );
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Xoá thất bại - Truyền Fake Token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Fake Token',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: 'Không có dữ liệu',
          expectedResult: 401,
          preconditions: 'Token giả.',
        },
        async () => {
          const response = await request(server)
            .delete(`/rooms/${cleanRoomId}`)
            .set('Authorization', 'Bearer fake.jwt.token');
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Xoá thất bại - Role Customer bị chặn', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Customer Forbidden',
          description: 'Tài khoản Customer cố xoá phòng chiếu.',
          procedure: 'Không có dữ liệu',
          expectedResult: 403,
          preconditions: 'Dùng token Customer.',
        },
        async () => {
          const response = await request(server)
            .delete(`/rooms/${cleanRoomId}`)
            .set('Authorization', `Bearer ${customerToken}`);
          expect(response.status).toBe(403);
          return response;
        },
      );
    });
  });

  describe('Business Logic', () => {
    it('Xoá thất bại - Room ID không tồn tại', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Room Not Found',
          description: 'Xoá phòng với ID không tồn tại trong DB.',
          procedure: 'Không có dữ liệu',
          expectedResult: 404,
          preconditions: 'Dùng token Admin.',
        },
        async () => {
          const response = await request(server)
            .delete('/rooms/999999')
            .set('Authorization', `Bearer ${adminToken}`);
          expect(response.status).toBe(404);
          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Phòng #999999 không tồn tại.');
          return response;
        },
      );
    });

    it('Xoá thất bại - Phòng đang có suất chiếu liên kết (409 Conflict)', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Room Has Active Showtimes',
          description:
            'Cố xoá phòng đang có suất chiếu, hệ thống phải trả về 409 Conflict.',
          procedure: 'Không có dữ liệu',
          expectedResult: 409,
          preconditions: `Phòng ID ${linkedRoomId} đã được gán showtime ID ${seededShowtimeId}.`,
        },
        async () => {
          const response = await request(server)
            .delete(`/rooms/${linkedRoomId}`)
            .set('Authorization', `Bearer ${adminToken}`);
          expect(response.status).toBe(409);
          const error = parseApiError(response);
          expectErrorMessage(
            error,
            409,
            'Không thể xoá phòng đang có suất chiếu',
          );
          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Xoá thành công - Phòng sạch bị xoá, trả về 204 No Content', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Delete Clean Room',
          description:
            'Xoá thành công một phòng không có suất chiếu nào liên kết.',
          procedure: 'Không có dữ liệu',
          expectedResult: 204,
          preconditions: `Phòng "50" (ID: ${cleanRoomId}) không có showtime.`,
        },
        async () => {
          const response = await request(server)
            .delete(`/rooms/${cleanRoomId}`)
            .set('Authorization', `Bearer ${adminToken}`);
          expect(response.status).toBe(204);
          return response;
        },
      );
    });

    it('Xác nhận sau xoá - Phòng không còn tồn tại trong DB (404)', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Verify Deletion',
          description:
            'Gọi lại GET /rooms/:id sau khi xoá, hệ thống trả về 404.',
          procedure: 'Không có dữ liệu',
          expectedResult: 404,
          preconditions: `Phòng ID ${cleanRoomId} đã bị xoá ở test case trước.`,
        },
        async () => {
          const response = await request(server)
            .get(`/rooms/${cleanRoomId}`)
            .set('Authorization', `Bearer ${adminToken}`);
          expect(response.status).toBe(404);
          return response;
        },
      );
    });
  });
});
