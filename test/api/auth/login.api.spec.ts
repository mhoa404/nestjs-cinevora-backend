import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { Server } from 'http';
import { DataSource } from 'typeorm';

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
  password?: unknown;
};

describe('[API] POST /auth/login', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  const results: TestCaseRecord[] = [];
  const PREFIX = 'LOG';
  let counter = 0;

  const validUser = {
    email: 'api_client@gmail.com',
    password: 'Api_client_123',
  };

  /**
   * Các login success case sẽ sinh refresh token cho user test.
   * Cleanup sau mỗi case để tránh rác token hoặc ảnh hưởng các test suite khác.
   */
  const cleanupTokenUserEmails = [validUser.email];

  const cleanupRefreshTokens = async (): Promise<void> => {
    if (!dataSource?.isInitialized) return;

    await dataSource.query(
      `
        DELETE rt
        FROM refresh_tokens rt
        INNER JOIN users u ON u.id = rt.user_id
        WHERE u.email IN (?)
      `,
      [cleanupTokenUserEmails],
    );
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
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await cleanupRefreshTokens();
  });

  afterAll(async () => {
    await cleanupRefreshTokens();
    await exportTestReport(results, PREFIX, 'Login');
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // Mobile Scope
  // ---------------------------------------------------------------------------
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
          expect(res.expiresIn).toBeDefined();
          expect(res.user.email).toBe(validUser.email);
          expect(res.user.role).toBeDefined();
          expect(res.user.isActive).toBe(true);

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

    it('Đăng nhập Mobile thất bại - Password không phải chuỗi', async () => {
      const body = { email: validUser.email, password: 123456 };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Password không phải chuỗi (Mobile)',
          description: 'Gửi password là kiểu số nguyên thay vì string.',
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
          expectErrorMessage(res, 400, 'Mật khẩu không hợp lệ');

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

    it('Đăng nhập Mobile thất bại - Email chưa được đăng ký', async () => {
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

    it('Đăng nhập Mobile thất bại - Tài khoản bị vô hiệu hoá', async () => {
      // Tài khoản này cần được seed với is_active = 0 trong DB test.
      // Nếu chưa có seed riêng, bỏ qua (skip) hoặc tạo user rồi deactivate trước khi chạy.
      const body: LoginBody = {
        email: 'inactive_user@example.com',
        password: 'SomePassword123!',
      };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Tài khoản bị vô hiệu hoá (Mobile)',
          description:
            'Đăng nhập bằng tài khoản có is_active = false trong DB.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Tài khoản tồn tại trong DB nhưng is_active = false.',
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

  // ---------------------------------------------------------------------------
  // Web Scope
  // ---------------------------------------------------------------------------
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
          expect(res.expiresIn).toBeDefined();
          // Web endpoint KHÔNG trả refreshToken trong body — nằm trong cookie
          expect(res.refreshToken).toBeUndefined();
          expect(res.user.email).toBe(validUser.email);
          expect(res.user.role).toBeDefined();
          expect(res.user.isActive).toBe(true);

          const rawCookies = response.headers['set-cookie'];
          expect(rawCookies).toBeDefined();

          const cookies: string[] = Array.isArray(rawCookies)
            ? rawCookies
            : [rawCookies];

          expect(
            cookies.some((cookie) => cookie.includes('refreshToken=')),
          ).toBeTruthy();

          // Cookie phải có HttpOnly
          expect(
            cookies.some((cookie) => cookie.toLowerCase().includes('httponly')),
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

    it('Đăng nhập Web thất bại - Password không phải chuỗi', async () => {
      const body = { email: validUser.email, password: 123456 };

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Password không phải chuỗi (Web)',
          description: 'Gửi password là kiểu số nguyên thay vì string.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Không có điều kiện đặc biệt.',
        },
        async () => {
          const response = await request(server).post('/auth/login').send(body);
          expect(response.status).toBe(400);

          const res = parseApiError(response);
          expectErrorMessage(res, 400, 'Mật khẩu không hợp lệ');

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

    it('Đăng nhập Web thất bại - Email chưa được đăng ký', async () => {
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

    it('Đăng nhập Web thất bại - Tài khoản bị vô hiệu hoá', async () => {
      // Tài khoản này cần được seed với is_active = 0 trong DB test.
      const body: LoginBody = {
        email: 'inactive_user@example.com',
        password: 'SomePassword123!',
      };

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Tài khoản bị vô hiệu hoá (Web)',
          description:
            'Đăng nhập bằng tài khoản có is_active = false trong DB.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Tài khoản tồn tại trong DB nhưng is_active = false.',
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
