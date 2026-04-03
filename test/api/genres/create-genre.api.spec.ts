import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { Server } from 'http';

import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import { parseApiData, parseApiError } from '../../helpers/http-test.helper';
import { AppModule } from '../../../src/app.module';
import {
  expectErrorMessage,
  getActualStatus,
} from '../../helpers/http-test.helper';
import { GenreResponseDto } from '../../../src/modules/genres/dto/genre-response.dto';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';

type GenreBody = {
  name?: string;
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

    const adminData = parseApiData<AuthResponseDto>(adminLoginRes);
    adminToken = adminData.accessToken;

    const customerLoginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'api_client@gmail.com', password: 'Api_client_123' });

    const customerData = parseApiData<AuthResponseDto>(customerLoginRes);
    customerToken = customerData.accessToken;
  });

  afterAll(async () => {
    await exportTestReport(results, PREFIX, 'Create_Genre');
    await app.close();
  });

  describe('Tạo mới thể loại', () => {
    it('Tạo thành công - Đủ field, field hợp lệ', async () => {
      const body: GenreBody = { name: 'Test' };

      await record(
        {
          id: nextId(),
          scope: 'All',
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

    it('Tạo thất bại - Sai Role', async () => {
      const body: GenreBody = { name: 'Kinh dị' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Sai quyền truy cập',
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

    it('Tạo thất bại - Thiếu trường name', async () => {
      const body: GenreBody = {};

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu trường name',
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

          const resError = parseApiError(response);
          expectErrorMessage(resError, 400, 'Vui lòng nhập tên thể loại.');
          return response;
        },
      );
    });

    it('Tạo thất bại - Name vượt quá 100 ký tự', async () => {
      const body: GenreBody = {
        name: 'a'.repeat(101),
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tên thể loại quá dài',
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

          const resError = parseApiError(response);
          expectErrorMessage(resError, 400, 'Tên thể loại tối đa 100 ký tự.');
          return response;
        },
      );
    });

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

      await record(
        {
          id: nextId(),
          scope: 'All',
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
          const resError = parseApiError(response);
          expectErrorMessage(resError, 400, 'Vui lòng nhập tên thể loại.');
          return response;
        },
      );
    });

    it('Tạo thất bại - name chỉ gồm khoảng trắng ("   ")', async () => {
      const body: GenreBody = { name: '   ' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Tên thể loại toàn dấu cách',
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

    it('Tạo thất bại - name là kiểu dữ liệu null', async () => {
      const body = { name: null };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: name = null',
          description: 'Gửi name là null.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: '',
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

    it('Tạo thất bại - name là kiểu dữ liệu boolean (true)', async () => {
      const body = { name: true };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: name = boolean',
          description: 'Gửi name là true boolean.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: '',
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

    it('Tạo thất bại - Gửi payload dư thừa field', async () => {
      const body = { name: 'Thể loại C', allowAll: true, foo: 'bar' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: field dư thừa',
          description: 'Gửi body chứa property ngoài field name.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: '',
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

    it('Tạo thất bại - Sai Signature hoặc token fake', async () => {
      const body: GenreBody = { name: 'Token Lởm' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Fake Token',
          description: 'Gửi chuỗi token auth invalid.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: '',
        },
        async () => {
          const response = await request(server)
            .post('/genres')
            .set('Authorization', `Bearer fake.jwt.hack`)
            .send(body);

          expect(response.status).toBe(401);
          return response;
        },
      );
    });
  });
});
