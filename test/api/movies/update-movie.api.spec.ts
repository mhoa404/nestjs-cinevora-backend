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
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';
  let validGenreId = 1;
  let targetMovieId = 1;

  const results: TestCaseRecord[] = [];
  const PREFIX = 'UMV';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return `${PREFIX}${String(counter).padStart(2, '0')}`;
  };

  const stringifyProcedure = (body?: MovieBody): string => {
    if (!body || Object.keys(body).length === 0) return 'Không có dữ liệu';
    return JSON.stringify(body, null, 2);
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
      .post('/auth/login')
      .send({ email: 'api_tester@gmail.com', password: 'Api_tester_123' });
    adminToken = parseApiData<AuthResponseDto>(adminLoginRes).accessToken;

    const customerLoginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'api_client@gmail.com', password: 'Api_client_123' });
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

    await exportTestReport(results, PREFIX, 'Update_Movie');
    await app.close();
  });

  describe('Phân quyền (Security & Roles)', () => {
    const body: MovieBody = { duration: 150 };

    it('Cập nhật thất bại - Không gửi token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
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
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Cập nhật thất bại - Token fake/không hợp lệ', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
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
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Cập nhật thất bại - Token Customer (Không đủ quyền)', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
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
          expect(response.status).toBe(403);
          return response;
        },
      );
    });
  });

  describe('Validation đầu vào (DTO)', () => {
    it('Cập nhật thất bại - Sai định dạng Type', async () => {
      const body: MovieBody = { duration: 'Một Trăm Mấy' };
      await record(
        {
          id: nextId(),
          scope: 'All',
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
          return response;
        },
      );
    });

    it('Cập nhật thất bại - URL sai định dạng', async () => {
      const body: MovieBody = { posterUrl: 'invalid_url_123' };
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Invalid URL',
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
          return response;
        },
      );
    });

    it('Cập nhật thất bại - Enum không hợp lệ', async () => {
      const body: MovieBody = { ageRating: 'C99' as string };
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Invalid Enum',
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
          return response;
        },
      );
    });

    it('Cập nhật thất bại - Mảng ID Thể loại có chứa chuỗi', async () => {
      const body: MovieBody = { genreIds: [validGenreId, 'string'] };
      await record(
        {
          id: nextId(),
          scope: 'All',
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
          return response;
        },
      );
    });
  });

  describe('Ràng buộc nghiệp vụ (Business Rules)', () => {
    it('Cập nhật thất bại - Movie Id Không tồn tại', async () => {
      const body: MovieBody = { title: 'Unknown Movie' };
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Movie Not Found',
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
          return response;
        },
      );
    });

    it('Cập nhật thất bại - Genre Ids chứa ID ảo không tồn tại', async () => {
      const body: MovieBody = { genreIds: [999999] };
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Genre Not Found',
          description: 'List Thể loại bao gồm mã ID ảo (999999)',
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
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'không tồn tại');
          return response;
        },
      );
    });
  });

  describe('Luồng thành công (Happy Path)', () => {
    it('Cập nhật thành công - Thuộc tính chung (Không ảnh hưởng Slug)', async () => {
      const body: MovieBody = {
        description: 'New Detail Update',
        duration: 999,
        status: MovieStatus.SHOWING,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Partial Fields Update',
          description: 'Chỉ cập nhật duration, description, status',
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
          return response;
        },
      );
    });
  });
});
