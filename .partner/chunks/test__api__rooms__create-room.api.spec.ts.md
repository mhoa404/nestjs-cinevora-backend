# FILE: test/api/rooms/create-room.api.spec.ts

path: test/api/rooms/create-room.api.spec.ts
module: test
kind: spec
language: ts
line_count: 424
size_bytes: 13366
sha256: 73d16203561b71f51a0475bd10c1910f2a874223a3123e1328b2690c718a8477
updated_at: 2026-04-21T09:19:06.992Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { Server } from 'http';

import {
  parseApiError,
  expectErrorMessage,
  getActualStatus,
  parseApiData,
} from '../../helpers/http-test.helper';
import { Room } from '../../../src/modules/rooms/entities/room.entity';
import { RoomResponseDto } from '../../../src/modules/rooms/dto/room-response.dto';
import { AppModule } from '../../../src/app.module';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';
import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';

type RoomBody = {
  name?: unknown;
};

describe('[API] POST /rooms', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  const createdRoomIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'CRM';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return `${PREFIX}${String(counter).padStart(2, '0')}`;
  };

  const stringifyProcedure = (
    body?: RoomBody | Record<string, unknown>,
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
    dataSource = app.get<DataSource>(DataSource);

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
      .post('/auth/mobile/login')
      .send({ email: 'api_tester@gmail.com', password: 'Api_tester_123' });
    adminToken = parseApiData<AuthResponseDto>(adminLoginRes).accessToken;

    const customerLoginRes = await request(server)
      .post('/auth/mobile/login')
      .send({ email: 'api_client@gmail.com', password: 'Api_client_123' });
    customerToken = parseApiData<AuthResponseDto>(customerLoginRes).accessToken;
  });

  afterAll(async () => {
    const roomRepository = dataSource.getRepository(Room);
    if (createdRoomIds.length > 0) {
      await roomRepository.delete(createdRoomIds);
    }
    await exportTestReport(results, PREFIX, 'Create_Room');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Tạo thất bại - Không truyền Authorization Token', async () => {
      const body: RoomBody = { name: '10' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Missing Token',
          description: 'Không gửi access token khi gọi API tạo phòng.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không có token.',
        },
        async () => {
          const response = await request(server).post('/rooms').send(body);
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Tạo thất bại - Truyền Fake Token', async () => {
      const body: RoomBody = { name: '10' };

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
            .post('/rooms')
            .set('Authorization', 'Bearer fake.jwt.token')
            .send(body);
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Tạo thất bại - Role Customer bị chặn', async () => {
      const body: RoomBody = { name: '10' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Customer Forbidden',
          description: 'Tài khoản Customer cố tạo phòng chiếu.',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: 'Dùng token Customer.',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', `Bearer ${customerToken}`)
            .send(body);
          expect(response.status).toBe(403);
          return response;
        },
      );
    });
  });

  describe('Validation Payload', () => {
    it('Tạo thất bại - Thiếu trường name', async () => {
      const body = {};

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Missing Name',
          description: 'Gửi body rỗng, không có trường name.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin.',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expect(error.statusCode).toBe(400);
          return response;
        },
      );
    });

    it('Tạo thất bại - name là chuỗi rỗng', async () => {
      const body: RoomBody = { name: '' };

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
            .post('/rooms')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expect(error.statusCode).toBe(400);
          return response;
        },
      );
    });

    it('Tạo thất bại - name không đúng định dạng 2 chữ số (VD: "1")', async () => {
      const body: RoomBody = { name: '1' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Wrong Format (1 digit)',
          description: 'Gửi name chỉ có 1 chữ số, không đúng định dạng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin.',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Tên phòng phải theo định dạng 01, 02, 03... (2 chữ số)',
          );
          return response;
        },
      );
    });

    it('Tạo thất bại - name không đúng định dạng 2 chữ số (VD: "abc")', async () => {
      const body: RoomBody = { name: 'abc' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Wrong Format (letters)',
          description: 'Gửi name gồm ký tự chữ cái, không phải số.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin.',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Tên phòng phải theo định dạng 01, 02, 03... (2 chữ số)',
          );
          return response;
        },
      );
    });

    it('Tạo thất bại - name vượt quá 3 chữ số (VD: "123")', async () => {
      const body: RoomBody = { name: '123' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Wrong Format (3 digits)',
          description: 'Gửi name có 3 chữ số, không đúng định dạng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin.',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Tên phòng phải theo định dạng 01, 02, 03... (2 chữ số)',
          );
          return response;
        },
      );
    });

    it('Tạo thất bại - Gửi payload dư field', async () => {
      const body = { name: '10', extraField: 'hack' };

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
            .post('/rooms')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expect(error.statusCode).toBe(400);
          return response;
        },
      );
    });
  });

  describe('Ràng buộc nghiệp vụ', () => {
    it('Tạo thất bại - Tên phòng đã tồn tại (409 Conflict)', async () => {
      const roomRepository = dataSource.getRepository(Room);
      const existingRoom = await roomRepository.save(
        roomRepository.create({ name: '11' }),
      );
      createdRoomIds.push(existingRoom.id);

      const body: RoomBody = { name: '11' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Duplicate Name',
          description: 'Cố tình tạo phòng với tên đã tồn tại trong hệ thống.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: `Room "11" đã được tạo sẵn (ID: ${existingRoom.id}).`,
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(response.status).toBe(409);
          const error = parseApiError(response);
          expectErrorMessage(error, 409, 'Tên phòng đã tồn tại');
          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Tạo thành công - Trả về 201 và dữ liệu phòng hợp lệ', async () => {
      const body: RoomBody = { name: '10' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Full Creation',
          description: 'Tạo phòng thành công với payload hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Dùng token Admin.',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(201);

          const data = parseApiData<RoomResponseDto>(response);
          expect(data.id).toBeDefined();
          expect(data.name).toBe('10');
          expect(data.createdAt).toBeDefined();
          expect(data.updatedAt).toBeDefined();

          createdRoomIds.push(data.id);
          return response;
        },
      );
    });
  });
});

````
