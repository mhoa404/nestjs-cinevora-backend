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
  title?: string | null;
  posterUrl?: string | null;
  trailerUrl?: string | null;
  bannerUrl?: string | null;
  description?: string | null;
  duration?: number | string | null;
  director?: string | null;
  actor?: string | null;
  language?: string | null;
  ageRating?: AgeRating | string | null;
  rated?: string | null;
  status?: MovieStatus | string | null;
  releaseDate?: string | null;
  endDate?: string | null;
  genreIds?: Array<number | string> | null;
};

interface UpdateMovieResponse {
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

describe('[API] PATCH /movies/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let targetMovieId = 0;
  let conflictMovieId = 0;
  let validGenreId = 0;
  let secondaryGenreId = 0;

  const createdMovieIds: number[] = [];
  const createdGenreIds: number[] = [];

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

  const stringifyProcedure = (
    body?: MovieBody | Record<string, unknown>,
  ): string => {
    if (!body || Object.keys(body).length === 0) return 'Không có dữ liệu';
    return JSON.stringify(body, null, 2);
  };

  const buildValidBody = (overrides: Partial<MovieBody> = {}): MovieBody => ({
    title: `Updated Movie Title ${Date.now()} ${counter}`,
    posterUrl: 'https://example.com/poster-updated.jpg',
    trailerUrl: 'https://example.com/trailer-updated.mp4',
    bannerUrl: 'https://example.com/banner-updated.jpg',
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

    const secondaryGenre = await genreRepository.save(
      genreRepository.create({
        name: `Update Movie Secondary Genre ${uniqueSeed}`,
        slug: `update-movie-secondary-genre-${uniqueSeed}`,
      }),
    );

    validGenreId = genre.id;
    secondaryGenreId = secondaryGenre.id;
    createdGenreIds.push(genre.id, secondaryGenre.id);

    const movie = await movieRepository.save(
      movieRepository.create({
        title: `Original Movie ${uniqueSeed}`,
        slug: `original-movie-${uniqueSeed}`,
        posterUrl: 'https://example.com/original-poster.jpg',
        trailerUrl: 'https://example.com/original-trailer.mp4',
        bannerUrl: 'https://example.com/original-banner.jpg',
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
    createdMovieIds.push(movie.id);

    const conflictMovie = await movieRepository.save(
      movieRepository.create({
        title: `Conflict Movie ${uniqueSeed}`,
        slug: `conflict-title-${String(movie.id).padStart(3, '0')}`,
        posterUrl: 'https://example.com/conflict-poster.jpg',
        trailerUrl: 'https://example.com/conflict-trailer.mp4',
        bannerUrl: 'https://example.com/conflict-banner.jpg',
        description: 'Conflict movie for slug unique validation.',
        duration: 100,
        director: 'Conflict Director',
        actor: 'Conflict Actor',
        language: 'EN',
        ageRating: AgeRating.C13,
        rated: '13+',
        status: MovieStatus.COMING,
        releaseDate: new Date(addDays(9)),
        endDate: new Date(addDays(19)),
        genres: [genre],
      }),
    );

    conflictMovieId = conflictMovie.id;
    createdMovieIds.push(conflictMovie.id);
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
          testCase: 'Không có Header Authorization',
          description: 'Không gửi access token khi gọi API cập nhật phim.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không có token.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
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
          testCase: 'Gửi Token giả',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Token giả.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
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
          testCase: 'Gửi Bearer token của Customer',
          description: 'Tài khoản customer cố cập nhật phim.',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: 'Dùng token customer.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
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
    it('Cập nhật thất bại - ID param không phải số', async () => {
      const body = buildValidBody();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'ID param không phải số',
          description:
            'Gọi PATCH /movies/:id với id không phải numeric string.',
          procedure: 'PATCH /movies/abc',
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch('/movies/abc')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

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

    it('Cập nhật thất bại - Body rỗng', async () => {
      const body: MovieBody = {};

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Body rỗng',
          description: 'Gửi PATCH với body rỗng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Không có dữ liệu nào để cập nhật.');

          return response;
        },
      );
    });

    it('Cập nhật thất bại - Field null', async () => {
      const body: MovieBody = { title: null };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Field null',
          description: 'Gửi title bằng null trong PATCH.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Không hỗ trợ set null cho PATCH: title.',
          );

          return response;
        },
      );
    });

    it('Cập nhật thất bại - title là chuỗi rỗng', async () => {
      const body: MovieBody = { title: '' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'title rỗng',
          description: 'Gửi title là chuỗi rỗng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng nhập tên phim.');

          return response;
        },
      );
    });

    it('Cập nhật thất bại - posterUrl sai định dạng', async () => {
      const body: MovieBody = { posterUrl: 'invalid_url' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'posterUrl sai định dạng',
          description: 'posterUrl không phải URL hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Poster phim phải là URL hợp lệ.');

          return response;
        },
      );
    });

    it('Cập nhật thất bại - bannerUrl sai định dạng', async () => {
      const body: MovieBody = { bannerUrl: 'invalid_banner_url' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'bannerUrl sai định dạng',
          description: 'bannerUrl không phải URL hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Banner phim phải là URL hợp lệ');

          return response;
        },
      );
    });

    it('Cập nhật thất bại - duration không phải số nguyên', async () => {
      const body: MovieBody = { duration: 120.5 };

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
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Thời lượng phim phải là số nguyên.');

          return response;
        },
      );
    });

    it('Cập nhật thất bại - duration nhỏ hơn 1', async () => {
      const body: MovieBody = { duration: 0 };

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
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Thời lượng phim phải lớn hơn 0.');

          return response;
        },
      );
    });

    it('Cập nhật thất bại - ageRating không thuộc enum', async () => {
      const body: MovieBody = { ageRating: 'C99' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'ageRating không thuộc enum',
          description: 'ageRating không tồn tại trong enum.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Giới hạn độ tuổi không hợp lệ.');

          return response;
        },
      );
    });

    it('Cập nhật thất bại - status không thuộc enum', async () => {
      const body: MovieBody = { status: 'INVALID' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'status không thuộc enum',
          description: 'status không tồn tại trong enum.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Trạng thái phim không hợp lệ.');

          return response;
        },
      );
    });

    it('Cập nhật thất bại - releaseDate sai định dạng', async () => {
      const body: MovieBody = { releaseDate: 'invalid-date' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'releaseDate sai định dạng',
          description: 'releaseDate không đúng định dạng DateString.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Ngày khởi chiếu không đúng định dạng YYYY-MM-DD.',
          );

          return response;
        },
      );
    });

    it('Cập nhật thất bại - endDate sai định dạng', async () => {
      const body: MovieBody = { endDate: 'invalid-date' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'endDate sai định dạng',
          description: 'endDate không đúng định dạng DateString.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Ngày kết thúc chiếu không đúng định dạng YYYY-MM-DD.',
          );

          return response;
        },
      );
    });

    it('Cập nhật thất bại - genreIds là mảng rỗng', async () => {
      const body: MovieBody = { genreIds: [] };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'genreIds mảng rỗng',
          description:
            'PATCH không cho phép set genreIds thành mảng rỗng theo service assertUpdatePayload.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'genreIds không được là mảng rỗng trong PATCH.',
          );

          return response;
        },
      );
    });

    it('Cập nhật thất bại - genreIds chứa số thực', async () => {
      const body: MovieBody = { genreIds: [validGenreId, 1.5] };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'genreIds chứa số thực',
          description: 'genreIds có phần tử không phải số nguyên.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Mỗi genreId phải là số nguyên.');

          return response;
        },
      );
    });

    it('Cập nhật thất bại - genreIds chứa số không dương', async () => {
      const body: MovieBody = { genreIds: [validGenreId, 0] };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'genreIds chứa số không dương',
          description: 'genreIds có chứa giá trị 0.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Mỗi genreId phải là số dương.');

          return response;
        },
      );
    });

    it('Cập nhật thất bại - genreIds chứa giá trị trùng lặp', async () => {
      const body: MovieBody = { genreIds: [validGenreId, validGenreId] };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'genreIds trùng lặp',
          description: 'genreIds có ID bị lặp.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
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
    it('Cập nhật thất bại - Movie ID không tồn tại', async () => {
      const body = buildValidBody();

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Movie ID không tồn tại',
          description: 'Cập nhật phim với ID không tồn tại.',
          procedure: stringifyProcedure(body),
          expectedResult: 404,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch('/movies/999999')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Phim #999999 không tồn tại.');

          return response;
        },
      );
    });

    it('Cập nhật thất bại - Genre ID không tồn tại', async () => {
      const body: MovieBody = { genreIds: [999999] };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Genre ID không tồn tại',
          description: 'Dùng genreIds không có thật.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
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

    it('Cập nhật thất bại - endDate cách hôm nay dưới 7 ngày', async () => {
      const body: MovieBody = {
        releaseDate: addDays(2),
        endDate: addDays(3),
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'endDate dưới 7 ngày',
          description: 'endDate nhỏ hơn ngưỡng tối thiểu 7 ngày kể từ hôm nay.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
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

    it('Cập nhật thất bại - endDate không sau releaseDate', async () => {
      const body: MovieBody = {
        releaseDate: addDays(12),
        endDate: addDays(12),
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'endDate không sau releaseDate',
          description: 'endDate bằng releaseDate.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
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

    it('Cập nhật thất bại - Slug phim đã tồn tại', async () => {
      const body: MovieBody = { title: 'Conflict Title' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Slug phim đã tồn tại',
          description: 'Đổi title khiến slug mới trùng với slug của phim khác.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: `Tồn tại movie conflict với ID ${conflictMovieId}.`,
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(error, 409, 'Slug phim đã tồn tại.');

          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Cập nhật thành công - Chỉ gửi title', async () => {
      const body: MovieBody = { title: 'Only Title Updated' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Partial update title',
          description:
            'Chỉ gửi 1 field title. PATCH hiện tại cho phép cập nhật từng trường.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(200);

          const data = parseApiData<UpdateMovieResponse>(response);
          expect(data.id).toBe(targetMovieId);
          expect(data.title).toBe('Only Title Updated');
          expect(data.slug).toMatch(/^only-title-updated-\d{3}$/);

          return response;
        },
      );
    });

    it('Cập nhật thành công - Clear các field cho phép bằng chuỗi rỗng', async () => {
      const body: MovieBody = {
        description: '',
        director: '',
        actor: '',
        language: '',
        rated: '',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Clear clearable fields',
          description:
            'Các field description/director/actor/language/rated được phép gửi chuỗi rỗng và service convert thành null.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(200);

          const data = parseApiData<UpdateMovieResponse>(response);
          expect(data.description).toBeNull();
          expect(data.director).toBeNull();
          expect(data.actor).toBeNull();
          expect(data.language).toBeNull();
          expect(data.rated).toBeNull();

          return response;
        },
      );
    });

    it('Cập nhật thành công với full payload hợp lệ', async () => {
      const body = buildValidBody({
        title: '  Updated Blockbuster  ',
        description: '  New description  ',
        director: '  James Gunn  ',
        actor: '  Actor A, Actor B  ',
        language: '  EN  ',
        rated: '  PG-13  ',
        genreIds: [validGenreId, secondaryGenreId],
      });

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Full update',
          description: 'Cập nhật phim thành công bằng full payload hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(200);

          const data = parseApiData<UpdateMovieResponse>(response);

          expect(data.id).toBe(targetMovieId);
          expect(data.title).toBe('Updated Blockbuster');
          expect(data.slug).toMatch(/^updated-blockbuster-\d{3}$/);
          expect(data.posterUrl).toBe(body.posterUrl);
          expect(data.trailerUrl).toBe(body.trailerUrl);
          expect(data.bannerUrl).toBe(body.bannerUrl);
          expect(data.description).toBe('New description');
          expect(data.duration).toBe(135);
          expect(data.director).toBe('James Gunn');
          expect(data.actor).toBe('Actor A, Actor B');
          expect(data.language).toBe('EN');
          expect(data.ageRating).toBe(AgeRating.C16);
          expect(data.rated).toBe('PG-13');
          expect(data.status).toBe(MovieStatus.SHOWING);
          expect(data.releaseDate).toBeDefined();
          expect(data.endDate).toBeDefined();
          expect(data.avgRating).toBeNull();
          expect(data.createdAt).toBeDefined();

          const genreIds = data.genres.map((genre) => genre.id).sort();
          expect(genreIds).toEqual([validGenreId, secondaryGenreId].sort());

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

          data.genres.forEach((genre) => {
            expect(typeof genre.id).toBe('number');
            expect(typeof genre.name).toBe('string');
            expect(typeof genre.slug).toBe('string');
            expect(typeof genre.createdAt).toBe('string');

            expect(Object.keys(genre).sort()).toEqual([
              'createdAt',
              'id',
              'name',
              'slug',
            ]);
          });

          return response;
        },
      );
    });

    it('Cập nhật thành công - Không có thay đổi vẫn trả 200', async () => {
      const body: MovieBody = { title: 'Updated Blockbuster' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'No-op update',
          description:
            'Gửi lại giá trị title hiện tại. Service không save lại nhưng vẫn trả MovieResponseDto với status 200.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Token Admin hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(200);

          const data = parseApiData<UpdateMovieResponse>(response);
          expect(data.id).toBe(targetMovieId);
          expect(data.title).toBe('Updated Blockbuster');

          return response;
        },
      );
    });
  });
});
