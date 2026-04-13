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
import { Genre } from '../../../src/modules/genres/entities/genre.entity';
import { AppModule } from '../../../src/app.module';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';
import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';

type MovieBody = {
  title?: string;
  posterUrl?: string;
  trailerUrl?: string;
  description?: string;
  duration?: number | string;
  director?: string;
  actor?: string;
  language?: string;
  ageRating?: AgeRating | string;
  rated?: string;
  status?: MovieStatus | string;
  releaseDate?: string;
  endDate?: string;
  genreIds?: Array<number | string>;
};

interface UpdateMovieResponse {
  id: number;
  slug: string | null;
  title: string;
  posterUrl: string;
  trailerUrl: string | null;
  description: string | null;
  duration: number;
  director: string | null;
  actor: string | null;
  language: string | null;
  ageRating: AgeRating;
  rated: string | null;
  status: MovieStatus;
  releaseDate: string;
  endDate: string | null;
  genres: { id: number; name: string; slug: string }[];
}

describe('[API] PUT /movies/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let targetMovieId = 0;
  let validGenreId = 0;

  const results: TestCaseRecord[] = [];
  const PREFIX = 'UMV';
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

  const stringifyProcedure = (body?: MovieBody): string => {
    if (!body || Object.keys(body).length === 0) return 'Không có dữ liệu';
    return JSON.stringify(body, null, 2);
  };

  const buildValidBody = (overrides: Partial<MovieBody> = {}): MovieBody => ({
    title: 'Updated Movie Title',
    posterUrl: 'https://example.com/poster-updated.jpg',
    trailerUrl: 'https://example.com/trailer-updated.mp4',
    description: 'Updated movie description',
    duration: 135,
    director: 'Updated Director',
    actor: 'Updated Actor',
    language: 'VI',
    ageRating: AgeRating.C16,
    rated: '16+',
    status: MovieStatus.SHOWING,
    releaseDate: addDays(10),
    endDate: addDays(20),
    genreIds: [validGenreId],
    ...overrides,
  });

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

    const genreRepository = dataSource.getRepository(Genre);
    const movieRepository = dataSource.getRepository(Movie);

    const uniqueSeed = Date.now();

    const genre = await genreRepository.save(
      genreRepository.create({
        name: `Update Movie Genre ${uniqueSeed}`,
        slug: `update-movie-genre-${uniqueSeed}`,
      }),
    );
    validGenreId = genre.id;

    const movie = await movieRepository.save(
      movieRepository.create({
        title: `Original Movie ${uniqueSeed}`,
        slug: `original-movie-${uniqueSeed}`,
        posterUrl: 'https://example.com/original-poster.jpg',
        trailerUrl: 'https://example.com/original-trailer.mp4',
        description: 'Original description',
        duration: 120,
        director: 'Original Director',
        actor: 'Original Actor',
        language: 'EN',
        ageRating: AgeRating.C13,
        rated: '13+',
        status: MovieStatus.COMING,
        releaseDate: new Date(addDays(8)),
        endDate: new Date(addDays(18)),
        genres: [genre],
      }),
    );

    targetMovieId = movie.id;
  });

  afterAll(async () => {
    await exportTestReport(results, PREFIX, 'Update_Movie');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Cập nhật thất bại - Không truyền Authorization Token', async () => {
      const body = buildValidBody();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Missing Token',
          description: 'Không gửi access token khi gọi API cập nhật phim.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không có token.',
        },
        async () => {
          const response = await request(server)
            .put(`/movies/${targetMovieId}`)
            .send(body);

          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Cập nhật thất bại - Truyền Fake Token', async () => {
      const body = buildValidBody();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Fake Token',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Token giả.',
        },
        async () => {
          const response = await request(server)
            .put(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer fake.jwt.token')
            .send(body);

          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Cập nhật thất bại - Role Customer bị chặn', async () => {
      const body = buildValidBody();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Customer Forbidden',
          description: 'Tài khoản customer cố cập nhật phim.',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: 'Dùng token customer.',
        },
        async () => {
          const response = await request(server)
            .put(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${customerToken}`)
            .send(body);

          expect(response.status).toBe(403);
          return response;
        },
      );
    });
  });

  describe('Validation Payload', () => {
    it('Cập nhật thất bại - Thiếu full payload do UpdateMovieDto hiện tại là full DTO', async () => {
      const body: MovieBody = { title: 'Only Title' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Partial Payload Rejected',
          description:
            'Chỉ gửi title như PATCH cũ, nhưng endpoint hiện tại yêu cầu full body.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .put(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expect(error.statusCode).toBe(400);
          return response;
        },
      );
    });

    it('Cập nhật thất bại - duration là chuỗi', async () => {
      const body = buildValidBody({ duration: '120' });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Wrong Type',
          description: 'Truyền duration là string.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .put(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Thời lượng phim phải là số nguyên.');
          return response;
        },
      );
    });

    it('Cập nhật thất bại - posterUrl sai định dạng', async () => {
      const body = buildValidBody({ posterUrl: 'invalid_url' });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Invalid URL',
          description: 'posterUrl không phải URL hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .put(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Poster phim phải là URL hợp lệ.');
          return response;
        },
      );
    });

    it('Cập nhật thất bại - ageRating không thuộc enum', async () => {
      const body = buildValidBody({ ageRating: 'C99' });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Invalid Enum',
          description: 'ageRating không tồn tại trong enum.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .put(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Giới hạn độ tuổi không hợp lệ.');
          return response;
        },
      );
    });

    it('Cập nhật thất bại - genreIds chứa string', async () => {
      const body = buildValidBody({ genreIds: [validGenreId, 'abc'] });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Invalid Array',
          description: 'genreIds có phần tử không phải số nguyên.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .put(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Mỗi genreId phải là số nguyên.');
          return response;
        },
      );
    });
  });

  describe('Ràng buộc nghiệp vụ', () => {
    it('Cập nhật thất bại - Movie ID không tồn tại', async () => {
      const body = buildValidBody();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Movie Not Found',
          description: 'Cập nhật phim với ID không tồn tại.',
          procedure: stringifyProcedure(body),
          expectedResult: 404,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .put('/movies/999999')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(404);
          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Phim #999999 không tồn tại.');
          return response;
        },
      );
    });

    it('Cập nhật thất bại - Genre ID không tồn tại', async () => {
      const body = buildValidBody({ genreIds: [999999] });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Genre Not Found',
          description: 'Dùng genreIds không có thật.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .put(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Thể loại với id [999999] không tồn tại.',
          );
          return response;
        },
      );
    });

    it('Cập nhật thất bại - endDate cách hôm nay dưới 7 ngày', async () => {
      const body = buildValidBody({
        releaseDate: addDays(2),
        endDate: addDays(3),
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: End Date Too Soon',
          description: 'endDate nhỏ hơn ngưỡng tối thiểu 7 ngày kể từ hôm nay.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .put(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Ngày kết thúc chiếu phải cách ít nhất 7 ngày kể từ hôm nay.',
          );
          return response;
        },
      );
    });

    it('Cập nhật thất bại - endDate không sau releaseDate', async () => {
      const body = buildValidBody({
        releaseDate: addDays(12),
        endDate: addDays(12),
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: End Date Before Release Date',
          description: 'endDate bằng hoặc nhỏ hơn releaseDate.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .put(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Ngày kết thúc chiếu phải sau ngày khởi chiếu.',
          );
          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Cập nhật thành công với full payload hợp lệ', async () => {
      const body = buildValidBody({
        title: '  Updated Blockbuster  ',
        description: '  New description  ',
        director: '  James Gunn  ',
        actor: '  Actor A, Actor B  ',
        language: '  EN  ',
        rated: '  PG-13  ',
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Full Update',
          description: 'Cập nhật phim thành công bằng full payload hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .put(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(200);

          const data = parseApiData<UpdateMovieResponse>(response);
          expect(data.id).toBe(targetMovieId);
          expect(data.title).toBe('Updated Blockbuster');
          expect(data.slug).toMatch(/^updated-blockbuster-\d{3}$/);
          expect(data.description).toBe('New description');
          expect(data.director).toBe('James Gunn');
          expect(data.actor).toBe('Actor A, Actor B');
          expect(data.language).toBe('EN');
          expect(data.rated).toBe('PG-13');
          expect(data.genres).toHaveLength(1);
          expect(data.genres[0].id).toBe(validGenreId);

          return response;
        },
      );
    });
  });
});
