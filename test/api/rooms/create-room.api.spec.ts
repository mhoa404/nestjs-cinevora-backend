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
import { cleanupRefreshTokens } from '../../helpers/cleanup-refresh-token';

type RoomBody = {
  name?: unknown;
  extraField?: unknown;
};

describe('[API] POST /rooms', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let createRoomName = '';
  let trimRoomName = '';
  let duplicateRoomName = '';

  const createdRoomIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'CRM';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return PREFIX + String(counter).padStart(2, '0');
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

  const rememberCreatedRoom = (room: RoomResponseDto): void => {
    if (typeof room.id === 'number') {
      createdRoomIds.push(room.id);
    }
  };

  const allocateRoomNames = async (): Promise<string[]> => {
    const roomRepository = dataSource.getRepository(Room);
    const existingRooms = await roomRepository.find({ select: ['name'] });
    const existingNames = new Set(existingRooms.map((room) => room.name));

    const availableNames = Array.from({ length: 100 }, (_, index) =>
      String(index).padStart(2, '0'),
    ).filter((name) => !existingNames.has(name));

    if (availableNames.length < 3) {
      throw new Error(
        'Không đủ room name dạng 2 chữ số để chạy create-room e2e.',
      );
    }

    return availableNames.slice(0, 3);
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
    duplicateRoomName = allocatedNames[0];
    createRoomName = allocatedNames[1];
    trimRoomName = allocatedNames[2];

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

    await cleanupRefreshTokens(dataSource);

    await exportTestReport(results, PREFIX, 'Create_Room');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Tạo thất bại - Không truyền Authorization Token trả về đúng message', async () => {
      const body: RoomBody = { name: '01' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không truyền token',
          description: 'Không gửi access token khi gọi API tạo phòng.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Không có token',
        },
        async () => {
          const response = await request(server).post('/rooms').send(body);

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Tạo thất bại - Truyền Fake Token trả về đúng message', async () => {
      const body: RoomBody = { name: '01' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Token không hợp lệ',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 401,
          preconditions: 'Token giả',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', 'Bearer fake.jwt.token')
            .send(body);

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Tạo thất bại - Role Customer bị chặn trả về đúng message', async () => {
      const body: RoomBody = { name: '01' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Customer không có quyền',
          description: 'Tài khoản Customer cố tạo phòng chiếu.',
          procedure: stringifyProcedure(body),
          expectedResult: 403,
          preconditions: 'Token Customer',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', 'Bearer ' + customerToken)
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
    it('Tạo thất bại - Thiếu trường name trả về đúng message', async () => {
      const body = {};

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu tên phòng',
          description: 'Gửi body rỗng, không có trường name.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', 'Bearer ' + adminToken)
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

    it('Tạo thất bại - name là chuỗi rỗng trả về đúng message', async () => {
      const body: RoomBody = { name: '' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tên phòng rỗng',
          description: 'Gửi name là chuỗi rỗng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', 'Bearer ' + adminToken)
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

    it('Tạo thất bại - name chỉ gồm khoảng trắng trả về đúng message', async () => {
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
          preconditions: 'Token Admin',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', 'Bearer ' + adminToken)
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

    it('Tạo thất bại - name không đúng định dạng 2 chữ số (VD: 1)', async () => {
      const body: RoomBody = { name: '1' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tên phòng sai định dạng',
          description: 'Gửi name chỉ có 1 chữ số, không đúng định dạng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', 'Bearer ' + adminToken)
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

    it('Tạo thất bại - name không đúng định dạng 2 chữ số (VD: abc)', async () => {
      const body: RoomBody = { name: 'abc' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tên phòng không phải số',
          description: 'Gửi name gồm ký tự chữ cái, không phải số.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', 'Bearer ' + adminToken)
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

    it('Tạo thất bại - name không đúng định dạng 2 chữ số (VD: 123)', async () => {
      const body: RoomBody = { name: '123' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tên phòng quá 2 chữ số',
          description: 'Gửi name có 3 chữ số, không đúng định dạng.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', 'Bearer ' + adminToken)
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

    it('Tạo thất bại - Gửi payload dư field trả về đúng message', async () => {
      const body: RoomBody = { name: '01', extraField: 'hack' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Payload dư field',
          description: 'Gửi thêm field không được khai báo trong DTO.',
          procedure: stringifyProcedure(body),
          expectedResult: 400,
          preconditions: 'Token Admin',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', 'Bearer ' + adminToken)
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
    it('Tạo thất bại - Tên phòng đã tồn tại', async () => {
      const roomRepository = dataSource.getRepository(Room);
      const existingRoom = await roomRepository.save(
        roomRepository.create({ name: duplicateRoomName }),
      );

      createdRoomIds.push(existingRoom.id);

      const body: RoomBody = { name: duplicateRoomName };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tên phòng đã tồn tại',
          description: 'Cố tình tạo phòng với tên đã tồn tại trong hệ thống.',
          procedure: stringifyProcedure(body),
          expectedResult: 409,
          preconditions: 'Token Admin, tên phòng đã tồn tại',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', 'Bearer ' + adminToken)
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
      const body: RoomBody = { name: createRoomName };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo phòng hợp lệ',
          description: 'Tạo phòng thành công với payload hợp lệ.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Token Admin, tên phòng chưa tồn tại',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(201);

          const data = parseApiData<RoomResponseDto>(response);
          rememberCreatedRoom(data);

          expect(typeof data.id).toBe('number');
          expect(data.name).toBe(createRoomName);
          expect(data.totalSeats).toBe(0);
          expect(typeof data.createdAt).toBe('string');
          expect(typeof data.updatedAt).toBe('string');

          return response;
        },
      );
    });

    it('Tạo thành công - Tự trim khoảng trắng hai đầu', async () => {
      const body: RoomBody = { name: '   ' + trimRoomName + '   ' };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tự trim tên phòng',
          description: 'Tạo phòng thành công khi name có khoảng trắng hai đầu.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Token Admin, tên phòng chưa tồn tại',
        },
        async () => {
          const response = await request(server)
            .post('/rooms')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(201);

          const data = parseApiData<RoomResponseDto>(response);
          rememberCreatedRoom(data);

          expect(data.name).toBe(trimRoomName);
          expect(data.totalSeats).toBe(0);

          return response;
        },
      );
    });

    it('Tạo thành công - Trả về đúng shape RoomResponseDto', async () => {
      const body: RoomBody = { name: createRoomName };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Kiểm tra response',
          description:
            'Kiểm tra response tạo phòng chỉ gồm các field của RoomResponseDto.',
          procedure: stringifyProcedure(body),
          expectedResult: 201,
          preconditions: 'Token Admin, phòng đã được tạo',
        },
        async () => {
          const response = await request(server)
            .get('/rooms')
            .set('Authorization', 'Bearer ' + adminToken);

          expect(response.status).toBe(200);

          const rooms = parseApiData<RoomResponseDto[]>(response);
          const data = rooms.find((room) => room.name === createRoomName);

          expect(data).toBeDefined();

          expect(typeof data?.id).toBe('number');
          expect(data?.name).toBe(createRoomName);
          expect(data?.totalSeats).toBe(0);
          expect(typeof data?.createdAt).toBe('string');
          expect(typeof data?.updatedAt).toBe('string');

          expect(Object.keys(data as RoomResponseDto).sort()).toEqual([
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
