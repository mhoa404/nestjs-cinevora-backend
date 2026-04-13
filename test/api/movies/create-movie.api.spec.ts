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

interface CreateMovieResponse {
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

describe('[API] POST /movies', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let validGenreId = 0;

  const results: TestCaseRecord[] = [];
  const PREFIX = 'CMV';
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
    title: 'New Movie Title',
    posterUrl: 'https://example.com/poster.jpg',
    trailerUrl: 'https://example.com/trailer.mp4',
    description: 'A super interesting movie.',
    duration: 120,
    director: 'Christopher Nolan',
    actor: 'Leonardo DiCaprio',
    language: 'EN',
    ageRating: AgeRating.C18,
    rated: '18+',
    status: MovieStatus.COMING,
    releaseDate: addDays(5),
    endDate: addDays(15),
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

    const uniqueSeed = Date.now();
    const genre = await genreRepository.save(
      genreRepository.create({
        name: `Create Movie Genre ${uniqueSeed}`,
        slug: `create-movie-genre-${uniqueSeed}`,
      }),
    );
    validGenreId = genre.id;
  });

  afterAll(async () => {
    await exportTestReport(results, PREFIX, 'Create_Movie');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Tạo thất bại - Không truyền Authorization Token', async () => {
      const body = buildValidBody();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Missing Token',
          description: 'Không gửi access token khi gọi API tạo phim.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không có token.',
        },
        async () => {
          const response = await request(server).post('/movies').send(body);

          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Tạo thất bại - Truyền Fake Token', async () => {
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
            .post('/movies')
            .set('Authorization', 'Bearer fake.jwt.token')
            .send(body);

          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Tạo thất bại - Role Customer bị chặn', async () => {
      const body = buildValidBody();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Customer Forbidden',
          description: 'Tài khoản customer cố tạo phim.',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: 'Dùng token customer.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', `Bearer ${customerToken}`)
            .send(body);

          expect(response.status).toBe(403);
          return response;
        },
      );
    });
  });

  describe('Validation Payload', () => {
    it('Tạo thất bại - Thiếu title do bỏ qua trường title', async () => {
      const body = buildValidBody();
      delete body.title;

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Missing Title',
          description: 'Gửi body không có trường title.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expect(error.statusCode).toBe(400);
          return response;
        },
      );
    });

    it('Tạo thất bại - duration là chuỗi thay vì số', async () => {
      const body = buildValidBody({ duration: '120' });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Wrong Type',
          description: 'Truyền duration là chuỗi thay vì số.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Thời lượng phim phải là số nguyên.');
          return response;
        },
      );
    });

    it('Tạo thất bại - posterUrl sai định dạng URL', async () => {
      const body = buildValidBody({ posterUrl: 'invalid_url' });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Invalid URL',
          description: 'posterUrl không đúng định dạng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Poster phim phải là URL hợp lệ.');
          return response;
        },
      );
    });

    it('Tạo thất bại - ageRating không thuộc enum', async () => {
      const body = buildValidBody({ ageRating: 'INVALID' });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Invalid Enum',
          description: 'ageRating không thuộc enum quy định.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Giới hạn độ tuổi không hợp lệ.');
          return response;
        },
      );
    });

    it('Tạo thất bại - genreIds chứa giá trị không hợp lệ', async () => {
      const body = buildValidBody({ genreIds: [validGenreId, 'abc'] });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Invalid Array Element',
          description: 'Truyền mảng genreIds có chứa chuỗi.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
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
    it('Tạo thất bại - Genre ID không tồn tại', async () => {
      const body = buildValidBody({ genreIds: [999999] });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Genre Not Found',
          description: 'Genre ID không có trong cơ sở dữ liệu.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
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

    it('Tạo thất bại - endDate cách hôm nay dưới 7 ngày', async () => {
      const body = buildValidBody({
        releaseDate: addDays(2),
        endDate: addDays(3),
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: End Date Too Soon',
          description: 'Truyền endDate nhỏ hơn 7 ngày từ lúc tạo.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
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

    it('Tạo thất bại - endDate không sau releaseDate', async () => {
      const body = buildValidBody({
        releaseDate: addDays(12),
        endDate: addDays(12),
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: End Date Before Release',
          description: 'Truyền endDate bằng releaseDate.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
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
    it('Tạo thành công với full payload hợp lệ', async () => {
      const body = buildValidBody({
        title: '  Epic Blockbuster  ',
        description: '  An incredible journey  ',
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Full Creation',
          description: 'Tạo phim thành công với data chuẩn.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(201);

          const data = parseApiData<CreateMovieResponse>(response);
          expect(data.title).toBe('Epic Blockbuster');
          expect(data.slug).toMatch(/^epic-blockbuster-\d{3}$/);
          expect(data.description).toBe('An incredible journey');
          expect(data.status).toBe(MovieStatus.COMING);
          expect(data.genres).toHaveLength(1);
          expect(data.genres[0].id).toBe(validGenreId);

          return response;
        },
      );
    });
  });
});
