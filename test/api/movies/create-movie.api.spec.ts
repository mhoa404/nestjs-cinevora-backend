import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { Server } from 'http';

import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import {
  parseApiData,
  parseApiError,
  expectErrorMessage,
  getActualStatus,
} from '../../helpers/http-test.helper';
import { AppModule } from '../../../src/app.module';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';
import {
  AgeRating,
  MovieStatus,
  Movie,
} from '../../../src/modules/movies/entities/movie.entity';
import { Genre } from '../../../src/modules/genres/entities/genre.entity';

type MovieBody = Record<string, any>;

export interface CreateMovieResponse {
  id: number;
  slug: string;
  title: string;
  genres?: { id: number; name: string }[];
}

describe('[API] POST /movies', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';
  let validGenreId = 1;

  const results: TestCaseRecord[] = [];
  const PREFIX = 'CMV';
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
  });

  afterAll(async () => {
    const movieRepo = dataSource.getRepository(Movie);
    await movieRepo
      .createQueryBuilder()
      .delete()
      .where('title IN (:...titles)', {
        titles: ['Spider Man Minimum', 'Oppenheimer Full'],
      })
      .execute();

    await exportTestReport(results, PREFIX, 'Create_Movie');
    await app.close();
  });

  describe('Phân quyền (Security & Roles)', () => {
    const body: MovieBody = {
      title: 'Missing Token Movie',
      posterUrl: 'http://example.com/poster.jpg',
      duration: 120,
      ageRating: AgeRating.P,
      releaseDate: '2026-05-01',
    };

    it('Tạo thất bại - Không gửi token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: No Token',
          description: 'Gọi API tạo Movie nhưng không set header Authorization',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: '',
        },
        async () => {
          const response = await request(server).post('/movies').send(body);
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Tạo thất bại - Token fake/không hợp lệ', async () => {
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
            .post('/movies')
            .set('Authorization', `Bearer fake.jwt.hack`)
            .send(body);
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Tạo thất bại - Token Customer (Không đủ quyền)', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Forbidden Role',
          description: 'Dùng token của Customer tạo movie',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: '',
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

  describe('Validation đầu vào (DTO)', () => {
    it('Tạo thất bại - Thiếu trường bắt buộc', async () => {
      const body: MovieBody = {
        title: 'Missing Info Movie',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Missing fields',
          description: 'Chỉ gửi mỗi title, thiếu duration, posterUrl etc.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          return response;
        },
      );
    });

    it('Tạo thất bại - Sai type (Number -> String)', async () => {
      const body: MovieBody = {
        title: 'Wrong Type Movie',
        posterUrl: 'http://example.com/poster.jpg',
        duration: 'Một Trăm Hai Mươi',
        ageRating: AgeRating.P,
        releaseDate: '2026-05-01',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Invalid Type',
          description: 'Trường duration truyền string thay vì số',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          return response;
        },
      );
    });

    it('Tạo thất bại - URL sai định dạng', async () => {
      const body: MovieBody = {
        title: 'Wrong URL Movie',
        posterUrl: 'not_a_valid_url',
        duration: 120,
        ageRating: AgeRating.P,
        releaseDate: '2026-05-01',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Invalid URL',
          description: 'Sai định dạng URL (posterUrl)',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          return response;
        },
      );
    });

    it('Tạo thất bại - Enum không hợp lệ', async () => {
      const body: MovieBody = {
        title: 'Wrong Enum Movie',
        posterUrl: 'http://example.com/poster.jpg',
        duration: 120,
        ageRating: 'C20' as string,
        releaseDate: '2026-05-01',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Invalid Enum',
          description: 'Gửi ageRating không nằm trong Enum thiết kế',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          return response;
        },
      );
    });

    it('Tạo thất bại - Mảng ID Thể loại có chứa chuỗi', async () => {
      const body: MovieBody = {
        title: 'Wrong Array Movie',
        posterUrl: 'http://example.com/poster.jpg',
        duration: 120,
        ageRating: AgeRating.P,
        releaseDate: '2026-05-01',
        genreIds: [1, 'wrong_id'],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Invalid Type in Array',
          description: 'Gửi genreIds có chứa chuỗi thay vì mảng toàn số',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          return response;
        },
      );
    });
  });

  describe('Luồng thành công (Happy Path)', () => {
    it('Tạo thành công - Các trường mandatory', async () => {
      const body: MovieBody = {
        title: 'Spider Man Minimum',
        posterUrl: 'http://example.com/poster.jpg',
        duration: 130,
        ageRating: AgeRating.C13,
        releaseDate: '2026-05-01',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Minimum Fields',
          description: 'Tạo phim mới chỉ với các fields bắt buộc tối thiểu',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(201);
          const data = parseApiData<CreateMovieResponse>(response);
          expect(data.id).toBeGreaterThan(0);
          expect(data.slug).toMatch(/^spider-man-minimum-\d{3}$/);
          return response;
        },
      );
    });

    it('Tạo thành công - Full cấu hình và Thể loại', async () => {
      const body: MovieBody = {
        title: 'Oppenheimer Full',
        posterUrl: 'http://example.com/poster.jpg',
        trailerUrl: 'http://example.com/trailer.mp4',
        description: 'Phim về bom nguyên tử',
        duration: 180,
        director: 'Christopher Nolan',
        actor: 'Cillian Murphy',
        language: 'EN',
        ageRating: AgeRating.C18,
        rated: 'R',
        status: MovieStatus.SHOWING,
        releaseDate: '2026-08-01',
        genreIds: [validGenreId],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Maximum Fields',
          description: 'Tạo phim mới truyền tất cả các parameters cho phép',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(201);
          const data = parseApiData<CreateMovieResponse>(response);
          expect(data.genres).toBeDefined();
          expect(data.genres?.length).toBe(1);
          return response;
        },
      );
    });
  });

  describe('Ràng buộc nghiệp vụ (Business Rules)', () => {
    it('Tạo thất bại - Genre ID không tồn tại trong CSDL', async () => {
      const body: MovieBody = {
        title: 'Conflict Genre Movie',
        posterUrl: 'http://example.com/poster.jpg',
        duration: 120,
        ageRating: AgeRating.P,
        releaseDate: '2026-05-01',
        genreIds: [999999],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Genre not found',
          description: 'Gửi genreIds là số ngẫu nhiên lớn không có thật',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .post('/movies')
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
});
