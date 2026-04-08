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
=======
import { parseApiData, parseApiError } from '../../helpers/http-test.helper';
import { AppModule } from '../../../src/app.module';
import {
  expectErrorMessage,
  getActualStatus,
} from '../../helpers/http-test.helper';
>>>>>>> origin/main
import { GenreResponseDto } from '../../../src/modules/genres/dto/genre-response.dto';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';

type GenreBody = {
<<<<<<< HEAD
  name?: string | null | boolean;
  allowAll?: boolean;
  extraField?: string;
=======
  name?: string;
>>>>>>> origin/main
};

describe('[API] POST /genres', () => {
  let app: INestApplication;
  let server: Server;

  let adminToken = '';
  let customerToken = '';

  const results: TestCaseRecord[] = [];
  const PREFIX = 'CGR';
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
    adminToken = parseApiData<AuthResponseDto>(adminLoginRes).accessToken;
=======
    const adminData = parseApiData<AuthResponseDto>(adminLoginRes);
    adminToken = adminData.accessToken;
>>>>>>> origin/main

    const customerLoginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'api_client@gmail.com', password: 'Api_client_123' });

<<<<<<< HEAD
    customerToken = parseApiData<AuthResponseDto>(customerLoginRes).accessToken;
=======
    const customerData = parseApiData<AuthResponseDto>(customerLoginRes);
    customerToken = customerData.accessToken;
>>>>>>> origin/main
  });

  afterAll(async () => {
    await exportTestReport(results, PREFIX, 'Create_Genre');
    await app.close();
  });

<<<<<<< HEAD
  describe('Phân quyền', () => {
    it('Tạo thất bại - Không có Access Token', async () => {
      const body = { name: 'Kinh dị' };
=======
  describe('Tạo mới thể loại', () => {
    it('Tạo thành công - Đủ field, field hợp lệ', async () => {
      const body: GenreBody = { name: 'Test' };
>>>>>>> origin/main

      await record(
        {
          id: nextId(),
          scope: 'All',
<<<<<<< HEAD
          testCase: 'Security: Missing Token',
=======
          testCase: 'Tạo thể loại thành công',
          description: 'Sử dụng token Admin với tên hợp lệ.',
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

          const res = parseApiData<GenreResponseDto>(response);
          expect(res.name).toBe('Test');
          expect(res.slug).toBe('test');

          return response;
        },
      );
    });

    it('Tạo thành công - Name thừa khoảng trắng hai đầu', async () => {
      const body: GenreBody = { name: '   Genre test   ' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Formatting: Tự trim 2 đầu',
          description: 'Truyền tên có dấu cách thừa ở đầu/cuối.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: '',
        },
        async () => {
          const response = await request(server)
            .post('/genres')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(201);
          const res = parseApiData<GenreResponseDto>(response);
          expect(res.name).toBe('Genre test');
          expect(res.slug).toBe('genre-test');
          return response;
        },
      );
    });

    it('Tạo thất bại - Không có Access Token', async () => {
      const body: GenreBody = { name: 'Kinh dị' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không gửi Token',
>>>>>>> origin/main
          description:
            'Gọi API tạo thể loại nhưng không set header Authorization.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không có token.',
        },
        async () => {
          const response = await request(server).post('/genres').send(body);
          expect(response.status).toBe(401);
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
            .send(body);

          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Tạo thất bại - Sai Role', async () => {
      const body = { name: 'Kinh dị' };
=======
    it('Tạo thất bại - Sai Role', async () => {
      const body: GenreBody = { name: 'Kinh dị' };
>>>>>>> origin/main

      await record(
        {
          id: nextId(),
          scope: 'All',
<<<<<<< HEAD
          testCase: 'Security: Customer Forbidden',
=======
          testCase: 'Sai quyền truy cập',
>>>>>>> origin/main
          description: 'Gửi token của tài khoản Customer.',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: 'Tài khoản Customer đã đăng nhập.',
        },
        async () => {
          const response = await request(server)
            .post('/genres')
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
=======

    it('Tạo thất bại - Thiếu trường name', async () => {
      const body: GenreBody = {};
>>>>>>> origin/main

      await record(
        {
          id: nextId(),
          scope: 'All',
<<<<<<< HEAD
          testCase: 'Validation: Missing Name',
=======
          testCase: 'Thiếu trường name',
>>>>>>> origin/main
          description: 'Gửi body rỗng.',
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
<<<<<<< HEAD
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng nhập tên thể loại.');
=======

          const resError = parseApiError(response);
          expectErrorMessage(resError, 400, 'Vui lòng nhập tên thể loại.');
>>>>>>> origin/main
          return response;
        },
      );
    });

    it('Tạo thất bại - Name vượt quá 100 ký tự', async () => {
<<<<<<< HEAD
      const body = { name: 'a'.repeat(101) };
=======
      const body: GenreBody = {
        name: 'a'.repeat(101),
      };
>>>>>>> origin/main

      await record(
        {
          id: nextId(),
          scope: 'All',
<<<<<<< HEAD
          testCase: 'Validation: Name Too Long',
=======
          testCase: 'Tên thể loại quá dài',
>>>>>>> origin/main
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
<<<<<<< HEAD
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Tên thể loại tối đa 100 ký tự.');
=======

          const resError = parseApiError(response);
          expectErrorMessage(resError, 400, 'Tên thể loại tối đa 100 ký tự.');
>>>>>>> origin/main
          return response;
        },
      );
    });

<<<<<<< HEAD
    it('Tạo thất bại - name là chuỗi rỗng', async () => {
      const body = { name: '' };
=======
    it('Tạo thất bại - Tên thể loại đã tồn tại', async () => {
      const body: GenreBody = { name: 'Test' };
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Trùng tên thể loại',
          description: 'Tạo lại thể loại có tên giống hệt TC01.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Đã có thể lại giống tên',
        },
        async () => {
          const response = await request(server)
            .post('/genres')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(409);
          const resError = parseApiError(response);
          expectErrorMessage(resError, 409, `Tên thể loại đã tồn tại`);
          return response;
        },
      );
    });

    it('Tạo thất bại - Trùng slug', async () => {
      const body: GenreBody = { name: 'Tést' };
>>>>>>> origin/main

      await record(
        {
          id: nextId(),
          scope: 'All',
<<<<<<< HEAD
          testCase: 'Validation: Empty String',
=======
          testCase: 'Trùng slug',
          description: 'Tạo tên khác nhưng sinh ra slug đã tồn tại.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'TC01 đã chạy thành công.',
        },
        async () => {
          const response = await request(server)
            .post('/genres')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(409);

          const resError = parseApiError(response);
          expectErrorMessage(resError, 409, `Slug này đã tồn tại.`);
          return response;
        },
      );
    });

    it('Tạo thất bại - name là chuỗi rỗng ("")', async () => {
      const body: GenreBody = { name: '' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Chuỗi rỗng',
>>>>>>> origin/main
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
<<<<<<< HEAD
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Vui lòng nhập tên thể loại.');
=======
          const resError = parseApiError(response);
          expectErrorMessage(resError, 400, 'Vui lòng nhập tên thể loại.');
>>>>>>> origin/main
          return response;
        },
      );
    });

<<<<<<< HEAD
    it('Tạo thất bại - name chỉ gồm khoảng trắng', async () => {
      const body = { name: '   ' };
=======
    it('Tạo thất bại - name chỉ gồm khoảng trắng ("   ")', async () => {
      const body: GenreBody = { name: '   ' };
>>>>>>> origin/main

      await record(
        {
          id: nextId(),
          scope: 'All',
<<<<<<< HEAD
          testCase: 'Validation: Whitespace Only',
=======
          testCase: 'Validation: Tên thể loại toàn dấu cách',
>>>>>>> origin/main
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
<<<<<<< HEAD
          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Tên thể loại không được để trống.');
=======
          const resError = parseApiError(response);
          expectErrorMessage(
            resError,
            400,
            'Tên thể loại không được để trống.',
          );
>>>>>>> origin/main
          return response;
        },
      );
    });

<<<<<<< HEAD
    it('Tạo thất bại - name là null', async () => {
=======
    it('Tạo thất bại - name là kiểu dữ liệu null', async () => {
>>>>>>> origin/main
      const body = { name: null };

      await record(
        {
          id: nextId(),
          scope: 'All',
<<<<<<< HEAD
          testCase: 'Validation: Name Is Null',
          description: 'Gửi name là null.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin.',
=======
          testCase: 'Validation: name = null',
          description: 'Gửi name là null.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: '',
>>>>>>> origin/main
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

<<<<<<< HEAD
    it('Tạo thất bại - name là boolean', async () => {
=======
    it('Tạo thất bại - name là kiểu dữ liệu boolean (true)', async () => {
>>>>>>> origin/main
      const body = { name: true };

      await record(
        {
          id: nextId(),
          scope: 'All',
<<<<<<< HEAD
          testCase: 'Validation: Name Is Boolean',
          description: 'Gửi name là true boolean.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin.',
=======
          testCase: 'Validation: name = boolean',
          description: 'Gửi name là true boolean.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: '',
>>>>>>> origin/main
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

<<<<<<< HEAD
    it('Tạo thất bại - Gửi payload dư field', async () => {
      const body = { name: 'Thể loại C', allowAll: true, extraField: 'abc' };
=======
    it('Tạo thất bại - Gửi payload dư thừa field', async () => {
      const body = { name: 'Thể loại C', allowAll: true, foo: 'bar' };
>>>>>>> origin/main

      await record(
        {
          id: nextId(),
          scope: 'All',
<<<<<<< HEAD
          testCase: 'Validation: Extra Fields',
          description: 'Gửi thêm field không được khai báo trong DTO.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'ValidationPipe bật forbidNonWhitelisted.',
=======
          testCase: 'Validation: field dư thừa',
          description: 'Gửi body chứa property ngoài field name.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: '',
>>>>>>> origin/main
        },
        async () => {
          const response = await request(server)
            .post('/genres')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);
<<<<<<< HEAD
          const error = parseApiError(response);
          expect(error.statusCode).toBe(400);
          return response;
        },
      );
    });
  });

  describe('Business Logic', () => {
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
>>>>>>> origin/main
          return response;
        },
      );
    });

<<<<<<< HEAD
    it('Tạo thành công - Tự trim khoảng trắng hai đầu', async () => {
      const unique = Date.now();
      const body = { name: `   Genre Trim ${unique}   ` };
=======
    it('Tạo thất bại - Sai Signature hoặc token fake', async () => {
      const body: GenreBody = { name: 'Token Lởm' };
>>>>>>> origin/main

      await record(
        {
          id: nextId(),
          scope: 'All',
<<<<<<< HEAD
          testCase: 'Happy Path: Auto Trim',
          description: 'Truyền tên có dấu cách thừa ở đầu và cuối.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Dùng token admin.',
=======
          testCase: 'Security: Fake Token',
          description: 'Gửi chuỗi token auth invalid.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: '',
>>>>>>> origin/main
        },
        async () => {
          const response = await request(server)
            .post('/genres')
<<<<<<< HEAD
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
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(409);
          const error = parseApiError(response);
          expectErrorMessage(error, 409, 'Tên thể loại đã tồn tại');
          return response;
        },
      );
    });

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
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(409);
          const error = parseApiError(response);
          expectErrorMessage(error, 409, 'Slug này đã tồn tại.');
=======
            .set('Authorization', `Bearer fake.jwt.hack`)
            .send(body);

          expect(response.status).toBe(401);
>>>>>>> origin/main
          return response;
        },
      );
    });
  });
});
