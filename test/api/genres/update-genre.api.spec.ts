import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { Server } from 'http';

import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import {
  parseApiData,
  parseApiError,
  expectErrorMessage,
  getActualStatus,
} from '../../helpers/http-test.helper';
import { AppModule } from '../../../src/app.module';
import { GenreResponseDto } from '../../../src/modules/genres/dto/genre-response.dto';
import { Genre } from '../../../src/modules/genres/entities/genre.entity';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';

type GenreBody = {
  name?: string | null | boolean;
  allowAll?: boolean;
  extraField?: string;
};

describe('[API] PATCH /genres/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let targetGenreId = 0;
  let existingGenreName = '';

  const results: TestCaseRecord[] = [];
  const PREFIX = 'UGR';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return `${PREFIX}${String(counter).padStart(2, '0')}`;
  };

  const stringifyProcedure = (
    body?: GenreBody | Record<string, unknown>,
  ): string => {
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
      .post('/auth/mobile/login')
      .send({ email: 'api_tester@gmail.com', password: 'Api_tester_123' });

    adminToken = parseApiData<AuthResponseDto>(adminLoginRes).accessToken;

    const customerLoginRes = await request(server)
      .post('/auth/mobile/login')
      .send({ email: 'api_client@gmail.com', password: 'Api_client_123' });

    customerToken = parseApiData<AuthResponseDto>(customerLoginRes).accessToken;

    const genreRepository = dataSource.getRepository(Genre);
    const unique = Date.now();

    const genre1 = await genreRepository.save(
      genreRepository.create({
        name: `Target Genre ${unique}`,
        slug: `target-genre-${unique}`,
      }),
    );
    targetGenreId = genre1.id;

    const genre2 = await genreRepository.save(
      genreRepository.create({
        name: `Existing Genre ${unique}`,
        slug: `existing-genre-${unique}`,
      }),
    );
    existingGenreName = genre2.name;
  });

  afterAll(async () => {
    await exportTestReport(results, PREFIX, 'Update_Genre');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Cập nhật thất bại - Không có Access Token', async () => {
      const body = { name: 'Kinh dị Updated' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Missing Token',
          description:
            'Gọi API cập nhật thể loại nhưng không set header Authorization.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không có token.',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .send(body);
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Cập nhật thất bại - Fake Token', async () => {
      const body = { name: 'Kinh dị Updated' };

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
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', 'Bearer fake.jwt.token')
            .send(body);

          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Cập nhật thất bại - Sai Role', async () => {
      const body = { name: 'Kinh dị Updated' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Customer Forbidden',
          description: 'Gửi token của tài khoản Customer.',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: 'Tài khoản Customer đã đăng nhập.',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${customerToken}`)
            .send(body);

          expect(response.status).toBe(403);
          return response;
        },
      );
    });
  });

  describe('Validation', () => {
    it('Cập nhật thất bại - Thiếu trường name', async () => {
      const body = {};

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Missing Name',
          description: 'Gửi body rỗng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin.',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng nhập tên thể loại.');
          return response;
        },
      );
    });

    it('Cập nhật thất bại - Name vượt quá 100 ký tự', async () => {
      const body = { name: 'a'.repeat(101) };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Name Too Long',
          description: 'Gửi name có 101 ký tự.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin.',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Tên thể loại tối đa 100 ký tự.');
          return response;
        },
      );
    });

    it('Cập nhật thất bại - name là chuỗi rỗng', async () => {
      const body = { name: '' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Empty String',
          description: 'Gửi name là chuỗi rỗng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin.',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng nhập tên thể loại.');
          return response;
        },
      );
    });

    it('Cập nhật thất bại - name chỉ gồm khoảng trắng', async () => {
      const body = { name: '   ' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Whitespace Only',
          description: 'Gửi name toàn dấu cách.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin.',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Tên thể loại không được để trống.');
          return response;
        },
      );
    });

    it('Cập nhật thất bại - Gửi payload dư field', async () => {
      const body = { name: 'Thể loại C', allowAll: true, extraField: 'abc' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Extra Fields',
          description: 'Gửi thêm field không được khai báo trong DTO.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'ValidationPipe bật forbidNonWhitelisted.',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expect(error.statusCode).toBe(400);
          return response;
        },
      );
    });
  });

  describe('Business Logic', () => {
    it('Cập nhật thất bại - Thể loại không tồn tại', async () => {
      const body = { name: 'Test Genre Update Non-existent' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Not Found',
          description: 'Cập nhật một thể loại với ID không tồn tại.',
          procedure: stringifyProcedure(body),
          expectedResult: 404,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .patch('/genres/999999')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(404);
          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Thể loại #999999 không tồn tại.');

          return response;
        },
      );
    });

    it('Cập nhật thành công - Name hợp lệ', async () => {
      const unique = Date.now();
      const body = { name: `Updated Genre ${unique}` };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Update Success',
          description: 'Cập nhật thể loại với token admin và name hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Tài khoản Admin đã đăng nhập.',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(200);

          const data = parseApiData<GenreResponseDto>(response);
          expect(data.name).toBe(body.name);
          expect(data.slug).toBe(`updated-genre-${unique}`);

          return response;
        },
      );
    });

    it('Cập nhật thành công - Tự trim khoảng trắng hai đầu', async () => {
      const unique = Date.now();
      const body = { name: `   Updated Genre Trim ${unique}   ` };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Auto Trim',
          description: 'Truyền tên có dấu cách thừa ở đầu và cuối.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(200);

          const data = parseApiData<GenreResponseDto>(response);
          expect(data.name).toBe(`Updated Genre Trim ${unique}`);
          expect(data.slug).toBe(`updated-genre-trim-${unique}`);

          return response;
        },
      );
    });

    it('Cập nhật thành công - Giữ nguyên tên ban đầu', async () => {
      const unique = Date.now();
      const name = `Updated Genre Trim ${unique}`;

      const body = { name };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Same Name',
          description: 'Cập nhật thể loại với tên cũ của chính nó.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Cập nhật về lại tên cũ.',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(200);
          return response;
        },
      );
    });

    it('Cập nhật thất bại - Tên thể loại đã tồn tại bởi ID khác', async () => {
      const body = { name: existingGenreName };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Duplicate Name',
          description: 'Cập nhật thể loại thành tên của một thể loại khác.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Đã tạo sẵn genre cùng tên.',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(409);
          const error = parseApiError(response);
          expectErrorMessage(error, 409, 'Tên thể loại đã tồn tại');
          return response;
        },
      );
    });
  });
});
