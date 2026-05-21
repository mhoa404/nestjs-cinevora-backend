import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { Server } from 'http';

import { AppModule } from '../../../src/app.module';
import { Genre } from '../../../src/modules/genres/entities/genre.entity';
import {
  AgeRating,
  Movie,
  MovieStatus,
} from '../../../src/modules/movies/entities/movie.entity';
import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import {
  expectErrorMessage,
  getActualStatus,
  parseApiData,
  parseApiError,
} from '../../helpers/http-test.helper';

interface MovieDetailResponse {
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

describe('[API] GET /movies/:slugOrId', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let validMovieId = 0;
  let validMovieSlug = '';

  const createdMovieIds: number[] = [];
  const createdGenreIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'GMD';
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

    const genreRepository = dataSource.getRepository(Genre);
    const movieRepository = dataSource.getRepository(Movie);
    const seed = Date.now();

    const genre = await genreRepository.save(
      genreRepository.create({
        name: `Get Movie Detail Genre ${seed}`,
        slug: `get-movie-detail-genre-${seed}`,
      }),
    );

    createdGenreIds.push(genre.id);

    const movie = await movieRepository.save(
      movieRepository.create({
        title: `Get Movie Detail ${seed}`,
        slug: `get-movie-detail-${seed}`,
        posterUrl: 'https://example.com/get-movie-detail-poster.jpg',
        trailerUrl: 'https://example.com/get-movie-detail-trailer.mp4',
        bannerUrl: 'https://example.com/get-movie-detail-banner.jpg',
        description: 'Movie detail for GET /movies/:slugOrId.',
        duration: 125,
        director: 'Detail Director',
        actor: 'Detail Actor',
        language: 'VI',
        ageRating: AgeRating.C16,
        rated: '16+',
        status: MovieStatus.SHOWING,
        releaseDate: new Date(addDays(1)),
        endDate: new Date(addDays(15)),
        genres: [genre],
      }),
    );

    validMovieId = movie.id;
    validMovieSlug = movie.slug!;
    createdMovieIds.push(movie.id);
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

    await exportTestReport(results, PREFIX, 'Get_Movie_Detail');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Lấy chi tiết phim thành công - Không cần Access Token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không gửi Header',
          description:
            'Gọi API lấy chi tiết phim mà không gửi Authorization header.',
          procedure: `GET /movies/${validMovieId}`,
          expectedResult: 200,
          preconditions: `Tồn tại movie với ID ${validMovieId}`,
        },
        async () => {
          const response = await request(server).get(`/movies/${validMovieId}`);

          expect(response.status).toBe(200);

          const data = parseApiData<MovieDetailResponse>(response);
          expect(data.id).toBe(validMovieId);

          return response;
        },
      );
    });

    it('Lấy chi tiết phim thành công - Vẫn cho phép request có Fake Token vì API Public', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi token giả',
          description:
            'Gọi API lấy chi tiết phim với Bearer token không hợp lệ.',
          procedure: `GET /movies/${validMovieSlug} với Authorization: Bearer fake.jwt.token`,
          expectedResult: 200,
          preconditions: `Tồn tại movie với slug ${validMovieSlug}`,
        },
        async () => {
          const response = await request(server)
            .get(`/movies/${validMovieSlug}`)
            .set('Authorization', 'Bearer fake.jwt.token');

          expect(response.status).toBe(200);

          const data = parseApiData<MovieDetailResponse>(response);
          expect(data.slug).toBe(validMovieSlug);

          return response;
        },
      );
    });
  });

  describe('Validation & Business Logic', () => {
    it('Lấy chi tiết phim thất bại - ID không tồn tại', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi ID không tồn tại',
          description: 'Gửi movie ID không tồn tại trong hệ thống.',
          procedure: 'GET /movies/999999',
          expectedResult: 404,
          preconditions: 'Không tồn tại movie với ID 999999',
        },
        async () => {
          const response = await request(server).get('/movies/999999');

          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            404,
            'Không tìm thấy phim với định danh "999999".',
          );

          return response;
        },
      );
    });

    it('Lấy chi tiết phim thất bại - Slug không tồn tại', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi slug không tồn tại',
          description:
            'Gửi movie slug không tồn tại trong hệ thống. Vì slugOrId không dùng ParseIntPipe nên chuỗi được xử lý như slug lookup.',
          procedure: 'GET /movies/movie-slug-not-found',
          expectedResult: 404,
          preconditions: 'Không tồn tại movie với slug movie-slug-not-found',
        },
        async () => {
          const response = await request(server).get(
            '/movies/movie-slug-not-found',
          );

          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            404,
            'Không tìm thấy phim với định danh "movie-slug-not-found".',
          );

          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Lấy chi tiết phim thành công - Tìm theo ID', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tìm movie theo ID',
          description:
            'Gọi API lấy chi tiết phim bằng numeric id, service query theo movie.id.',
          procedure: `GET /movies/${validMovieId}`,
          expectedResult: 200,
          preconditions: `Tồn tại movie với ID ${validMovieId}`,
        },
        async () => {
          const response = await request(server).get(`/movies/${validMovieId}`);

          expect(response.status).toBe(200);

          const data = parseApiData<MovieDetailResponse>(response);

          expect(data.id).toBe(validMovieId);
          expect(data.slug).toBe(validMovieSlug);
          expect(data.title).toBeDefined();

          return response;
        },
      );
    });

    it('Lấy chi tiết phim thành công - Tìm theo slug', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tìm movie theo slug',
          description:
            'Gọi API lấy chi tiết phim bằng slug, service query theo movie.slug.',
          procedure: `GET /movies/${validMovieSlug}`,
          expectedResult: 200,
          preconditions: `Tồn tại movie với slug ${validMovieSlug}`,
        },
        async () => {
          const response = await request(server).get(
            `/movies/${validMovieSlug}`,
          );

          expect(response.status).toBe(200);

          const data = parseApiData<MovieDetailResponse>(response);

          expect(data.id).toBe(validMovieId);
          expect(data.slug).toBe(validMovieSlug);
          expect(data.title).toBeDefined();

          return response;
        },
      );
    });

    it('Lấy chi tiết phim thành công - Trả về đúng shape MovieResponseDto', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra shape MovieResponseDto',
          description:
            'Lấy chi tiết phim và kiểm tra response chỉ gồm các field của MovieResponseDto.',
          procedure: `GET /movies/${validMovieSlug}`,
          expectedResult: 200,
          preconditions: `Tồn tại movie với slug ${validMovieSlug}`,
        },
        async () => {
          const response = await request(server).get(
            `/movies/${validMovieSlug}`,
          );

          expect(response.status).toBe(200);

          const data = parseApiData<MovieDetailResponse>(response);

          expect(data.id).toBe(validMovieId);
          expect(data.title).toBeDefined();
          expect(data.slug).toBe(validMovieSlug);
          expect(data.posterUrl).toBeDefined();
          expect(data.trailerUrl).toBeDefined();
          expect(data.bannerUrl).toBeDefined();
          expect(data.description).toBeDefined();
          expect(data.duration).toBeDefined();
          expect(data.director).toBeDefined();
          expect(data.actor).toBeDefined();
          expect(data.language).toBeDefined();
          expect(data.ageRating).toBeDefined();
          expect(data.rated).toBeDefined();
          expect(data.status).toBeDefined();
          expect(data.releaseDate).toBeDefined();
          expect(data.endDate).toBeDefined();
          expect(data.createdAt).toBeDefined();
          expect(data.genres).toBeDefined();

          expect(typeof data.id).toBe('number');
          expect(typeof data.title).toBe('string');
          expect(typeof data.slug).toBe('string');
          expect(typeof data.posterUrl).toBe('string');
          expect(typeof data.trailerUrl).toBe('string');
          expect(typeof data.bannerUrl).toBe('string');
          expect(typeof data.description).toBe('string');
          expect(typeof data.duration).toBe('number');
          expect(typeof data.director).toBe('string');
          expect(typeof data.actor).toBe('string');
          expect(typeof data.language).toBe('string');
          expect(Object.values(AgeRating)).toContain(data.ageRating);
          expect(typeof data.rated).toBe('string');
          expect(Object.values(MovieStatus)).toContain(data.status);
          expect(typeof data.releaseDate).toBe('string');
          expect(typeof data.endDate).toBe('string');
          expect(data.avgRating).toBeNull();
          expect(typeof data.createdAt).toBe('string');
          expect(Array.isArray(data.genres)).toBe(true);

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

          expect(data.genres.length).toBe(1);

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
  });
});
