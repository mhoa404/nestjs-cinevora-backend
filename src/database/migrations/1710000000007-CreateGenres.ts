import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGenres1710000000007 implements MigrationInterface {
  name = 'CreateGenres1710000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
        ('Hành động', 'hanh-dong'),
        ('Hài kịch', 'hai-kich'),
        ('Tình cảm', 'tinh-cam');
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
