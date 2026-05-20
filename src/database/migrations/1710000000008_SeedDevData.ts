import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

const BUFFER_MINUTES = 30;

interface MovieSeedItem {
  slug: string;
  title: string;
  posterUrl: string;
  trailerUrl: string;
  bannerUrl: string | null;
  description: string;
  duration: number;
  director: string;
  actor: string;
  language: string;
  ageRating: 'P' | 'C13' | 'C16' | 'C18';
  status: 'now_showing' | 'upcoming' | 'ended';
  releaseOffsetDays: number;
  screeningDays: number;
  avgRating: number | null;
  genreSlugs: string[];
}

interface ShowtimeSeedItem {
  movieIndex: number;
  roomName: string;
  dayOffsetAfterRelease: number;
  hour: number;
  minute: number;
  status: 'open' | 'sold_out';
  priceStandard: number;
  priceVip: number;
  priceCouple: number;
}

export class SeedDevData1710000000008 implements MigrationInterface {
  name = 'SeedDevData1710000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const today = this.startOfUtcDate(new Date());
    const adminPassword = await bcrypt.hash('Api_tester_123', 10);
    const clientPassword = await bcrypt.hash('Api_client_123', 10);

    await this.seedDevUsers(queryRunner, adminPassword, clientPassword);
    await this.seedRoomsAndSeats(queryRunner);
    await this.seedMovies(queryRunner, today);
    await this.seedMovieGenres(queryRunner);
    await this.seedShowtimes(queryRunner, today);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE st FROM \`showtimes\` st
      INNER JOIN \`movies\` m ON m.id = st.movie_id
      WHERE m.slug LIKE 'seed-dev-%'
    `);

    await queryRunner.query(`
      DELETE mg FROM \`movie_genre\` mg
      INNER JOIN \`movies\` m ON m.id = mg.movie_id
      WHERE m.slug LIKE 'seed-dev-%'
    `);

    await queryRunner.query(
      `DELETE FROM \`movies\` WHERE \`slug\` LIKE 'seed-dev-%'`,
    );

    await queryRunner.query(`
      DELETE s FROM \`seats\` s
      INNER JOIN \`rooms\` r ON r.id = s.room_id
      WHERE r.name IN ('01', '02', '03', '04', '05')
    `);

    await queryRunner.query(`
      DELETE FROM \`rooms\`
      WHERE \`name\` IN ('01', '02', '03', '04', '05')
    `);

    await queryRunner.query(`
      DELETE FROM \`users\`
      WHERE \`email\` IN ('api_tester@gmail.com', 'api_client@gmail.com')
    `);
  }

  private async seedDevUsers(
    queryRunner: QueryRunner,
    adminPassword: string,
    clientPassword: string,
  ): Promise<void> {
    await queryRunner.query(`
      INSERT IGNORE INTO \`users\` (
        \`full_name\`, \`email\`, \`password\`, \`date_of_birth\`, \`phone\`, \`role\`
      ) VALUES
        ('API Tester', 'api_tester@gmail.com', '${this.escapeSql(adminPassword)}', '2011-11-11', '0369539200', 'admin'),
        ('API Client', 'api_client@gmail.com', '${this.escapeSql(clientPassword)}', '2010-10-10', '0369539201', 'customer')
    `);
  }

  private async seedRoomsAndSeats(queryRunner: QueryRunner): Promise<void> {
    const roomNames = ['01', '02', '03', '04', '05'];
    const rowLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
    const vipRows = new Set(['E', 'F']);

    await queryRunner.query(`
      INSERT IGNORE INTO \`rooms\` (\`name\`) VALUES
      ${roomNames.map((roomName) => `('${roomName}')`).join(',\n      ')}
    `);

    const seatValues = roomNames
      .flatMap((roomName) =>
        rowLabels.flatMap((rowLabel) => {
          const seatType = vipRows.has(rowLabel) ? 'vip' : 'standard';
          return Array.from({ length: 10 }, (_, index) => {
            const seatNumber = index + 1;
            const seatKey = `${rowLabel}${seatNumber}`;
            return `((SELECT \`id\` FROM \`rooms\` WHERE \`name\` = '${roomName}'), '${seatKey}', '${rowLabel}', ${seatNumber}, '${seatType}')`;
          });
        }),
      )
      .join(',\n      ');

    await queryRunner.query(`
      INSERT IGNORE INTO \`seats\` (\`room_id\`, \`seat_key\`, \`row_label\`, \`seat_number\`, \`seat_type\`)
      VALUES
      ${seatValues}
    `);
  }

  private async seedMovies(
    queryRunner: QueryRunner,
    today: Date,
  ): Promise<void> {
    const movieValues = this.getMovieSeeds().map((movie) => {
      const releaseDate = this.addDays(today, movie.releaseOffsetDays);
      const endDate = this.addDays(releaseDate, movie.screeningDays);
      const rated = this.getRatedText(movie.ageRating);
      const avgRatingValue =
        movie.avgRating === null ? 'NULL' : movie.avgRating.toFixed(1);

      return `(
        '${this.escapeSql(movie.slug)}',
        '${this.escapeSql(movie.title)}',
        '${this.escapeSql(movie.posterUrl)}',
        '${this.escapeSql(movie.trailerUrl)}',
        ${this.toSqlNullableString(movie.bannerUrl)},
        '${this.escapeSql(movie.description)}',
        ${movie.duration},
        '${this.escapeSql(movie.director)}',
        '${this.escapeSql(movie.actor)}',
        '${this.escapeSql(movie.language)}',
        '${movie.ageRating}',
        '${this.escapeSql(rated)}',
        '${movie.status}',
        '${this.toDateOnly(releaseDate)}',
        '${this.toDateOnly(endDate)}',
        ${avgRatingValue}
      )`;
    });

    await queryRunner.query(`
      INSERT IGNORE INTO \`movies\` (
        \`slug\`, \`title\`, \`poster_url\`, \`trailer_url\`, \`banner_url\`,
        \`description\`, \`duration\`, \`director\`, \`actor\`, \`language\`,
        \`age_rating\`, \`rated\`, \`status\`, \`release_date\`, \`end_date\`, \`avg_rating\`
      ) VALUES
      ${movieValues.join(',\n')}
    `);
  }

  private async seedMovieGenres(queryRunner: QueryRunner): Promise<void> {
    for (const movie of this.getMovieSeeds()) {
      const genreList = movie.genreSlugs
        .map((slug) => `'${this.escapeSql(slug)}'`)
        .join(', ');

      await queryRunner.query(`
        INSERT IGNORE INTO \`movie_genre\` (\`movie_id\`, \`genre_id\`)
        SELECT m.id, g.id
        FROM \`movies\` m
        INNER JOIN \`genres\` g ON g.slug IN (${genreList})
        WHERE m.slug = '${this.escapeSql(movie.slug)}'
      `);
    }
  }

  private async seedShowtimes(
    queryRunner: QueryRunner,
    today: Date,
  ): Promise<void> {
    const movies = this.getMovieSeeds();

    const preparedShowtimes = this.getShowtimeSeeds().map((showtime) => {
      const movie = movies[showtime.movieIndex];
      const releaseDate = this.addDays(today, movie.releaseOffsetDays);
      const startTime = this.withUtcTime(
        this.addDays(releaseDate, showtime.dayOffsetAfterRelease),
        showtime.hour,
        showtime.minute,
      );
      const endTime = this.addMinutes(startTime, movie.duration);

      return {
        showtime,
        movie,
        roomName: showtime.roomName,
        startTime,
        endTime,
      };
    });

    this.assertNoBufferConflicts(preparedShowtimes);

    for (const { showtime, movie, startTime, endTime } of preparedShowtimes) {
      await queryRunner.query(`
        INSERT INTO \`showtimes\` (
          \`movie_id\`, \`room_id\`, \`start_time\`, \`end_time\`,
          \`status\`, \`price_standard\`, \`price_vip\`, \`price_couple\`
        )
        SELECT m.id, r.id,
          '${this.toMysqlDateTime(startTime)}',
          '${this.toMysqlDateTime(endTime)}',
          '${showtime.status}',
          ${showtime.priceStandard},
          ${showtime.priceVip},
          ${showtime.priceCouple}
        FROM \`movies\` m
        INNER JOIN \`rooms\` r ON r.name = '${showtime.roomName}'
        WHERE m.slug = '${this.escapeSql(movie.slug)}'
      `);
    }
  }

  private assertNoBufferConflicts(
    items: Array<{ roomName: string; startTime: Date; endTime: Date }>,
  ): void {
    const windowsByRoom = new Map<
      string,
      Array<{ startTime: Date; endTime: Date }>
    >();

    for (const item of items) {
      const windows = windowsByRoom.get(item.roomName) ?? [];
      windows.push({ startTime: item.startTime, endTime: item.endTime });
      windowsByRoom.set(item.roomName, windows);
    }

    for (const [roomName, windows] of windowsByRoom.entries()) {
      const orderedWindows = windows.sort(
        (current, next) =>
          current.startTime.getTime() - next.startTime.getTime(),
      );

      for (let index = 1; index < orderedWindows.length; index += 1) {
        const previous = orderedWindows[index - 1];
        const current = orderedWindows[index];
        const previousEndWithBuffer = this.addMinutes(
          previous.endTime,
          BUFFER_MINUTES,
        );

        if (current.startTime < previousEndWithBuffer) {
          throw new Error(
            `Seed showtimes bị trùng phòng ${roomName}: ${current.startTime.toISOString()}`,
          );
        }
      }
    }
  }

  private getShowtimeSeeds(): ShowtimeSeedItem[] {
    // 10 suất chiếu này chỉ dùng cho 10 phim đang chiếu tại rạp.
    // movieIndex 0 -> 9 tương ứng với 10 phim có status = 'now_showing'.
    //
    // Vì 10 phim now_showing có releaseOffsetDays lần lượt từ -1 đến -10,
    // nên dayOffsetAfterRelease được set để start_time luôn nằm ở tương lai.
    //
    // end_time sẽ được tính tự động ở seedShowtimes():
    //   end_time = start_time + movie.duration
    //
    // Buffer 30 phút vẫn được kiểm tra trong assertNoBufferConflicts().
    return [
      {
        movieIndex: 0,
        roomName: '01',
        dayOffsetAfterRelease: 2,
        hour: 9,
        minute: 0,
        status: 'open',
        priceStandard: 70000,
        priceVip: 85000,
        priceCouple: 140000,
      },
      {
        movieIndex: 1,
        roomName: '02',
        dayOffsetAfterRelease: 3,
        hour: 10,
        minute: 0,
        status: 'open',
        priceStandard: 70000,
        priceVip: 85000,
        priceCouple: 140000,
      },
      {
        movieIndex: 2,
        roomName: '03',
        dayOffsetAfterRelease: 4,
        hour: 9,
        minute: 30,
        status: 'open',
        priceStandard: 75000,
        priceVip: 90000,
        priceCouple: 150000,
      },
      {
        movieIndex: 3,
        roomName: '04',
        dayOffsetAfterRelease: 5,
        hour: 12,
        minute: 30,
        status: 'open',
        priceStandard: 75000,
        priceVip: 90000,
        priceCouple: 150000,
      },
      {
        movieIndex: 4,
        roomName: '05',
        dayOffsetAfterRelease: 6,
        hour: 18,
        minute: 30,
        status: 'open',
        priceStandard: 80000,
        priceVip: 95000,
        priceCouple: 160000,
      },
      {
        movieIndex: 5,
        roomName: '01',
        dayOffsetAfterRelease: 7,
        hour: 13,
        minute: 0,
        status: 'open',
        priceStandard: 80000,
        priceVip: 95000,
        priceCouple: 160000,
      },
      {
        movieIndex: 6,
        roomName: '02',
        dayOffsetAfterRelease: 8,
        hour: 14,
        minute: 30,
        status: 'open',
        priceStandard: 85000,
        priceVip: 100000,
        priceCouple: 170000,
      },
      {
        movieIndex: 7,
        roomName: '03',
        dayOffsetAfterRelease: 9,
        hour: 16,
        minute: 0,
        status: 'open',
        priceStandard: 85000,
        priceVip: 100000,
        priceCouple: 170000,
      },
      {
        movieIndex: 8,
        roomName: '04',
        dayOffsetAfterRelease: 10,
        hour: 18,
        minute: 45,
        status: 'open',
        priceStandard: 90000,
        priceVip: 105000,
        priceCouple: 180000,
      },
      {
        movieIndex: 9,
        roomName: '05',
        dayOffsetAfterRelease: 11,
        hour: 22,
        minute: 30,
        status: 'open',
        priceStandard: 90000,
        priceVip: 105000,
        priceCouple: 180000,
      },
    ];
  }

  private getMovieSeeds(): MovieSeedItem[] {
    // 20 phim dev: 10 now_showing, 5 upcoming, 5 ended.
    // Nhóm now_showing có release_date từ hôm qua trở về vài ngày trước
    // và end_date còn khoảng 1 tháng sau ngày chạy seed.
    return [
      // NOW SHOWING
      {
        slug: 'seed-dev-bong-dem-sai-gon',
        title: 'Bóng Đêm Sài Gòn',
        posterUrl: 'https://picsum.photos/seed/bong-dem-sai-gon/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        bannerUrl:
          'https://picsum.photos/seed/bong-dem-sai-gon-banner/1600/600',
        description:
          'Một điều tra viên lần theo chuỗi manh mối trong thành phố không ngủ.',
        duration: 118,
        director: 'Nguyễn Minh Khoa',
        actor: 'Trần Bảo Sơn, Khả Ngân, Hứa Vĩ Văn',
        language: 'Tiếng Việt',
        ageRating: 'C16',
        status: 'now_showing',
        releaseOffsetDays: -1,
        screeningDays: 31,
        avgRating: null,
        genreSlugs: ['toi-pham', 'giat-gan', 'tam-ly'],
      },
      {
        slug: 'seed-dev-ngay-mai-ruc-ro',
        title: 'Ngày Mai Rực Rỡ',
        posterUrl: 'https://picsum.photos/seed/ngay-mai-ruc-ro/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=ysz5S6PUM-U',
        bannerUrl: 'https://picsum.photos/seed/ngay-mai-ruc-ro-banner/1600/600',
        description:
          'Một nhóm bạn trẻ cùng vượt qua biến cố để tìm lại ước mơ.',
        duration: 105,
        director: 'Lê Hoàng Nam',
        actor: 'Jun Phạm, Hoàng Yến Chibi, Lâm Vỹ Dạ',
        language: 'Tiếng Việt',
        ageRating: 'P',
        status: 'now_showing',
        releaseOffsetDays: -2,
        screeningDays: 32,
        avgRating: null,
        genreSlugs: ['gia-dinh', 'hai-kich', 'tinh-cam'],
      },
      {
        slug: 'seed-dev-hanh-tinh-bang-gia',
        title: 'Hành Tinh Băng Giá',
        posterUrl: 'https://picsum.photos/seed/hanh-tinh-bang-gia/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
        bannerUrl:
          'https://picsum.photos/seed/hanh-tinh-bang-gia-banner/1600/600',
        description:
          'Đội thám hiểm mắc kẹt trên hành tinh băng giá và phải gửi tín hiệu cầu cứu.',
        duration: 132,
        director: 'Victor Lâm',
        actor: 'Minh Tiệp, Diễm My, Quốc Trường',
        language: 'Tiếng Anh',
        ageRating: 'C13',
        status: 'now_showing',
        releaseOffsetDays: -3,
        screeningDays: 33,
        avgRating: null,
        genreSlugs: ['khoa-hoc-vien-tuong', 'phieu-luu', 'hanh-dong'],
      },
      {
        slug: 'seed-dev-chuyen-tau-cuoi-cung',
        title: 'Chuyến Tàu Cuối Cùng',
        posterUrl: 'https://picsum.photos/seed/chuyen-tau-cuoi-cung/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=oHg5SJYRHA0',
        bannerUrl:
          'https://picsum.photos/seed/chuyen-tau-cuoi-cung-banner/1600/600',
        description:
          'Một chuyến tàu đêm đưa các hành khách bước vào cuộc truy đuổi nghẹt thở.',
        duration: 124,
        director: 'Phạm Gia Hưng',
        actor: 'Liên Bỉnh Phát, Kaity Nguyễn, Thái Hòa',
        language: 'Tiếng Việt',
        ageRating: 'C16',
        status: 'now_showing',
        releaseOffsetDays: -4,
        screeningDays: 34,
        avgRating: null,
        genreSlugs: ['hanh-dong', 'giat-gan'],
      },
      {
        slug: 'seed-dev-khu-vuon-ky-uc',
        title: 'Khu Vườn Ký Ức',
        posterUrl: 'https://picsum.photos/seed/khu-vuon-ky-uc/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        bannerUrl: 'https://picsum.photos/seed/khu-vuon-ky-uc-banner/1600/600',
        description:
          'Một cô gái trở về quê nhà và tìm thấy bí mật gia đình trong khu vườn cũ.',
        duration: 99,
        director: 'Đỗ An Nhiên',
        actor: 'Miu Lê, Hồng Ánh, Công Ninh',
        language: 'Tiếng Việt',
        ageRating: 'P',
        status: 'now_showing',
        releaseOffsetDays: -5,
        screeningDays: 35,
        avgRating: null,
        genreSlugs: ['gia-dinh', 'tinh-cam', 'tam-ly'],
      },
      {
        slug: 'seed-dev-mat-ma-dai-duong',
        title: 'Mật Mã Đại Dương',
        posterUrl: 'https://picsum.photos/seed/mat-ma-dai-duong/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=ScMzIvxBSi4',
        bannerUrl:
          'https://picsum.photos/seed/mat-ma-dai-duong-banner/1600/600',
        description:
          'Một bản đồ cổ dẫn nhóm thợ lặn đến bí mật bị chôn vùi dưới đáy biển.',
        duration: 141,
        director: 'Adam Vũ',
        actor: 'Johnny Trí Nguyễn, Ngô Thanh Vân, Bình Minh',
        language: 'Tiếng Anh',
        ageRating: 'C13',
        status: 'now_showing',
        releaseOffsetDays: -6,
        screeningDays: 36,
        avgRating: null,
        genreSlugs: ['phieu-luu', 'hanh-dong'],
      },
      {
        slug: 'seed-dev-robot-nho-va-mua-he',
        title: 'Robot Nhỏ Và Mùa Hè',
        posterUrl: 'https://picsum.photos/seed/robot-nho-va-mua-he/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=2Vv-BfVoq4g',
        bannerUrl:
          'https://picsum.photos/seed/robot-nho-va-mua-he-banner/1600/600',
        description:
          'Một chú robot lạc vào thị trấn ven biển và kết bạn với nhóm trẻ tinh nghịch.',
        duration: 94,
        director: 'Mai Anh Đức',
        actor: 'Lồng tiếng Việt',
        language: 'Lồng tiếng Việt',
        ageRating: 'P',
        status: 'now_showing',
        releaseOffsetDays: -7,
        screeningDays: 37,
        avgRating: null,
        genreSlugs: ['hoat-hinh', 'gia-dinh', 'hai-kich'],
      },
      {
        slug: 'seed-dev-loi-thi-tham-tren-nui',
        title: 'Lời Thì Thầm Trên Núi',
        posterUrl: 'https://picsum.photos/seed/loi-thi-tham-tren-nui/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
        bannerUrl:
          'https://picsum.photos/seed/loi-thi-tham-tren-nui-banner/1600/600',
        description:
          'Một nhà báo điều tra những tiếng động lạ xuất hiện ở ngôi làng miền núi.',
        duration: 111,
        director: 'Trần Duy Linh',
        actor: 'Quang Tuấn, Oanh Kiều, NSƯT Hữu Châu',
        language: 'Tiếng Việt',
        ageRating: 'C18',
        status: 'now_showing',
        releaseOffsetDays: -8,
        screeningDays: 38,
        avgRating: null,
        genreSlugs: ['giat-gan', 'tam-ly'],
      },
      {
        slug: 'seed-dev-cuoc-dua-anh-sang',
        title: 'Cuộc Đua Ánh Sáng',
        posterUrl: 'https://picsum.photos/seed/cuoc-dua-anh-sang/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
        bannerUrl:
          'https://picsum.photos/seed/cuoc-dua-anh-sang-banner/1600/600',
        description:
          'Các tay đua công nghệ cạnh tranh trong giải đấu tốc độ bằng xe năng lượng mới.',
        duration: 116,
        director: 'Kenji Phan',
        actor: 'Song Luân, Isaac, Diễm My 9x',
        language: 'Tiếng Việt',
        ageRating: 'C13',
        status: 'now_showing',
        releaseOffsetDays: -9,
        screeningDays: 39,
        avgRating: null,
        genreSlugs: ['hanh-dong', 'khoa-hoc-vien-tuong'],
      },
      {
        slug: 'seed-dev-hon-dao-khong-ten',
        title: 'Hòn Đảo Không Tên',
        posterUrl: 'https://picsum.photos/seed/hon-dao-khong-ten/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=fRh_vgS2dFE',
        bannerUrl:
          'https://picsum.photos/seed/hon-dao-khong-ten-banner/1600/600',
        description:
          'Một đoàn làm phim mắc kẹt trên hòn đảo bí ẩn sau cơn bão lớn.',
        duration: 127,
        director: 'Võ Thanh Hòa',
        actor: 'Kiều Minh Tuấn, Thu Trang, Tiến Luật',
        language: 'Tiếng Việt',
        ageRating: 'C16',
        status: 'now_showing',
        releaseOffsetDays: -10,
        screeningDays: 40,
        avgRating: null,
        genreSlugs: ['phieu-luu', 'giat-gan'],
      },
      // UPCOMING
      {
        slug: 'seed-dev-ca-phe-nua-dem',
        title: 'Cà Phê Nửa Đêm',
        posterUrl: 'https://picsum.photos/seed/ca-phe-nua-dem/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=RgKAFK5djSk',
        bannerUrl: 'https://picsum.photos/seed/ca-phe-nua-dem-banner/1600/600',
        description:
          'Những câu chuyện tình yêu giao nhau trong một quán cà phê mở cửa lúc nửa đêm.',
        duration: 102,
        director: 'Lý Minh Thắng',
        actor: 'Ninh Dương Lan Ngọc, Bình An, Puka',
        language: 'Tiếng Việt',
        ageRating: 'P',
        status: 'upcoming',
        releaseOffsetDays: 10,
        screeningDays: 36,
        avgRating: null,
        genreSlugs: ['tinh-cam', 'hai-kich'],
      },
      {
        slug: 'seed-dev-thanh-pho-duoi-long-dat',
        title: 'Thành Phố Dưới Lòng Đất',
        posterUrl:
          'https://picsum.photos/seed/thanh-pho-duoi-long-dat/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=60ItHLz5WEA',
        bannerUrl:
          'https://picsum.photos/seed/thanh-pho-duoi-long-dat-banner/1600/600',
        description:
          'Một nhóm kỹ sư phát hiện nền văn minh cổ dưới hệ thống metro đang xây dựng.',
        duration: 136,
        director: 'Christopher Vũ',
        actor: 'Trương Ngọc Ánh, Hồng Đăng, Kim Lý',
        language: 'Tiếng Anh',
        ageRating: 'C13',
        status: 'upcoming',
        releaseOffsetDays: 11,
        screeningDays: 58,
        avgRating: null,
        genreSlugs: ['gia-tuong', 'phieu-luu', 'khoa-hoc-vien-tuong'],
      },
      {
        slug: 'seed-dev-diep-vien-mua-mua',
        title: 'Điệp Viên Mùa Mưa',
        posterUrl: 'https://picsum.photos/seed/diep-vien-mua-mua/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=hT_nvWreIhg',
        bannerUrl:
          'https://picsum.photos/seed/diep-vien-mua-mua-banner/1600/600',
        description:
          'Một điệp viên về hưu buộc phải tái xuất khi hồ sơ mật bị đánh cắp.',
        duration: 121,
        director: 'Lương Đình Dũng',
        actor: 'Hứa Vĩ Văn, Kim Tuyến, Mạc Văn Khoa',
        language: 'Tiếng Việt',
        ageRating: 'C16',
        status: 'upcoming',
        releaseOffsetDays: 12,
        screeningDays: 44,
        avgRating: null,
        genreSlugs: ['gian-diep', 'hanh-dong'],
      },
      {
        slug: 'seed-dev-cong-vien-quai-vat',
        title: 'Công Viên Quái Vật',
        posterUrl: 'https://picsum.photos/seed/cong-vien-quai-vat/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=09R8_2nJtjg',
        bannerUrl:
          'https://picsum.photos/seed/cong-vien-quai-vat-banner/1600/600',
        description:
          'Một công viên giải trí bỏ hoang bỗng trở thành nơi trú ngụ của sinh vật lạ.',
        duration: 109,
        director: 'Jordan Nguyễn',
        actor: 'Quốc Anh, Jun Vũ, La Thành',
        language: 'Tiếng Anh',
        ageRating: 'C16',
        status: 'upcoming',
        releaseOffsetDays: 13,
        screeningDays: 39,
        avgRating: null,
        genreSlugs: ['quai-vat', 'giat-gan'],
      },
      {
        slug: 'seed-dev-buc-thu-tu-tuong-lai',
        title: 'Bức Thư Từ Tương Lai',
        posterUrl: 'https://picsum.photos/seed/buc-thu-tu-tuong-lai/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=OPf0YbXqDm0',
        bannerUrl:
          'https://picsum.photos/seed/buc-thu-tu-tuong-lai-banner/1600/600',
        description:
          'Một cậu bé nhận được bức thư từ chính mình ở tương lai và thay đổi số phận gia đình.',
        duration: 113,
        director: 'Nguyễn Phan Quang Bình',
        actor: 'Trọng Khang, Thanh Mỹ, Hồng Đào',
        language: 'Tiếng Việt',
        ageRating: 'P',
        status: 'upcoming',
        releaseOffsetDays: 14,
        screeningDays: 52,
        avgRating: null,
        genreSlugs: ['gia-dinh', 'gia-tuong', 'tam-ly'],
      },
      // ENDED
      {
        slug: 'seed-dev-nhung-ngay-da-qua',
        title: 'Những Ngày Đã Qua',
        posterUrl: 'https://picsum.photos/seed/nhung-ngay-da-qua/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=CevxZvSJLk8',
        bannerUrl:
          'https://picsum.photos/seed/nhung-ngay-da-qua-banner/1600/600',
        description:
          'Một gia đình nhìn lại mùa hè cuối cùng trước khi mỗi người rẽ sang hướng khác.',
        duration: 108,
        director: 'Vũ Ngọc Đãng',
        actor: 'Hồng Ánh, Lan Phương, Nhan Phúc Vinh',
        language: 'Tiếng Việt',
        ageRating: 'P',
        status: 'ended',
        releaseOffsetDays: -90,
        screeningDays: 35,
        avgRating: 7.8,
        genreSlugs: ['gia-dinh', 'tam-ly'],
      },
      {
        slug: 'seed-dev-bien-vang-im-lang',
        title: 'Biển Vắng Im Lặng',
        posterUrl: 'https://picsum.photos/seed/bien-vang-im-lang/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=YQHsXMglC9A',
        bannerUrl:
          'https://picsum.photos/seed/bien-vang-im-lang-banner/1600/600',
        description:
          'Một vụ mất tích tại làng chài kéo theo bí mật bị che giấu suốt nhiều năm.',
        duration: 119,
        director: 'Bùi Thạc Chuyên',
        actor: 'Thái Hòa, Đinh Ngọc Diệp, Quách Ngọc Ngoan',
        language: 'Tiếng Việt',
        ageRating: 'C16',
        status: 'ended',
        releaseOffsetDays: -82,
        screeningDays: 40,
        avgRating: 8.1,
        genreSlugs: ['toi-pham', 'giat-gan'],
      },
      {
        slug: 'seed-dev-mua-hoa-cu',
        title: 'Mùa Hoa Cũ',
        posterUrl: 'https://picsum.photos/seed/mua-hoa-cu/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=JGwWNGJdvx8',
        bannerUrl: 'https://picsum.photos/seed/mua-hoa-cu-banner/1600/600',
        description:
          'Hai người bạn cũ gặp lại nhau khi thành phố bước vào mùa hoa cuối năm.',
        duration: 97,
        director: 'Nguyễn Quang Dũng',
        actor: 'Phương Anh Đào, Tuấn Trần, Lê Giang',
        language: 'Tiếng Việt',
        ageRating: 'P',
        status: 'ended',
        releaseOffsetDays: -74,
        screeningDays: 45,
        avgRating: 7.4,
        genreSlugs: ['tinh-cam', 'tam-ly'],
      },
      {
        slug: 'seed-dev-vet-nut-thoi-gian',
        title: 'Vết Nứt Thời Gian',
        posterUrl: 'https://picsum.photos/seed/vet-nut-thoi-gian/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=uelHwf8o7_U',
        bannerUrl:
          'https://picsum.photos/seed/vet-nut-thoi-gian-banner/1600/600',
        description:
          'Một nhà vật lý phát hiện cánh cổng thời gian trong phòng thí nghiệm bỏ hoang.',
        duration: 130,
        director: 'Lê Văn Kiệt',
        actor: 'Ngô Kiến Huy, Maya, Hoàng Phi',
        language: 'Tiếng Việt',
        ageRating: 'C13',
        status: 'ended',
        releaseOffsetDays: -66,
        screeningDays: 50,
        avgRating: 8.0,
        genreSlugs: ['khoa-hoc-vien-tuong', 'gia-tuong'],
      },
      {
        slug: 'seed-dev-dem-hoi-cuoi-cung',
        title: 'Đêm Hội Cuối Cùng',
        posterUrl: 'https://picsum.photos/seed/dem-hoi-cuoi-cung/700/1000',
        trailerUrl: 'https://www.youtube.com/watch?v=KQ6zr6kCPj8',
        bannerUrl:
          'https://picsum.photos/seed/dem-hoi-cuoi-cung-banner/1600/600',
        description:
          'Một nhóm học sinh tổ chức đêm hội chia tay và vô tình vướng vào rắc rối lớn.',
        duration: 101,
        director: 'Charlie Nguyễn',
        actor: 'Mạc Văn Khoa, Puka, BB Trần',
        language: 'Tiếng Việt',
        ageRating: 'C13',
        status: 'ended',
        releaseOffsetDays: -58,
        screeningDays: 32,
        avgRating: 7.2,
        genreSlugs: ['hai-kich', 'gia-dinh'],
      },
    ];
  }

  private getRatedText(ageRating: MovieSeedItem['ageRating']): string {
    const ratedMap: Record<MovieSeedItem['ageRating'], string> = {
      P: 'P - Phim dành cho mọi lứa tuổi',
      C13: 'C13 - Phim cấm khán giả dưới 13 tuổi',
      C16: 'C16 - Phim cấm khán giả dưới 16 tuổi',
      C18: 'C18 - Phim cấm khán giả dưới 18 tuổi',
    };
    return ratedMap[ageRating];
  }

  private startOfUtcDate(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private addDays(date: Date, days: number): Date {
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate;
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  private withUtcTime(date: Date, hour: number, minute: number): Date {
    const result = new Date(date);
    result.setUTCHours(hour, minute, 0, 0);
    return result;
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toMysqlDateTime(date: Date): string {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }

  private toSqlNullableString(value: string | null): string {
    if (value === null) {
      return 'NULL';
    }
    return `'${this.escapeSql(value)}'`;
  }

  private escapeSql(value: string): string {
    return value.replace(/'/g, "''");
  }
}
