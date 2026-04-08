import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request, { Response } from 'supertest';
import cookieParser from 'cookie-parser';
import { Server } from 'http';

import { exportTestReport, TestCaseRecord } from '../../helpers/excel-reporter';
import { AppModule } from '../../../src/app.module';
import {
  expectErrorMessage,
  getActualStatus,
  parseApiData,
  parseApiError,
} from '../../helpers/http-test.helper';
import { AuthResponseDto } from '../../../src/modules/auth/dto/auth-response.dto';
import { GenreResponseDto } from '../../../src/modules/genres/dto/genre-response.dto';
import { Genre } from '../../../src/modules/genres/entities/genre.entity';
import {
  AgeRating,
  Movie,
  MovieStatus,
} from '../../../src/modules/movies/entities/movie.entity';

describe('[API] DELETE /genres/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let genreInUseId = 0;
  let genreToDeleteId = 0;

  const results: TestCaseRecord[] = [];
  const PREFIX = 'DGR';
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return `${PREFIX}-${String(counter).padStart(3, '0')}`;
  };

  const record = async (
    meta: Omit<TestCaseRecord, 'id' | 'passed' | 'testDate' | 'actualResult'>,
    executor: () => Promise<Response>,
  ): Promise<void> => {
    const testDate = new Date();
    const id = nextId();
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
      results.push({ id, ...meta, actualResult, passed, testDate });
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
      .post('/auth/login')
      .send({ email: 'api_tester@gmail.com', password: 'Api_tester_123' });
    adminToken = parseApiData<AuthResponseDto>(adminLoginRes).accessToken;

    const customerLoginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'api_client@gmail.com', password: 'Api_client_123' });
    customerToken = parseApiData<AuthResponseDto>(customerLoginRes).accessToken;

    const genreRepository = dataSource.getRepository(Genre);
    const movieRepository = dataSource.getRepository(Movie);
    const seed = Date.now();

    const inUseGenre = await genreRepository.save(
      genreRepository.create({
        name: `Genre In Use ${seed}`,
        slug: `genre-in-use-${seed}`,
      }),
    );
    genreInUseId = inUseGenre.id;

    const freeGenre = await genreRepository.save(
      genreRepository.create({
        name: `Genre Free ${seed}`,
        slug: `genre-free-${seed}`,
      }),
    );
    genreToDeleteId = freeGenre.id;

    await movieRepository.save(
      movieRepository.create({
        title: `Delete Genre Movie ${seed}`,
        slug: `delete-genre-movie-${seed}`,
        posterUrl: 'https://example.com/delete-genre-movie.jpg',
        trailerUrl: null,
        description: 'Movie linked to genre',
        duration: 110,
        director: 'Director X',
        actor: 'Actor X',
        language: 'VI',
        ageRating: AgeRating.P,
        rated: 'P',
        status: MovieStatus.COMING,
        releaseDate: new Date(),
        endDate: null,
        genres: [inUseGenre],
      }),
    );
  });

  afterAll(async () => {
    await exportTestReport(results, PREFIX, 'Delete_Genre');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Xoá thất bại - Không gửi token', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Security: Missing Token',
          description: 'Không gửi Authorization header.',
          procedure: `DELETE /genres/${genreToDeleteId}`,
          expectedResult: 401,
          preconditions: 'Không có token.',
        },
        async () => {
          const response = await request(server).delete(
            `/genres/${genreToDeleteId}`,
          );
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Xoá thất bại - Customer không có quyền', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Security: Customer Forbidden',
          description: 'Customer cố xoá genre.',
          procedure: `DELETE /genres/${genreToDeleteId}`,
          expectedResult: 403,
          preconditions: 'Dùng token customer.',
        },
        async () => {
          const response = await request(server)
            .delete(`/genres/${genreToDeleteId}`)
            .set('Authorization', `Bearer ${customerToken}`);

          expect(response.status).toBe(403);
          return response;
        },
      );
    });

    it('Xoá thất bại - Fake token', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Security: Fake Token',
          description: 'Gửi token giả.',
          procedure: `DELETE /genres/${genreToDeleteId}`,
          expectedResult: 401,
          preconditions: 'Token giả.',
        },
        async () => {
          const response = await request(server)
            .delete(`/genres/${genreToDeleteId}`)
            .set('Authorization', 'Bearer fake.jwt.token');

          expect(response.status).toBe(401);
          return response;
        },
      );
    });
  });

  describe('Ràng buộc nghiệp vụ', () => {
    it('Xoá thất bại - Genre ID không tồn tại', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Business: Genre Not Found',
          description: 'Xoá genre không tồn tại.',
          procedure: 'DELETE /genres/999999',
          expectedResult: 404,
          preconditions: 'Dùng token admin.',
        },
        async () => {
          const response = await request(server)
            .delete('/genres/999999')
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(404);
          const error = parseApiError(response);
          expectErrorMessage(error, 404, 'Thể loại #999999 không tồn tại.');
          return response;
        },
      );
    });

    it('Xoá thất bại - Genre đang được sử dụng bởi movie', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Business: Conflict FK',
          description: 'Xoá genre đang được gắn với 1 movie.',
          procedure: `DELETE /genres/${genreInUseId}`,
          expectedResult: 409,
          preconditions: 'Genre đã được gắn vào movie.',
        },
        async () => {
          const response = await request(server)
            .delete(`/genres/${genreInUseId}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(409);
          const error = parseApiError(response);
          expectErrorMessage(
            error,
            409,
            'Không thể xoá thể loại đang được sử dụng bởi 1 phim.',
          );
          return response;
        },
      );
    });
  });

  describe('Luồng thành công', () => {
    it('Xoá thành công - Genre tồn tại và không liên kết phim', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Business: Delete Success',
          description: 'Admin xoá genre không liên kết movie.',
          procedure: `DELETE /genres/${genreToDeleteId}`,
          expectedResult: 204,
          preconditions: 'Genre tồn tại và chưa dùng.',
        },
        async () => {
          const response = await request(server)
            .delete(`/genres/${genreToDeleteId}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(204);
          return response;
        },
      );
    });

    it('Xoá thất bại - Xoá lại lần 2 cùng ID', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Business: Delete Again',
          description: 'Gọi xoá lần 2 với đúng ID đã xoá.',
          procedure: `DELETE /genres/${genreToDeleteId}`,
          expectedResult: 404,
          preconditions: 'Genre đã bị xoá ở bước trước.',
        },
        async () => {
          const response = await request(server)
            .delete(`/genres/${genreToDeleteId}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(404);
          const error = parseApiError(response);
          expectErrorMessage(
            error,
            404,
            `Thể loại #${genreToDeleteId} không tồn tại.`,
          );
          return response;
        },
      );
    });

    it('Sau khi xoá thành công - GET /genres/:id trả về 404', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Verification: Get Deleted Genre',
          description: 'Xác minh genre đã biến mất.',
          procedure: `GET /genres/${genreToDeleteId}`,
          expectedResult: 404,
          preconditions: 'Genre đã bị xoá.',
        },
        async () => {
          const response = await request(server).get(
            `/genres/${genreToDeleteId}`,
          );
          expect(response.status).toBe(404);
          return response;
        },
      );
    });

    it('Sau khi xoá thành công - GET /genres không còn chứa genre đó', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Verification: Genre Removed From List',
          description: 'Danh sách genre không còn chứa ID đã xoá.',
          procedure: 'GET /genres',
          expectedResult: 200,
          preconditions: 'Genre đã bị xoá.',
        },
        async () => {
          const response = await request(server).get('/genres');

          expect(response.status).toBe(200);
          const listGenres = parseApiData<GenreResponseDto[]>(response);
          const exists = listGenres.some(
            (genre) => genre.id === genreToDeleteId,
          );
          expect(exists).toBe(false);

          return response;
        },
      );
    });
  });
});
