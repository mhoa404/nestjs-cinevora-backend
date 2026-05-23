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
import { getActualStatus, parseApiData } from '../../helpers/http-test.helper';

describe('[API] GET /genres', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  const createdGenreIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'GGR';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return PREFIX + String(counter).padStart(2, '0');
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

    const genres = await genreRepository.save([
      genreRepository.create({
        name: 'Z Get Genre ' + seed,
        slug: 'z-get-genre-' + seed,
      }),
      genreRepository.create({
        name: 'A Get Genre ' + seed,
        slug: 'a-get-genre-' + seed,
      }),
      genreRepository.create({
        name: 'M Get Genre ' + seed,
        slug: 'm-get-genre-' + seed,
      }),
    ]);

    createdGenreIds.push(...genres.map((genre) => genre.id));
  });

  afterAll(async () => {
    const genreRepository = dataSource.getRepository(Genre);

    if (createdGenreIds.length > 0) {
      await genreRepository.delete(createdGenreIds);
    }

    await exportTestReport(results, PREFIX, 'Get_Genres');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Lấy danh sách thành công - Không cần Access Token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Lấy danh sách thể loại phim',
          description:
            'Gọi API lấy danh sách thể loại phim mà không gửi Authorization header.',
          procedure: 'GET /genres',
          expectedResult: 200,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server).get('/genres');

          expect(response.status).toBe(200);
          expect(
            Array.isArray(parseApiData<GenreResponseDto[]>(response)),
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
          testCase: 'Gửi kèm Bearer token không hợp lệ',
          description:
            'Gọi API lấy danh sách thể loại phim với Bearer token không hợp lệ.',
          procedure: 'GET /genres với Authorization: Bearer fake.jwt.token',
          expectedResult: 200,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server)
            .get('/genres')
            .set('Authorization', 'Bearer fake.jwt.token');

          expect(response.status).toBe(200);
          expect(
            Array.isArray(parseApiData<GenreResponseDto[]>(response)),
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
          testCase: 'Kiểm tra response shape của GenreResponseDto',
          description:
            'Kiểm tra response chỉ gồm các field của GenreResponseDto.',
          procedure: 'GET /genres',
          expectedResult: 200,
          preconditions: 'Cần seed sẵn dữ liệu',
        },
        async () => {
          const response = await request(server).get('/genres');

          expect(response.status).toBe(200);

          const data = parseApiData<GenreResponseDto[]>(response);
          expect(Array.isArray(data)).toBe(true);

          const seededGenres = data.filter((genre) =>
            createdGenreIds.includes(genre.id),
          );

          expect(seededGenres.length).toBe(3);

          seededGenres.forEach((genre) => {
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

    it('Lấy danh sách thành công - Sắp xếp theo name ASC', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra thể loại được sắp xếp ASC',
          description:
            'Lấy danh sách thể loại phim thành công, kết quả được sắp xếp tăng dần theo name.',
          procedure: 'GET /genres',
          expectedResult: 200,
          preconditions: 'Cần seed sẵn dữ liệu',
        },
        async () => {
          const response = await request(server).get('/genres');

          expect(response.status).toBe(200);

          const data = parseApiData<GenreResponseDto[]>(response);
          const seededGenres = data.filter((genre) =>
            createdGenreIds.includes(genre.id),
          );

          expect(seededGenres.length).toBe(3);

          const names = seededGenres.map((genre) => genre.name);
          expect(names).toEqual([...names].sort());

          return response;
        },
      );
    });
  });
});
