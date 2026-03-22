import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMovies1710000000001 implements MigrationInterface {
    name = 'CreateMovies1710000000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`movies\` (
                \`id\`           VARCHAR(100)    NOT NULL,
                \`title\`        VARCHAR(255)    NOT NULL,
                \`poster_url\`   TEXT            NOT NULL,
                \`trailer_url\`  TEXT,
                \`description\`  TEXT,
                \`duration\`     INT             NOT NULL,
                \`genre\`        VARCHAR(255),
                \`director\`     VARCHAR(200),
                \`actor\`        TEXT,
                \`language\`     VARCHAR(50),
                \`age_rating\`   ENUM('P', 'C13', 'C16', 'C18') NOT NULL,
                \`rated\`        VARCHAR(100),
                \`is_upcoming\`  TINYINT(1)      NOT NULL DEFAULT 0,
                \`release_date\` DATE            NOT NULL,
                \`avg_rating\`   DECIMAL(3,1),
                \`created_at\`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT \`PK_movies\` PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`movies\``);
    }
}
