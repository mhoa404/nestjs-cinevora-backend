import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { Server } from 'http';

import { AppModule } from '../../../src/app.module';
import { Genre } from '../../../src/modules/genres/entities/genre.entity';
import { GenreResponseDto } from '../../../src/modules/genres/dto/genre-response.dto';
import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import {
  expectErrorMessage,
  getActualStatus,
  parseApiData,
  parseApiError,
} from '../../helpers/http-test.helper';

describe('[API] GET /genres/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let validGenreId = 0;
  const createdGenreIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'GGI';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return `${PREFIX}${String(counter).padStart(2, '0')}`;
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
    const seed = Date.now();

    const genre = await genreRepository.save(
      genreRepository.create({
        name: `Get Genre By Id ${seed}`,
        slug: `get-genre-by-id-${seed}`,
      }),
    );

    validGenreId = genre.id;
    createdGenreIds.push(genre.id);
  });

  afterAll(async () => {
    const genreRepository = dataSource.getRepository(Genre);

    if (createdGenreIds.length > 0) {
      await genreRepository.delete(createdGenreIds);
    }

    await exportTestReport(results, PREFIX, 'Get_Genre_By_Id');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Lấy chi tiết genre thành công - Không cần Access Token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không gửi Header',
          description:
            'Gọi API lấy chi tiết thể loại phim mà không gửi Authorization header.',
          procedure: `GET /genres/${validGenreId}`,
          expectedResult: 200,
          preconditions: `Tồn tại genre với ID ${validGenreId}`,
        },
        async () => {
          const response = await request(server).get(`/genres/${validGenreId}`);

          expect(response.status).toBe(200);

          const data = parseApiData<GenreResponseDto>(response);
          expect(data.id).toBe(validGenreId);

          return response;
        },
      );
    });

    it('Lấy chi tiết genre thành công - Vẫn cho phép request có Fake Token vì API Public', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi token giả',
          description:
            'Gọi API lấy chi tiết thể loại phim với Bearer token không hợp lệ.',
          procedure: `GET /genres/${validGenreId} với Authorization: Bearer fake.jwt.token`,
          expectedResult: 200,
          preconditions: `Tồn tại genre với ID ${validGenreId}`,
        },
        async () => {
          const response = await request(server)
            .get(`/genres/${validGenreId}`)
            .set('Authorization', 'Bearer fake.jwt.token');

          expect(response.status).toBe(200);

          const data = parseApiData<GenreResponseDto>(response);
          expect(data.id).toBe(validGenreId);

          return response;
        },
      );
    });
  });

  describe('Validation & Business Logic', () => {
    it('Lấy chi tiết genre thất bại - ID không phải số', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Sai định dạng ID',
          description:
            'Truyền ID là chuỗi chữ cái, ParseIntPipe không thể parse sang number.',
          procedure: 'GET /genres/abc',
          expectedResult: 400,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server).get('/genres/abc');

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

    it('Lấy chi tiết genre thất bại - Genre ID không tồn tại', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi ID không tồn tại',
          description: 'Gửi ID không tồn tại trong hệ thống.',
          procedure: 'GET /genres/999999',
          expectedResult: 404,
          preconditions: `Không tồn tại genre với ID 999999`,
        },
        async () => {
          const response = await request(server).get('/genres/999999');

          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Thể loại #999999 không tồn tại.');

          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Lấy chi tiết genre thành công - Trả về đúng shape GenreResponseDto', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra shape GenreResponseDto',
          description:
            'Lấy chi tiết thể loại phim và kiểm tra response chỉ gồm các field của GenreResponseDto.',
          procedure: `GET /genres/${validGenreId}`,
          expectedResult: 200,
          preconditions: `Tồn tại genre với ID ${validGenreId}`,
        },
        async () => {
          const response = await request(server).get(`/genres/${validGenreId}`);

          expect(response.status).toBe(200);

          const data = parseApiData<GenreResponseDto>(response);

          expect(data.id).toBe(validGenreId);
          expect(data.name).toBeDefined();
          expect(data.slug).toBeDefined();
          expect(data.createdAt).toBeDefined();

          expect(typeof data.id).toBe('number');
          expect(typeof data.name).toBe('string');
          expect(typeof data.slug).toBe('string');
          expect(typeof data.createdAt).toBe('string');

          expect(Object.keys(data).sort()).toEqual([
            'createdAt',
            'id',
            'name',
            'slug',
          ]);

          return response;
        },
      );
    });
  });
});
