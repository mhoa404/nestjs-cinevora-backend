import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { Server } from 'http';

import {
  expectErrorMessage,
  getActualStatus,
  parseApiData,
  parseApiError,
} from '../../helpers/http-test.helper';
import { Room } from '../../../src/modules/rooms/entities/room.entity';
import { Seat } from '../../../src/modules/seats/entities/seat.entity';
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
  const createdSeatIds: number[] = [];

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

    const seed = String(Date.now()).slice(-6);

    const roomRepository = dataSource.getRepository(Room);
    const seatRepository = dataSource.getRepository(Seat);

    const rooms = await roomRepository.save([
      roomRepository.create({ name: `ZGRM${seed}` }),
      roomRepository.create({ name: `AGRM${seed}` }),
      roomRepository.create({ name: `MGRM${seed}` }),
    ]);

    createdRoomIds.push(...rooms.map((room) => room.id));

    const roomWithSeats = rooms.find((room) => room.name.startsWith('AGRM'));

    if (!roomWithSeats) {
      throw new Error('Seed room for totalSeats test was not created.');
    }

    const seats = await seatRepository.save([
      seatRepository.create({
        roomId: roomWithSeats.id,
        seatKey: 'A1',
        rowLabel: 'A',
        seatNumber: 1,
      }),
      seatRepository.create({
        roomId: roomWithSeats.id,
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

    await exportTestReport(results, PREFIX, 'Get_Rooms');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Lấy danh sách thất bại - Không truyền Authorization Token trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không gửi Header Authorization',
          description:
            'Không gửi access token khi gọi API lấy danh sách phòng.',
          procedure: 'GET /rooms',
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server).get('/rooms');

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Lấy danh sách thất bại - Truyền Fake Token trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi token giả',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: 'GET /rooms với Authorization: Bearer fake.jwt.token',
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server)
            .get('/rooms')
            .set('Authorization', 'Bearer fake.jwt.token');

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Lấy danh sách thất bại - Role Customer bị chặn trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi token của Customer',
          description: 'Tài khoản Customer cố lấy danh sách phòng chiếu.',
          procedure: 'GET /rooms với token Customer',
          expectedResult: 403,
          preconditions: 'Token của customer',
        },
        async () => {
          const response = await request(server)
            .get('/rooms')
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

  describe('Luồng thành công', () => {
    it('Lấy danh sách thành công - Kiểm tra response shape của RoomResponseDto', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra response shape',
          description:
            'Kiểm tra response chỉ gồm các field của RoomResponseDto.',
          procedure: 'GET /rooms',
          expectedResult: 200,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get('/rooms')
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(200);

          const data = parseApiData<RoomResponseDto[]>(response);
          expect(Array.isArray(data)).toBe(true);

          const seededRooms = data.filter((room) =>
            createdRoomIds.includes(room.id),
          );

          expect(seededRooms.length).toBe(3);

          seededRooms.forEach((room) => {
            expect(typeof room.id).toBe('number');
            expect(typeof room.name).toBe('string');
            expect(typeof room.totalSeats).toBe('number');
            expect(typeof room.createdAt).toBe('string');
            expect(typeof room.updatedAt).toBe('string');

            expect(Object.keys(room).sort()).toEqual([
              'createdAt',
              'id',
              'name',
              'totalSeats',
              'updatedAt',
            ]);
          });

          return response;
        },
      );
    });

    it('Lấy danh sách thành công - Sắp xếp theo name ASC', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra phòng được sắp xếp ASC',
          description:
            'Lấy danh sách phòng thành công, kết quả được sắp xếp tăng dần theo name.',
          procedure: 'GET /rooms',
          expectedResult: 200,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get('/rooms')
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(200);

          const data = parseApiData<RoomResponseDto[]>(response);
          const seededRooms = data.filter((room) =>
            createdRoomIds.includes(room.id),
          );

          expect(seededRooms.length).toBe(3);

          const names = seededRooms.map((room) => room.name);
          expect(names).toEqual([...names].sort());

          return response;
        },
      );
    });

    it('Lấy danh sách thành công - Trả về đúng totalSeats theo số ghế của phòng', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra totalSeats của phòng',
          description:
            'Lấy danh sách phòng thành công, totalSeats phản ánh đúng số ghế thuộc phòng.',
          procedure: 'GET /rooms',
          expectedResult: 200,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get('/rooms')
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(200);

          const data = parseApiData<RoomResponseDto[]>(response);
          const seededRooms = data.filter((room) =>
            createdRoomIds.includes(room.id),
          );

          expect(seededRooms.length).toBe(3);

          const roomWithSeats = seededRooms.find((room) =>
            room.name.startsWith('AGRM'),
          );

          expect(roomWithSeats).toBeDefined();
          expect(roomWithSeats?.totalSeats).toBe(2);

          const roomsWithoutSeats = seededRooms.filter(
            (room) => !room.name.startsWith('AGRM'),
          );

          roomsWithoutSeats.forEach((room) => {
            expect(room.totalSeats).toBe(0);
          });

          return response;
        },
      );
    });
  });
});
