import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGenres1710000000007 implements MigrationInterface {
  name = 'CreateGenres1710000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`genres\` (
        \`id\`          INT             NOT NULL AUTO_INCREMENT,
        \`name\`        VARCHAR(100)    NOT NULL,
        \`slug\`        VARCHAR(100)    NOT NULL,
        \`created_at\`  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        CONSTRAINT \`PK_genres\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`UQ_genres_name\` UNIQUE (\`name\`),
        CONSTRAINT \`UQ_genres_slug\` UNIQUE (\`slug\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`movie_genre\` (
        \`movie_id\`    INT             NOT NULL,
        \`genre_id\`    INT             NOT NULL,
        CONSTRAINT \`PK_movie_genre\` PRIMARY KEY (\`movie_id\`, \`genre_id\`),
        CONSTRAINT \`FK_movie_genres_movi\` FOREIGN KEY (\`movie_id\`)
          REFERENCES \`movies\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_movie_genres_genr\` FOREIGN KEY (\`genre_id\`)
          REFERENCES \`genres\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(
      `CREATE INDEX \`IDX_movie_genre_movie_id\` ON \`movie_genre\`(\`movie_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_movie_genre_genre_id\` ON \`movie_genre\`(\`genre_id\`)`,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_movie_genre_genre_id\` ON \`movie_genre\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_movie_genre_movie_id\` ON \`movie_genre\``,
    );
    await queryRunner.query(`DROP TABLE \`movie_genre\``);
    await queryRunner.query(`DROP TABLE \`genres\``);
  }
}
