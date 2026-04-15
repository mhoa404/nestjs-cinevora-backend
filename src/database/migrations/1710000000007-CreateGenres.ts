import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGenres1710000000007 implements MigrationInterface {
  name = 'CreateGenres1710000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─────────────────────────────────────────────
    // 1. TẠO BẢNG genres
    // ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE \`genres\` (
        \`id\`          INT             NOT NULL AUTO_INCREMENT,
        \`name\`        VARCHAR(100)    NOT NULL,
        \`slug\`        VARCHAR(100)    NOT NULL,
        \`created_at\`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \`PK_genres\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`UQ_genres_name\` UNIQUE (\`name\`),
        CONSTRAINT \`UQ_genres_slug\` UNIQUE (\`slug\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ─────────────────────────────────────────────
    // 2. TẠO BẢNG movie_genres (join table)
    // ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE \`movie_genres\` (
        \`movie_id\`    INT             NOT NULL,
        \`genre_id\`    INT             NOT NULL,
        CONSTRAINT \`PK_movie_genres\` PRIMARY KEY (\`movie_id\`, \`genre_id\`),
        CONSTRAINT \`FK_movie_genres_movie\` FOREIGN KEY (\`movie_id\`)
          REFERENCES \`movies\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_movie_genres_genre\` FOREIGN KEY (\`genre_id\`)
          REFERENCES \`genres\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(
      `CREATE INDEX \`IDX_movie_genres_movie_id\` ON \`movie_genres\`(\`movie_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_movie_genres_genre_id\` ON \`movie_genres\`(\`genre_id\`)`,
    );

    await queryRunner.query(`
      INSERT INTO \`genres\` (\`name\`, \`slug\`) VALUES
        ('Hành động',              'hanh-dong'),
        ('Hài kịch',               'hai-kich'),
        ('Tình cảm',               'tinh-cam'),
        ('Tội phạm',               'toi-pham'),
        ('Tâm lý',                 'tam-ly'),
        ('Giật gân',               'giat-gan'),
        ('Khoa học viễn tưởng',    'khoa-hoc-vien-tuong'),
        ('Phiêu lưu',              'phieu-luu'),
        ('Hoạt hình',              'hoat-hinh'),
        ('Gia đình',               'gia-dinh'),
        ('Giả tưởng',              'gia-tuong'),
        ('Quái vật',               'quai-vat'),
        ('Gián điệp',              'gian-diep'),
        ('Chính kịch',             'chinh-kich')
    `);

    await queryRunner.query(`
      INSERT INTO \`movies\` (
        \`slug\`, \`title\`, \`poster_url\`, \`trailer_url\`, \`banner_url\`,
        \`description\`, \`duration\`, \`director\`, \`actor\`,
        \`language\`, \`age_rating\`, \`rated\`, \`status\`,
        \`release_date\`, \`end_date\`
      ) VALUES

      -- 1. Thiên Đường Máu
      (
        'thien-duong-mau',
        'Thiên Đường Máu',
        'https://metiz.vn/media/poster_film/tdm.jpg',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://metiz.vn/media/banner_web/Banner_Web_T%E1%BB%9Bi_Gi%E1%BB%9D_Ch%C6%A1i.jpg',
        'Một vụ án mạng bí ẩn xảy ra trong gia đình giàu có, hé lộ những góc khuất tăm tối của lòng tham và sự phản bội.',
        166,
        'Nguyễn Quang Dũng',
        'Thái Hòa, Thu Trang, Hồng Ánh',
        'Tiếng Việt',
        'C16',
        'C16 - Phim cấm khán giả dưới 16 tuổi',
        'now_showing',
        '2025-03-19',
        '2025-05-30'
      ),

      -- 2. Avatar 3: Lửa và Tro Tàn
      (
        'avatar-3-fire-and-ash',
        'Avatar 3: Lửa và Tro Tàn',
        'https://metiz.vn/media/poster_film/avatar.jpg',
        'https://www.youtube.com/watch?v=a8Gx8wiNbs8',
        'https://metiz.vn/media/banner_web/Banner_Web_M%C3%A1y_v%E1%BA%BF.jpg',
        'Cuộc chiến mới trên hành tinh Pandora bùng nổ khi con người quay trở lại với tham vọng khai thác tàn khốc.',
        166,
        'James Cameron',
        'Sam Worthington, Zoe Saldaña, Sigourney Weaver',
        'Tiếng Anh',
        'C13',
        'C13 - Phim cấm khán giả dưới 13 tuổi',
        'upcoming',
        '2026-02-03',
        NULL
      ),

      -- 3. Ai Thương Ai Mến
      (
        'ai-thuong-ai-men',
        'Ai Thương Ai Mến',
        'https://metiz.vn/media/poster_film/ai_men.jpg',
        'https://www.youtube.com/watch?v=3JWTaaS7LdU',
        'https://metiz.vn/media/banner_web/khuyến_mãi_metiz.jpg',
        'Câu chuyện gia đình nhẹ nhàng, hài hước xoay quanh những mâu thuẫn nhỏ nhưng đầy yêu thương.',
        166,
        'Huỳnh Đông',
        'Lê Khánh, Đại Nghĩa, Puka',
        'Tiếng Việt',
        'P',
        'P - Phim dành cho mọi lứa tuổi',
        'now_showing',
        '2024-01-03',
        '2024-03-03'
      ),

      -- 4. Gia Đình Khủng Long: Mắc Kẹt Kỷ Jura
      (
        'dino-family-jurassic',
        'Gia Đình Khủng Long: Mắc Kẹt Kỷ Jura',
        'https://metiz.vn/media/poster_film/700x1000-dino.jpg',
        'https://www.youtube.com/watch?v=XSjk2eTZ7tY',
        NULL,
        'Gia đình khủng long bị lạc vào kỷ Jura và phải hợp sức để tìm đường trở về nhà.',
        165,
        'Mark Dindal',
        'Lồng tiếng',
        'Lồng tiếng Việt',
        'P',
        'P - Phim dành cho mọi lứa tuổi',
        'now_showing',
        '2024-02-28',
        '2024-04-30'
      ),

      -- 5. Tom and Jerry: Chiếc La Bàn Kỳ Bí
      (
        'tom-jerry-magic-compass',
        'Tom and Jerry: Chiếc La Bàn Kỳ Bí',
        'https://metiz.vn/media/poster_film/tom_GEQ3qx2.jpg',
        'https://www.youtube.com/watch?v=tgbNymZ7vqY',
        NULL,
        'Tom và Jerry bước vào cuộc phiêu lưu kỳ lạ xoay quanh một chiếc la bàn phép thuật.',
        134,
        'Darrell Van Citters',
        'Lồng tiếng',
        'Lồng tiếng Việt',
        'P',
        'P - Phim dành cho mọi lứa tuổi',
        'now_showing',
        '2024-03-15',
        '2024-05-15'
      ),

      -- 6. Đại Thoại Tây Du
      (
        'journey-to-the-west-comedy',
        'Đại Thoại Tây Du',
        'https://metiz.vn/media/poster_film/tdk.jpg',
        'https://www.youtube.com/watch?v=GNXjlSjOPKY',
        NULL,
        'Phiên bản hài hước kinh điển của Tây Du Ký với phong cách đặc trưng của Châu Tinh Trì.',
        94,
        'Lưu Trấn Vỹ',
        'Châu Tinh Trì, Ngô Mạnh Đạt',
        'Tiếng Trung',
        'P',
        'P - Phim dành cho mọi lứa tuổi',
        'now_showing',
        '2024-03-08',
        '2024-05-08'
      ),

      -- 7. Godzilla x Kong: Đế Chế Mới
      (
        'godzilla-x-kong-new-empire',
        'Godzilla x Kong: Đế Chế Mới',
        'https://image.tmdb.org/t/p/w500/2vFuG6bWGyQUzYS9d69E5l85nIz.jpg',
        'https://www.youtube.com/watch?v=lV1OOlGwExM',
        'https://image.tmdb.org/t/p/original/t5zCBSB5xMCEcNqn41nAoB1exCE.jpg',
        'Godzilla và Kong buộc phải liên minh trước mối đe dọa mới có thể hủy diệt toàn bộ thế giới.',
        115,
        'Adam Wingard',
        'Rebecca Hall, Brian Tyree Henry',
        'Tiếng Anh',
        'C13',
        'C13 - Phim cấm khán giả dưới 13 tuổi',
        'now_showing',
        '2024-03-29',
        '2024-05-29'
      ),

      -- 8. Mai
      (
        'mai',
        'Mai',
        'https://metiz.vn/media/poster_film/mai.jpg',
        'https://www.youtube.com/watch?v=ePpPVE-GGJw',
        NULL,
        'Câu chuyện cảm xúc về tình yêu, gia đình và những lựa chọn khó khăn trong cuộc sống.',
        131,
        'Trấn Thành',
        'Phương Anh Đào, Tuấn Trần',
        'Tiếng Việt',
        'C16',
        'C16 - Phim cấm khán giả dưới 16 tuổi',
        'now_showing',
        '2024-02-10',
        '2024-04-20'
      ),

      -- 9. Lạc Phàm Trần
      (
        'lac-pham-tran',
        'Lạc Phàm Trần',
        'https://metiz.vn/media/poster_film/lac_phaqm_tran.jpg',
        'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
        NULL,
        'Một chàng trai vô tình rơi vào chuỗi tình huống dở khóc dở cười giữa đời thường.',
        108,
        'Lý Hải',
        'Song Luân, Kaity Nguyễn',
        'Tiếng Việt',
        'C13',
        'C13 - Phim cấm khán giả dưới 13 tuổi',
        'now_showing',
        '2025-01-19',
        '2025-03-19'
      ),

      -- 10. Nhà Hai Chủ
      (
        'nha-hai-chu',
        'Nhà Hai Chủ',
        'https://metiz.vn/media/poster_film/nha_hai_chu.jpg',
        'https://www.youtube.com/watch?v=y6120QOlsfU',
        NULL,
        'Hai gia đình cùng sở hữu một căn nhà, từ đó nảy sinh hàng loạt tình huống hài hước.',
        110,
        'Nhật Trung',
        'Hồng Vân, Quốc Trường',
        'Tiếng Việt',
        'C13',
        'C13 - Phim cấm khán giả dưới 13 tuổi',
        'now_showing',
        '2024-04-12',
        '2024-06-12'
      ),

      -- 11. Mission: Impossible 8
      (
        'mission-impossible-8',
        'Mission: Impossible 8',
        'https://iguov8nhvyobj.vcdn.cloud/media/catalog/product/cache/1/image/c5f0a1eff4c394a251036189ccddaacd/m/i/mi8_poster_470x700_1.jpg',
        'https://www.youtube.com/watch?v=avz06PDqDbk',
        'https://image.tmdb.org/t/p/original/21pXEEW2YJmVdO7O0YV1I9r5T8q.jpg',
        'Ethan Hunt trở lại trong nhiệm vụ nguy hiểm nhất từ trước đến nay.',
        165,
        'Christopher McQuarrie',
        'Tom Cruise, Hayley Atwell',
        'Tiếng Anh',
        'C13',
        'C13 - Phim cấm khán giả dưới 13 tuổi',
        'upcoming',
        '2025-06-28',
        NULL
      ),

      -- 12. Inside Out 2
      (
        'inside-out-2',
        'Inside Out 2',
        'https://iguov8nhvyobj.vcdn.cloud/media/catalog/product/cache/1/image/c5f0a1eff4c394a251036189ccddaacd/1/0/1080x1350-insideout.jpg',
        'https://www.youtube.com/watch?v=LEjhY15eCx0',
        'https://image.tmdb.org/t/p/original/xg27NrFOB4EEiKoxoOWK8McvKzN.jpg',
        'Riley bước vào tuổi thiếu niên, kéo theo những cảm xúc hoàn toàn mới xuất hiện.',
        100,
        'Kelsey Mann',
        'Amy Poehler, Maya Hawke',
        'Tiếng Anh',
        'P',
        'P - Phim dành cho mọi lứa tuổi',
        'upcoming',
        '2025-06-14',
        NULL
      ),

      -- 13. Transformers One
      (
        'transformers-one',
        'Transformers One',
        'https://iguov8nhvyobj.vcdn.cloud/media/catalog/product/cache/1/image/c5f0a1eff4c394a251036189ccddaacd/t/f/tf1_intl_allspark_dgtl_online_payoff_keyart_vie_470x700.jpg',
        'https://www.youtube.com/watch?v=aRGCFZRVp8Q',
        'https://image.tmdb.org/t/p/original/phkNpE1Y9K4d35j8y5J3NtsDxyh.jpg',
        'Câu chuyện nguồn gốc của Optimus Prime và Megatron.',
        120,
        'Josh Cooley',
        'Chris Hemsworth, Brian Tyree Henry',
        'Tiếng Anh',
        'C13',
        'C13 - Phim cấm khán giả dưới 13 tuổi',
        'upcoming',
        '2025-09-20',
        NULL
      ),

      -- 14. Joker: Folie à Deux
      (
        'joker-folie-a-deux',
        'Joker: Folie à Deux',
        'https://iguov8nhvyobj.vcdn.cloud/media/catalog/product/cache/1/image/c5f0a1eff4c394a251036189ccddaacd/r/s/rsz_poster_payoff_joker_folie_a_deux_5_1_.jpg',
        'https://www.youtube.com/watch?v=_rEA8Bkz334',
        'https://image.tmdb.org/t/p/original/bcM2Tl5Hl0S4HhGj01w4n4Dk0wB.jpg',
        'Joker trở lại với một chương đen tối và điên loạn hơn bao giờ hết.',
        138,
        'Todd Phillips',
        'Joaquin Phoenix, Lady Gaga',
        'Tiếng Anh',
        'C18',
        'C18 - Phim cấm khán giả dưới 18 tuổi',
        'upcoming',
        '2025-10-04',
        NULL
      ),

      -- 15. Batman: The Dark Knight Rises
      (
        'batman-the-dark-knight-rises',
        'Batman: The Dark Knight Rises',
        'https://toomva.com/images/videos/2022/05/ky-si-bong-dem-troi-day-2012--1652094438.jpg',
        'https://www.youtube.com/watch?v=g8evyE9TuYk',
        'https://image.tmdb.org/t/p/original/n2aF1DeAmbaY57R3aEMfW52A2R6.jpg',
        'Tám năm sau cái chết của Harvey Dent, Batman buộc phải quay trở lại khi Gotham bị đe dọa bởi Bane – một kẻ khủng bố tàn bạo với âm mưu hủy diệt toàn bộ thành phố.',
        165,
        'Christopher Nolan',
        'Christian Bale, Tom Hardy, Anne Hathaway',
        'Tiếng Anh',
        'C13',
        'C13 - Phim cấm khán giả dưới 13 tuổi',
        'upcoming',
        '2025-07-20',
        NULL
      )
    `);

    // ─────────────────────────────────────────────
    // 5. SEED BẢNG movie_genres
    //    Dùng subquery để lấy id theo slug/name → tránh hardcode ID
    // ─────────────────────────────────────────────

    // Thiên Đường Máu → Tội phạm, Giật gân, Tâm lý
    await queryRunner.query(`
      INSERT INTO \`movie_genres\` (\`movie_id\`, \`genre_id\`)
      SELECT m.id, g.id FROM \`movies\` m, \`genres\` g
      WHERE m.slug = 'thien-duong-mau' AND g.slug IN ('toi-pham', 'giat-gan', 'tam-ly')
    `);

    // Avatar 3 → Khoa học viễn tưởng, Phiêu lưu, Hành động
    await queryRunner.query(`
      INSERT INTO \`movie_genres\` (\`movie_id\`, \`genre_id\`)
      SELECT m.id, g.id FROM \`movies\` m, \`genres\` g
      WHERE m.slug = 'avatar-3-fire-and-ash' AND g.slug IN ('khoa-hoc-vien-tuong', 'phieu-luu', 'hanh-dong')
    `);

    // Ai Thương Ai Mến → Hài kịch, Gia đình, Tình cảm
    await queryRunner.query(`
      INSERT INTO \`movie_genres\` (\`movie_id\`, \`genre_id\`)
      SELECT m.id, g.id FROM \`movies\` m, \`genres\` g
      WHERE m.slug = 'ai-thuong-ai-men' AND g.slug IN ('hai-kich', 'gia-dinh', 'tinh-cam')
    `);

    // Gia Đình Khủng Long → Hoạt hình, Phiêu lưu, Gia đình
    await queryRunner.query(`
      INSERT INTO \`movie_genres\` (\`movie_id\`, \`genre_id\`)
      SELECT m.id, g.id FROM \`movies\` m, \`genres\` g
      WHERE m.slug = 'dino-family-jurassic' AND g.slug IN ('hoat-hinh', 'phieu-luu', 'gia-dinh')
    `);

    // Tom and Jerry → Hoạt hình, Hài kịch, Phiêu lưu
    await queryRunner.query(`
      INSERT INTO \`movie_genres\` (\`movie_id\`, \`genre_id\`)
      SELECT m.id, g.id FROM \`movies\` m, \`genres\` g
      WHERE m.slug = 'tom-jerry-magic-compass' AND g.slug IN ('hoat-hinh', 'hai-kich', 'phieu-luu')
    `);

    // Đại Thoại Tây Du → Hài kịch, Giả tưởng, Phiêu lưu
    await queryRunner.query(`
      INSERT INTO \`movie_genres\` (\`movie_id\`, \`genre_id\`)
      SELECT m.id, g.id FROM \`movies\` m, \`genres\` g
      WHERE m.slug = 'journey-to-the-west-comedy' AND g.slug IN ('hai-kich', 'gia-tuong', 'phieu-luu')
    `);

    // Godzilla x Kong → Hành động, Khoa học viễn tưởng, Quái vật
    await queryRunner.query(`
      INSERT INTO \`movie_genres\` (\`movie_id\`, \`genre_id\`)
      SELECT m.id, g.id FROM \`movies\` m, \`genres\` g
      WHERE m.slug = 'godzilla-x-kong-new-empire' AND g.slug IN ('hanh-dong', 'khoa-hoc-vien-tuong', 'quai-vat')
    `);

    // Mai → Tình cảm, Tâm lý, Gia đình
    await queryRunner.query(`
      INSERT INTO \`movie_genres\` (\`movie_id\`, \`genre_id\`)
      SELECT m.id, g.id FROM \`movies\` m, \`genres\` g
      WHERE m.slug = 'mai' AND g.slug IN ('tinh-cam', 'tam-ly', 'gia-dinh')
    `);

    // Lạc Phàm Trần → Hài kịch, Tình cảm
    await queryRunner.query(`
      INSERT INTO \`movie_genres\` (\`movie_id\`, \`genre_id\`)
      SELECT m.id, g.id FROM \`movies\` m, \`genres\` g
      WHERE m.slug = 'lac-pham-tran' AND g.slug IN ('hai-kich', 'tinh-cam')
    `);

    // Nhà Hai Chủ → Hài kịch, Gia đình
    await queryRunner.query(`
      INSERT INTO \`movie_genres\` (\`movie_id\`, \`genre_id\`)
      SELECT m.id, g.id FROM \`movies\` m, \`genres\` g
      WHERE m.slug = 'nha-hai-chu' AND g.slug IN ('hai-kich', 'gia-dinh')
    `);

    // Mission: Impossible 8 → Hành động, Gián điệp
    await queryRunner.query(`
      INSERT INTO \`movie_genres\` (\`movie_id\`, \`genre_id\`)
      SELECT m.id, g.id FROM \`movies\` m, \`genres\` g
      WHERE m.slug = 'mission-impossible-8' AND g.slug IN ('hanh-dong', 'gian-diep')
    `);

    // Inside Out 2 → Hoạt hình, Gia đình
    await queryRunner.query(`
      INSERT INTO \`movie_genres\` (\`movie_id\`, \`genre_id\`)
      SELECT m.id, g.id FROM \`movies\` m, \`genres\` g
      WHERE m.slug = 'inside-out-2' AND g.slug IN ('hoat-hinh', 'gia-dinh')
    `);

    // Transformers One → Hoạt hình, Khoa học viễn tưởng
    await queryRunner.query(`
      INSERT INTO \`movie_genres\` (\`movie_id\`, \`genre_id\`)
      SELECT m.id, g.id FROM \`movies\` m, \`genres\` g
      WHERE m.slug = 'transformers-one' AND g.slug IN ('hoat-hinh', 'khoa-hoc-vien-tuong')
    `);

    // Joker: Folie à Deux → Tội phạm, Tâm lý
    await queryRunner.query(`
      INSERT INTO \`movie_genres\` (\`movie_id\`, \`genre_id\`)
      SELECT m.id, g.id FROM \`movies\` m, \`genres\` g
      WHERE m.slug = 'joker-folie-a-deux' AND g.slug IN ('toi-pham', 'tam-ly')
    `);

    // Batman: The Dark Knight Rises → Hành động, Tội phạm, Chính kịch
    await queryRunner.query(`
      INSERT INTO \`movie_genres\` (\`movie_id\`, \`genre_id\`)
      SELECT m.id, g.id FROM \`movies\` m, \`genres\` g
      WHERE m.slug = 'batman-the-dark-knight-rises' AND g.slug IN ('hanh-dong', 'toi-pham', 'chinh-kich')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_movie_genres_genre_id\` ON \`movie_genres\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_movie_genres_movie_id\` ON \`movie_genres\``,
    );
    await queryRunner.query(`DROP TABLE \`movie_genres\``);
    await queryRunner.query(`DROP TABLE \`genres\``);
  }
}
