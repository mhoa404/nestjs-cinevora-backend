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

<<<<<<< HEAD
  let genreInUseId = 0;
  let genreToDeleteId = 0;
=======
  let genreInUseId: number;
  let genreToDeleteId: number;
>>>>>>> origin/main

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
<<<<<<< HEAD
    const id = nextId();
    let passed = false;
    let actualResult: number | null = null;
=======
    let passed = false;
    let actualResult: number | null = null;
    const testId = nextId();
>>>>>>> origin/main

    try {
      const response = await executor();
      actualResult = response.status;
      passed = true;
    } catch (error: unknown) {
      actualResult = getActualStatus(error);
      passed = false;
      throw error;
    } finally {
<<<<<<< HEAD
      results.push({ id, ...meta, actualResult, passed, testDate });
=======
      results.push({ id: testId, ...meta, actualResult, passed, testDate });
>>>>>>> origin/main
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
<<<<<<< HEAD

=======
>>>>>>> origin/main
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

<<<<<<< HEAD
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
=======
    const genreRepo = dataSource.getRepository(Genre);
    const movieRepo = dataSource.getRepository(Movie);

    const actionGenre = await genreRepo.findOne({
      where: { slug: 'hanh-dong' },
    });
    const comedyGenre = await genreRepo.findOne({
      where: { slug: 'genre-test' },
    });

    if (!actionGenre || !comedyGenre) {
      throw new Error(
        'Bạn cần chuẩn bị DB chứa sẵn thể loại Hành động và Hài kịch trước khi test!',
      );
    }

    const mockMovie = movieRepo.create({
      title: 'Test Movie Xoá Thể Loại',
      slug: 'test-movie-xoa-the-loai-999',
      posterUrl: 'No Poster',
      duration: 120,
      ageRating: AgeRating.P,
      status: MovieStatus.COMMING,
      releaseDate: new Date('2026-01-01'),
      genres: [actionGenre],
    });
    await movieRepo.save(mockMovie);

    genreInUseId = actionGenre.id;
    genreToDeleteId = comedyGenre.id;
>>>>>>> origin/main
  });

  afterAll(async () => {
    await exportTestReport(results, PREFIX, 'Delete_Genre');
    await app.close();
  });

<<<<<<< HEAD
  describe('Phân quyền', () => {
=======
  describe('Validation & Security', () => {
>>>>>>> origin/main
    it('Xoá thất bại - Không gửi token', async () => {
      await record(
        {
          scope: 'All',
<<<<<<< HEAD
          testCase: 'Security: Missing Token',
          description: 'Không gửi Authorization header.',
          procedure: `DELETE /genres/${genreToDeleteId}`,
          expectedResult: 401,
          preconditions: 'Không có token.',
=======
          testCase: 'Security: No Token',
          description: 'Không gửi header Authorization',
          procedure: 'Gọi DELETE không gửi Bearer token',
          expectedResult: 401,
          preconditions: '',
>>>>>>> origin/main
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

<<<<<<< HEAD
    it('Xoá thất bại - Customer không có quyền', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Security: Customer Forbidden',
          description: 'Customer cố xoá genre.',
          procedure: `DELETE /genres/${genreToDeleteId}`,
          expectedResult: 403,
          preconditions: 'Dùng token customer.',
=======
    it('Xoá thất bại - Token không hợp lệ', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Security: Invalid Token',
          description: 'Gửi chuỗi token fake không parse được JWT',
          procedure: 'Gọi DELETE với Token fake',
          expectedResult: 401,
          preconditions: '',
        },
        async () => {
          const response = await request(server)
            .delete(`/genres/${genreToDeleteId}`)
            .set('Authorization', 'Bearer invalid.fake.jwt');
          expect(response.status).toBe(401);
          return response;
        },
      );
    });

    it('Xoá thất bại - Mức quyền Customer', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Security: Sai Role',
          description: 'Dùng token của người chơi (Customer) gọi API xoá',
          procedure: 'Gọi DELETE với token Customer',
          expectedResult: 403,
          preconditions: '',
>>>>>>> origin/main
        },
        async () => {
          const response = await request(server)
            .delete(`/genres/${genreToDeleteId}`)
            .set('Authorization', `Bearer ${customerToken}`);
<<<<<<< HEAD

=======
>>>>>>> origin/main
          expect(response.status).toBe(403);
          return response;
        },
      );
    });

<<<<<<< HEAD
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
=======
    it('Xoá thất bại - ID sai format', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Validation: ID sai format',
          description: 'Truyền id là chữ (ví dụ abc) thay vì số nguyên',
          procedure: 'Gửi request DELETE /genres/abc',
          expectedResult: 400,
          preconditions: '',
        },
        async () => {
          const response = await request(server)
            .delete(`/genres/abc`)
            .set('Authorization', `Bearer ${adminToken}`);
          expect(response.status).toBe(400);
>>>>>>> origin/main
          return response;
        },
      );
    });
<<<<<<< HEAD
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
=======

    it('Xoá thất bại - Thể loại không tồn tại', async () => {
      const fakeId = 999999;
      await record(
        {
          scope: 'All',
          testCase: 'Business: ID không tồn tại',
          description: 'Cố xoá ID rác không có thật trong csdl',
          procedure: `Gửi request DELETE /genres/${fakeId}`,
          expectedResult: 404,
          preconditions: '',
        },
        async () => {
          const response = await request(server)
            .delete(`/genres/${fakeId}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(404);
          const resError = parseApiError(response);
          expectErrorMessage(
            resError,
            404,
            `Thể loại #${fakeId} không tồn tại.`,
          );
>>>>>>> origin/main
          return response;
        },
      );
    });

<<<<<<< HEAD
    it('Xoá thất bại - Genre đang được sử dụng bởi movie', async () => {
=======
    it('Xoá thất bại - Thể loại đang được sử dụng bởi movie', async () => {
>>>>>>> origin/main
      await record(
        {
          scope: 'All',
          testCase: 'Business: Conflict FK',
<<<<<<< HEAD
          description: 'Xoá genre đang được gắn với 1 movie.',
          procedure: `DELETE /genres/${genreInUseId}`,
          expectedResult: 409,
          preconditions: 'Genre đã được gắn vào movie.',
=======
          description:
            'Gọi hàm xóa với thể loại Hành động đã được giả lập liên kết phim',
          procedure: 'DELETE /genres/ (id Action Genre)',
          expectedResult: 409,
          preconditions:
            'Migration #7 đã insert Phim DELETE-TEST-MOVIE-001 gắn vào Hành động',
>>>>>>> origin/main
        },
        async () => {
          const response = await request(server)
            .delete(`/genres/${genreInUseId}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(409);
<<<<<<< HEAD
          const error = parseApiError(response);
          expectErrorMessage(
            error,
            409,
            'Không thể xoá thể loại đang được sử dụng bởi 1 phim.',
=======
          const resError = parseApiError(response);

          expectErrorMessage(
            resError,
            409,
            `Không thể xoá thể loại đang được sử dụng bởi 1 phim.`,
>>>>>>> origin/main
          );
          return response;
        },
      );
    });
  });

<<<<<<< HEAD
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
=======
  describe('Business Logic Xoá Thành Công', () => {
    it('Xoá thành công - Thể loại tồn tại, Không liên kết phim', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Business: Xoá thành công',
          description:
            'Admin gọi hàm xóa thể loại "Hài kịch" không có phim gắn cản trở',
          procedure: `DELETE /genres/${genreToDeleteId}`,
          expectedResult: 204,
          preconditions: 'Hài kịch chỉ là thể loại trơn',
>>>>>>> origin/main
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

<<<<<<< HEAD
    it('Xoá thất bại - Xoá lại lần 2 cùng ID', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Business: Delete Again',
          description: 'Gọi xoá lần 2 với đúng ID đã xoá.',
          procedure: `DELETE /genres/${genreToDeleteId}`,
          expectedResult: 404,
          preconditions: 'Genre đã bị xoá ở bước trước.',
=======
    it('Xoá thất bại - Xoá lại lần 2 bằng chính ID vừa xoá thành công', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Business: Xoá lại ID đã xoá',
          description:
            'Tiếp tục gọi API Xoá ID vừa nhận mã thành công (204) ở bước trước',
          procedure: `DELETE /genres/${genreToDeleteId}`,
          expectedResult: 404,
          preconditions: 'Hài kịch đã biến mất vĩnh viễn',
>>>>>>> origin/main
        },
        async () => {
          const response = await request(server)
            .delete(`/genres/${genreToDeleteId}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(404);
<<<<<<< HEAD
          const error = parseApiError(response);
          expectErrorMessage(
            error,
=======
          const resError = parseApiError(response);
          expectErrorMessage(
            resError,
>>>>>>> origin/main
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
<<<<<<< HEAD
          testCase: 'Verification: Get Deleted Genre',
          description: 'Xác minh genre đã biến mất.',
          procedure: `GET /genres/${genreToDeleteId}`,
          expectedResult: 404,
          preconditions: 'Genre đã bị xoá.',
=======
          testCase: 'Verification: Get ID',
          description: 'Kiểm tra xem phương thức GET ID vừa xoá có ra số 404',
          procedure: `GET /genres/${genreToDeleteId}`,
          expectedResult: 404,
          preconditions: '',
>>>>>>> origin/main
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

<<<<<<< HEAD
    it('Sau khi xoá thành công - GET /genres không còn chứa genre đó', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Verification: Genre Removed From List',
          description: 'Danh sách genre không còn chứa ID đã xoá.',
          procedure: 'GET /genres',
          expectedResult: 200,
          preconditions: 'Genre đã bị xoá.',
=======
    it('Sau khi xoá thành công - GET list /genres không còn chứa thể loại đó', async () => {
      await record(
        {
          scope: 'All',
          testCase: 'Verification: Get List',
          description:
            'Liệt kê All Categories xem bóng dáng Hài Kịch còn xuất hiện không',
          procedure: `GET /genres`,
          expectedResult: 200,
          preconditions: '',
>>>>>>> origin/main
        },
        async () => {
          const response = await request(server).get('/genres');

          expect(response.status).toBe(200);
          const listGenres = parseApiData<GenreResponseDto[]>(response);
<<<<<<< HEAD
          const exists = listGenres.some(
            (genre) => genre.id === genreToDeleteId,
          );
          expect(exists).toBe(false);
=======

          const isExist = listGenres.some((g) => g.id === genreToDeleteId);
          expect(isExist).toBe(false);
>>>>>>> origin/main

          return response;
        },
      );
    });
  });
});
