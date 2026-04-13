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
import {
  AgeRating,
  MovieStatus,
  Movie,
} from '../../../src/modules/movies/entities/movie.entity';
import { AppModule } from '../../../src/app.module';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';
import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';

describe('[API] DELETE /movies/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let endedMovieId = 0;
  let showingMovieId = 0;

  const results: TestCaseRecord[] = [];
  const PREFIX = 'DMV';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return `${PREFIX}${String(counter).padStart(2, '0')}`;
  };

  const formatDate = (date: Date): string => {
    return date.toISOString().slice(0, 10);
  };

  const addDays = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return formatDate(date);
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

    const movieRepository = dataSource.getRepository(Movie);
    const uniqueSeed = Date.now();

    const endedMovie = await movieRepository.save(
      movieRepository.create({
        title: `Ended Movie ${uniqueSeed}`,
        slug: `ended-movie-${uniqueSeed}`,
        posterUrl: 'https://example.com/poster.jpg',
        trailerUrl: 'https://example.com/trailer.mp4',
        description: 'Ended description',
        duration: 120,
        director: 'Director',
        actor: 'Actor',
        language: 'EN',
        ageRating: AgeRating.C13,
        rated: '13+',
        status: MovieStatus.ENDED,
        releaseDate: new Date(addDays(-20)),
        endDate: new Date(addDays(-1)),
      }),
    );
    endedMovieId = endedMovie.id;

    const showingMovie = await movieRepository.save(
      movieRepository.create({
        title: `Showing Movie ${uniqueSeed}`,
        slug: `showing-movie-${uniqueSeed}`,
        posterUrl: 'https://example.com/poster.jpg',
        trailerUrl: 'https://example.com/trailer.mp4',
        description: 'Showing description',
        duration: 120,
        director: 'Director',
        actor: 'Actor',
        language: 'EN',
        ageRating: AgeRating.C13,
        rated: '13+',
        status: MovieStatus.SHOWING,
        releaseDate: new Date(addDays(-5)),
        endDate: new Date(addDays(5)),
      }),
    );
    showingMovieId = showingMovie.id;
  });

  afterAll(async () => {
    await exportTestReport(results, PREFIX, 'Delete_Movie');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Xoá thất bại - Không truyền Authorization Token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Missing Token',
          description: 'Không gửi access token khi gọi API xoá phim.',
          procedure: 'Không có dữ liệu',
          expectedResult: 401,
          preconditions: 'Không có token.',
        },
        async () => {
          const response = await request(server).delete(
            `/movies/${endedMovieId}`,
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
            .delete(`/movies/${endedMovieId}`)
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
          description: 'Tài khoản customer cố xoá phim.',
          procedure: 'Không có dữ liệu',
          expectedResult: 403,
          preconditions: 'Dùng token customer.',
        },
        async () => {
          const response = await request(server)
            .delete(`/movies/${endedMovieId}`)
            .set('Authorization', `Bearer ${customerToken}`);
          expect(response.status).toBe(403);
          return response;
        },
      );
    });
  });

  describe('Ràng buộc nghiệp vụ', () => {
    it('Xoá thất bại - Movie ID không tồn tại', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Movie Not Found',
          description: 'Xoá phim với ID không tồn tại.',
          procedure: 'Không có dữ liệu',
          expectedResult: 404,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .delete('/movies/999999')
            .set('Authorization', `Bearer ${adminToken}`);
          expect(response.status).toBe(404);
          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Phim #999999 không tồn tại.');
          return response;
        },
      );
    });

    it('Xoá thất bại - Không thể xoá phim khi trạng thái chưa kết thúc', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Cannot Delete Non-Ended Movie',
          description: 'Cố xoá phim đang có trạng thái SHOWING.',
          procedure: 'Không có dữ liệu',
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .delete(`/movies/${showingMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`);
          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Chỉ có thể xoá phim khi trạng thái đã kết thúc.',
          );
          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Xoá thành công', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Complete Deletion',
          description: 'Xoá thành công một phim ở trạng thái ENDED.',
          procedure: 'Không có dữ liệu',
          expectedResult: 204,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .delete(`/movies/${endedMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`);
          expect(response.status).toBe(204);
          return response;
        },
      );
    });
  });
});
