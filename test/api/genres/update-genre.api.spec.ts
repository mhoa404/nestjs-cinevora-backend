import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { Server } from 'http';

import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import { AppModule } from '../../../src/app.module';
import {
  expectErrorMessage,
  getActualStatus,
  parseApiData,
  parseApiError,
} from '../../helpers/http-test.helper';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';
import { GenreResponseDto } from '../../../src/modules/genres/dto/genre-response.dto';

describe('[API] PATCH /genres/:id', () => {
  let app: INestApplication;
  let server: Server;

  let adminToken = '';
  let customerToken = '';

  let targetGenreId: number;

  const results: TestCaseRecord[] = [];
  const PREFIX = 'UGR';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return `${PREFIX}-${String(counter).padStart(3, '0')}`;
  };

  const stringifyProcedure = (body?: Record<string, unknown>): string => {
    if (!body || Object.keys(body).length === 0) return 'Không có dữ liệu';
    return JSON.stringify(body, null, 2);
  };

  const record = async (
    meta: Omit<TestCaseRecord, 'id' | 'passed' | 'testDate' | 'actualResult'>,
    executor: () => Promise<Response>,
  ): Promise<void> => {
    const testDate = new Date();
    let passed = false;
    let actualResult: number | null = null;
    const testId = nextId();

    try {
      const response = await executor();
      actualResult = response.status;
      passed = true;
    } catch (error: unknown) {
      actualResult = getActualStatus(error);
      passed = false;
      throw error;
    } finally {
      results.push({ id: testId, ...meta, actualResult, passed, testDate });
    }
  };

  beforeAll(async () => {
    process.env.ENABLE_RECAPTCHA = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

    const adminAuthData = parseApiData<AuthResponseDto>(adminLoginRes);
    adminToken = adminAuthData.accessToken;

    const customerLoginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'api_client@gmail.com', password: 'Api_client_123' });

    const customerAuthData = parseApiData<AuthResponseDto>(customerLoginRes);
    customerToken = customerAuthData.accessToken;

    const seedGenre = async (name: string): Promise<number> => {
      const res = await request(server)
        .post('/genres')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name });

      if (res.status === 201) {
        return parseApiData<GenreResponseDto>(res).id;
      }

      if (res.status === 409) {
        const listRes = await request(server).get('/genres');
        const genres = parseApiData<GenreResponseDto[]>(listRes);
        const existing = genres.find((g) => g.name === name);
        if (existing) return existing.id;
      }

      throw new Error(`Không thể seed data cho genre: ${name}`);
    };

    targetGenreId = await seedGenre('Test');
    await seedGenre('Tình cảm');
    await seedGenre('Khoa Học Viễn Tưởng');
  });

  afterAll(async () => {
    await exportTestReport(results, PREFIX, 'Update_Genre');
    await app.close();
  });

  describe('Validation & Security', () => {
    it('Update thất bại - Truyền chuỗi rỗng ', async () => {
      const body = { name: '' };
      await record(
        {
          scope: 'All',
          testCase: 'Validation: Chuỗi rỗng',
          description: 'Truyền name là chuỗi rỗng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: '',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const resError = parseApiError(response);
          expectErrorMessage(resError, 400, 'Vui lòng nhập tên thể loại.');
          return response;
        },
      );
    });

    it('Update thất bại - Name = null', async () => {
      const body = { name: null };
      await record(
        {
          scope: 'All',
          testCase: 'Validation: null',
          description: 'Truyền name là null.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: '',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          return response;
        },
      );
    });

    it('Update thất bại - Name chỉ chứa space', async () => {
      const body = { name: '     ' };
      await record(
        {
          scope: 'All',
          testCase: 'Validation: Chỉ có khoảng trắng',
          description: 'Truyền name chỉ chứa ký tự space.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: '',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const resError = parseApiError(response);
          expectErrorMessage(
            resError,
            400,
            'Tên thể loại không được để trống.',
          );
          return response;
        },
      );
    });

    it('Update thất bại - Name quá dài', async () => {
      const body = { name: 'a'.repeat(101) };
      await record(
        {
          scope: 'All',
          testCase: 'Validation: Vượt max length',
          description: 'Truyền name dài 101 ký tự.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: '',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const resError = parseApiError(response);
          expectErrorMessage(resError, 400, 'Tên thể loại tối đa 100 ký tự.');
          return response;
        },
      );
    });

    it('Update thất bại - Genre không tồn tại', async () => {
      const body = { name: 'Test thất bại' };
      const fakeId = 999999;
      await record(
        {
          scope: 'All',
          testCase: 'Business: ID không tồn tại',
          description: 'Cập nhật vào một ID chưa có trong DB.',
          procedure: stringifyProcedure(body),
          expectedResult: 404,
          preconditions: 'ID 999999 không tồn tại.',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${fakeId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(404);
          const resError = parseApiError(response);
          expectErrorMessage(
            resError,
            404,
            `Thể loại #${fakeId} không tồn tại.`,
          );
          return response;
        },
      );
    });

    it('Update thất bại - Không gửi token', async () => {
      const body = { name: 'Test thất bại' };
      await record(
        {
          scope: 'All',
          testCase: 'Security: No Token',
          description: 'Không có header Authorization.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: '',
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

    it('Update thất bại - Token không hợp lệ', async () => {
      const body = { name: 'Test thất bại' };
      await record(
        {
          scope: 'All',
          testCase: 'Security: Invalid Token',
          description: 'Gửi chuỗi token fake.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: '',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', 'Bearer invalid.fake.jwt')
            .send(body);

          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Update thất bại - Không đủ quyền', async () => {
      const body = { name: 'Test thất bại' };
      await record(
        {
          scope: 'All',
          testCase: 'Security: Sai Role',
          description: 'Sử dụng token Customer.',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: '',
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

    it('Update thất bại - id sai format', async () => {
      const body = { name: 'Test thất bại' };
      await record(
        {
          scope: 'All',
          testCase: 'Validation: ID sai format',
          description: 'Truyền id là chữ cái.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: '',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/abc`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          return response;
        },
      );
    });

    it('Update thất bại - payload thiếu field name', async () => {
      const body = {};
      await record(
        {
          scope: 'All',
          testCase: 'Validation: Thiếu field name',
          description: 'Gửi body rỗng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: '',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const resError = parseApiError(response);
          expectErrorMessage(resError, 400, 'Vui lòng nhập tên thể loại.');
          return response;
        },
      );
    });
  });

  describe('Business Logic', () => {
    it('Update thành công - Tên chứa space ở hai đầu', async () => {
      const body = { name: '   Test test   ' };
      await record(
        {
          scope: 'All',
          testCase: 'Business: Update thành công (Trim)',
          description: 'Cập nhật từ "Test" sang "Test test".',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Đang là Test.',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(200);
          const res = parseApiData<GenreResponseDto>(response);
          expect(res.name).toBe('Test test');
          return response;
        },
      );
    });

    it('Update thất bại - Trùng name', async () => {
      const body = { name: 'Tình cảm' };
      await record(
        {
          scope: 'All',
          testCase: 'Business: Trùng tên thể loại',
          description:
            'Update thành tên "Tình cảm", trùng với thể loại khác đã tạo từ đầu.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Tình cảm đã tồn tại.',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(409);
          const resError = parseApiError(response);
          expectErrorMessage(resError, 409, 'Tên thể loại đã tồn tại');
          return response;
        },
      );
    });

    it('Update thất bại - lỗi trùng slug', async () => {
      const body = { name: 'Khoá Học Viện Tướng' };
      await record(
        {
          scope: 'All',
          testCase: 'Business: Trùng Slug',
          description: 'Update tên rẽ nhánh tạo ra cùng slug.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Khoa Học Viễn Tưởng đã tồn tại.',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(409);
          const resError = parseApiError(response);
          expectErrorMessage(resError, 409, 'Slug này đã tồn tại.');
          return response;
        },
      );
    });

    it('Update thành công - Update lại chính tên hiện tại', async () => {
      const body = { name: 'Test test' };
      await record(
        {
          scope: 'All',
          testCase: 'Business: Dữ liệu không đổi',
          description: 'Update lại chính tên hiện tại của thể loại.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Tên đang là Test test.',
        },
        async () => {
          const response = await request(server)
            .patch(`/genres/${targetGenreId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(200);
          const res = parseApiData<GenreResponseDto>(response);
          expect(res.name).toBe('Test test');
          return response;
        },
      );
    });
  });
});
