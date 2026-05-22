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
import { cleanupRefreshTokens } from '../../helpers/cleanup-refresh-token';

type RoomBody = {
  name?: unknown;
  extraField?: unknown;
};

describe('[API] PATCH /rooms/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let targetRoomId = 0;
  let originalRoomName = '';
  let occupiedRoomName = '';
  let updateRoomName = '';
  let trimRoomName = '';
  let shapeRoomName = '';

  const createdRoomIds: number[] = [];
  const createdSeatIds: number[] = [];

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

  const allocateRoomNames = async (): Promise<string[]> => {
    const roomRepository = dataSource.getRepository(Room);
    const existingRooms = await roomRepository.find({ select: ['name'] });
    const existingNames = new Set(existingRooms.map((room) => room.name));

    const availableNames = Array.from({ length: 100 }, (_, index) =>
      String(index).padStart(2, '0'),
    ).filter((name) => !existingNames.has(name));

    if (availableNames.length < 5) {
      throw new Error(
        'Không đủ room name dạng 2 chữ số để chạy update-room e2e.',
      );
    }

    return availableNames.slice(0, 5);
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

    const allocatedNames = await allocateRoomNames();

    originalRoomName = allocatedNames[0];
    occupiedRoomName = allocatedNames[1];
    updateRoomName = allocatedNames[2];
    trimRoomName = allocatedNames[3];
    shapeRoomName = allocatedNames[4];

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

    const targetRoom = await roomRepository.save(
      roomRepository.create({ name: originalRoomName }),
    );

    targetRoomId = targetRoom.id;
    createdRoomIds.push(targetRoom.id);

    const occupiedRoom = await roomRepository.save(
      roomRepository.create({ name: occupiedRoomName }),
    );

    createdRoomIds.push(occupiedRoom.id);

    const seats = await seatRepository.save([
      seatRepository.create({
        roomId: targetRoom.id,
        seatKey: 'A1',
        rowLabel: 'A',
        seatNumber: 1,
      }),
      seatRepository.create({
        roomId: targetRoom.id,
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

    await cleanupRefreshTokens(dataSource);

    await exportTestReport(results, PREFIX, 'Update_Room');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Cập nhật thất bại - Không truyền Authorization Token trả về đúng message', async () => {
      const body: RoomBody = { name: updateRoomName };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không truyền token',
          description: 'Không gửi access token khi gọi API cập nhật phòng.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server)
            .patch(`/rooms/${targetRoomId}`)
            .send(body);

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Cập nhật thất bại - Truyền Fake Token trả về đúng message', async () => {
      const body: RoomBody = { name: updateRoomName };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Token không hợp lệ',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server)
            .patch(`/rooms/${targetRoomId}`)
            .set('Authorization', 'Bearer fake.jwt.token')
            .send(body);

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Cập nhật thất bại - Role Customer bị chặn trả về đúng message', async () => {
      const body: RoomBody = { name: updateRoomName };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Customer không có quyền',
          description: 'Tài khoản Customer cố cập nhật phòng chiếu.',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: 'Token Customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .patch(`/rooms/${targetRoomId}`)
            .set('Authorization', `Bearer ${customerToken}`)
            .send(body);

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

  describe('Validation Payload', () => {
    it('Cập nhật thất bại - ID không phải số nguyên trả về đúng message', async () => {
      const body: RoomBody = { name: updateRoomName };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'ID sai định dạng',
          description:
            'Truyền id là chuỗi chữ cái, ParseIntPipe không thể parse sang number.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .patch('/rooms/abc')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

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

    it('Cập nhật thất bại - Body rỗng trả về đúng message', async () => {
      const body = {};

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Body rỗng',
          description: 'Gửi body rỗng, không có dữ liệu để cập nhật.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .patch(`/rooms/${targetRoomId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'Không có dữ liệu nào để cập nhật.');

          return response;
        },
      );
    });

    it('Cập nhật thất bại - name là null trả về đúng message', async () => {
      const body: RoomBody = { name: null };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Name là null',
          description: 'Gửi name là null khi PATCH phòng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ',
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
            'Không hỗ trợ set null cho PATCH: name.',
          );

          return response;
        },
      );
    });

    it('Cập nhật thất bại - name là chuỗi rỗng trả về đúng message', async () => {
      const body: RoomBody = { name: '' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tên phòng rỗng',
          description: 'Gửi name là chuỗi rỗng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ',
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

    it('Cập nhật thất bại - name chỉ gồm khoảng trắng trả về đúng message', async () => {
      const body: RoomBody = { name: '   ' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tên phòng chỉ có khoảng trắng',
          description:
            'Gửi name chỉ gồm khoảng trắng, Trim decorator sẽ trim về chuỗi rỗng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ',
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

    it('Cập nhật thất bại - name không đúng định dạng 2 chữ số (VD: 1)', async () => {
      const body: RoomBody = { name: '1' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tên phòng sai định dạng',
          description: 'Gửi name chỉ có 1 chữ số, không đúng định dạng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ',
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

    it('Cập nhật thất bại - name không đúng định dạng 2 chữ số (VD: abc)', async () => {
      const body: RoomBody = { name: 'abc' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tên phòng không phải số',
          description: 'Gửi name gồm ký tự chữ cái, không phải số.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ',
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

    it('Cập nhật thất bại - name không đúng định dạng 2 chữ số (VD: 123)', async () => {
      const body: RoomBody = { name: '123' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tên phòng quá 2 chữ số',
          description: 'Gửi name có 3 chữ số, không đúng định dạng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ',
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

    it('Cập nhật thất bại - Gửi payload dư field trả về đúng message', async () => {
      const body: RoomBody = {
        name: updateRoomName,
        extraField: 'hack',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Payload dư field',
          description: 'Gửi thêm field không được khai báo trong DTO.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ',
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
            'property extraField should not exist',
          );

          return response;
        },
      );
    });
  });

  describe('Ràng buộc nghiệp vụ', () => {
    it('Cập nhật thất bại - Room ID không tồn tại', async () => {
      const body: RoomBody = { name: updateRoomName };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Phòng không tồn tại',
          description: 'Cập nhật phòng với ID không tồn tại trong DB.',
          procedure: stringifyProcedure(body),
          expectedResult: 404,
          preconditions: 'Token Admin hợp lệ',
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

    it('Cập nhật thất bại - Tên phòng đã được dùng bởi phòng khác', async () => {
      const body: RoomBody = { name: occupiedRoomName };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tên phòng đã tồn tại',
          description:
            'Cập nhật phòng thành tên đã tồn tại ở phòng khác trong hệ thống.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Token Admin, tên phòng đã tồn tại',
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
      const body: RoomBody = { name: originalRoomName };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Gửi lại tên hiện tại',
          description:
            'PATCH với name trùng name hiện tại của chính phòng đó vẫn trả 200 OK.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Token Admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .patch(`/rooms/${targetRoomId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(200);

          const data = parseApiData<RoomResponseDto>(response);

          expect(data.id).toBe(targetRoomId);
          expect(data.name).toBe(originalRoomName);
          expect(data.totalSeats).toBe(2);

          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Cập nhật thành công - Đổi tên phòng hợp lệ', async () => {
      const body: RoomBody = { name: updateRoomName };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Cập nhật phòng hợp lệ',
          description:
            'Cập nhật tên phòng thành công với token Admin và payload hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Token Admin hợp lệ, tên phòng chưa tồn tại',
        },
        async () => {
          const response = await request(server)
            .patch(`/rooms/${targetRoomId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(200);

          const data = parseApiData<RoomResponseDto>(response);

          expect(data.id).toBe(targetRoomId);
          expect(data.name).toBe(updateRoomName);
          expect(data.totalSeats).toBe(2);
          expect(typeof data.createdAt).toBe('string');
          expect(typeof data.updatedAt).toBe('string');

          return response;
        },
      );
    });

    it('Cập nhật thành công - Tự trim khoảng trắng hai đầu', async () => {
      const body: RoomBody = { name: '   ' + trimRoomName + '   ' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tự trim tên phòng',
          description:
            'Cập nhật phòng thành công khi name có khoảng trắng hai đầu.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Token Admin hợp lệ, tên phòng chưa tồn tại',
        },
        async () => {
          const response = await request(server)
            .patch(`/rooms/${targetRoomId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(200);

          const data = parseApiData<RoomResponseDto>(response);

          expect(data.id).toBe(targetRoomId);
          expect(data.name).toBe(trimRoomName);
          expect(data.totalSeats).toBe(2);

          return response;
        },
      );
    });

    it('Cập nhật thành công - Trả về đúng shape RoomResponseDto', async () => {
      const body: RoomBody = { name: shapeRoomName };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra response',
          description:
            'Cập nhật phòng thành công và kiểm tra response chỉ gồm các field của RoomResponseDto.',
          procedure: stringifyProcedure(body),
          expectedResult: 200,
          preconditions: 'Token Admin hợp lệ, tên phòng chưa tồn tại',
        },
        async () => {
          const response = await request(server)
            .patch(`/rooms/${targetRoomId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);

          expect(response.status).toBe(200);

          const data = parseApiData<RoomResponseDto>(response);

          expect(data.id).toBe(targetRoomId);
          expect(data.name).toBe(shapeRoomName);
          expect(data.totalSeats).toBe(2);
          expect(typeof data.id).toBe('number');
          expect(typeof data.name).toBe('string');
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
  });
});
