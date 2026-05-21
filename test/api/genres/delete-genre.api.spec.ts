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
import { cleanupRefreshTokens } from '../../helpers/cleanup-refresh-token';

describe('[API] DELETE /genres/:id', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let adminToken = '';
  let customerToken = '';

  let genreInUseId = 0;
  let genreToDeleteId = 0;

  const createdGenreIds: number[] = [];
  const createdMovieIds: number[] = [];

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
      .post('/auth/mobile/login')
      .send({ email: 'api_tester@gmail.com', password: 'Api_tester_123' });
    adminToken = parseApiData<AuthResponseDto>(adminLoginRes).accessToken;

    const customerLoginRes = await request(server)
      .post('/auth/mobile/login')
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
    createdGenreIds.push(inUseGenre.id);

    const freeGenre = await genreRepository.save(
      genreRepository.create({
        name: `Genre Free ${seed}`,
        slug: `genre-free-${seed}`,
      }),
    );
    genreToDeleteId = freeGenre.id;
    createdGenreIds.push(freeGenre.id);

    const movie = await movieRepository.save(
      movieRepository.create({
        title: `Delete Genre Movie ${seed}`,
        slug: `delete-genre-movie-${seed}`,
        posterUrl: 'https://example.com/delete-genre-movie.jpg',
        trailerUrl: null,
        bannerUrl: null,
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
    createdMovieIds.push(movie.id);
  });

  afterAll(async () => {
    const movieRepository = dataSource.getRepository(Movie);
    const genreRepository = dataSource.getRepository(Genre);

    if (createdMovieIds.length > 0) {
      await movieRepository.delete(createdMovieIds);
    }

    if (createdGenreIds.length > 0) {
      await genreRepository.delete(createdGenreIds);
    }

    await cleanupRefreshTokens(dataSource);

    await exportTestReport(results, PREFIX, 'Delete_Genre');
    await app.close();
  });

  describe('Phân quyền', () => {
    it('Xoá thất bại - Không gửi token', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Không gửi Header Authorization',
          description: 'Không gửi Authorization header.',
          procedure: `DELETE /genres/${genreToDeleteId}`,
          expectedResult: 401,
          preconditions: 'Không có',
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

    it('Xoá thất bại - Fake token', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Gửi token giả',
          description: 'Gửi token giả.',
          procedure: `DELETE /genres/${genreToDeleteId}`,
          expectedResult: 401,
          preconditions: 'Không có',
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

    it('Xoá thất bại - Customer không có quyền', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Gửi token của customer',
          description: 'Thực hiện xóa genre với tài khoản customer',
          procedure: `DELETE /genres/${genreToDeleteId}`,
          expectedResult: 403,
          preconditions: 'Token Customer hợp lệ',
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
  });

  describe('Validation', () => {
    it('Xoá thất bại - ID không phải số', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Sai định dạng ID',
          description:
            'Truyền id là chuỗi chữ cái, ParseIntPipe không thể parse sang number.',
          procedure: 'DELETE /genres/abc',
          expectedResult: 400,
          preconditions: 'Token Admin hợp lệ',
        },
        async () => {
          const response = await request(server)
            .delete('/genres/abc')
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
  });

  describe('Ràng buộc nghiệp vụ', () => {
    it('Xoá thất bại - Genre ID không tồn tại', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Xóa genre không tồn tại',
          description: 'Xoá genre không tồn tại.',
          procedure: 'DELETE /genres/999999',
          expectedResult: 404,
          preconditions: 'Token Admin hợp lệ',
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
          testCase: 'Xóa genre đang được sử dụng',
          description: 'Xoá genre đang được gắn với 1 movie.',
          procedure: `DELETE /genres/${genreInUseId}`,
          expectedResult: 409,
          preconditions: 'Genre đã được gắn vào movie',
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
    it('Xoá thành công - Genre tồn tại và không liên kết phim trả 204 No Content', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Xóa thành công',
          description:
            'Admin xoá genre không liên kết movie, API trả 204 No Content.',
          procedure: `DELETE /genres/${genreToDeleteId}`,
          expectedResult: 204,
          preconditions: 'Genre tồn tại và chưa dùng.',
        },
        async () => {
          const response = await request(server)
            .delete(`/genres/${genreToDeleteId}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(204);
          expect(response.text).toBe('');

          return response;
        },
      );
    });

    it('Xoá thất bại - Xoá lại lần 2 cùng ID', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Xóa lại lần 2 cùng ID',
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
          testCase: 'Kiểm tra genre đã bị xoá',
          description: 'Xác minh genre đã biến mất.',
          procedure: `GET /genres/${genreToDeleteId}`,
          expectedResult: 404,
          preconditions: 'Genre đã bị xóa',
        },
        async () => {
          const response = await request(server).get(
            `/genres/${genreToDeleteId}`,
          );

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

    it('Sau khi xoá thành công - GET /genres không còn chứa genre đó', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Kiểm tra danh sách genre sau khi xoá',
          description: 'Danh sách genre không còn chứa ID đã xoá.',
          procedure: 'GET /genres',
          expectedResult: 200,
          preconditions: 'Genre đã bị xoá',
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
