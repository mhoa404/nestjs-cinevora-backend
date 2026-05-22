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
import { AppModule } from '../../../src/app.module';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';
import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import { cleanupRefreshTokens } from '../../helpers/cleanup-refresh-token';
import { Room } from '../../../src/modules/rooms/entities/room.entity';
import { Seat } from '../../../src/modules/seats/entities/seat.entity';
import { SeatResponseDto } from '../../../src/modules/seats/dto/seat-response.dto';
import { SeatType } from '../../../src/common/constants/seat-type.constant';

type SeatApiResponse = Omit<SeatResponseDto, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

type CreateSeatBody = {
  roomId?: unknown;
  seats?: unknown;
  extraField?: unknown;
};

describe('[API] POST /seats', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let roomForCreateId = 0;
  let roomForNormalizeId = 0;
  let roomForExistingConflictId = 0;
  let notFoundRoomId = 0;

  const createdRoomIds: number[] = [];
  const createdSeatIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'CSE';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return PREFIX + String(counter).padStart(2, '0');
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

  const rememberCreatedSeats = (seats: SeatApiResponse[]): void => {
    seats.forEach((seat) => {
      if (typeof seat.id === 'number') {
        createdSeatIds.push(seat.id);
      }
    });
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

    const rooms = await roomRepository.save([
      roomRepository.create({ name: 'CS' + seed.slice(0, 6) + 'A' }),
      roomRepository.create({ name: 'CS' + seed.slice(0, 6) + 'B' }),
      roomRepository.create({ name: 'CS' + seed.slice(0, 6) + 'C' }),
    ]);

    roomForCreateId = rooms[0].id;
    roomForNormalizeId = rooms[1].id;
    roomForExistingConflictId = rooms[2].id;
    createdRoomIds.push(...rooms.map((room) => room.id));

    const existingSeat = await seatRepository.save(
      seatRepository.create({
        roomId: roomForExistingConflictId,
        seatKey: 'A1',
        rowLabel: 'A',
        seatNumber: 1,
        seatType: SeatType.STANDARD,
      }),
    );

    createdSeatIds.push(existingSeat.id);

    const maxRoom = await roomRepository
      .createQueryBuilder('room')
      .select('MAX(room.id)', 'max')
      .getRawOne<{ max: string | null }>();

    notFoundRoomId = Number(maxRoom?.max ?? 0) + 999999;
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

    await exportTestReport(results, PREFIX, 'Create_Seats');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Tạo ghế thất bại - Không truyền Authorization Token trả về đúng message', async () => {
      const body: CreateSeatBody = {
        roomId: roomForCreateId,
        seats: [
          {
            rowLabel: 'A',
            seatNumber: 1,
            seatType: SeatType.STANDARD,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không truyền token',
          description: 'Không gửi access token khi gọi API tạo ghế.',
          procedure: `{
  "roomId": ${roomForCreateId},
  "seats": [
    {
      "rowLabel": "A",
      "seatNumber": 1,
      "seatType": "standard"
    }
  ]
}`,
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server).post('/seats').send(body);

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Tạo ghế thất bại - Truyền Fake Token trả về đúng message', async () => {
      const body: CreateSeatBody = {
        roomId: roomForCreateId,
        seats: [
          {
            rowLabel: 'A',
            seatNumber: 1,
            seatType: SeatType.STANDARD,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Token không hợp lệ',
          description: 'Gửi Bearer token không hợp lệ.',
          procedure: `{
  "roomId": ${roomForCreateId},
  "seats": [
    {
      "rowLabel": "A",
      "seatNumber": 1,
      "seatType": "standard"
    }
  ]
}`,
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server)
            .post('/seats')
            .set('Authorization', 'Bearer fake.jwt.token')
            .send(body);

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Tạo ghế thất bại - Role Customer bị chặn trả về đúng message', async () => {
      const body: CreateSeatBody = {
        roomId: roomForCreateId,
        seats: [
          {
            rowLabel: 'A',
            seatNumber: 1,
            seatType: SeatType.STANDARD,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Customer không có quyền',
          description: 'Tài khoản Customer cố tạo ghế.',
          procedure: `{
  "roomId": ${roomForCreateId},
  "seats": [
    {
      "rowLabel": "A",
      "seatNumber": 1,
      "seatType": "standard"
    }
  ]
}`,
          expectedResult: 403,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats')
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
    it('Tạo ghế thất bại - Thiếu seats trả về đúng message', async () => {
      const body: CreateSeatBody = {
        roomId: roomForCreateId,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu seats',
          description: 'Gửi body thiếu trường seats.',
          procedure: `{
  "roomId": ${roomForCreateId}
}`,
          expectedResult: 400,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'seats không được rỗng');

          return response;
        },
      );
    });

    it('Tạo ghế thất bại - seats rỗng trả về đúng message', async () => {
      const body: CreateSeatBody = {
        roomId: roomForCreateId,
        seats: [],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'seats rỗng',
          description: 'Gửi seats là mảng rỗng.',
          procedure: `{
  "roomId": ${roomForCreateId},
  "seats": []
}`,
          expectedResult: 400,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'seats không được rỗng');

          return response;
        },
      );
    });

    it('Tạo ghế thất bại - seatNumber nhỏ hơn 1 trả về đúng message', async () => {
      const body: CreateSeatBody = {
        roomId: roomForCreateId,
        seats: [
          {
            rowLabel: 'A',
            seatNumber: 0,
            seatType: SeatType.STANDARD,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'seatNumber nhỏ hơn 1',
          description: 'Gửi seatNumber bằng 0.',
          procedure: `{
  "roomId": ${roomForCreateId},
  "seats": [
    {
      "rowLabel": "A",
      "seatNumber": 0,
      "seatType": "standard"
    }
  ]
}`,
          expectedResult: 400,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'seatNumber phải lớn hơn hoặc bằng 1');

          return response;
        },
      );
    });

    it('Tạo ghế thất bại - seatType không hợp lệ trả về đúng message', async () => {
      const body: CreateSeatBody = {
        roomId: roomForCreateId,
        seats: [
          {
            rowLabel: 'A',
            seatNumber: 1,
            seatType: 'premium',
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'seatType không hợp lệ',
          description: 'Gửi seatType không thuộc enum SeatType.',
          procedure: `{
  "roomId": ${roomForCreateId},
  "seats": [
    {
      "rowLabel": "A",
      "seatNumber": 1,
      "seatType": "premium"
    }
  ]
}`,
          expectedResult: 400,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'seatType phải là một trong: standard, vip, couple',
          );

          return response;
        },
      );
    });

    it('Tạo ghế thất bại - Payload dư field trả về đúng message', async () => {
      const body: CreateSeatBody = {
        roomId: roomForCreateId,
        seats: [
          {
            rowLabel: 'A',
            seatNumber: 1,
            seatType: SeatType.STANDARD,
          },
        ],
        extraField: 'hack',
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Payload dư field',
          description: 'Gửi thêm field không được khai báo trong DTO.',
          procedure: `{
  "roomId": ${roomForCreateId},
  "seats": [
    {
      "rowLabel": "A",
      "seatNumber": 1,
      "seatType": "standard"
    }
  ],
  "extraField": "hack"
}`,
          expectedResult: 400,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats')
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

    it('Tạo ghế thất bại - rowLabel chỉ gồm khoảng trắng trả về đúng message', async () => {
      const body: CreateSeatBody = {
        roomId: roomForCreateId,
        seats: [
          {
            rowLabel: '   ',
            seatNumber: 1,
            seatType: SeatType.STANDARD,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'rowLabel trắng',
          description:
            'Gửi rowLabel chỉ gồm khoảng trắng, service trim về chuỗi rỗng.',
          procedure: `{
  "roomId": ${roomForCreateId},
  "seats": [
    {
      "rowLabel": " ",
      "seatNumber": 1,
      "seatType": "standard"
    }
  ]
}`,
          expectedResult: 400,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'rowLabel không được để trống.');

          return response;
        },
      );
    });
  });

  describe('Ràng buộc nghiệp vụ', () => {
    it('Tạo ghế thất bại - Phòng không tồn tại trả về đúng message', async () => {
      const body: CreateSeatBody = {
        roomId: notFoundRoomId,
        seats: [
          {
            rowLabel: 'A',
            seatNumber: 1,
            seatType: SeatType.STANDARD,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Phòng không tồn tại',
          description: 'Truyền roomId hợp lệ nhưng không tồn tại trong DB.',
          procedure: `{
  "roomId": ${notFoundRoomId},
  "seats": [
    {
      "rowLabel": "A",
      "seatNumber": 1,
      "seatType": "standard"
    }
  ]
}`,
          expectedResult: 404,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(404);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            404,
            'Phòng #' + notFoundRoomId + ' không tồn tại.',
          );

          return response;
        },
      );
    });

    it('Tạo ghế thất bại - Trùng seatKey trong payload trả về đúng message', async () => {
      const body: CreateSeatBody = {
        roomId: roomForCreateId,
        seats: [
          {
            rowLabel: 'A',
            seatNumber: 1,
            seatType: SeatType.STANDARD,
          },
          {
            rowLabel: 'a',
            seatNumber: 1,
            seatType: SeatType.VIP,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Trùng ghế trong payload',
          description:
            'Gửi hai ghế có cùng seatKey sau khi normalize rowLabel.',
          procedure: `{
  "roomId": ${roomForCreateId},
  "seats": [
    {
      "rowLabel": "A",
      "seatNumber": 1,
      "seatType": "standard"
    },
    {
      "rowLabel": "a",
      "seatNumber": 1,
      "seatType": "vip"
    }
  ]
}`,
          expectedResult: 409,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            409,
            'Danh sách ghế gửi lên có seatKey bị trùng lặp',
          );

          return response;
        },
      );
    });

    it('Tạo ghế thất bại - Ghế đã tồn tại trong DB trả về đúng message', async () => {
      const body: CreateSeatBody = {
        roomId: roomForExistingConflictId,
        seats: [
          {
            rowLabel: 'A',
            seatNumber: 1,
            seatType: SeatType.STANDARD,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Ghế đã tồn tại',
          description: 'Tạo ghế có seatKey đã tồn tại trong cùng phòng.',
          procedure: `{
  "roomId": ${roomForExistingConflictId},
  "seats": [
    {
      "rowLabel": "A",
      "seatNumber": 1,
      "seatType": "standard"
    }
  ]
}`,
          expectedResult: 409,
          preconditions: 'Token admin hợp lệ, ghế đã tồn tại',
        },
        async () => {
          const response = await request(server)
            .post('/seats')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            409,
            'Các ghế sau đã tồn tại trong phòng: A1',
          );

          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Tạo ghế thành công - Tạo nhiều ghế và kiểm tra response shape', async () => {
      const body: CreateSeatBody = {
        roomId: roomForCreateId,
        seats: [
          {
            rowLabel: 'A',
            seatNumber: 1,
            seatType: SeatType.STANDARD,
          },
          {
            rowLabel: 'A',
            seatNumber: 2,
            seatType: SeatType.VIP,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Tạo nhiều ghế',
          description: 'Tạo nhiều ghế trong cùng một phòng.',
          procedure: `{
  "roomId": ${roomForCreateId},
  "seats": [
    {
      "rowLabel": "A",
      "seatNumber": 1,
      "seatType": "standard"
    },
    {
      "rowLabel": "A",
      "seatNumber": 2,
      "seatType": "vip"
    }
  ]
}`,
          expectedResult: 201,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(201);

          const data = parseApiData<SeatApiResponse[]>(response);
          expect(Array.isArray(data)).toBe(true);
          expect(data.length).toBe(2);

          data.forEach((seat) => {
            expect(typeof seat.id).toBe('number');
            expect(seat.roomId).toBe(roomForCreateId);
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

          expect(data.map((seat) => seat.seatKey)).toEqual(['A1', 'A2']);
          expect(data.map((seat) => seat.seatType)).toEqual([
            SeatType.STANDARD,
            SeatType.VIP,
          ]);

          rememberCreatedSeats(data);

          return response;
        },
      );
    });

    it('Tạo ghế thành công - rowLabel được normalize uppercase và tạo đúng seatKey', async () => {
      const body: CreateSeatBody = {
        roomId: roomForNormalizeId,
        seats: [
          {
            rowLabel: ' b ',
            seatNumber: 3,
            seatType: SeatType.COUPLE,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Normalize rowLabel',
          description:
            'Tạo ghế với rowLabel có khoảng trắng và chữ thường, service normalize về uppercase.',
          procedure: `{
  "roomId": ${roomForNormalizeId},
  "seats": [
    {
      "rowLabel": " b ",
      "seatNumber": 3,
      "seatType": "couple"
    }
  ]
}`,
          expectedResult: 201,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(201);

          const data = parseApiData<SeatApiResponse[]>(response);
          expect(data).toHaveLength(1);
          expect(data[0].roomId).toBe(roomForNormalizeId);
          expect(data[0].rowLabel).toBe('B');
          expect(data[0].seatNumber).toBe(3);
          expect(data[0].seatKey).toBe('B3');
          expect(data[0].seatType).toBe(SeatType.COUPLE);
          expect(data[0].isActive).toBe(true);

          rememberCreatedSeats(data);

          return response;
        },
      );
    });
  });
});
