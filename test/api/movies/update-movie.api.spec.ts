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
<<<<<<< HEAD
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
=======
import { AppModule } from '../../../src/app.module';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';
import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import { Genre } from '../../../src/modules/genres/entities/genre.entity';
import { CreateMovieResponse } from './create-movie.api.spec';

type MovieBody = Record<string, any>;

interface UpdateMovieResponse {
  id: number;
  slug: string;
  title: string;
  duration: number;
  description: string | null;
  status: string;
  genres?: { id: number; name: string }[];
}

describe('[API] PATCH /movies/:id', () => {
>>>>>>> origin/main
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';
<<<<<<< HEAD

  let targetMovieId = 0;
  let validGenreId = 0;
=======
  let validGenreId = 1;
  let targetMovieId = 1;
>>>>>>> origin/main

  const results: TestCaseRecord[] = [];
  const PREFIX = 'UMV';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return `${PREFIX}${String(counter).padStart(2, '0')}`;
  };

<<<<<<< HEAD
  const formatDate = (date: Date): string => {
    return date.toISOString().slice(0, 10);
  };

  const addDays = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return formatDate(date);
  };

=======
>>>>>>> origin/main
  const stringifyProcedure = (body?: MovieBody): string => {
    if (!body || Object.keys(body).length === 0) return 'Không có dữ liệu';
    return JSON.stringify(body, null, 2);
  };

<<<<<<< HEAD
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

=======
>>>>>>> origin/main
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
      .post('/auth/login')
      .send({ email: 'api_tester@gmail.com', password: 'Api_tester_123' });
<<<<<<< HEAD

=======
>>>>>>> origin/main
    adminToken = parseApiData<AuthResponseDto>(adminLoginRes).accessToken;

    const customerLoginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'api_client@gmail.com', password: 'Api_client_123' });
<<<<<<< HEAD

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
=======
    customerToken = parseApiData<AuthResponseDto>(customerLoginRes).accessToken;

    const genreRepo = dataSource.getRepository(Genre);
    const genre = await genreRepo.findOne({ where: {} });
    if (genre) {
      validGenreId = genre.id;
    }

    const seedRes = await request(server)
      .post('/movies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Original Movie UMV',
        posterUrl: 'http://example.com/poster.jpg',
        duration: 100,
        ageRating: AgeRating.C13,
        releaseDate: '2026-05-01',
      });
    const parsedData = parseApiData<CreateMovieResponse>(seedRes);
    targetMovieId = parsedData.id;
  });

  afterAll(async () => {
    if (targetMovieId) {
      const movieRepo = dataSource.getRepository(Movie);
      await movieRepo.delete({ id: targetMovieId });
    }

>>>>>>> origin/main
    await exportTestReport(results, PREFIX, 'Update_Movie');
    await app.close();
  });

<<<<<<< HEAD
  describe('Phân quyền', () => {
    it('Cập nhật thất bại - Không truyền Authorization Token', async () => {
      const body = buildValidBody();

=======
  describe('Phân quyền (Security & Roles)', () => {
    const body: MovieBody = { duration: 150 };

    it('Cập nhật thất bại - Không gửi token', async () => {
>>>>>>> origin/main
      await record(
        {
          id: nextId(),
          scope: 'All',
<<<<<<< HEAD
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

=======
          testCase: 'Security: No Token',
          description: 'Gọi API Update Movie nhưng không có token',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: '',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .send(body);
>>>>>>> origin/main
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

<<<<<<< HEAD
    it('Cập nhật thất bại - Truyền Fake Token', async () => {
      const body = buildValidBody();

=======
    it('Cập nhật thất bại - Token fake/không hợp lệ', async () => {
>>>>>>> origin/main
      await record(
        {
          id: nextId(),
          scope: 'All',
<<<<<<< HEAD
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

=======
          testCase: 'Security: Invalid Token',
          description: 'Gửi fake token',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: '',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer fake.jwt.hack`)
            .send(body);
>>>>>>> origin/main
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

<<<<<<< HEAD
    it('Cập nhật thất bại - Role Customer bị chặn', async () => {
      const body = buildValidBody();

=======
    it('Cập nhật thất bại - Token Customer (Không đủ quyền)', async () => {
>>>>>>> origin/main
      await record(
        {
          id: nextId(),
          scope: 'All',
<<<<<<< HEAD
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

=======
          testCase: 'Security: Forbidden Role',
          description: 'Dùng token của Customer cập nhật movie',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: '',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${customerToken}`)
            .send(body);
>>>>>>> origin/main
          expect(response.status).toBe(403);
          return response;
        },
      );
    });
  });

<<<<<<< HEAD
  describe('Validation Payload', () => {
    it('Cập nhật thất bại - Thiếu full payload do UpdateMovieDto hiện tại là full DTO', async () => {
      const body: MovieBody = { title: 'Only Title' };

=======
  describe('Validation đầu vào (DTO)', () => {
    it('Cập nhật thất bại - Sai định dạng Type', async () => {
      const body: MovieBody = { duration: 'Một Trăm Mấy' };
>>>>>>> origin/main
      await record(
        {
          id: nextId(),
          scope: 'All',
<<<<<<< HEAD
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
=======
          testCase: 'Validation: Invalid Type',
          description: 'Trường duration gửi dưới dạng string',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(response.status).toBe(400);
>>>>>>> origin/main
          return response;
        },
      );
    });

<<<<<<< HEAD
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

=======
    it('Cập nhật thất bại - URL sai định dạng', async () => {
      const body: MovieBody = { posterUrl: 'invalid_url_123' };
>>>>>>> origin/main
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Invalid URL',
<<<<<<< HEAD
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
=======
          description: 'Sai định dạng URL',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(response.status).toBe(400);
>>>>>>> origin/main
          return response;
        },
      );
    });

<<<<<<< HEAD
    it('Cập nhật thất bại - ageRating không thuộc enum', async () => {
      const body = buildValidBody({ ageRating: 'C99' });

=======
    it('Cập nhật thất bại - Enum không hợp lệ', async () => {
      const body: MovieBody = { ageRating: 'C99' as string };
>>>>>>> origin/main
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Invalid Enum',
<<<<<<< HEAD
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
=======
          description: 'Gửi age rating lạ không nằm trong enum',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(response.status).toBe(400);
>>>>>>> origin/main
          return response;
        },
      );
    });

<<<<<<< HEAD
    it('Cập nhật thất bại - genreIds chứa string', async () => {
      const body = buildValidBody({ genreIds: [validGenreId, 'abc'] });

=======
    it('Cập nhật thất bại - Mảng ID Thể loại có chứa chuỗi', async () => {
      const body: MovieBody = { genreIds: [validGenreId, 'string'] };
>>>>>>> origin/main
      await record(
        {
          id: nextId(),
          scope: 'All',
<<<<<<< HEAD
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
=======
          testCase: 'Validation: Invalid Type in Array',
          description: 'Mảng genreIds bị lỗi vì có chứa string',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(response.status).toBe(400);
>>>>>>> origin/main
          return response;
        },
      );
    });
  });

<<<<<<< HEAD
  describe('Ràng buộc nghiệp vụ', () => {
    it('Cập nhật thất bại - Movie ID không tồn tại', async () => {
      const body = buildValidBody();

=======
  describe('Ràng buộc nghiệp vụ (Business Rules)', () => {
    it('Cập nhật thất bại - Movie Id Không tồn tại', async () => {
      const body: MovieBody = { title: 'Unknown Movie' };
>>>>>>> origin/main
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Movie Not Found',
<<<<<<< HEAD
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
=======
          description: 'Chỉnh sửa phim có ID ngẫu nhiên hoặc không tồn tại',
          procedure: stringifyProcedure(body),
          expectedResult: 404,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/999999`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(response.status).toBe(404);
>>>>>>> origin/main
          return response;
        },
      );
    });

<<<<<<< HEAD
    it('Cập nhật thất bại - Genre ID không tồn tại', async () => {
      const body = buildValidBody({ genreIds: [999999] });

=======
    it('Cập nhật thất bại - Genre Ids chứa ID ảo không tồn tại', async () => {
      const body: MovieBody = { genreIds: [999999] };
>>>>>>> origin/main
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Genre Not Found',
<<<<<<< HEAD
          description: 'Dùng genreIds không có thật.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .put(`/movies/${targetMovieId}`)
=======
          description: 'List Thể loại bao gồm mã ID ảo (999999)',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
>>>>>>> origin/main
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
<<<<<<< HEAD
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
=======
          expectErrorMessage(error, 400, 'không tồn tại');
>>>>>>> origin/main
          return response;
        },
      );
    });
  });

<<<<<<< HEAD
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
=======
  describe('Luồng thành công (Happy Path)', () => {
    it('Cập nhật thành công - Thuộc tính chung (Không ảnh hưởng Slug)', async () => {
      const body: MovieBody = {
        description: 'New Detail Update',
        duration: 999,
        status: MovieStatus.SHOWING,
      };
>>>>>>> origin/main

      await record(
        {
          id: nextId(),
          scope: 'All',
<<<<<<< HEAD
          testCase: 'Happy Path: Full Update',
          description: 'Cập nhật phim thành công bằng full payload hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .put(`/movies/${targetMovieId}`)
=======
          testCase: 'Happy Path: Partial Fields Update',
          description: 'Chỉ cập nhật duration, description, status',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
>>>>>>> origin/main
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(200);
<<<<<<< HEAD

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

=======
          const data = parseApiData<UpdateMovieResponse>(response);

          expect(data.id).toEqual(targetMovieId);
          expect(data.duration).toEqual(999);
          expect(data.description).toEqual('New Detail Update');
          return response;
        },
      );
    });

    it('Cập nhật thành công - Update Title (Cần chạy lại logic gen Slug)', async () => {
      const body: MovieBody = {
        title: 'New Movie Avatar',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Dynamic Slug Re-generation',
          description: 'Cập nhật title phim. Hệ thống phải đổi slug mới',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .patch(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(200);
          const data = parseApiData<UpdateMovieResponse>(response);

          expect(data.title).toEqual('New Movie Avatar');
          expect(data.slug).toMatch(/^new-movie-avatar-\d{3}$/); // Assert sinh lại slug đúng format
>>>>>>> origin/main
          return response;
        },
      );
    });
  });
});
