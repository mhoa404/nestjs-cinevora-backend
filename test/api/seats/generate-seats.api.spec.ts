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

type GenerateSeatsBody = {
  roomId?: unknown;
  rows?: unknown;
  extraField?: unknown;
};

describe('[API] POST /seats/generate', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let roomForGenerateId = 0;
  let roomForNormalizeId = 0;
  let roomWithExistingSeatsId = 0;
  let notFoundRoomId = 0;

  const createdRoomIds: number[] = [];
  const createdSeatIds: number[] = [];

  const results: TestCaseRecord[] = [];
  const PREFIX = 'GNS';
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
      roomRepository.create({ name: 'GS' + seed.slice(0, 6) + 'A' }),
      roomRepository.create({ name: 'GS' + seed.slice(0, 6) + 'B' }),
      roomRepository.create({ name: 'GS' + seed.slice(0, 6) + 'C' }),
    ]);

    roomForGenerateId = rooms[0].id;
    roomForNormalizeId = rooms[1].id;
    roomWithExistingSeatsId = rooms[2].id;
    createdRoomIds.push(...rooms.map((room) => room.id));

    const existingSeat = await seatRepository.save(
      seatRepository.create({
        roomId: roomWithExistingSeatsId,
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
    await exportTestReport(results, PREFIX, 'Generate_Seats');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Generate ghế thất bại - Không truyền Authorization Token trả về đúng message', async () => {
      const body: GenerateSeatsBody = {
        roomId: roomForGenerateId,
        rows: [
          {
            rowLabel: 'A',
            count: 2,
            seatType: SeatType.STANDARD,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Không truyền token',
          description: 'Không gửi access token khi gọi API generate ghế.',
          procedure: `{
  "roomId": ${roomForGenerateId},
  "rows": [
    {
      "rowLabel": "A",
      "count": 2,
      "seatType": "standard"
    }
  ]
}`,
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server)
            .post('/seats/generate')
            .send(body);

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Generate ghế thất bại - Truyền Fake Token trả về đúng message', async () => {
      const body: GenerateSeatsBody = {
        roomId: roomForGenerateId,
        rows: [
          {
            rowLabel: 'A',
            count: 2,
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
  "roomId": ${roomForGenerateId},
  "rows": [
    {
      "rowLabel": "A",
      "count": 2,
      "seatType": "standard"
    }
  ]
}`,
          expectedResult: 401,
          preconditions: 'Không có',
        },
        async () => {
          const response = await request(server)
            .post('/seats/generate')
            .set('Authorization', 'Bearer fake.jwt.token')
            .send(body);

          expect(response.status).toBe(401);

          const error = parseApiError(response);
          expectErrorMessage(error, 401, 'Unauthorized');

          return response;
        },
      );
    });

    it('Generate ghế thất bại - Role Customer bị chặn trả về đúng message', async () => {
      const body: GenerateSeatsBody = {
        roomId: roomForGenerateId,
        rows: [
          {
            rowLabel: 'A',
            count: 2,
            seatType: SeatType.STANDARD,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Customer không có quyền',
          description: 'Tài khoản Customer cố generate ghế.',
          procedure: `{
  "roomId": ${roomForGenerateId},
  "rows": [
    {
      "rowLabel": "A",
      "count": 2,
      "seatType": "standard"
    }
  ]
}`,
          expectedResult: 403,
          preconditions: 'Token customer hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats/generate')
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
    it('Generate ghế thất bại - Thiếu rows trả về đúng message', async () => {
      const body: GenerateSeatsBody = {
        roomId: roomForGenerateId,
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Thiếu rows',
          description: 'Gửi body thiếu trường rows.',
          procedure: `{
  "roomId": ${roomForGenerateId}
}`,
          expectedResult: 400,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats/generate')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'rows không được rỗng');

          return response;
        },
      );
    });

    it('Generate ghế thất bại - rows rỗng trả về đúng message', async () => {
      const body: GenerateSeatsBody = {
        roomId: roomForGenerateId,
        rows: [],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'rows rỗng',
          description: 'Gửi rows là mảng rỗng.',
          procedure: `{
  "roomId": ${roomForGenerateId},
  "rows": []
}`,
          expectedResult: 400,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats/generate')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'rows không được rỗng');

          return response;
        },
      );
    });

    it('Generate ghế thất bại - count nhỏ hơn 1 trả về đúng message', async () => {
      const body: GenerateSeatsBody = {
        roomId: roomForGenerateId,
        rows: [
          {
            rowLabel: 'A',
            count: 0,
            seatType: SeatType.STANDARD,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'count nhỏ hơn 1',
          description: 'Gửi count bằng 0.',
          procedure: `{
  "roomId": ${roomForGenerateId},
  "rows": [
    {
      "rowLabel": "A",
      "count": 0,
      "seatType": "standard"
    }
  ]
}`,
          expectedResult: 400,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats/generate')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(error, 400, 'count phải lớn hơn hoặc bằng 1');

          return response;
        },
      );
    });

    it('Generate ghế thất bại - count vượt quá 100 trả về đúng message', async () => {
      const body: GenerateSeatsBody = {
        roomId: roomForGenerateId,
        rows: [
          {
            rowLabel: 'A',
            count: 101,
            seatType: SeatType.STANDARD,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'count vượt quá 100',
          description: 'Gửi count lớn hơn giới hạn 100 ghế mỗi hàng.',
          procedure: `{
  "roomId": ${roomForGenerateId},
  "rows": [
    {
      "rowLabel": "A",
      "count": 101,
      "seatType": "standard"
    }
  ]
}`,
          expectedResult: 400,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats/generate')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(400);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            400,
            'count không được vượt quá 100 ghế mỗi hàng',
          );

          return response;
        },
      );
    });

    it('Generate ghế thất bại - seatType không hợp lệ trả về đúng message', async () => {
      const body: GenerateSeatsBody = {
        roomId: roomForGenerateId,
        rows: [
          {
            rowLabel: 'A',
            count: 2,
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
  "roomId": ${roomForGenerateId},
  "rows": [
    {
      "rowLabel": "A",
      "count": 2,
      "seatType": "premium"
    }
  ]
}`,
          expectedResult: 400,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats/generate')
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

    it('Generate ghế thất bại - Payload dư field trả về đúng message', async () => {
      const body: GenerateSeatsBody = {
        roomId: roomForGenerateId,
        rows: [
          {
            rowLabel: 'A',
            count: 2,
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
  "roomId": ${roomForGenerateId},
  "rows": [
    {
      "rowLabel": "A",
      "count": 2,
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
            .post('/seats/generate')
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

    it('Generate ghế thất bại - rowLabel chỉ gồm khoảng trắng trả về đúng message', async () => {
      const body: GenerateSeatsBody = {
        roomId: roomForGenerateId,
        rows: [
          {
            rowLabel: '   ',
            count: 2,
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
  "roomId": ${roomForGenerateId},
  "rows": [
    {
      "rowLabel": "   ",
      "count": 2,
      "seatType": "standard"
    }
  ]
}`,
          expectedResult: 400,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats/generate')
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
    it('Generate ghế thất bại - Phòng không tồn tại trả về đúng message', async () => {
      const body: GenerateSeatsBody = {
        roomId: notFoundRoomId,
        rows: [
          {
            rowLabel: 'A',
            count: 2,
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
  "rows": [
    {
      "rowLabel": "A",
      "count": 2,
      "seatType": "standard"
    }
  ]
}`,
          expectedResult: 404,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats/generate')
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

    it('Generate ghế thất bại - Trùng rowLabel trong payload trả về đúng message', async () => {
      const body: GenerateSeatsBody = {
        roomId: roomForGenerateId,
        rows: [
          {
            rowLabel: 'A',
            count: 2,
            seatType: SeatType.STANDARD,
          },
          {
            rowLabel: ' a ',
            count: 3,
            seatType: SeatType.VIP,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Trùng rowLabel',
          description:
            'Gửi hai row có cùng rowLabel sau khi normalize rowLabel.',
          procedure: `{
  "roomId": ${roomForGenerateId},
  "rows": [
    {
      "rowLabel": "A",
      "count": 2,
      "seatType": "standard"
    },
    {
      "rowLabel": " a ",
      "count": 3,
      "seatType": "vip"
    }
  ]
}`,
          expectedResult: 409,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats/generate')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            409,
            'Danh sách rows gửi lên có rowLabel bị trùng lặp',
          );

          return response;
        },
      );
    });

    it('Generate ghế thất bại - Phòng đã có ghế trả về đúng message', async () => {
      const body: GenerateSeatsBody = {
        roomId: roomWithExistingSeatsId,
        rows: [
          {
            rowLabel: 'B',
            count: 2,
            seatType: SeatType.STANDARD,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Phòng đã có ghế',
          description: 'Generate ghế cho phòng đã tồn tại ghế trong DB.',
          procedure: `{
  "roomId": ${roomWithExistingSeatsId},
  "rows": [
    {
      "rowLabel": "B",
      "count": 2,
      "seatType": "standard"
    }
  ]
}`,
          expectedResult: 409,
          preconditions: 'Token admin hợp lệ, phòng đã có ghế',
        },
        async () => {
          const response = await request(server)
            .post('/seats/generate')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(409);

          const error = parseApiError(response);
          expectErrorMessage(
            error,
            409,
            'Phòng đã có ghế, không thể generate tự động',
          );

          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Generate ghế thành công - Generate nhiều hàng và kiểm tra response shape', async () => {
      const body: GenerateSeatsBody = {
        roomId: roomForGenerateId,
        rows: [
          {
            rowLabel: 'A',
            count: 2,
            seatType: SeatType.STANDARD,
          },
          {
            rowLabel: 'B',
            count: 3,
            seatType: SeatType.VIP,
          },
        ],
      };

      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Generate nhiều hàng',
          description: 'Generate nhiều hàng ghế trong cùng một phòng.',
          procedure: `{
  "roomId": ${roomForGenerateId},
  "rows": [
    {
      "rowLabel": "A",
      "count": 2,
      "seatType": "standard"
    },
    {
      "rowLabel": "B",
      "count": 3,
      "seatType": "vip"
    }
  ]
}`,
          expectedResult: 201,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats/generate')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(201);

          const data = parseApiData<SeatApiResponse[]>(response);
          expect(Array.isArray(data)).toBe(true);
          expect(data.length).toBe(5);

          data.forEach((seat) => {
            expect(typeof seat.id).toBe('number');
            expect(seat.roomId).toBe(roomForGenerateId);
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

          expect(data.map((seat) => seat.seatKey)).toEqual([
            'A1',
            'A2',
            'B1',
            'B2',
            'B3',
          ]);

          expect(data.map((seat) => seat.seatType)).toEqual([
            SeatType.STANDARD,
            SeatType.STANDARD,
            SeatType.VIP,
            SeatType.VIP,
            SeatType.VIP,
          ]);

          rememberCreatedSeats(data);

          return response;
        },
      );
    });

    it('Generate ghế thành công - rowLabel được normalize uppercase và tạo đúng seatKey', async () => {
      const body: GenerateSeatsBody = {
        roomId: roomForNormalizeId,
        rows: [
          {
            rowLabel: ' c ',
            count: 2,
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
            'Generate ghế với rowLabel có khoảng trắng và chữ thường, service normalize về uppercase.',
          procedure: `{
  "roomId": ${roomForNormalizeId},
  "rows": [
    {
      "rowLabel": " c ",
      "count": 2,
      "seatType": "couple"
    }
  ]
}`,
          expectedResult: 201,
          preconditions: 'Token admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .post('/seats/generate')
            .set('Authorization', 'Bearer ' + adminToken)
            .send(body);

          expect(response.status).toBe(201);

          const data = parseApiData<SeatApiResponse[]>(response);
          expect(data).toHaveLength(2);
          expect(data.map((seat) => seat.roomId)).toEqual([
            roomForNormalizeId,
            roomForNormalizeId,
          ]);
          expect(data.map((seat) => seat.rowLabel)).toEqual(['C', 'C']);
          expect(data.map((seat) => seat.seatNumber)).toEqual([1, 2]);
          expect(data.map((seat) => seat.seatKey)).toEqual(['C1', 'C2']);
          expect(data.map((seat) => seat.seatType)).toEqual([
            SeatType.COUPLE,
            SeatType.COUPLE,
          ]);
          expect(data.every((seat) => seat.isActive === true)).toBe(true);

          rememberCreatedSeats(data);

          return response;
        },
      );
    });
  });
});
