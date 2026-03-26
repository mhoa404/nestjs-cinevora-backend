import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { Server } from 'http';

import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import { AppModule } from '../../../src/app.module';
import {
  expectErrorMessage,
  getActualStatus,
  parseApiData,
  parseApiError,
} from '../../helpers/http-test.helper';

type RegisterBody = {
  fullName?: string;
  email?: string;
  password?: string;
  dateOfBirth?: string;
  phone?: string;
  recaptchaToken?: string;
  unknownField?: string;
};

type RegisterSuccessResponse = {
  message: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    [key: string]: unknown;
  };
};

describe('[API] POST /auth/register', () => {
  let app: INestApplication;
  let server: Server;

  const results: TestCaseRecord[] = [];
  const PREFIX = (process.env.TEST_PREFIX ?? 'REG').toUpperCase();
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return `${PREFIX}${String(counter).padStart(2, '0')}`;
  };

  const buildValidBody = (
    overrides: Partial<RegisterBody> = {},
  ): RegisterBody => {
    const seed = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    return {
      fullName: 'Lê Nguyễn Minh Hoà',
      email: `register_${seed}@example.com`,
      password: 'Test@1234',
      dateOfBirth: '2004-01-20',
      phone: `9${Math.floor(10000000 + Math.random() * 89999999)}`,
      recaptchaToken: 'bypass-token',
      ...overrides,
    };
  };

  const stringifyProcedure = (body?: RegisterBody): string => {
    if (!body || Object.keys(body).length === 0) {
      return 'Không có dữ liệu';
    }

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
      results.push({
        ...meta,
        actualResult,
        passed,
        testDate,
      });
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

    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await exportTestReport(results, PREFIX, 'Register');
    await app.close();
  });

  it('Đăng ký thành công', async () => {
    const body = buildValidBody();

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Đăng ký thành công',
        description: 'Gửi đầy đủ dữ liệu hợp lệ.',
        procedure: stringifyProcedure(body),
        expectedResult: 201,
        preconditions:
          'Server chạy, DB kết nối thành công, email/SĐT chưa tồn tại.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);

        expect(response.status).toBe(201);

        const res = parseApiData<RegisterSuccessResponse>(response);

        expect(res.message).toBe('Đăng ký tài khoản thành công');
        expect(res.user.email).toBe(body.email);
        expect(res.user.fullName).toBe(body.fullName);

        return response;
      },
    );
  });

  it('Đăng ký thất bại - thiếu toàn bộ field', async () => {
    const body: RegisterBody = {};

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Body rỗng',
        description: 'Gửi body rỗng không có trường nào.',
        procedure: 'Không có dữ liệu',
        expectedResult: 400,
        preconditions: 'Không có điều kiện đặc biệt.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);

        expect(response.status).toBe(400);

        const res = parseApiError(response);
        expect(res.statusCode).toBe(400);

        return response;
      },
    );
  });

  it('Đăng ký thất bại - thiếu email', async () => {
    const body = buildValidBody();
    delete body.email;

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Thiếu email',
        description: 'Không truyền trường email.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Không có điều kiện đặc biệt.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);

        expect(response.status).toBe(400);

        const res = parseApiError(response);
        expectErrorMessage(res, 400, 'Vui lòng nhập địa chỉ email');

        return response;
      },
    );
  });

  it('Đăng ký thất bại - email đã tồn tại', async () => {
    const setupBody = buildValidBody();
    await request(server).post('/auth/register').send(setupBody);

    const body = buildValidBody({
      email: setupBody.email,
    });

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Email đã tồn tại',
        description: 'Dùng email đã có trong DB để đăng ký lại.',
        procedure: stringifyProcedure(body),
        expectedResult: 409,
        preconditions: 'Email test đã tồn tại trong DB.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);

        expect(response.status).toBe(409);

        const res = parseApiError(response);
        expectErrorMessage(res, 409, 'Email');

        return response;
      },
    );
  });

  it('Đăng ký thất bại - email sai định dạng', async () => {
    const body = buildValidBody({ email: 'invalid-email-format' });

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Email sai định dạng',
        description: 'Gửi email không đúng chuẩn.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Không có điều kiện đặc biệt.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(400);
        const res = parseApiError(response);
        expectErrorMessage(res, 400, 'Địa chỉ email không hợp lệ.');
        return response;
      },
    );
  });

  it('Đăng ký thất bại - thiếu fullName', async () => {
    const body = buildValidBody();
    delete body.fullName;

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Thiếu fullName',
        description: 'Không truyền trường fullName.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Không có điều kiện đặc biệt.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(400);
        const res = parseApiError(response);
        expectErrorMessage(res, 400, 'Vui lòng điền đủ họ tên.');
        return response;
      },
    );
  });

  it('Đăng ký thất bại - fullName vượt 100 ký tự', async () => {
    const body = buildValidBody({ fullName: 'A'.repeat(101) });

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'fullName quá dài',
        description: 'Truyền fullName dài hơn 100 ký tự.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Không có điều kiện đặc biệt.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(400);
        const res = parseApiError(response);
        expectErrorMessage(res, 400, 'Họ tên tối đa 100 ký tự.');
        return response;
      },
    );
  });

  it('Đăng ký thất bại - tên chứa số', async () => {
    const body = buildValidBody({ fullName: 'Nguyễn Văn A 123' });

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Tên chứa số',
        description: 'Truyền fullName có chứa ký tự số.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Validation chặn số trong tên.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(400);
        const res = parseApiError(response);
        expectErrorMessage(
          res,
          400,
          'Họ tên không được chứa số hoặc ký tự đặc biệt.',
        );
        return response;
      },
    );
  });

  it('Đăng ký thất bại - thiếu password', async () => {
    const body = buildValidBody();
    delete body.password;

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Thiếu password',
        description: 'Không truyền trường password.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Không có điều kiện đặc biệt.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(400);
        const res = parseApiError(response);
        expectErrorMessage(res, 400, 'Vui lòng nhập mật khẩu');
        return response;
      },
    );
  });

  it('Đăng ký thất bại - password ngắn (dưới 8 ký tự)', async () => {
    const body = buildValidBody({ password: 'P@sw1' });

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Password ngắn',
        description: 'Đủ loại ký tự nhưng độ dài dưới 8.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Không có điều kiện đặc biệt.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(400);
        const res = parseApiError(response);
        expectErrorMessage(res, 400, 'Mật khẩu chứa ít nhất 8 ký tự');
        return response;
      },
    );
  });

  it('Đăng ký thất bại - password quá yếu', async () => {
    const body = buildValidBody({ password: 'password' });

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Password quá yếu',
        description: 'Chỉ chứa chữ thường, thiếu các yêu cầu khác.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Không có điều kiện đặc biệt.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(400);
        const res = parseApiError(response);
        expectErrorMessage(res, 400, 'Mật khẩu chứa ít nhất 8 ký tự');
        return response;
      },
    );
  });

  it('Đăng ký thất bại - password thiếu ký tự đặc biệt', async () => {
    const body = buildValidBody({ password: 'Password123' });

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Password thiếu ký tự đặc biệt',
        description: 'Đã đủ chữ hoa, số nhưng thiếu ký tự đặc biệt.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Không có điều kiện đặc biệt.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(400);
        const res = parseApiError(response);
        expectErrorMessage(res, 400, 'Mật khẩu chứa ít nhất 8 ký tự');
        return response;
      },
    );
  });

  it('Đăng ký thất bại - password thiếu số', async () => {
    const body = buildValidBody({ password: 'Password@' });

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Password thiếu số',
        description: 'Đã đủ chữ hoa, ký tự đặc biệt nhưng thiếu số.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Không có điều kiện đặc biệt.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(400);
        const res = parseApiError(response);
        expectErrorMessage(res, 400, 'Mật khẩu chứa ít nhất 8 ký tự');
        return response;
      },
    );
  });

  it('Đăng ký thất bại - Password thiếu chữ in Hoa', async () => {
    const body = buildValidBody({ password: 'password@123' });

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Password thiếu chữ in hoa',
        description: 'Thiếu ký tự viết hoa.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Không có điều kiện đặc biệt.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(400);
        const res = parseApiError(response);
        expectErrorMessage(res, 400, 'Mật khẩu chứa ít nhất 8 ký tự');
        return response;
      },
    );
  });

  it('Đăng ký thất bại - thiếu số điện thoại', async () => {
    const body = buildValidBody();
    delete body.phone;

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Thiếu số điện thoại',
        description: 'Không truyền trường phone.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Không có điều kiện đặc biệt.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(400);
        const res = parseApiError(response);
        expectErrorMessage(res, 400, 'Vui lòng điền số điện thoại.');
        return response;
      },
    );
  });

  it('Đăng ký thất bại - số điện thoại không đúng định dạng', async () => {
    const body = buildValidBody({ phone: '0912345678' });

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'SĐT bắt đầu bằng 0',
        description: 'Truyền SĐT có số 0 ở đầu (vi phạm regex).',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Regex yêu cầu bỏ số 0 ở đầu.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(400);
        const res = parseApiError(response);
        expectErrorMessage(res, 400, 'Số điện thoại không hợp lệ.');
        return response;
      },
    );
  });

  it('Đăng ký thất bại - số điện thoại quá ngắn', async () => {
    const body = buildValidBody({ phone: '9123456' });

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'SĐT quá ngắn',
        description: 'Truyền SĐT không đủ 9 số.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Regex yêu cầu chính xác 9 chữ số.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(400);
        const res = parseApiError(response);
        expectErrorMessage(res, 400, 'Số điện thoại không hợp lệ.');
        return response;
      },
    );
  });

  it('Đăng ký thất bại - số điện thoại quá dài', async () => {
    const body = buildValidBody({ phone: '9123456789' });

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'SĐT quá dài',
        description: 'Truyền SĐT vượt quá 9 chữ số.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Regex yêu cầu chính xác 9 chữ số.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(400);
        const res = parseApiError(response);
        expectErrorMessage(res, 400, 'Số điện thoại không hợp lệ.');
        return response;
      },
    );
  });

  it('Đăng ký thất bại - số điện thoại tồn tại', async () => {
    const setupBody = buildValidBody();
    await request(server).post('/auth/register').send(setupBody);

    const body = buildValidBody({ phone: setupBody.phone });

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Số điện thoại bị trùng',
        description: 'Dùng số điện thoại đã có trong DB để đăng ký lại.',
        procedure: stringifyProcedure(body),
        expectedResult: 409, // Trùng theo logic UsersService
        preconditions: 'SĐT test đã tồn tại trong DB.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(409);
        const res = parseApiError(response);
        expectErrorMessage(res, 409, 'Số điện thoại đã được sử dụng.');
        return response;
      },
    );
  });

  it('Đăng ký thất bại - thiếu ngày sinh', async () => {
    const body = buildValidBody();
    delete body.dateOfBirth;

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Thiếu ngày sinh',
        description: 'Không truyền trường dateOfBirth.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Không có điều kiện đặc biệt.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(400);
        const res = parseApiError(response);
        expectErrorMessage(res, 400, 'Vui lòng điền ngày tháng năm sinh.');
        return response;
      },
    );
  });

  it('Đăng ký thất bại - ngày sinh sai định dạng', async () => {
    const body = buildValidBody({ dateOfBirth: '20-01-2004' });

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Ngày sinh sai định dạng',
        description: 'Truyền ngày sinh không đúng format (cần YYYY-MM-DD).',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Không có điều kiện đặc biệt.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);
        expect(response.status).toBe(400);
        const res = parseApiError(response);
        expectErrorMessage(
          res,
          400,
          'Ngày sinh không đúng định dạng (YYYY-MM-DD).',
        );
        return response;
      },
    );
  });

  it('Đăng ký thất bại - thiếu reCAPTCHA', async () => {
    const body = buildValidBody();
    delete body.recaptchaToken;

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Thiếu reCAPTCHA',
        description: 'Không truyền trường recaptchaToken khi đăng ký.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'Không có điều kiện đặc biệt.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);

        expect(response.status).toBe(400);

        const res = parseApiError(response);
        expectErrorMessage(res, 400, 'Vui lòng hoàn thành CAPTCHA.');

        return response;
      },
    );
  });

  it('Đăng ký thất bại - gửi field thừa', async () => {
    const body = buildValidBody({
      unknownField: 'abc',
    });

    await record(
      {
        id: nextId(),
        scope: 'All',
        testCase: 'Có field thừa',
        description: 'Gửi thêm field không được phép.',
        procedure: stringifyProcedure(body),
        expectedResult: 400,
        preconditions: 'ValidationPipe bật whitelist và forbidNonWhitelisted.',
      },
      async () => {
        const response = await request(server)
          .post('/auth/register')
          .send(body);

        expect(response.status).toBe(400);

        const res = parseApiError(response);
        expectErrorMessage(res, 400);

        return response;
      },
    );
  });
});
