import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { Server } from 'http';

import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import { AuthResponse } from '../../types/auth-user.type';
import { AppModule } from '../../../src/app.module';
import {
  expectErrorMessage,
  getActualStatus,
  parseApiData,
  parseApiError,
} from '../../helpers/http-test.helper';

type LoginBody = {
  email?: string;
  password?: string;
};

describe('[API] POST /auth/login', () => {
  let app: INestApplication;
  let server: Server;

  const results: TestCaseRecord[] = [];
  const PREFIX = (process.env.TEST_PREFIX ?? 'LOG').toUpperCase();
  let counter = 0;

  const validUser = {
    fullName: 'Test Login User',
    email: `login_test_${Date.now()}@example.com`,
    password: 'TestPassword@123',
    dateOfBirth: '2000-01-01',
    phone: `9${Math.floor(10000000 + Math.random() * 89999999)}`,
    recaptchaToken: 'bypass-token',
  };

  const nextId = (): string => {
    counter += 1;
    return `${PREFIX}${String(counter).padStart(2, '0')}`;
  };

  const stringifyProcedure = (
    body?: LoginBody | Record<string, unknown>,
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
  });

  afterAll(async () => {
    await exportTestReport(results, PREFIX, 'Login');
    await app.close();
  });

  // Register: API dùng chung

  it('Đăng ký tài khoản (Setup cho Login)', async () => {
    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Đăng ký tài khoản test',
        description: 'Tạo tài khoản mới để đảm bảo có user thực tế cho test.',
        procedure: stringifyProcedure(validUser),
        expectedResult: 201,
        preconditions: 'Server chạy, DB kết nối thành công.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(validUser);
        expect(response.status).toBe(201);
        return response;
      },
    );
  });

  // API Mobile
  describe('Mobile Scope', () => {
    it('Đăng nhập Mobile thành công', async () => {
      const body: LoginBody = {
        email: validUser.email,
        password: validUser.password,
      };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Đăng nhập thành công (Mobile)',
          description: 'Gửi email và password hợp lệ tới API Mobile.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Tài khoản đã được tạo ở bước setup.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/login')
            .send(body);

          expect(response.status).toBe(200);

          const res = parseApiData<AuthResponse>(response);
          expect(res.accessToken).toBeDefined();
          expect(res.refreshToken).toBeDefined();
          expect(res.user.email).toBe(validUser.email);
          expect(res.user.role).toBeDefined();

          return response;
        },
      );
    });

    it('Đăng nhập Mobile thất bại - Thiếu email', async () => {
      const body: LoginBody = { password: validUser.password };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Thiếu email (Mobile)',
          description: 'Chỉ gửi password, không gửi trường email.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Không có điều kiện đặc biệt.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/login')
            .send(body);
          expect(response.status).toBe(400);

          const res = parseApiError(response);
          expectErrorMessage(res, 400, 'Vui lòng nhập địa chỉ email.');

          return response;
        },
      );
    });

    it('Đăng nhập Mobile thất bại - Email này chưa được đăng ký', async () => {
      const body: LoginBody = {
        email: 'not_exist_user_123@example.com',
        password: 'SomePassword123!',
      };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Email chưa đăng ký (Mobile)',
          description: 'Sử dụng một email không có trong hệ thống.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Email test không tồn tại trong DB.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/login')
            .send(body);
          expect(response.status).toBe(401);

          const res = parseApiError(response);
          expectErrorMessage(res, 401, 'Email hoặc mật khẩu không đúng');

          return response;
        },
      );
    });

    it('Đăng nhập Mobile thất bại - Email sai định dạng', async () => {
      const body: LoginBody = {
        email: 'invalid-email-string',
        password: validUser.password,
      };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Email sai định dạng (Mobile)',
          description: 'Gửi email không đúng format chuẩn.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Không có điều kiện đặc biệt.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/login')
            .send(body);
          expect(response.status).toBe(400);

          const res = parseApiError(response);
          expectErrorMessage(res, 400, 'Địa chỉ email không hợp lệ.');

          return response;
        },
      );
    });

    it('Đăng nhập Mobile thất bại - Thiếu password', async () => {
      const body: LoginBody = { email: validUser.email };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Thiếu password (Mobile)',
          description: 'Gửi email đúng nhưng không gửi password.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Không có điều kiện đặc biệt.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/login')
            .send(body);
          expect(response.status).toBe(400);

          const res = parseApiError(response);
          expectErrorMessage(res, 400, 'Vui lòng nhập mật khẩu.');

          return response;
        },
      );
    });

    it('Đăng nhập Mobile thất bại - Sai password', async () => {
      const body: LoginBody = {
        email: validUser.email,
        password: 'WrongPassword@123',
      };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Sai password (Mobile)',
          description: 'Gửi đúng email đã đăng ký nhưng sai mật khẩu.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Tài khoản đã tồn tại trong DB.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/login')
            .send(body);
          expect(response.status).toBe(401);

          const res = parseApiError(response);
          expectErrorMessage(res, 401, 'Email hoặc mật khẩu không đúng');

          return response;
        },
      );
    });
  });

  // Web API
  describe('Web Scope', () => {
    it('Đăng nhập Web thành công', async () => {
      const body: LoginBody = {
        email: validUser.email,
        password: validUser.password,
      };

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Đăng nhập thành công (Web)',
          description: 'Gửi email và password hợp lệ tới API Web.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Tài khoản đã được tạo ở bước setup.',
        },
        async () => {
          const response = await request(server).post('/auth/login').send(body);

          expect(response.status).toBe(200);

          const res = parseApiData<AuthResponse>(response);
          expect(res.accessToken).toBeDefined();

          // Đảm bảo token KHÔNG bị rò rỉ ra Body JSON
          expect(res.refreshToken).toBeUndefined();
          expect(res.user.email).toBe(validUser.email);
          expect(res.user.role).toBeDefined();

          // Kiểm tra xem backend có gửi Cookie cho trình duyệt không
          const rawCookies = response.headers['set-cookie'];
          expect(rawCookies).toBeDefined();

          // Đảm bảo đưa về dạng mảng dù supertest trả về chuỗi hay mảng
          const cookies: string[] = Array.isArray(rawCookies)
            ? rawCookies
            : [rawCookies];

          expect(
            cookies.some((cookie) => cookie.includes('refreshToken=')),
          ).toBeTruthy();

          return response;
        },
      );
    });

    it('Đăng nhập Web thất bại - Thiếu email', async () => {
      const body: LoginBody = { password: validUser.password };

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Thiếu email (Web)',
          description: 'Chỉ gửi password, không gửi trường email.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Không có điều kiện đặc biệt.',
        },
        async () => {
          const response = await request(server).post('/auth/login').send(body);
          expect(response.status).toBe(400);

          const res = parseApiError(response);
          expectErrorMessage(res, 400, 'Vui lòng nhập địa chỉ email.');

          return response;
        },
      );
    });

    it('Đăng nhập Web thất bại - Email này chưa được đăng ký', async () => {
      const body: LoginBody = {
        email: 'not_exist_user_123@example.com',
        password: 'SomePassword123!',
      };

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Email chưa đăng ký (Web)',
          description: 'Sử dụng một email không có trong hệ thống.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Email test không tồn tại trong DB.',
        },
        async () => {
          const response = await request(server).post('/auth/login').send(body);
          expect(response.status).toBe(401);

          const res = parseApiError(response);
          expectErrorMessage(res, 401, 'Email hoặc mật khẩu không đúng');

          return response;
        },
      );
    });

    it('Đăng nhập Web thất bại - Email sai định dạng', async () => {
      const body: LoginBody = {
        email: 'invalid-email-string',
        password: validUser.password,
      };

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Email sai định dạng (Web)',
          description: 'Gửi email không đúng format chuẩn.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Không có điều kiện đặc biệt.',
        },
        async () => {
          const response = await request(server).post('/auth/login').send(body);
          expect(response.status).toBe(400);

          const res = parseApiError(response);
          expectErrorMessage(res, 400, 'Địa chỉ email không hợp lệ.');

          return response;
        },
      );
    });

    it('Đăng nhập Web thất bại - Thiếu password', async () => {
      const body: LoginBody = { email: validUser.email };

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Thiếu password (Web)',
          description: 'Gửi email đúng nhưng không gửi password.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Không có điều kiện đặc biệt.',
        },
        async () => {
          const response = await request(server).post('/auth/login').send(body);
          expect(response.status).toBe(400);

          const res = parseApiError(response);
          expectErrorMessage(res, 400, 'Vui lòng nhập mật khẩu.');

          return response;
        },
      );
    });

    it('Đăng nhập Web thất bại - Sai password', async () => {
      const body: LoginBody = {
        email: validUser.email,
        password: 'WrongPassword@123',
      };

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Sai password (Web)',
          description: 'Gửi đúng email đã đăng ký nhưng sai mật khẩu.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Tài khoản đã tồn tại trong DB.',
        },
        async () => {
          const response = await request(server).post('/auth/login').send(body);
          expect(response.status).toBe(401);

          const res = parseApiError(response);
          expectErrorMessage(res, 401, 'Email hoặc mật khẩu không đúng');

          return response;
        },
      );
    });
  });
});
