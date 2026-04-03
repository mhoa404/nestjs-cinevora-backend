import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMovies1710000000001 implements MigrationInterface {
  name = 'CreateMovies1710000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`movies\` (
        \`id\`           INT             NOT NULL AUTO_INCREMENT,
        \`slug\`         VARCHAR(255)    UNIQUE,
        \`title\`        VARCHAR(255)    NOT NULL,
        \`poster_url\`   TEXT            NOT NULL,
        \`trailer_url\`  TEXT,
        \`description\`  TEXT,
        \`duration\`     INT             NOT NULL,
        \`director\`     VARCHAR(200),
        \`actor\`        TEXT,
        \`language\`     VARCHAR(50),
        \`age_rating\`   ENUM('P', 'C13', 'C16', 'C18') NOT NULL,
        \`rated\`        VARCHAR(255),
        \`status\`       ENUM('now_showing', 'upcoming', 'ended') NOT NULL DEFAULT 'upcoming',
        \`release_date\` DATE            NOT NULL,
        \`avg_rating\`   DECIMAL(3,1),
        \`created_at\`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \`PK_movies\` PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(
      `CREATE INDEX \`IDX_movies_status\` ON \`movies\`(\`status\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_movies_release_date\` ON \`movies\`(\`release_date\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_movies_age_rating\` ON \`movies\`(\`age_rating\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_movies_age_rating\` ON \`movies\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_movies_release_date\` ON \`movies\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_movies_status\` ON \`movies\``);
    await queryRunner.query(`DROP TABLE \`movies\``);
  }
}
