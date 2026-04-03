import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { Server } from 'http';

import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import {
  parseApiData,
  parseApiError,
  getActualStatus,
} from '../../helpers/http-test.helper';
import { AppModule } from '../../../src/app.module';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';
import {
  AgeRating,
  Movie,
  MovieStatus,
} from '../../../src/modules/movies/entities/movie.entity';

describe('[API] DELETE /movies/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';
  let targetMovieId = -1;
  let activeMovieId = -1;

  const results: TestCaseRecord[] = [];
  const PREFIX = 'DMV';
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
      }),
    );
    app.use(cookieParser());
    await app.init();
    server = app.getHttpServer() as Server;

    const adminLoginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'api_tester@gmail.com', password: 'Api_tester_123' });
    adminToken = parseApiData<AuthResponseDto>(adminLoginRes).accessToken;

    const customerLoginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'api_client@gmail.com', password: 'Api_client_123' });
    customerToken = parseApiData<AuthResponseDto>(customerLoginRes).accessToken;

    const movieRepo = dataSource.getRepository(Movie);

    const endMovie = movieRepo.create({
      title: 'Movie To Be Deleted',
      posterUrl: 'http://example.com/poster-delete.jpg',
      duration: 90,
      ageRating: AgeRating.P,
      releaseDate: '2027-01-01',
      status: MovieStatus.ENDED,
    });
    const savedEndMovie = await movieRepo.save(endMovie);
    targetMovieId = savedEndMovie.id;

    const activeMovie = movieRepo.create({
      title: 'Movie Cannot Be Deleted',
      posterUrl: 'http://example.com/poster-showing.jpg',
      duration: 90,
      ageRating: AgeRating.P,
      releaseDate: '2027-01-01',
      status: MovieStatus.SHOWING,
    });
    const savedActiveMovie = await movieRepo.save(activeMovie);
    activeMovieId = savedActiveMovie.id;
  });

  afterAll(async () => {
    const movieRepo = dataSource.getRepository(Movie);
    if (targetMovieId > 0) {
      await movieRepo.delete({ id: targetMovieId });
    }
    if (activeMovieId > 0) {
      await movieRepo.delete({ id: activeMovieId });
    }

    await exportTestReport(results, PREFIX, 'Delete_Movie');
    await app.close();
  });

  describe('Security & Roles)', () => {
    it('Xoá thất bại - Không gửi token', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: No Token',
          description: 'Gọi API Delete Movie nhưng không có token',
          procedure: 'DELETE params: ID',
          expectedResult: 401,
          preconditions: '',
        },
        async () => {
          const response = await request(server).delete(
            `/movies/${targetMovieId}`,
          );
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Xoá thất bại - Token Customer (Không đủ quyền)', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Security: Forbidden Role',
          description:
            'Dùng token của Customer (Mặc định chỉ Admin/Super Admin được xoá)',
          procedure: 'DELETE params: ID',
          expectedResult: 403,
          preconditions: '',
        },
        async () => {
          const response = await request(server)
            .delete(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${customerToken}`);
          expect(response.status).toBe(403);
          return response;
        },
      );
    });
  });

  describe('Ràng buộc nghiệp vụ (Business Rules)', () => {
    it('Xoá thất bại - Movie Id không tồn tại', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Movie Not Found',
          description: 'Cố gắng xoá Id rác không có trong database',
          procedure: 'DELETE params: 999999',
          expectedResult: 404,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .delete(`/movies/999999`)
            .set('Authorization', `Bearer ${adminToken}`);
          expect(response.status).toBe(404);
          return response;
        },
      );
    });

    it('Xóa thất bại - Trạng thái phim chưa phải là ended', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Business: Invalid Movie Status',
          description: 'Cố gắng xoá một bộ phim đang SHOWING (chưa kết thúc)',
          procedure: 'DELETE params: activeMovieId',
          expectedResult: 400,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .delete(`/movies/${activeMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`);
          expect(response.status).toBe(400);
          const error = parseApiError(response);
          expect(error.message).toBe(
            'Chỉ có thể xóa phim khi trạng thái đã chuyển sang ended.',
          );
          return response;
        },
      );
    });
  });

  describe('Luồng thành công (Happy Path)', () => {
    it('Xóa thành công một Movie hợp lệ', async () => {
      await record(
        {
          id: nextId(),
          scope: 'All',
          testCase: 'Happy Path: Valid Deletion',
          description: 'Xóa phim có trạng thái ENDED bằng tài khoản Admin',
          procedure: 'DELETE params: targetMovieId',
          expectedResult: 204,
          preconditions: 'Dùng token Admin',
        },
        async () => {
          const response = await request(server)
            .delete(`/movies/${targetMovieId}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(204);
          return response;
        },
      );
    });

    it('Xác thực lại: Movie đã hoàn toàn biến mất sau khi xoá', async () => {
      const response = await request(server).get(`/movies/${targetMovieId}`);
      expect(response.status).toBe(404);
    });
  });
});
