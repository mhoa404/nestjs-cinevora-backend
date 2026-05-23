import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { DataSource, Repository } from 'typeorm';
import { Server } from 'http';

import {
  parseApiError,
  expectErrorMessage,
  getActualStatus,
  parseApiData,
} from '../../helpers/http-test.helper';
import {
  AgeRating,
  Movie,
  MovieStatus,
} from '../../../src/modules/movies/entities/movie.entity';
import { AppModule } from '../../../src/app.module';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';
import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import { cleanupRefreshTokens } from '../../helpers/cleanup-refresh-token';

describe('[API] DELETE /movies/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;
  let movieRepository: Repository<Movie>;

  let adminToken = '';
  let customerToken = '';

  let endedMovieId = 0;
  let showingMovieId = 0;
  let comingMovieId = 0;

  const createdMovieIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'DMV';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return PREFIX + String(counter).padStart(2, '0');
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
    movieRepository = dataSource.getRepository(Movie);

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

    const uniqueSeed = Date.now();

    const endedMovie = await movieRepository.save(
      movieRepository.create({
        title: 'Ended Movie ' + uniqueSeed,
        slug: 'ended-movie-' + uniqueSeed,
        posterUrl: 'https://example.com/ended-poster.jpg',
        trailerUrl: 'https://example.com/ended-trailer.mp4',
        bannerUrl: 'https://example.com/ended-banner.jpg',
        description: 'Ended movie for DELETE /movies/:id.',
        duration: 120,
        director: 'Ended Director',
        actor: 'Ended Actor',
        language: 'EN',
        ageRating: AgeRating.C13,
        rated: '13+',
        status: MovieStatus.ENDED,
        releaseDate: new Date(addDays(-20)),
        endDate: new Date(addDays(-1)),
      }),
    );

    endedMovieId = endedMovie.id;
    createdMovieIds.push(endedMovie.id);

    const showingMovie = await movieRepository.save(
      movieRepository.create({
        title: 'Showing Movie ' + uniqueSeed,
        slug: 'showing-movie-' + uniqueSeed,
        posterUrl: 'https://example.com/showing-poster.jpg',
        trailerUrl: 'https://example.com/showing-trailer.mp4',
        bannerUrl: 'https://example.com/showing-banner.jpg',
        description: 'Showing movie for DELETE /movies/:id.',
        duration: 120,
        director: 'Showing Director',
        actor: 'Showing Actor',
        language: 'EN',
        ageRating: AgeRating.C13,
        rated: '13+',
        status: MovieStatus.SHOWING,
        releaseDate: new Date(addDays(-5)),
        endDate: new Date(addDays(5)),
      }),
    );

    showingMovieId = showingMovie.id;
    createdMovieIds.push(showingMovie.id);

    const comingMovie = await movieRepository.save(
      movieRepository.create({
        title: 'Coming Movie ' + uniqueSeed,
        slug: 'coming-movie-' + uniqueSeed,
        posterUrl: 'https://example.com/coming-poster.jpg',
        trailerUrl: 'https://example.com/coming-trailer.mp4',
        bannerUrl: 'https://example.com/coming-banner.jpg',
        description: 'Coming movie for DELETE /movies/:id.',
        duration: 120,
        director: 'Coming Director',
        actor: 'Coming Actor',
        language: 'EN',
        ageRating: AgeRating.C13,
        rated: '13+',
        status: MovieStatus.COMING,
        releaseDate: new Date(addDays(10)),
        endDate: new Date(addDays(20)),
      }),
    );

    comingMovieId = comingMovie.id;
    createdMovieIds.push(comingMovie.id);
  });

  afterAll(async () => {
    if (createdMovieIds.length > 0) {
      await movieRepository.delete(createdMovieIds);
    }

    await cleanupRefreshTokens(dataSource);

    await exportTestReport(results, PREFIX, 'Delete_Movie');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Xoá thất bại - Không truyền Authorization Token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không có Header Authorization',
          description: 'Không gửi access token khi gọi API xoá phim.',
          procedure: 'DELETE /movies/' + endedMovieId,
          expectedResult: 401,
          preconditions: 'Không có token.',
        },
        async () => {
          const response = await request(server).delete(
            '/movies/' + endedMovieId,
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
          testCase: 'Gửi Token giả',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: 'DELETE /movies/' + endedMovieId,
          expectedResult: 401,
          preconditions: 'Token giả.',
        },
        async () => {
          const response = await request(server)
            .delete('/movies/' + endedMovieId)
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
          testCase: 'Gửi Bearer token của Customer',
          description: 'Tài khoản customer cố xoá phim.',
          procedure: 'DELETE /movies/' + endedMovieId,
          expectedResult: 403,
          preconditions: 'Dùng token customer.',
        },
        async () => {
          const response = await request(server)
            .delete('/movies/' + endedMovieId)
            .set('Authorization', 'Bearer ' + customerToken);

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

  describe('Validation Payload', () => {
    it('Xoá thất bại - ID param không phải số', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'ID param không phải số',
          description:
            'Gọi DELETE /movies/:id với id không phải numeric string.',
          procedure: 'DELETE /movies/abc',
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .delete('/movies/abc')
            .set('Authorization', 'Bearer ' + adminToken);

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
  });

  describe('Ràng buộc nghiệp vụ', () => {
    it('Xoá thất bại - Movie ID không tồn tại', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Movie ID không tồn tại',
          description: 'Xoá phim với ID không tồn tại.',
          procedure: 'DELETE /movies/999999',
          expectedResult: 404,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .delete('/movies/999999')
            .set('Authorization', 'Bearer ' + adminToken);

          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Phim #999999 không tồn tại.');

          return response;
        },
      );
    });

    it('Xoá thất bại - Không thể xoá phim đang chiếu', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Movie status now_showing',
          description:
            'Cố xoá phim đang có trạng thái now_showing. Service chỉ cho xoá phim ended.',
          procedure: 'DELETE /movies/' + showingMovieId,
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .delete('/movies/' + showingMovieId)
            .set('Authorization', 'Bearer ' + adminToken);

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

    it('Xoá thất bại - Không thể xoá phim sắp chiếu', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Movie status upcoming',
          description:
            'Cố xoá phim đang có trạng thái upcoming. Service chỉ cho xoá phim ended.',
          procedure: 'DELETE /movies/' + comingMovieId,
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .delete('/movies/' + comingMovieId)
            .set('Authorization', 'Bearer ' + adminToken);

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
    it('Xoá thành công - Phim trạng thái ended', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Xoá movie ended',
          description: 'Xoá thành công một phim ở trạng thái ended.',
          procedure: 'DELETE /movies/' + endedMovieId,
          expectedResult: 204,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .delete('/movies/' + endedMovieId)
            .set('Authorization', 'Bearer ' + adminToken);

          expect(response.status).toBe(204);
          expect(response.body).toEqual({});

          const deletedMovie = await movieRepository.findOneBy({
            id: endedMovieId,
          });
          expect(deletedMovie).toBeNull();

          return response;
        },
      );
    });
  });
});
