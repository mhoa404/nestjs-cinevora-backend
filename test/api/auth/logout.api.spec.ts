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

type LogoutBody = {
  refreshToken?: string | number;
};

type LogoutSuccessResponse = {
  message: string;
};

describe('[API] POST /auth/logout', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  const results: TestCaseRecord[] = [];
  const PREFIX = (process.env.TEST_PREFIX ?? 'OUT').toUpperCase();
  let counter = 0;

  const validUser = {
    email: 'api_client@gmail.com',
    password: 'Api_client_123',
  };

  const cleanupTokenUserEmails = [validUser.email];

  const cleanupRefreshTokens = async (): Promise<void> => {
    if (!dataSource?.isInitialized) return;

    await dataSource.query(
      [
        'DELETE rt',
        'FROM refresh_tokens rt',
        'INNER JOIN users u ON u.id = rt.user_id',
        'WHERE u.email IN (?)',
      ].join(' '),
      [cleanupTokenUserEmails],
    );
  };

  const nextId = (): string => {
    counter += 1;
    return `${PREFIX}${String(counter).padStart(2, '0')}`;
  };

  const stringifyProcedure = (
    body?: LogoutBody | Record<string, unknown>,
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

  const createMobileRefreshToken = async (): Promise<string> => {
    const response = await request(server).post('/auth/mobile/login').send({
      email: validUser.email,
      password: validUser.password,
    });

    expect(response.status).toBe(200);

    return parseApiData<AuthResponse>(response).refreshToken as string;
  };

  const extractRefreshTokenCookie = (response: Response): string => {
    const rawCookies = response.headers['set-cookie'];
    const cookies: string[] = Array.isArray(rawCookies)
      ? rawCookies
      : rawCookies
        ? [rawCookies]
        : [];

    const refreshTokenCookie = cookies.find((cookie) =>
      cookie.startsWith('refreshToken='),
    );

    if (!refreshTokenCookie) {
      throw new Error('Missing refreshToken cookie from login response.');
    }

    return refreshTokenCookie.split(';')[0];
  };

  const createWebRefreshTokenCookie = async (): Promise<string> => {
    const response = await request(server).post('/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });

    expect(response.status).toBe(200);

    return extractRefreshTokenCookie(response);
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

    await cleanupRefreshTokens();
  });

  afterEach(async () => {
    await cleanupRefreshTokens();
  });

  afterAll(async () => {
    await cleanupRefreshTokens();
    await exportTestReport(results, PREFIX, 'Logout');
    await app.close();
  });

  describe('Mobile Scope', () => {
    it('Đăng xuất thành công (Mobile)', async () => {
      const mobileRefreshToken = await createMobileRefreshToken();
      const body: LogoutBody = { refreshToken: mobileRefreshToken };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Đăng xuất thành công',
          description: 'Gửi refresh token hợp lệ qua Body để đăng xuất.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'User đã đăng nhập.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/logout')
            .send(body);

          expect(response.status).toBe(200);

          const res = parseApiData<LogoutSuccessResponse>(response);
          expect(res.message).toBe('Đăng xuất thành công');

          return response;
        },
      );
    });

    it('Đăng xuất thất bại - Token đã bị thu hồi (Mobile)', async () => {
      const mobileRefreshToken = await createMobileRefreshToken();
      const body: LogoutBody = { refreshToken: mobileRefreshToken };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Token đã thu hồi',
          description: 'Đăng xuất lần 2 với token đã được thu hồi trước đó.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Token đã được logout thành công trước đó.',
        },
        async () => {
          const firstResponse = await request(server)
            .post('/auth/mobile/logout')
            .send(body);

          expect(firstResponse.status).toBe(200);

          const response = await request(server)
            .post('/auth/mobile/logout')
            .send(body);

          expect(response.status).toBe(401);

          const res = parseApiError(response);
          expectErrorMessage(
            res,
            401,
            'Refresh token không hợp lệ, đã hết hạn hoặc đã bị thu hồi.',
          );

          return response;
        },
      );
    });

    it('Đăng xuất thất bại - Refresh token không tồn tại (Mobile)', async () => {
      const body: LogoutBody = { refreshToken: 'invalid-refresh-token' };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Refresh token không tồn tại',
          description:
            'Gửi refresh token dạng chuỗi nhưng không tồn tại trong DB.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không có token tương ứng trong bảng refresh_tokens.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/logout')
            .send(body);

          expect(response.status).toBe(401);

          const res = parseApiError(response);
          expectErrorMessage(
            res,
            401,
            'Refresh token không hợp lệ, đã hết hạn hoặc đã bị thu hồi.',
          );

          return response;
        },
      );
    });

    it('Đăng xuất thất bại - Thiếu refresh token (Mobile)', async () => {
      const body: LogoutBody = {};

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Thiếu refresh token',
          description: 'Gửi request body rỗng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Controller Mobile yêu cầu bắt buộc.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/logout')
            .send(body);

          expect(response.status).toBe(400);

          const res = parseApiError(response);
          expectErrorMessage(res, 400, 'Vui lòng cung cấp refresh token');

          return response;
        },
      );
    });

    it('Đăng xuất thất bại - Sai định dạng token (Mobile)', async () => {
      const body: LogoutBody = { refreshToken: 123456 };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Sai định dạng token',
          description: 'Truyền kiểu dữ liệu số thay vì chuỗi.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'ValidationPipe bắt lỗi IsString.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/logout')
            .send(body);

          expect(response.status).toBe(400);

          const res = parseApiError(response);
          expectErrorMessage(res, 400, 'Định dạng refresh token không hợp lệ.');

          return response;
        },
      );
    });
  });

  describe('Web Scope', () => {
    it('Đăng xuất thành công (Web)', async () => {
      const body: LogoutBody = {};
      const webRefreshTokenCookie = await createWebRefreshTokenCookie();

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Đăng xuất thành công',
          description: 'Gửi request chứa Cookie hợp lệ để đăng xuất.',
          procedure: 'Gửi Header: Cookie=refreshToken=...',
          expectedResult: 200,
          preconditions: 'User đã đăng nhập Web và có refreshToken Cookie.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/logout')
            .set('Cookie', [webRefreshTokenCookie])
            .send(body);

          expect(response.status).toBe(200);

          const res = parseApiData<LogoutSuccessResponse>(response);
          expect(res.message).toBe('Đăng xuất thành công');

          const rawCookies = response.headers['set-cookie'];
          expect(rawCookies).toBeDefined();

          const cookies: string[] = Array.isArray(rawCookies)
            ? rawCookies
            : [rawCookies];

          expect(
            cookies.some((cookie) => cookie.includes('refreshToken=;')),
          ).toBeTruthy();

          return response;
        },
      );
    });

    it('Đăng xuất thất bại - Token đã bị thu hồi (Web)', async () => {
      const body: LogoutBody = {};
      const webRefreshTokenCookie = await createWebRefreshTokenCookie();

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Token đã thu hồi',
          description: 'Gửi Cookie chứa token đã bị thu hồi trước đó.',
          procedure: 'Gửi Header: Cookie với token cũ.',
          expectedResult: 401,
          preconditions: 'Token đã được logout thành công trước đó.',
        },
        async () => {
          const firstResponse = await request(server)
            .post('/auth/logout')
            .set('Cookie', [webRefreshTokenCookie])
            .send(body);

          expect(firstResponse.status).toBe(200);

          const response = await request(server)
            .post('/auth/logout')
            .set('Cookie', [webRefreshTokenCookie])
            .send(body);

          expect(response.status).toBe(401);

          const res = parseApiError(response);
          expectErrorMessage(
            res,
            401,
            'Refresh token không hợp lệ, đã hết hạn hoặc đã bị thu hồi.',
          );

          return response;
        },
      );
    });

    it('Đăng xuất thất bại - Refresh token không tồn tại (Web)', async () => {
      const body: LogoutBody = {};

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Refresh token không tồn tại',
          description:
            'Gửi Cookie refreshToken dạng chuỗi nhưng không tồn tại trong DB.',
          procedure: 'Gửi Header: Cookie=refreshToken=invalid-refresh-token',
          expectedResult: 401,
          preconditions: 'Không có token tương ứng trong bảng refresh_tokens.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/logout')
            .set('Cookie', ['refreshToken=invalid-refresh-token'])
            .send(body);

          expect(response.status).toBe(401);

          const res = parseApiError(response);
          expectErrorMessage(
            res,
            401,
            'Refresh token không hợp lệ, đã hết hạn hoặc đã bị thu hồi.',
          );

          return response;
        },
      );
    });

    it('Đăng xuất thất bại - Không gửi Cookie (Web)', async () => {
      const body: LogoutBody = {};

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Không gửi Cookie',
          description: 'Gọi API logout mà không kèm theo Cookie nào.',
          procedure: 'Request không có Header Cookie.',
          expectedResult: 400,
          preconditions: 'Không có.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/logout')
            .send(body);

          expect(response.status).toBe(400);

          const res = parseApiError(response);
          expectErrorMessage(
            res,
            400,
            'Không tìm thấy refresh token trong Cookie',
          );

          return response;
        },
      );
    });

    it('Đăng xuất thành công - Bỏ qua dữ liệu rác trong Body (Web)', async () => {
      const body: LogoutBody = { refreshToken: 123456 };
      const webRefreshTokenCookie = await createWebRefreshTokenCookie();

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Bỏ qua dữ liệu rác ở Body',
          description: 'Có Cookie hợp lệ nhưng cố tình gửi body sai định dạng.',
          procedure: 'Cookie hợp lệ + JSON Body chứa số.',
          expectedResult: 200,
          preconditions: 'API Web không validate Body.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/logout')
            .set('Cookie', [webRefreshTokenCookie])
            .send(body);

          expect(response.status).toBe(200);

          const res = parseApiData<LogoutSuccessResponse>(response);
          expect(res.message).toBe('Đăng xuất thành công');

          return response;
        },
      );
    });
  });
});
