import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { Server } from 'http';

import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
<<<<<<< HEAD
import {
  parseApiData,
  parseApiError,
  expectErrorMessage,
  getActualStatus,
} from '../../helpers/http-test.helper';
import { AppModule } from '../../../src/app.module';
import { GenreResponseDto } from '../../../src/modules/genres/dto/genre-response.dto';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';

type GenreBody = {
  name?: string | null | boolean;
  allowAll?: boolean;
  extraField?: string;
};

describe('[API] POST /genres', () => {
=======
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
>>>>>>> origin/main
  let app: INestApplication;
  let server: Server;

  let adminToken = '';
  let customerToken = '';

<<<<<<< HEAD
  const results: TestCaseRecord[] = [];
  const PREFIX = 'CGR';
=======
  let targetGenreId: number;

  const results: TestCaseRecord[] = [];
  const PREFIX = 'UGR';
>>>>>>> origin/main
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
<<<<<<< HEAD
    return `${PREFIX}${String(counter).padStart(2, '0')}`;
  };

  const stringifyProcedure = (
    body?: GenreBody | Record<string, unknown>,
  ): string => {
=======
    return `${PREFIX}-${String(counter).padStart(3, '0')}`;
  };

  const stringifyProcedure = (body?: Record<string, unknown>): string => {
>>>>>>> origin/main
    if (!body || Object.keys(body).length === 0) return 'Không có dữ liệu';
    return JSON.stringify(body, null, 2);
  };

  const record = async (
<<<<<<< HEAD
    meta: Omit<TestCaseRecord, 'passed' | 'testDate' | 'actualResult'>,
=======
    meta: Omit<TestCaseRecord, 'id' | 'passed' | 'testDate' | 'actualResult'>,
>>>>>>> origin/main
    executor: () => Promise<Response>,
  ): Promise<void> => {
    const testDate = new Date();
    let passed = false;
    let actualResult: number | null = null;
<<<<<<< HEAD
=======
    const testId = nextId();
>>>>>>> origin/main

    try {
      const response = await executor();
      actualResult = response.status;
      passed = true;
    } catch (error: unknown) {
      actualResult = getActualStatus(error);
      passed = false;
      throw error;
    } finally {
<<<<<<< HEAD
      results.push({ ...meta, actualResult, passed, testDate });
=======
      results.push({ id: testId, ...meta, actualResult, passed, testDate });
>>>>>>> origin/main
    }
  };

  beforeAll(async () => {
    process.env.ENABLE_RECAPTCHA = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
<<<<<<< HEAD

=======
>>>>>>> origin/main
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        stopAtFirstError: true,
      }),
    );
    app.use(cookieParser());
<<<<<<< HEAD

=======
>>>>>>> origin/main
    await app.init();
    server = app.getHttpServer() as Server;

    const adminLoginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'api_tester@gmail.com', password: 'Api_tester_123' });

<<<<<<< HEAD
    adminToken = parseApiData<AuthResponseDto>(adminLoginRes).accessToken;
=======
    const adminAuthData = parseApiData<AuthResponseDto>(adminLoginRes);
    adminToken = adminAuthData.accessToken;
>>>>>>> origin/main

    const customerLoginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'api_client@gmail.com', password: 'Api_client_123' });

<<<<<<< HEAD
    customerToken = parseApiData<AuthResponseDto>(customerLoginRes).accessToken;
  });

  afterAll(async () => {
    await exportTestReport(results, PREFIX, 'Create_Genre');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Tạo thất bại - Không có Access Token', async () => {
      const body = { name: 'Kinh dị' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Missing Token',
          description:
            'Gọi API tạo thể loại nhưng không set header Authorization.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không có token.',
        },
        async () => {
          const response = await request(server).post('/genres').send(body);
          expect(response.status).toBe(401);
=======
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
>>>>>>> origin/main
          return response;
        },
      );
    });

<<<<<<< HEAD
    it('Tạo thất bại - Fake Token', async () => {
      const body = { name: 'Kinh dị' };

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
            .post('/genres')
            .set('Authorization', 'Bearer fake.jwt.token')
=======
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
>>>>>>> origin/main
            .send(body);

          expect(response.status).toBe(401);
          return response;
        },
      );
    });

<<<<<<< HEAD
    it('Tạo thất bại - Sai Role', async () => {
      const body = { name: 'Kinh dị' };

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
            .post('/genres')
=======
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
>>>>>>> origin/main
            .set('Authorization', `Bearer ${customerToken}`)
            .send(body);

          expect(response.status).toBe(403);
          return response;
        },
      );
    });
<<<<<<< HEAD
  });

  describe('Validation', () => {
    it('Tạo thất bại - Thiếu trường name', async () => {
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
            .post('/genres')
=======

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
>>>>>>> origin/main
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
<<<<<<< HEAD
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng nhập tên thể loại.');
          return response;
        },
      );
    });

    it('Tạo thất bại - Name vượt quá 100 ký tự', async () => {
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
            .post('/genres')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Tên thể loại tối đa 100 ký tự.');
          return response;
        },
      );
    });

    it('Tạo thất bại - name là chuỗi rỗng', async () => {
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
            .post('/genres')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng nhập tên thể loại.');
          return response;
        },
      );
    });

    it('Tạo thất bại - name chỉ gồm khoảng trắng', async () => {
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
            .post('/genres')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Tên thể loại không được để trống.');
          return response;
        },
      );
    });

    it('Tạo thất bại - name là null', async () => {
      const body = { name: null };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Name Is Null',
          description: 'Gửi name là null.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin.',
        },
        async () => {
          const response = await request(server)
            .post('/genres')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          return response;
        },
      );
    });

    it('Tạo thất bại - name là boolean', async () => {
      const body = { name: true };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Name Is Boolean',
          description: 'Gửi name là true boolean.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin.',
        },
        async () => {
          const response = await request(server)
            .post('/genres')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          return response;
        },
      );
    });

    it('Tạo thất bại - Gửi payload dư field', async () => {
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
            .post('/genres')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expect(error.statusCode).toBe(400);
=======
          const resError = parseApiError(response);
          expectErrorMessage(resError, 400, 'Vui lòng nhập tên thể loại.');
>>>>>>> origin/main
          return response;
        },
      );
    });
  });

  describe('Business Logic', () => {
<<<<<<< HEAD
    it('Tạo thành công - Name hợp lệ', async () => {
      const unique = Date.now();
      const body = { name: `Test Genre ${unique}` };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Create Success',
          description: 'Tạo thể loại với token admin và name hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Tài khoản Admin đã đăng nhập.',
        },
        async () => {
          const response = await request(server)
            .post('/genres')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(201);

          const data = parseApiData<GenreResponseDto>(response);
          expect(data.name).toBe(body.name);
          expect(data.slug).toBe(`test-genre-${unique}`);

=======
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
>>>>>>> origin/main
          return response;
        },
      );
    });

<<<<<<< HEAD
    it('Tạo thành công - Tự trim khoảng trắng hai đầu', async () => {
      const unique = Date.now();
      const body = { name: `   Genre Trim ${unique}   ` };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Auto Trim',
          description: 'Truyền tên có dấu cách thừa ở đầu và cuối.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .post('/genres')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(201);

          const data = parseApiData<GenreResponseDto>(response);
          expect(data.name).toBe(`Genre Trim ${unique}`);
          expect(data.slug).toBe(`genre-trim-${unique}`);

          return response;
        },
      );
    });

    it('Tạo thất bại - Tên thể loại đã tồn tại', async () => {
      const unique = Date.now();
      const originalName = `Duplicate Genre ${unique}`;

      await request(server)
        .post('/genres')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: originalName });

      const body = { name: originalName };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Duplicate Name',
          description: 'Tạo lại thể loại có tên giống hệt bản ghi đã tồn tại.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Đã tạo sẵn genre cùng tên.',
        },
        async () => {
          const response = await request(server)
            .post('/genres')
=======
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
>>>>>>> origin/main
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(409);
<<<<<<< HEAD
          const error = parseApiError(response);
          expectErrorMessage(error, 409, 'Tên thể loại đã tồn tại');
=======
          const resError = parseApiError(response);
          expectErrorMessage(resError, 409, 'Tên thể loại đã tồn tại');
>>>>>>> origin/main
          return response;
        },
      );
    });

<<<<<<< HEAD
    it('Tạo thất bại - Trùng slug', async () => {
      const unique = Date.now();
      const originalName = `Test Slug ${unique}`;
      const conflictName = `Tést-Slug ${unique}`;

      await request(server)
        .post('/genres')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: originalName });

      const body = { name: conflictName };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Duplicate Slug',
          description: 'Tên khác nhưng slug sinh ra trùng với bản ghi đã có.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Đã tạo sẵn genre có slug tương ứng.',
        },
        async () => {
          const response = await request(server)
            .post('/genres')
=======
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
>>>>>>> origin/main
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(409);
<<<<<<< HEAD
          const error = parseApiError(response);
          expectErrorMessage(error, 409, 'Slug này đã tồn tại.');
=======
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
>>>>>>> origin/main
          return response;
        },
      );
    });
  });
});
