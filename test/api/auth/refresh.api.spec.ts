import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'http';
import { DataSource } from 'typeorm';

import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import { AuthResponse, AuthUser } from '../../types/auth-user.type';
import { AppModule } from '../../../src/app.module';
import {
  expectErrorMessage,
  getActualStatus,
  parseApiData,
  parseApiError,
} from '../../helpers/http-test.helper';

type RefreshBody = {
  refreshToken?: unknown;
};

describe('[API] POST /auth/refresh', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let configService: ConfigService;
  let validUser: AuthUser;

  const results: TestCaseRecord[] = [];
  const PREFIX = (process.env.TEST_PREFIX ?? 'REF').toUpperCase();
  let counter = 0;

  const validUserCredentials = {
    email: 'api_client@gmail.com',
    password: 'Api_client_123',
  };

  const cleanupTokenUserEmails = [validUserCredentials.email];

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
    body?: RefreshBody | Record<string, unknown>,
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
      email: validUserCredentials.email,
      password: validUserCredentials.password,
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
      throw new Error('Missing refreshToken cookie from response.');
    }

    return refreshTokenCookie.split(';')[0];
  };

  const createWebRefreshTokenCookie = async (): Promise<string> => {
    const response = await request(server).post('/auth/login').send({
      email: validUserCredentials.email,
      password: validUserCredentials.password,
    });

    expect(response.status).toBe(200);

    return extractRefreshTokenCookie(response);
  };

  const getRefreshSecret = (): string => {
    const refreshSecret = configService.get<string>('jwt.refreshSecret');

    if (!refreshSecret) {
      throw new Error('Missing jwt.refreshSecret config.');
    }

    return refreshSecret;
  };

  const createSignedRefreshToken = async (
    payload: {
      sub: string;
      email: string;
      role: string;
      exp?: number;
    },
    expiresInSeconds?: number,
  ): Promise<string> => {
    const options: { secret: string; expiresIn?: number } = {
      secret: getRefreshSecret(),
    };

    if (expiresInSeconds) {
      options.expiresIn = expiresInSeconds;
    }

    return jwtService.signAsync(payload, options);
  };

  const createExpiredRefreshToken = async (): Promise<string> => {
    const pastTime = Math.floor(Date.now() / 1000) - 3600;

    return createSignedRefreshToken({
      sub: validUser.id,
      email: validUser.email,
      role: validUser.role,
      exp: pastTime,
    });
  };

  const createDeletedUserRefreshToken = async (): Promise<string> => {
    return createSignedRefreshToken(
      {
        sub: '00000000-0000-0000-0000-000000000000',
        email: 'deleted_user@gmail.com',
        role: validUser.role,
      },
      3600,
    );
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
    jwtService = app.get<JwtService>(JwtService);
    configService = app.get<ConfigService>(ConfigService);

    const response = await request(server).post('/auth/mobile/login').send({
      email: validUserCredentials.email,
      password: validUserCredentials.password,
    });

    expect(response.status).toBe(200);
    validUser = parseApiData<AuthResponse>(response).user;

    await cleanupRefreshTokens();
  });

  afterEach(async () => {
    await cleanupRefreshTokens();
  });

  afterAll(async () => {
    await cleanupRefreshTokens();
    await exportTestReport(results, PREFIX, 'Refresh_Token');
    await app.close();
  });

  describe('Mobile Scope', () => {
    it('Refresh Token thành công (Mobile)', async () => {
      const mobileRefreshToken = await createMobileRefreshToken();
      const body: RefreshBody = { refreshToken: mobileRefreshToken };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Refresh token thành công',
          description: 'Gửi refresh token hợp lệ qua Body để lấy token mới.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'User đã đăng nhập Mobile và có refresh token hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/refresh')
            .send(body);

          expect(response.status).toBe(200);

          const res = parseApiData<AuthResponse>(response);
          expect(res.accessToken).toBeDefined();
          expect(res.refreshToken).toBeDefined();
          expect(res.expiresIn).toBeDefined();
          expect(res.user.email).toBe(validUserCredentials.email);
          expect(res.user.role).toBeDefined();
          expect(res.user.isActive).toBe(true);

          return response;
        },
      );
    });

    it('Refresh thất bại - Thiếu refresh token (Mobile)', async () => {
      const body: RefreshBody = {};

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Thiếu refresh token',
          description: 'Không truyền trường refreshToken trong Body.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Không có điều kiện đặc biệt.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/refresh')
            .send(body);

          expect(response.status).toBe(400);

          const res = parseApiError(response);
          expectErrorMessage(res, 400, 'Vui lòng cung cấp refresh token');

          return response;
        },
      );
    });

    it('Refresh thất bại - Sai định dạng refresh token (Mobile)', async () => {
      const body: RefreshBody = { refreshToken: 123456 };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Sai định dạng refresh token',
          description: 'Truyền refreshToken kiểu number thay vì string.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'ValidationPipe bắt lỗi IsString.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/refresh')
            .send(body);

          expect(response.status).toBe(400);

          const res = parseApiError(response);
          expectErrorMessage(res, 400, 'Định dạng refresh token không hợp lệ.');

          return response;
        },
      );
    });

    it('Refresh thất bại - Token đã bị thu hồi (Mobile)', async () => {
      const mobileRefreshToken = await createMobileRefreshToken();
      const body: RefreshBody = { refreshToken: mobileRefreshToken };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Token đã bị thu hồi',
          description:
            'Dùng lại refresh token đã được consume ở lần refresh trước.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions:
            'Token đã refresh thành công và bị đánh dấu is_revoked = true.',
        },
        async () => {
          const firstResponse = await request(server)
            .post('/auth/mobile/refresh')
            .send(body);

          expect(firstResponse.status).toBe(200);

          const response = await request(server)
            .post('/auth/mobile/refresh')
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

    it('Refresh thất bại - Token sai định dạng JWT (Mobile)', async () => {
      const body: RefreshBody = { refreshToken: 'invalid.jwt.string' };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Token sai định dạng JWT',
          description: 'Gửi chuỗi không phải refresh JWT hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không có token tương ứng trong hệ thống.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/refresh')
            .send(body);

          expect(response.status).toBe(401);

          const res = parseApiError(response);
          expectErrorMessage(
            res,
            401,
            'Refresh token không hợp lệ hoặc đã hết hạn.',
          );

          return response;
        },
      );
    });

    it('Refresh thất bại - Token đã hết hạn (Mobile)', async () => {
      const expiredToken = await createExpiredRefreshToken();
      const body: RefreshBody = { refreshToken: expiredToken };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Token đã hết hạn',
          description: 'Gửi JWT đúng secret nhưng exp nằm trong quá khứ.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Token quá hạn.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/refresh')
            .send(body);

          expect(response.status).toBe(401);

          const res = parseApiError(response);
          expectErrorMessage(
            res,
            401,
            'Refresh token không hợp lệ hoặc đã hết hạn.',
          );

          return response;
        },
      );
    });

    it('Refresh thất bại - Tài khoản không tồn tại hoặc bị khoá (Mobile)', async () => {
      const deletedUserToken = await createDeletedUserRefreshToken();
      const body: RefreshBody = { refreshToken: deletedUserToken };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Tài khoản không tồn tại hoặc bị khoá',
          description:
            'Gửi refresh JWT hợp lệ nhưng sub không còn tồn tại trong bảng users.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'JWT verify thành công nhưng user không tồn tại.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/refresh')
            .send(body);

          expect(response.status).toBe(401);

          const res = parseApiError(response);
          expectErrorMessage(
            res,
            401,
            'Tài khoản không tồn tại hoặc đã bị khoá',
          );

          return response;
        },
      );
    });
  });

  describe('Web Scope', () => {
    it('Refresh Token thành công (Web)', async () => {
      const webRefreshTokenCookie = await createWebRefreshTokenCookie();
      const body: RefreshBody = {};

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Refresh token thành công',
          description:
            'Gửi refresh token hợp lệ qua Cookie để lấy access token mới.',
          procedure: 'Gửi Header: Cookie=refreshToken=...',
          expectedResult: 200,
          preconditions:
            'User đã đăng nhập Web và có refreshToken Cookie hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/refresh')
            .set('Cookie', [webRefreshTokenCookie])
            .send(body);

          expect(response.status).toBe(200);

          const res = parseApiData<AuthResponse>(response);
          expect(res.accessToken).toBeDefined();
          expect(res.refreshToken).toBeUndefined();
          expect(res.expiresIn).toBeDefined();
          expect(res.user.email).toBe(validUserCredentials.email);
          expect(res.user.role).toBeDefined();
          expect(res.user.isActive).toBe(true);

          const rawCookies = response.headers['set-cookie'];
          expect(rawCookies).toBeDefined();

          const cookies: string[] = Array.isArray(rawCookies)
            ? rawCookies
            : [rawCookies];

          expect(
            cookies.some((cookie) => cookie.startsWith('refreshToken=')),
          ).toBeTruthy();

          return response;
        },
      );
    });

    it('Refresh thất bại - Thiếu refresh token (Web)', async () => {
      const body: RefreshBody = {};

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Thiếu refresh token',
          description: 'Không gửi refreshToken Cookie.',
          procedure: 'Request không có Header Cookie.',
          expectedResult: 401,
          preconditions: 'Không có điều kiện đặc biệt.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/refresh')
            .send(body);

          expect(response.status).toBe(401);

          const res = parseApiError(response);
          expectErrorMessage(
            res,
            401,
            'Không tìm thấy refresh token trong Cookie',
          );

          return response;
        },
      );
    });

    it('Refresh thất bại - Token đã bị thu hồi (Web)', async () => {
      const webRefreshTokenCookie = await createWebRefreshTokenCookie();
      const body: RefreshBody = {};

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Token đã bị thu hồi',
          description:
            'Dùng lại Cookie chứa refresh token đã được consume ở lần refresh trước.',
          procedure: 'Gửi Header: Cookie với token cũ.',
          expectedResult: 401,
          preconditions:
            'Token đã refresh thành công và bị đánh dấu is_revoked = true.',
        },
        async () => {
          const firstResponse = await request(server)
            .post('/auth/refresh')
            .set('Cookie', [webRefreshTokenCookie])
            .send(body);

          expect(firstResponse.status).toBe(200);

          const response = await request(server)
            .post('/auth/refresh')
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

    it('Refresh thất bại - Token sai định dạng JWT (Web)', async () => {
      const body: RefreshBody = {};

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Token sai định dạng JWT',
          description: 'Gắn chuỗi không phải refresh JWT hợp lệ vào Cookie.',
          procedure: 'Gửi Header: Cookie=refreshToken=invalid.jwt.string',
          expectedResult: 401,
          preconditions: 'Không có token tương ứng trong hệ thống.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/refresh')
            .set('Cookie', ['refreshToken=invalid.jwt.string'])
            .send(body);

          expect(response.status).toBe(401);

          const res = parseApiError(response);
          expectErrorMessage(
            res,
            401,
            'Refresh token không hợp lệ hoặc đã hết hạn.',
          );

          return response;
        },
      );
    });

    it('Refresh thất bại - Token đã hết hạn (Web)', async () => {
      const expiredToken = await createExpiredRefreshToken();
      const body: RefreshBody = {};

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Token đã hết hạn',
          description:
            'Gửi JWT đúng secret nhưng exp nằm trong quá khứ qua Cookie.',
          procedure: 'Gửi Header: Cookie=refreshToken=expired_jwt_string',
          expectedResult: 401,
          preconditions: 'Token quá hạn.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/refresh')
            .set('Cookie', [`refreshToken=${expiredToken}`])
            .send(body);

          expect(response.status).toBe(401);

          const res = parseApiError(response);
          expectErrorMessage(
            res,
            401,
            'Refresh token không hợp lệ hoặc đã hết hạn.',
          );

          return response;
        },
      );
    });

    it('Refresh thất bại - Tài khoản không tồn tại hoặc bị khoá (Web)', async () => {
      const deletedUserToken = await createDeletedUserRefreshToken();
      const body: RefreshBody = {};

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Tài khoản không tồn tại hoặc bị khoá',
          description:
            'Gửi refresh JWT hợp lệ trong Cookie nhưng sub không còn tồn tại trong bảng users.',
          procedure: 'Gửi Header: Cookie=refreshToken=deleted_user_jwt',
          expectedResult: 401,
          preconditions: 'JWT verify thành công nhưng user không tồn tại.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/refresh')
            .set('Cookie', [`refreshToken=${deletedUserToken}`])
            .send(body);

          expect(response.status).toBe(401);

          const res = parseApiError(response);
          expectErrorMessage(
            res,
            401,
            'Tài khoản không tồn tại hoặc đã bị khoá',
          );

          return response;
        },
      );
    });

    it('Refresh thành công - Bỏ qua dữ liệu rác trong Body (Web)', async () => {
      const webRefreshTokenCookie = await createWebRefreshTokenCookie();
      const body: RefreshBody = { refreshToken: 123456 };

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Bỏ qua dữ liệu rác ở Body',
          description: 'Có Cookie hợp lệ nhưng cố tình gửi body sai định dạng.',
          procedure: 'Cookie hợp lệ + JSON Body chứa refreshToken kiểu number.',
          expectedResult: 200,
          preconditions:
            'API Web lấy refresh token từ Cookie và không validate Body.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/refresh')
            .set('Cookie', [webRefreshTokenCookie])
            .send(body);

          expect(response.status).toBe(200);

          const res = parseApiData<AuthResponse>(response);
          expect(res.accessToken).toBeDefined();
          expect(res.refreshToken).toBeUndefined();
          expect(res.expiresIn).toBeDefined();
          expect(res.user.email).toBe(validUserCredentials.email);

          return response;
        },
      );
    });
  });
});
