import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { Server } from 'http';

import { AppModule } from '../../../src/app.module';
import {
  AgeRating,
  Movie,
  MovieStatus,
} from '../../../src/modules/movies/entities/movie.entity';
import { Genre } from '../../../src/modules/genres/entities/genre.entity';
import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import { getActualStatus, parseApiData } from '../../helpers/http-test.helper';

interface GetMovieResponse {
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

describe('[API] GET /movies', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  const createdMovieIds: number[] = [];
  const createdGenreIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'GMV';
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

  const sleep = (milliseconds: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
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

    const actionGenre = await genreRepository.save(
      genreRepository.create({
        name: `Get Movies Action ${seed}`,
        slug: `get-movies-action-${seed}`,
      }),
    );

    const dramaGenre = await genreRepository.save(
      genreRepository.create({
        name: `Get Movies Drama ${seed}`,
        slug: `get-movies-drama-${seed}`,
      }),
    );

    createdGenreIds.push(actionGenre.id, dramaGenre.id);

    const olderMovie = await movieRepository.save(
      movieRepository.create({
        title: `A Older Get Movie ${seed}`,
        slug: `a-older-get-movie-${seed}`,
        posterUrl: 'https://example.com/older-poster.jpg',
        trailerUrl: 'https://example.com/older-trailer.mp4',
        bannerUrl: 'https://example.com/older-banner.jpg',
        description: 'Older movie for GET /movies.',
        duration: 110,
        director: 'Older Director',
        actor: 'Older Actor',
        language: 'EN',
        ageRating: AgeRating.C13,
        rated: '13+',
        status: MovieStatus.COMING,
        releaseDate: new Date(addDays(10)),
        endDate: new Date(addDays(20)),
        genres: [actionGenre],
      }),
    );

    await sleep(20);

    const newerMovie = await movieRepository.save(
      movieRepository.create({
        title: `B Newer Get Movie ${seed}`,
        slug: `b-newer-get-movie-${seed}`,
        posterUrl: 'https://example.com/newer-poster.jpg',
        trailerUrl: 'https://example.com/newer-trailer.mp4',
        bannerUrl: 'https://example.com/newer-banner.jpg',
        description: 'Newer movie for GET /movies.',
        duration: 120,
        director: 'Newer Director',
        actor: 'Newer Actor',
        language: 'VI',
        ageRating: AgeRating.C16,
        rated: '16+',
        status: MovieStatus.SHOWING,
        releaseDate: new Date(addDays(1)),
        endDate: new Date(addDays(15)),
        genres: [actionGenre, dramaGenre],
      }),
    );

    createdMovieIds.push(olderMovie.id, newerMovie.id);
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

    await exportTestReport(results, PREFIX, 'Get_Movies');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Lấy danh sách thành công - Không cần Access Token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không gửi Authorization header',
          description:
            'Gọi API lấy danh sách phim mà không gửi Authorization header.',
          procedure: 'GET /movies',
          expectedResult: 200,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server).get('/movies');

          expect(response.status).toBe(200);
          expect(
            Array.isArray(parseApiData<GetMovieResponse[]>(response)),
          ).toBe(true);

          return response;
        },
      );
    });

    it('Lấy danh sách thành công - Không validate token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi Bearer token không hợp lệ',
          description:
            'Gọi API lấy danh sách phim với Bearer token không hợp lệ.',
          procedure: 'GET /movies với Authorization: Bearer fake.jwt.token',
          expectedResult: 200,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server)
            .get('/movies')
            .set('Authorization', 'Bearer fake.jwt.token');

          expect(response.status).toBe(200);
          expect(
            Array.isArray(parseApiData<GetMovieResponse[]>(response)),
          ).toBe(true);

          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Lấy danh sách thành công - Kiểm tra response shape', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra response shape',
          description:
            'Kiểm tra response chỉ gồm các field của MovieResponseDto.',
          procedure: 'GET /movies',
          expectedResult: 200,
          preconditions: 'Cần seed sẵn dữ liệu',
        },
        async () => {
          const response = await request(server).get('/movies');

          expect(response.status).toBe(200);

          const data = parseApiData<GetMovieResponse[]>(response);
          expect(Array.isArray(data)).toBe(true);

          const seededMovies = data.filter((movie) =>
            createdMovieIds.includes(movie.id),
          );

          expect(seededMovies.length).toBe(2);

          seededMovies.forEach((movie) => {
            expect(typeof movie.id).toBe('number');
            expect(typeof movie.title).toBe('string');
            expect(typeof movie.slug).toBe('string');
            expect(typeof movie.posterUrl).toBe('string');
            expect(typeof movie.trailerUrl).toBe('string');
            expect(typeof movie.bannerUrl).toBe('string');
            expect(typeof movie.description).toBe('string');
            expect(typeof movie.duration).toBe('number');
            expect(typeof movie.director).toBe('string');
            expect(typeof movie.actor).toBe('string');
            expect(typeof movie.language).toBe('string');
            expect(Object.values(AgeRating)).toContain(movie.ageRating);
            expect(typeof movie.rated).toBe('string');
            expect(Object.values(MovieStatus)).toContain(movie.status);
            expect(typeof movie.releaseDate).toBe('string');
            expect(typeof movie.endDate).toBe('string');
            expect(movie.avgRating).toBeNull();
            expect(typeof movie.createdAt).toBe('string');
            expect(Array.isArray(movie.genres)).toBe(true);

            expect(Object.keys(movie).sort()).toEqual([
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
          });

          return response;
        },
      );
    });

    it('Lấy danh sách thành công - Trả về kèm danh sách genres', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra relations genres',
          description:
            'Lấy danh sách phim thành công, mỗi phim trả về kèm danh sách genres.',
          procedure: 'GET /movies',
          expectedResult: 200,
          preconditions: 'Cần seed sẵn phim có genres',
        },
        async () => {
          const response = await request(server).get('/movies');

          expect(response.status).toBe(200);

          const data = parseApiData<GetMovieResponse[]>(response);
          const seededMovies = data.filter((movie) =>
            createdMovieIds.includes(movie.id),
          );

          expect(seededMovies.length).toBe(2);

          const movieWithTwoGenres = seededMovies.find(
            (movie) => movie.genres.length === 2,
          );

          expect(movieWithTwoGenres).toBeDefined();

          seededMovies.forEach((movie) => {
            expect(movie.genres.length).toBeGreaterThan(0);

            movie.genres.forEach((genre) => {
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
          });

          return response;
        },
      );
    });

    it('Lấy danh sách thành công - Sắp xếp theo createdAt DESC', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra phim được sắp xếp DESC',
          description:
            'Lấy danh sách phim thành công, kết quả được sắp xếp giảm dần theo createdAt.',
          procedure: 'GET /movies',
          expectedResult: 200,
          preconditions: 'Cần seed sẵn dữ liệu',
        },
        async () => {
          const response = await request(server).get('/movies');

          expect(response.status).toBe(200);

          const data = parseApiData<GetMovieResponse[]>(response);
          const seededMovies = data.filter((movie) =>
            createdMovieIds.includes(movie.id),
          );

          expect(seededMovies.length).toBe(2);
          expect(seededMovies.map((movie) => movie.id)).toEqual([
            createdMovieIds[1],
            createdMovieIds[0],
          ]);

          const createdAtValues = seededMovies.map((movie) =>
            new Date(movie.createdAt).getTime(),
          );

          expect(createdAtValues[0]).toBeGreaterThanOrEqual(createdAtValues[1]);

          return response;
        },
      );
    });
  });
});
