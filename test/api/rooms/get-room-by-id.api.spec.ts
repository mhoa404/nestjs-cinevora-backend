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
import { Seat } from '../../../src/modules/seats/entities/seat.entity';
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
  let validRoomName = '';

  const createdRoomIds: number[] = [];
  const createdSeatIds: number[] = [];

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

    const roomRepository = dataSource.getRepository(Room);
    const seatRepository = dataSource.getRepository(Seat);

    const seed = String(Date.now()).slice(-8);
    const room = await roomRepository.save(
      roomRepository.create({ name: `GRI${seed}` }),
    );

    validRoomId = room.id;
    validRoomName = room.name;
    createdRoomIds.push(room.id);

    const seats = await seatRepository.save([
      seatRepository.create({
        roomId: room.id,
        seatKey: 'A1',
        rowLabel: 'A',
        seatNumber: 1,
      }),
      seatRepository.create({
        roomId: room.id,
        seatKey: 'A2',
        rowLabel: 'A',
        seatNumber: 2,
      }),
    ]);

    createdSeatIds.push(...seats.map((seat) => seat.id));
  });

  afterAll(async () => {
    const seatRepository = dataSource.getRepository(Seat);
    const roomRepository = dataSource.getRepository(Room);

    if (createdSeatIds.length > 0) {
      await seatRepository.delete(createdSeatIds);
    }

    if (createdRoomIds.length > 0) {
      await roomRepository.delete(createdRoomIds);
    }

    await exportTestReport(results, PREFIX, 'Get_Room_By_Id');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Lấy phòng thất bại - Không truyền Authorization Token trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không gửi Header Authorization',
          description: 'Không gửi access token khi gọi API lấy phòng theo ID.',
          procedure: `GET /rooms/${validRoomId}`,
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server).get(`/rooms/${validRoomId}`);

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Lấy phòng thất bại - Truyền Fake Token trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi token giả',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: `GET /rooms/${validRoomId} với Authorization: Bearer fake.jwt.token`,
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server)
            .get(`/rooms/${validRoomId}`)
            .set('Authorization', 'Bearer fake.jwt.token');

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Lấy phòng thất bại - Role Customer bị chặn trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi token Customer',
          description: 'Tài khoản Customer cố lấy thông tin phòng chiếu.',
          procedure: `GET /rooms/${validRoomId}`,
          expectedResult: 403,
          preconditions: 'Token Customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get(`/rooms/${validRoomId}`)
            .set('Authorization', `Bearer ${customerToken}`);

          expect(response.status).toBe(403);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            403,
            'Bạn không có quyền thực hiện hành động này.',
          );

          return response;
        },
      );
    });
  });

  describe('Validation & Business Logic', () => {
    it('Lấy phòng thất bại - ID không phải số nguyên trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi sai định dạng ID',
          description:
            'Truyền ID là chuỗi chữ cái, ParseIntPipe không thể parse sang number.',
          procedure: 'GET /rooms/abc',
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get('/rooms/abc')
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'Validation failed (numeric string is expected)',
          );

          return response;
        },
      );
    });

    it('Lấy phòng thất bại - ID không tồn tại trong DB', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi ID không tồn tại',
          description: 'Lấy thông tin phòng với ID không tồn tại.',
          procedure: 'GET /rooms/999999',
          expectedResult: 404,
          preconditions: 'Token Admin hợp lệ và room ID không tồn tại',
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
    it('Lấy phòng thành công - Kiểm tra response shape của RoomResponseDto', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra response shape',
          description:
            'Lấy thông tin một phòng chiếu bằng ID hợp lệ và kiểm tra response đúng RoomResponseDto.',
          procedure: `GET /rooms/${validRoomId}`,
          expectedResult: 200,
          preconditions: `Token Admin hợp lệ`,
        },
        async () => {
          const response = await request(server)
            .get(`/rooms/${validRoomId}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(200);

          const data = parseApiData<RoomResponseDto>(response);

          expect(data.id).toBe(validRoomId);
          expect(data.name).toBe(validRoomName);
          expect(typeof data.totalSeats).toBe('number');
          expect(typeof data.createdAt).toBe('string');
          expect(typeof data.updatedAt).toBe('string');

          expect(Object.keys(data).sort()).toEqual([
            'createdAt',
            'id',
            'name',
            'totalSeats',
            'updatedAt',
          ]);

          return response;
        },
      );
    });

    it('Lấy phòng thành công - Trả về đúng totalSeats theo số ghế của phòng', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra phòng với tổng ghế',
          description:
            'Lấy thông tin một phòng chiếu bằng ID hợp lệ, totalSeats phản ánh đúng số ghế thuộc phòng.',
          procedure: `GET /rooms/${validRoomId}`,
          expectedResult: 200,
          preconditions: `Token Admin hợp lệ và phòng đã có ghế`,
        },
        async () => {
          const response = await request(server)
            .get(`/rooms/${validRoomId}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(200);

          const data = parseApiData<RoomResponseDto>(response);

          expect(data.id).toBe(validRoomId);
          expect(data.name).toBe(validRoomName);
          expect(data.totalSeats).toBe(2);

          return response;
        },
      );
    });
  });
});
