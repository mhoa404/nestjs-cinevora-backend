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
import { cleanupRefreshTokens } from '../../helpers/cleanup-refresh-token';

describe('[API] DELETE /rooms/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let cleanRoomId = 0;
  let linkedRoomId = 0;

  let seededMovieId = 0;
  let seededShowtimeId = 0;

  const createdRoomIds: number[] = [];

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

  const allocateRoomNames = async (): Promise<string[]> => {
    const roomRepository = dataSource.getRepository(Room);
    const existingRooms = await roomRepository.find({ select: ['name'] });
    const existingNames = new Set(existingRooms.map((room) => room.name));

    const availableNames = Array.from({ length: 100 }, (_, index) =>
      String(index).padStart(2, '0'),
    ).filter((name) => !existingNames.has(name));

    if (availableNames.length < 2) {
      throw new Error(
        'Không đủ room name dạng 2 chữ số để chạy delete-room e2e.',
      );
    }

    return availableNames.slice(0, 2);
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

    const [cleanRoomName, linkedRoomName] = await allocateRoomNames();

    const cleanRoom = await roomRepository.save(
      roomRepository.create({ name: cleanRoomName }),
    );
    cleanRoomId = cleanRoom.id;
    createdRoomIds.push(cleanRoom.id);

    const linkedRoom = await roomRepository.save(
      roomRepository.create({ name: linkedRoomName }),
    );
    linkedRoomId = linkedRoom.id;
    createdRoomIds.push(linkedRoom.id);

    const unique = Date.now();

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

    const startTime = new Date(Date.now() + 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

    const showtime = await showtimeRepository.save(
      showtimeRepository.create({
        movieId: movie.id,
        roomId: linkedRoom.id,
        startTime,
        endTime,
        priceStandard: 90000,
        priceVip: 120000,
        priceCouple: null,
      }),
    );
    seededShowtimeId = showtime.id;
  });

  afterAll(async () => {
    const showtimeRepository = dataSource.getRepository(Showtime);
    const movieRepository = dataSource.getRepository(Movie);
    const roomRepository = dataSource.getRepository(Room);

    if (seededShowtimeId) {
      await showtimeRepository.delete(seededShowtimeId);
    }

    if (seededMovieId) {
      await movieRepository.delete(seededMovieId);
    }

    if (createdRoomIds.length > 0) {
      await roomRepository.delete(createdRoomIds);
    }

    await cleanupRefreshTokens(dataSource);

    await exportTestReport(results, PREFIX, 'Delete_Room');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Xoá thất bại - Không truyền Authorization Token trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không truyền token',
          description: 'Không gửi access token khi gọi API xoá phòng.',
          procedure: `DELETE /rooms/${cleanRoomId}`,
          expectedResult: 401,
          preconditions: 'Không có token',
        },
        async () => {
          const response = await request(server).delete(
            `/rooms/${cleanRoomId}`,
          );

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Xoá thất bại - Truyền Fake Token trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Token không hợp lệ',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: `DELETE /rooms/${cleanRoomId}`,
          expectedResult: 401,
          preconditions: 'Token giả',
        },
        async () => {
          const response = await request(server)
            .delete(`/rooms/${cleanRoomId}`)
            .set('Authorization', 'Bearer fake.jwt.token');

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Xoá thất bại - Role Customer bị chặn trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Customer không có quyền',
          description: 'Tài khoản Customer cố xoá phòng chiếu.',
          procedure: `DELETE /rooms/${cleanRoomId}`,
          expectedResult: 403,
          preconditions: 'Token Customer',
        },
        async () => {
          const response = await request(server)
            .delete(`/rooms/${cleanRoomId}`)
            .set('Authorization', `Bearer ${customerToken}`);

          expect(response.status).toBe(403);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            403,
            'Bạn không có quyền thực hiện hành động này.',
          );

          return response;
        },
      );
    });
  });

  describe('Validation & Business Logic', () => {
    it('Xoá thất bại - ID không phải số nguyên trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'ID sai định dạng',
          description:
            'Truyền id là chuỗi chữ cái, ParseIntPipe không thể parse sang number.',
          procedure: 'DELETE /rooms/abc',
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        async () => {
          const response = await request(server)
            .delete('/rooms/abc')
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Validation failed (numeric string is expected)',
          );

          return response;
        },
      );
    });

    it('Xoá thất bại - Room ID không tồn tại', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Phòng không tồn tại',
          description: 'Xoá phòng với ID không tồn tại trong DB.',
          procedure: 'DELETE /rooms/999999',
          expectedResult: 404,
          preconditions: 'Token Admin',
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

    it('Xoá thất bại - Phòng đang có suất chiếu', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Phòng đang có suất chiếu',
          description:
            'Cố xoá phòng đang có suất chiếu, hệ thống phải trả về 409 Conflict.',
          procedure: `DELETE /rooms/${linkedRoomId}`,
          expectedResult: 409,
          preconditions: 'Token Admin, phòng có suất chiếu',
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
    it('Xoá thành công - Phòng không có suất chiếu', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Xoá phòng hợp lệ',
          description:
            'Xoá thành công một phòng không có suất chiếu nào liên kết.',
          procedure: `DELETE /rooms/${cleanRoomId}`,
          expectedResult: 204,
          preconditions: 'Token Admin, phòng không có suất chiếu',
        },
        async () => {
          const response = await request(server)
            .delete(`/rooms/${cleanRoomId}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(204);
          expect(response.text).toBe('');

          const roomRepository = dataSource.getRepository(Room);
          const deletedRoom = await roomRepository.findOne({
            where: { id: cleanRoomId },
          });

          expect(deletedRoom).toBeNull();

          return response;
        },
      );
    });
  });
});
