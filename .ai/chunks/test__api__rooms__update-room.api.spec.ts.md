# FILE: test/api/rooms/update-room.api.spec.ts

path: test/api/rooms/update-room.api.spec.ts
module: test
kind: spec
language: ts
line_count: 410
size_bytes: 13307
sha256: f0b02a281d3f7bd63647cdca861381c0a9b32f3a53ee3d5a346a50809804e5af
updated_at: 2026-04-21T12:38:42.245Z

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

describe('[API] PATCH /rooms/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let targetRoomId = 0;
  let occupiedRoomName = '';

  const createdRoomIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'URM';
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

    // Seed fixture: 1 phòng sẽ là target update, 1 phòng khác chiếm tên để test conflict
    const roomRepository = dataSource.getRepository(Room);

    const targetRoom = await roomRepository.save(
      roomRepository.create({ name: '20' }),
    );
    targetRoomId = targetRoom.id;
    createdRoomIds.push(targetRoom.id);

    const occupiedRoom = await roomRepository.save(
      roomRepository.create({ name: '21' }),
    );
    occupiedRoomName = occupiedRoom.name;
    createdRoomIds.push(occupiedRoom.id);
  });

  afterAll(async () => {
    const roomRepository = dataSource.getRepository(Room);
    if (createdRoomIds.length > 0) {
      await roomRepository.delete(createdRoomIds);
    }
    await exportTestReport(results, PREFIX, 'Update_Room');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Cập nhật thất bại - Không truyền Authorization Token', async () => {
      const body: RoomBody = { name: '22' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Missing Token',
          description: 'Không gửi access token khi gọi API cập nhật phòng.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không có token.',
        },
        async () => {
          const response = await request(server)
            .patch(`/rooms/${targetRoomId}`)
            .send(body);
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Cập nhật thất bại - Truyền Fake Token', async () => {
      const body: RoomBody = { name: '22' };

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
            .patch(`/rooms/${targetRoomId}`)
            .set('Authorization', 'Bearer fake.jwt.token')
            .send(body);
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Cập nhật thất bại - Role Customer bị chặn', async () => {
      const body: RoomBody = { name: '22' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Customer Forbidden',
          description: 'Tài khoản Customer cố cập nhật phòng chiếu.',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: 'Dùng token Customer.',
        },
        async () => {
          const response = await request(server)
            .patch(`/rooms/${targetRoomId}`)
            .set('Authorization', `Bearer ${customerToken}`)
            .send(body);
          expect(response.status).toBe(403);
          return response;
        },
      );
    });
  });

  describe('Validation Payload', () => {
    it('Cập nhật thất bại - Thiếu trường name (body rỗng)', async () => {
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
            .patch(`/rooms/${targetRoomId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expect(error.statusCode).toBe(400);
          return response;
        },
      );
    });

    it('Cập nhật thất bại - name không đúng định dạng 2 chữ số (VD: "abc")', async () => {
      const body: RoomBody = { name: 'abc' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Wrong Format',
          description: 'Gửi name là chuỗi chữ cái, sai định dạng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Dùng token Admin.',
        },
        async () => {
          const response = await request(server)
            .patch(`/rooms/${targetRoomId}`)
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

    it('Cập nhật thất bại - Gửi payload dư field', async () => {
      const body = { name: '22', extraField: 'hack' };

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
            .patch(`/rooms/${targetRoomId}`)
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

  describe('Business Logic', () => {
    it('Cập nhật thất bại - Room ID không tồn tại', async () => {
      const body: RoomBody = { name: '22' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Room Not Found',
          description: 'Cập nhật phòng với ID không tồn tại trong DB.',
          procedure: stringifyProcedure(body),
          expectedResult: 404,
          preconditions: 'Dùng token Admin.',
        },
        async () => {
          const response = await request(server)
            .patch('/rooms/999999')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(response.status).toBe(404);
          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Phòng #999999 không tồn tại.');
          return response;
        },
      );
    });

    it('Cập nhật thất bại - Tên phòng đã được dùng bởi phòng khác (409 Conflict)', async () => {
      const body: RoomBody = { name: occupiedRoomName };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Duplicate Name',
          description:
            'Cập nhật phòng thành tên đã tồn tại ở phòng khác trong hệ thống.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: `Phòng khác đã dùng tên "${occupiedRoomName}".`,
        },
        async () => {
          const response = await request(server)
            .patch(`/rooms/${targetRoomId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(response.status).toBe(409);
          const error = parseApiError(response);
          expectErrorMessage(error, 409, 'Tên phòng đã tồn tại');
          return response;
        },
      );
    });

    it('Cập nhật thành công - Giữ nguyên tên hiện tại của chính phòng đó', async () => {
      // Lấy tên hiện tại của targetRoom từ DB
      const roomRepository = dataSource.getRepository(Room);
      const currentRoom = await roomRepository.findOne({
        where: { id: targetRoomId },
      });
      const body: RoomBody = { name: currentRoom!.name };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Same Name (Self)',
          description:
            'Cập nhật phòng với tên hiện tại của chính nó, không bị conflict.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Gửi lại tên cũ của cùng phòng đó.',
        },
        async () => {
          const response = await request(server)
            .patch(`/rooms/${targetRoomId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
          expect(response.status).toBe(200);
          const data = parseApiData<RoomResponseDto>(response);
          expect(data.name).toBe(currentRoom!.name);
          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Cập nhật thành công - Đổi tên phòng hợp lệ, trả về 200', async () => {
      const body: RoomBody = { name: '22' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Update Success',
          description:
            'Cập nhật tên phòng thành công với token Admin và payload hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: `Phòng ID ${targetRoomId} đã được seed sẵn.`,
        },
        async () => {
          const response = await request(server)
            .patch(`/rooms/${targetRoomId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(200);

          const data = parseApiData<RoomResponseDto>(response);
          expect(data.id).toBe(targetRoomId);
          expect(data.name).toBe('22');
          expect(data.updatedAt).toBeDefined();

          return response;
        },
      );
    });
  });
});

````
