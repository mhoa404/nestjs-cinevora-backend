# FILE: test/api/rooms/get-rooms.api.spec.ts

path: test/api/rooms/get-rooms.api.spec.ts
module: test
kind: spec
language: ts
line_count: 212
size_bytes: 7022
sha256: 0cafc02a9420fd9d9c5076c6d775e1ba8e627784d3ad893ea5f52e9788a9a0b3
updated_at: 2026-04-21T09:14:46.776Z

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

import { getActualStatus, parseApiData } from '../../helpers/http-test.helper';
import { Room } from '../../../src/modules/rooms/entities/room.entity';
import { RoomResponseDto } from '../../../src/modules/rooms/dto/room-response.dto';
import { AppModule } from '../../../src/app.module';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';
import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';

describe('[API] GET /rooms', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  const createdRoomIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'GRM';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return `${PREFIX}${String(counter).padStart(2, '0')}`;
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

    // Seed 2 phòng để test danh sách có sắp xếp
    const roomRepository = dataSource.getRepository(Room);
    const r1 = await roomRepository.save(roomRepository.create({ name: '31' }));
    const r2 = await roomRepository.save(roomRepository.create({ name: '30' }));
    createdRoomIds.push(r1.id, r2.id);
  });

  afterAll(async () => {
    const roomRepository = dataSource.getRepository(Room);
    if (createdRoomIds.length > 0) {
      await roomRepository.delete(createdRoomIds);
    }
    await exportTestReport(results, PREFIX, 'Get_Rooms');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Lấy danh sách thất bại - Không truyền Authorization Token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Missing Token',
          description:
            'Không gửi access token khi gọi API lấy danh sách phòng.',
          procedure: 'Không có dữ liệu',
          expectedResult: 401,
          preconditions: 'Không có token.',
        },
        async () => {
          const response = await request(server).get('/rooms');
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Lấy danh sách thất bại - Truyền Fake Token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Fake Token',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: 'Không có dữ liệu',
          expectedResult: 401,
          preconditions: 'Token giả.',
        },
        async () => {
          const response = await request(server)
            .get('/rooms')
            .set('Authorization', 'Bearer fake.jwt.token');
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Lấy danh sách thất bại - Role Customer bị chặn', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Customer Forbidden',
          description: 'Tài khoản Customer cố lấy danh sách phòng chiếu.',
          procedure: 'Không có dữ liệu',
          expectedResult: 403,
          preconditions: 'Dùng token Customer.',
        },
        async () => {
          const response = await request(server)
            .get('/rooms')
            .set('Authorization', `Bearer ${customerToken}`);
          expect(response.status).toBe(403);
          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Lấy danh sách thành công - Trả về 200 và mảng phòng sắp xếp theo name ASC', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: List All Rooms Ordered ASC',
          description:
            'Lấy danh sách phòng thành công, kết quả được sắp xếp tăng dần theo name.',
          procedure: 'Không có dữ liệu',
          expectedResult: 200,
          preconditions: 'Đã seed 2 phòng "30" và "31" vào DB.',
        },
        async () => {
          const response = await request(server)
            .get('/rooms')
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(200);

          const data = parseApiData<RoomResponseDto[]>(response);
          expect(Array.isArray(data)).toBe(true);

          // Lấy 2 phòng vừa seed để kiểm tra thứ tự
          const seededRooms = data.filter((r) => createdRoomIds.includes(r.id));
          expect(seededRooms.length).toBe(2);

          // Kiểm tra sắp xếp ASC: "30" phải trước "31"
          const names = seededRooms.map((r) => r.name);
          expect(names).toEqual([...names].sort());

          // Kiểm tra shape của từng phần tử
          const first = data[0];
          expect(first.id).toBeDefined();
          expect(first.name).toBeDefined();
          expect(first.createdAt).toBeDefined();
          expect(first.updatedAt).toBeDefined();

          return response;
        },
      );
    });
  });
});

````
