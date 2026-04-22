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

describe('[API] GET /rooms/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let validRoomId = 0;
  const createdRoomIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'GRI';
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

    // Seed 1 phòng để test lấy theo ID
    const roomRepository = dataSource.getRepository(Room);
    const room = await roomRepository.save(
      roomRepository.create({ name: '40' }),
    );
    validRoomId = room.id;
    createdRoomIds.push(room.id);
  });

  afterAll(async () => {
    const roomRepository = dataSource.getRepository(Room);
    if (createdRoomIds.length > 0) {
      await roomRepository.delete(createdRoomIds);
    }
    await exportTestReport(results, PREFIX, 'Get_Room_By_Id');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Lấy phòng thất bại - Không truyền Authorization Token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Missing Token',
          description: 'Không gửi access token khi gọi API lấy phòng theo ID.',
          procedure: 'Không có dữ liệu',
          expectedResult: 401,
          preconditions: 'Không có token.',
        },
        async () => {
          const response = await request(server).get(`/rooms/${validRoomId}`);
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Lấy phòng thất bại - Truyền Fake Token', async () => {
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
            .get(`/rooms/${validRoomId}`)
            .set('Authorization', 'Bearer fake.jwt.token');
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Lấy phòng thất bại - Role Customer bị chặn', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Customer Forbidden',
          description: 'Tài khoản Customer cố lấy thông tin phòng chiếu.',
          procedure: 'Không có dữ liệu',
          expectedResult: 403,
          preconditions: 'Dùng token Customer.',
        },
        async () => {
          const response = await request(server)
            .get(`/rooms/${validRoomId}`)
            .set('Authorization', `Bearer ${customerToken}`);
          expect(response.status).toBe(403);
          return response;
        },
      );
    });
  });

  describe('Validation & Business Logic', () => {
    it('Lấy phòng thất bại - ID không phải số nguyên (ParseIntPipe fails)', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Validation: Invalid ID Format',
          description:
            'Truyền ID là chuỗi chữ cái, ParseIntPipe không thể parse.',
          procedure: 'Không có dữ liệu',
          expectedResult: 400,
          preconditions: 'Dùng token Admin.',
        },
        async () => {
          const response = await request(server)
            .get('/rooms/abc')
            .set('Authorization', `Bearer ${adminToken}`);
          expect(response.status).toBe(400);
          return response;
        },
      );
    });

    it('Lấy phòng thất bại - ID không tồn tại trong DB', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Room Not Found',
          description: 'Lấy thông tin phòng với ID không tồn tại.',
          procedure: 'Không có dữ liệu',
          expectedResult: 404,
          preconditions: 'Dùng token Admin.',
        },
        async () => {
          const response = await request(server)
            .get('/rooms/999999')
            .set('Authorization', `Bearer ${adminToken}`);
          expect(response.status).toBe(404);
          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Phòng #999999 không tồn tại.');
          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Lấy phòng thành công - Trả về 200 và dữ liệu phòng đúng', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Get Room By Valid ID',
          description: 'Lấy thông tin một phòng chiếu bằng ID hợp lệ.',
          procedure: 'Không có dữ liệu',
          expectedResult: 200,
          preconditions: `Phòng ID ${validRoomId} đã được seed sẵn.`,
        },
        async () => {
          const response = await request(server)
            .get(`/rooms/${validRoomId}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(200);

          const data = parseApiData<RoomResponseDto>(response);
          expect(data.id).toBe(validRoomId);
          expect(data.name).toBe('40');
          expect(data.createdAt).toBeDefined();
          expect(data.updatedAt).toBeDefined();

          return response;
        },
      );
    });
  });
});
