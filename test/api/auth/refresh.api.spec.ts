import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'http';

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
  refreshToken?: string;
};

describe('[API] POST /auth/refresh', () => {
  let app: INestApplication;
  let server: Server;
  let jwtService: JwtService;
  let configService: ConfigService;

  const results: TestCaseRecord[] = [];
  const PREFIX = (process.env.TEST_PREFIX ?? 'REF').toUpperCase();
  let counter = 0;

  let validUser: AuthUser;
  let mobileRefreshToken = '';
  let webRefreshToken = '';
  let oldMobileRefreshToken = '';
  let oldWebRefreshToken = '';

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
    jwtService = app.get<JwtService>(JwtService);
    configService = app.get<ConfigService>(ConfigService);

    const account = {
      email: 'api_client@gmail.com',
      password: 'Api_client_123',
    };

    const loginMobileRes = await request(server)
      .post('/auth/mobile/login')
      .send({
        email: account.email,
        password: account.password,
      });
    const mobileData = parseApiData<AuthResponse>(loginMobileRes);
    validUser = mobileData.user;
    mobileRefreshToken = mobileData.refreshToken as string;

    const loginWebRes = await request(server).post('/auth/mobile/login').send({
      email: account.email,
      password: account.password,
    });
    const webData = parseApiData<AuthResponse>(loginWebRes);
    webRefreshToken = webData.refreshToken as string;
  });

  afterAll(async () => {
    await exportTestReport(results, PREFIX, 'Refresh_Token');
    await app.close();
  });

  describe('Mobile Scope', () => {
    it('Refresh Token thành công (Mobile)', async () => {
      const body: RefreshBody = { refreshToken: mobileRefreshToken };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Refresh token thành công (Mobile)',
          description: 'Gửi refresh token hợp lệ qua Body để lấy token mới.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Có refresh token hợp lệ.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/mobile/refresh')
            .send(body);

          expect(response.status).toBe(200);

          const res = parseApiData<AuthResponse>(response);
          expect(res.accessToken).toBeDefined();
          expect(res.refreshToken).toBeDefined();

          oldMobileRefreshToken = mobileRefreshToken;
          mobileRefreshToken = res.refreshToken as string;

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
          testCase: 'Thiếu refresh token (Mobile)',
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

    it('Refresh thất bại - Token đã bị thu hồi (Mobile)', async () => {
      const body: RefreshBody = { refreshToken: oldMobileRefreshToken };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Token đã bị thu hồi (Mobile)',
          description: 'Dùng lại token đã refresh thành công trước đó.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Token trong DB đã có is_revoked = true.',
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
            'Refresh token không hợp lệ, đã hết hạn hoặc đã bị thu hồi.',
          );

          return response;
        },
      );
    });

    it('Refresh thất bại - Sai định dạng (Mobile)', async () => {
      const body: RefreshBody = { refreshToken: 'invalid.jwt.string' };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Token sai định dạng (Mobile)',
          description: 'Gửi một chuỗi linh tinh.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không có.',
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
            'Refresh token không hợp lệ hoặc đã hết hạn',
          );

          return response;
        },
      );
    });

    it('Refresh thất bại - Token đã hết hạn (Mobile)', async () => {
      const refreshSecret =
        configService.get<string>('jwt.refreshSecret') || '';
      const pastTime = Math.floor(Date.now() / 1000) - 3600;

      const expiredToken = await jwtService.signAsync(
        {
          sub: validUser.id,
          email: validUser.email,
          role: validUser.role,
          exp: pastTime,
        },
        { secret: refreshSecret },
      );

      const body: RefreshBody = { refreshToken: expiredToken };

      await record(
        {
          id: nextId(),
          scope: 'Mobile',
          testCase: 'Token đã hết hạn (Mobile)',
          description: 'Gửi JWT hợp lệ nhưng exp trong quá khứ.',
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
            'Refresh token không hợp lệ hoặc đã hết hạn',
          );

          return response;
        },
      );
    });
  });

  describe('Web Scope', () => {
    it('Refresh Token thành công (Web)', async () => {
      const body: RefreshBody = {};

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Refresh token thành công (Web)',
          description: 'Gửi refresh token hợp lệ qua Cookie để lấy token mới.',
          procedure: 'Gửi Header: Cookie=refreshToken=...',
          expectedResult: 200,
          preconditions: 'Có refresh token hợp lệ trong Cookie.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/refresh')
            .set('Cookie', [`refreshToken=${webRefreshToken}`])
            .send(body);

          expect(response.status).toBe(200);

          const res = parseApiData<AuthResponse>(response);
          expect(res.accessToken).toBeDefined();
          expect(res.refreshToken).toBeUndefined();

          const rawCookies = response.headers['set-cookie'];
          expect(rawCookies).toBeDefined();
          const cookies: string[] = Array.isArray(rawCookies)
            ? rawCookies
            : [rawCookies];

          expect(
            cookies.some((cookie) => cookie.includes('refreshToken=')),
          ).toBeTruthy();

          oldWebRefreshToken = webRefreshToken;

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
          testCase: 'Thiếu refresh token (Web)',
          description: 'Không truyền token vào cả Body lẫn Cookie.',
          procedure: 'Request không gắn Header Cookie.',
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
      const body: RefreshBody = {};

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Token đã bị thu hồi (Web)',
          description:
            'Đính kèm Cookie chứa token đã refresh thành công trước đó.',
          procedure: 'Gửi Header: Cookie với token cũ.',
          expectedResult: 401,
          preconditions: 'Token trong DB đã có is_revoked = true.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/refresh')
            .set('Cookie', [`refreshToken=${oldWebRefreshToken}`])
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

    it('Refresh thất bại - Sai định dạng (Web)', async () => {
      const body: RefreshBody = {};

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Token sai định dạng (Web)',
          description: 'Gắn một chuỗi linh tinh vào Cookie.',
          procedure: 'Gửi Header: Cookie=refreshToken=invalid.string',
          expectedResult: 401,
          preconditions: 'Không có.',
        },
        async () => {
          const response = await request(server)
            .post('/auth/refresh')
            .set('Cookie', [`refreshToken=invalid.jwt.string`])
            .send(body);

          expect(response.status).toBe(401);

          const res = parseApiError(response);
          expectErrorMessage(
            res,
            401,
            'Refresh token không hợp lệ hoặc đã hết hạn',
          );

          return response;
        },
      );
    });

    it('Refresh thất bại - Token đã hết hạn (Web)', async () => {
      const refreshSecret =
        configService.get<string>('jwt.refreshSecret') || '';
      const pastTime = Math.floor(Date.now() / 1000) - 3600;

      const expiredToken = await jwtService.signAsync(
        {
          sub: validUser.id,
          email: validUser.email,
          role: validUser.role,
          exp: pastTime,
        },
        { secret: refreshSecret },
      );

      const body: RefreshBody = {};

      await record(
        {
          id: nextId(),
          scope: 'Web',
          testCase: 'Token đã hết hạn (Web)',
          description: 'Gửi JWT hợp lệ trong Cookie nhưng exp ở quá khứ.',
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
            'Refresh token không hợp lệ hoặc đã hết hạn',
          );

          return response;
        },
      );
    });
  });
});
