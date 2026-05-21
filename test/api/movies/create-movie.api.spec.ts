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
  Movie,
  MovieStatus,
} from '../../../src/modules/movies/entities/movie.entity';
import { Genre } from '../../../src/modules/genres/entities/genre.entity';
import { AppModule } from '../../../src/app.module';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';
import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import { cleanupRefreshTokens } from '../../helpers/cleanup-refresh-token';

type MovieBody = {
  title?: string;
  posterUrl?: string;
  trailerUrl?: string;
  bannerUrl?: string;
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
  genreIds?: Array<number | string> | string;
};

interface CreateMovieResponse {
  id: number;
  title: string;
  slug: string | null;
  posterUrl: string;
  trailerUrl: string | null;
  bannerUrl: string | null;
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
  avgRating: number | string | null;
  createdAt: string;
  genres: {
    id: number;
    name: string;
    slug: string;
    createdAt: string;
  }[];
}

describe('[API] POST /movies', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let validGenreId = 0;

  const createdMovieIds: number[] = [];
  const createdGenreIds: number[] = [];

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

  const stringifyProcedure = (
    body?: MovieBody | Record<string, unknown>,
  ): string => {
    if (!body || Object.keys(body).length === 0) return 'Không có dữ liệu';
    return JSON.stringify(body, null, 2);
  };

  const buildValidBody = (overrides: Partial<MovieBody> = {}): MovieBody => ({
    title: `Create Movie ${Date.now()} ${counter}`,
    posterUrl: 'https://example.com/poster.jpg',
    trailerUrl: 'https://example.com/trailer.mp4',
    bannerUrl: 'https://example.com/banner.jpg',
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

  const rememberCreatedMovie = (movie: CreateMovieResponse): void => {
    if (typeof movie.id === 'number') {
      createdMovieIds.push(movie.id);
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
    createdGenreIds.push(genre.id);
  });

  afterAll(async () => {
    const movieRepository = dataSource.getRepository(Movie);
    const genreRepository = dataSource.getRepository(Genre);

    if (createdMovieIds.length > 0) {
      await movieRepository.delete(createdMovieIds);
    }

    if (createdGenreIds.length > 0) {
      await genreRepository.delete(createdGenreIds);
    }

    await cleanupRefreshTokens(dataSource);

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
          testCase: 'Không có Header Authorization',
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
          testCase: 'Gửi Token giả',
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
          testCase: 'Gửi Bearer token của Customer',
          description: 'Tài khoản customer cố tạo phim.',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: 'Dùng token customer.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + customerToken)
            .send(body);

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
    it('Tạo thất bại - Thiếu title', async () => {
      const body = buildValidBody();
      delete body.title;

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu title',
          description: 'Gửi body không có trường title.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng nhập tên phim.');

          return response;
        },
      );
    });

    it('Tạo thất bại - Thiếu posterUrl', async () => {
      const body = buildValidBody();
      delete body.posterUrl;

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu posterUrl',
          description: 'Gửi body không có trường posterUrl.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng cung cấp poster phim.');

          return response;
        },
      );
    });

    it('Tạo thất bại - Thiếu duration', async () => {
      const body = buildValidBody();
      delete body.duration;

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu duration',
          description: 'Gửi body không có trường duration.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Thời lượng phim phải là số nguyên.');

          return response;
        },
      );
    });

    it('Tạo thất bại - Thiếu ageRating', async () => {
      const body = buildValidBody();
      delete body.ageRating;

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu ageRating',
          description: 'Gửi body không có trường ageRating.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng chọn giới hạn độ tuổi.');

          return response;
        },
      );
    });

    it('Tạo thất bại - Thiếu releaseDate', async () => {
      const body = buildValidBody();
      delete body.releaseDate;

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu releaseDate',
          description: 'Gửi body không có trường releaseDate.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng nhập ngày khởi chiếu.');

          return response;
        },
      );
    });

    it('Tạo thất bại - duration không phải số nguyên', async () => {
      const body = buildValidBody({ duration: 120.5 });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'duration không phải số nguyên',
          description:
            'Truyền duration là số thực. Không dùng chuỗi "120" vì DTO có @Type(() => Number).',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Thời lượng phim phải là số nguyên.');

          return response;
        },
      );
    });

    it('Tạo thất bại - duration nhỏ hơn 1', async () => {
      const body = buildValidBody({ duration: 0 });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'duration nhỏ hơn 1',
          description: 'Truyền duration bằng 0.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Thời lượng phim phải lớn hơn 0.');

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
          testCase: 'posterUrl sai định dạng',
          description: 'posterUrl không đúng định dạng URL.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Poster phim phải là URL hợp lệ.');

          return response;
        },
      );
    });

    it('Tạo thất bại - bannerUrl sai định dạng URL', async () => {
      const body = buildValidBody({ bannerUrl: 'invalid_banner_url' });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'bannerUrl sai định dạng',
          description: 'bannerUrl không đúng định dạng URL.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Banner phim phải là URL hợp lệ');

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
          testCase: 'ageRating không thuộc enum',
          description: 'ageRating không thuộc enum quy định.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Giới hạn độ tuổi không hợp lệ.');

          return response;
        },
      );
    });

    it('Tạo thất bại - status không thuộc enum', async () => {
      const body = buildValidBody({ status: 'INVALID' });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'status không thuộc enum',
          description: 'status không thuộc enum quy định.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Trạng thái phim không hợp lệ.');

          return response;
        },
      );
    });

    it('Tạo thất bại - genreIds không phải mảng', async () => {
      const body = buildValidBody({ genreIds: '1,2' });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'genreIds không phải mảng',
          description: 'Truyền genreIds dạng string.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'genreIds phải là một mảng.');

          return response;
        },
      );
    });

    it('Tạo thất bại - genreIds chứa giá trị không phải số nguyên', async () => {
      const body = buildValidBody({ genreIds: [validGenreId, 1.5] });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'genreIds chứa chuỗi',
          description: 'Truyền mảng genreIds có chứa chuỗi không phải số.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Mỗi genreId phải là số nguyên.');

          return response;
        },
      );
    });

    it('Tạo thất bại - genreIds chứa giá trị không phải số dương', async () => {
      const body = buildValidBody({ genreIds: [validGenreId, 0] });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'genreIds chứa số âm',
          description: 'Truyền genreIds có chứa giá trị 0.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Mỗi genreId phải là số dương.');

          return response;
        },
      );
    });

    it('Tạo thất bại - genreIds chứa giá trị trùng lặp', async () => {
      const body = buildValidBody({ genreIds: [validGenreId, validGenreId] });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'genreIds trùng lặp',
          description: 'Truyền genreIds có ID bị lặp.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'genreIds không được chứa giá trị trùng lặp.',
          );

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
          testCase: 'Genre ID không tồn tại',
          description: 'Genre ID không có trong cơ sở dữ liệu.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
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
          testCase: 'endDate dưới 7 ngày',
          description: 'Truyền endDate nhỏ hơn 7 ngày kể từ hôm nay.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
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
          testCase: 'endDate không sau releaseDate',
          description: 'Truyền endDate bằng releaseDate.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
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
        title: 'Epic Blockbuster',
        description: 'An incredible journey',
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo phim với full payload',
          description: 'Tạo phim thành công với data chuẩn.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(201);

          const data = parseApiData<CreateMovieResponse>(response);
          rememberCreatedMovie(data);

          expect(data.id).toEqual(expect.any(Number));
          expect(data.title).toBe('Epic Blockbuster');
          expect(data.slug).toMatch(/^epic-blockbuster-\d{3}$/);
          expect(data.posterUrl).toBe(body.posterUrl);
          expect(data.trailerUrl).toBe(body.trailerUrl);
          expect(data.bannerUrl).toBe(body.bannerUrl);
          expect(data.description).toBe('An incredible journey');
          expect(data.duration).toBe(120);
          expect(data.director).toBe(body.director);
          expect(data.actor).toBe(body.actor);
          expect(data.language).toBe(body.language);
          expect(data.ageRating).toBe(AgeRating.C18);
          expect(data.rated).toBe(body.rated);
          expect(data.status).toBe(MovieStatus.COMING);
          expect(data.releaseDate).toBeDefined();
          expect(data.endDate).toBeDefined();
          expect(data.avgRating).toBeNull();
          expect(data.createdAt).toBeDefined();
          expect(data.genres).toHaveLength(1);
          expect(data.genres[0].id).toBe(validGenreId);

          expect(Object.keys(data).sort()).toEqual([
            'actor',
            'ageRating',
            'avgRating',
            'bannerUrl',
            'createdAt',
            'description',
            'director',
            'duration',
            'endDate',
            'genres',
            'id',
            'language',
            'posterUrl',
            'rated',
            'releaseDate',
            'slug',
            'status',
            'title',
            'trailerUrl',
          ]);

          return response;
        },
      );
    });

    it('Tạo thành công - Không truyền status thì mặc định upcoming', async () => {
      const body = buildValidBody({
        title: `Movie Without Status ${Date.now()}`,
      });
      delete body.status;

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không truyền status',
          description:
            'Tạo phim thành công khi không truyền status, service mặc định status là upcoming.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(201);

          const data = parseApiData<CreateMovieResponse>(response);
          rememberCreatedMovie(data);

          expect(data.status).toBe(MovieStatus.COMING);

          return response;
        },
      );
    });

    it('Tạo thành công - Không truyền genreIds thì trả về genres rỗng', async () => {
      const body = buildValidBody({
        title: `Movie Without Genres ${Date.now()}`,
      });
      delete body.genreIds;

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không truyền genreIds',
          description:
            'Tạo phim thành công khi không truyền genreIds, service trả về danh sách genres rỗng.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(201);

          const data = parseApiData<CreateMovieResponse>(response);
          rememberCreatedMovie(data);

          expect(data.genres).toEqual([]);

          return response;
        },
      );
    });

    it('Tạo thành công - Trim title và các text field', async () => {
      const body = buildValidBody({
        title: '  Trimmed Movie Title  ',
        description: '  Trimmed description  ',
        director: '  Trimmed Director  ',
        actor: '  Trimmed Actor  ',
        language: '  VI  ',
        rated: '  18+  ',
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Trim text fields',
          description:
            'Tạo phim thành công và kiểm tra các field string được trim.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(201);

          const data = parseApiData<CreateMovieResponse>(response);
          rememberCreatedMovie(data);

          expect(data.title).toBe('Trimmed Movie Title');
          expect(data.slug).toMatch(/^trimmed-movie-title-\d{3}$/);
          expect(data.description).toBe('Trimmed description');
          expect(data.director).toBe('Trimmed Director');
          expect(data.actor).toBe('Trimmed Actor');
          expect(data.language).toBe('VI');
          expect(data.rated).toBe('18+');

          return response;
        },
      );
    });
  });
});
