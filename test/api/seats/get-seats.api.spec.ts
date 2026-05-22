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
import { SeatResponseDto } from '../../../src/modules/seats/dto/seat-response.dto';
import { SeatType } from '../../../src/common/constants/seat-type.constant';
import { AppModule } from '../../../src/app.module';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';
import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';

describe('[API] GET /seats', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let roomWithSeatsId = 0;
  let emptyRoomId = 0;
  let otherRoomId = 0;
  let notFoundRoomId = 0;

  const createdRoomIds: number[] = [];
  const createdSeatIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'GSE';
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

    const seed = String(Date.now()).slice(-12);

    const roomRepository = dataSource.getRepository(Room);
    const seatRepository = dataSource.getRepository(Seat);

    const rooms = await roomRepository.save([
      roomRepository.create({ name: `GSE-A-${seed}` }),
      roomRepository.create({ name: `GSE-E-${seed}` }),
      roomRepository.create({ name: `GSE-O-${seed}` }),
    ]);

    roomWithSeatsId = rooms[0].id;
    emptyRoomId = rooms[1].id;
    otherRoomId = rooms[2].id;

    createdRoomIds.push(...rooms.map((room) => room.id));

    const seats = await seatRepository.save([
      seatRepository.create({
        roomId: roomWithSeatsId,
        seatKey: 'B2',
        rowLabel: 'B',
        seatNumber: 2,
        seatType: SeatType.VIP,
      }),
      seatRepository.create({
        roomId: roomWithSeatsId,
        seatKey: 'A2',
        rowLabel: 'A',
        seatNumber: 2,
        seatType: SeatType.STANDARD,
      }),
      seatRepository.create({
        roomId: roomWithSeatsId,
        seatKey: 'A1',
        rowLabel: 'A',
        seatNumber: 1,
        seatType: SeatType.STANDARD,
      }),
      seatRepository.create({
        roomId: roomWithSeatsId,
        seatKey: 'B1',
        rowLabel: 'B',
        seatNumber: 1,
        seatType: SeatType.VIP,
      }),
      seatRepository.create({
        roomId: otherRoomId,
        seatKey: 'C1',
        rowLabel: 'C',
        seatNumber: 1,
        seatType: SeatType.COUPLE,
      }),
    ]);

    createdSeatIds.push(...seats.map((seat) => seat.id));

    const maxRoomRaw = (await roomRepository
      .createQueryBuilder('room')
      .select('MAX(room.id)', 'max')
      .getRawOne()) as { max: string | number | null };

    notFoundRoomId = Number(maxRoomRaw.max ?? 0) + 9999;
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

    await exportTestReport(results, PREFIX, 'Get_Seats');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Lấy danh sách ghế thất bại - Không truyền Authorization Token trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không gửi Header Authorization',
          description: 'Không gửi access token khi gọi API lấy danh sách ghế.',
          procedure: `{"roomId": ${roomWithSeatsId}}`,
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server)
            .get('/seats')
            .query({ roomId: roomWithSeatsId });

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Lấy danh sách ghế thất bại - Truyền Fake Token trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi token giả',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: `{"roomId": ${roomWithSeatsId}}`,
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server)
            .get('/seats')
            .set('Authorization', 'Bearer fake.jwt.token')
            .query({ roomId: roomWithSeatsId });

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Lấy danh sách ghế thất bại - Role Customer bị chặn trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi token Customer',
          description: 'Tài khoản Customer cố lấy danh sách ghế.',
          procedure: `{"roomId": ${roomWithSeatsId}}`,
          expectedResult: 403,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get('/seats')
            .set('Authorization', `Bearer ${customerToken}`)
            .query({ roomId: roomWithSeatsId });

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

  describe('Validation & lỗi nghiệp vụ', () => {
    it('Lấy danh sách ghế thất bại - Thiếu roomId trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu roomId',
          description: 'Không truyền query roomId khi lấy danh sách ghế.',
          procedure: '{}',
          expectedResult: 400,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get('/seats')
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

    it('Lấy danh sách ghế thất bại - roomId không phải số trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'roomId không hợp lệ',
          description: 'Truyền query roomId không phải numeric string.',
          procedure: `{"roomId": "abc"}`,
          expectedResult: 400,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get('/seats')
            .set('Authorization', `Bearer ${adminToken}`)
            .query({ roomId: 'abc' });

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

    it('Lấy danh sách ghế thất bại - Phòng không tồn tại trả về đúng message', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Phòng không tồn tại',
          description: 'Truyền roomId hợp lệ nhưng không tồn tại trong DB.',
          procedure: `{"roomId": ${notFoundRoomId}}`,
          expectedResult: 404,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get('/seats')
            .set('Authorization', `Bearer ${adminToken}`)
            .query({ roomId: notFoundRoomId });

          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            404,
            `Phòng #${notFoundRoomId} không tồn tại.`,
          );

          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Lấy danh sách ghế thành công - Kiểm tra response shape của SeatResponseDto', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra response shape',
          description:
            'Kiểm tra response chỉ gồm các field của SeatResponseDto.',
          procedure: `{"roomId": ${roomWithSeatsId}}`,
          expectedResult: 200,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get('/seats')
            .set('Authorization', `Bearer ${adminToken}`)
            .query({ roomId: roomWithSeatsId });

          expect(response.status).toBe(200);

          const data = parseApiData<SeatResponseDto[]>(response);
          expect(Array.isArray(data)).toBe(true);
          expect(data.length).toBe(4);

          data.forEach((seat) => {
            expect(typeof seat.id).toBe('number');
            expect(seat.roomId).toBe(roomWithSeatsId);
            expect(typeof seat.seatKey).toBe('string');
            expect(typeof seat.rowLabel).toBe('string');
            expect(typeof seat.seatNumber).toBe('number');
            expect(Object.values(SeatType)).toContain(seat.seatType);
            expect(typeof seat.isActive).toBe('boolean');
            expect(typeof seat.createdAt).toBe('string');
            expect(typeof seat.updatedAt).toBe('string');

            expect(Object.keys(seat).sort()).toEqual([
              'createdAt',
              'id',
              'isActive',
              'roomId',
              'rowLabel',
              'seatKey',
              'seatNumber',
              'seatType',
              'updatedAt',
            ]);
          });

          return response;
        },
      );
    });

    it('Lấy danh sách ghế thành công - Chỉ trả về ghế thuộc đúng phòng', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra lọc theo phòng',
          description:
            'Lấy danh sách ghế thành công và không trả ghế của phòng khác.',
          procedure: `{"roomId": ${roomWithSeatsId}}`,
          expectedResult: 200,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get('/seats')
            .set('Authorization', `Bearer ${adminToken}`)
            .query({ roomId: roomWithSeatsId });

          expect(response.status).toBe(200);

          const data = parseApiData<SeatResponseDto[]>(response);
          expect(data.length).toBe(4);
          expect(data.every((seat) => seat.roomId === roomWithSeatsId)).toBe(
            true,
          );
          expect(data.some((seat) => seat.roomId === otherRoomId)).toBe(false);

          return response;
        },
      );
    });

    it('Lấy danh sách ghế thành công - Sắp xếp theo rowLabel ASC và seatNumber ASC', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra ghế được sắp xếp ASC',
          description:
            'Lấy danh sách ghế thành công, kết quả sắp xếp theo rowLabel ASC và seatNumber ASC.',
          procedure: `{"roomId": ${roomWithSeatsId}}`,
          expectedResult: 200,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get('/seats')
            .set('Authorization', `Bearer ${adminToken}`)
            .query({ roomId: roomWithSeatsId });

          expect(response.status).toBe(200);

          const data = parseApiData<SeatResponseDto[]>(response);
          expect(data.map((seat) => seat.seatKey)).toEqual([
            'A1',
            'A2',
            'B1',
            'B2',
          ]);

          return response;
        },
      );
    });

    it('Lấy danh sách ghế thành công - Phòng chưa có ghế trả về mảng rỗng', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Phòng chưa có ghế',
          description: 'Lấy danh sách ghế của phòng tồn tại nhưng chưa có ghế.',
          procedure: `{"roomId": ${emptyRoomId}}`,
          expectedResult: 200,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .get('/seats')
            .set('Authorization', `Bearer ${adminToken}`)
            .query({ roomId: emptyRoomId });

          expect(response.status).toBe(200);

          const data = parseApiData<SeatResponseDto[]>(response);
          expect(Array.isArray(data)).toBe(true);
          expect(data).toEqual([]);

          return response;
        },
      );
    });
  });
});
