import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateShowtimes1710000000003 implements MigrationInterface {
  name = 'CreateShowtimes1710000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`showtimes\` (
        \`id\`              INT             NOT NULL AUTO_INCREMENT,
        \`movie_id\`        INT             NOT NULL,
        \`room_id\`         INT             NOT NULL,
        \`start_time\`      DATETIME        NOT NULL,
        \`end_time\`        DATETIME        NOT NULL,
        \`status\`          ENUM('open', 'sold_out') NOT NULL DEFAULT 'open',
        \`price_standard\`  DECIMAL(10,0)   NOT NULL,
        \`price_vip\`       DECIMAL(10,0)   NOT NULL,
        \`price_couple\`    DECIMAL(10,0)   NULL,
        \`created_at\`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`PK_showtimes\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_showtimes_movie\` FOREIGN KEY (\`movie_id\`)
          REFERENCES \`movies\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_showtimes_room\` FOREIGN KEY (\`room_id\`)
          REFERENCES \`rooms\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(
      `CREATE INDEX \`IDX_showtimes_movie_id\` ON \`showtimes\`(\`movie_id\`)`,
    );

    await queryRunner.query(
      `CREATE INDEX \`IDX_showtimes_room_start\` ON \`showtimes\`(\`room_id\`, \`start_time\`)`,
    );

    await queryRunner.query(`
      INSERT INTO \`showtimes\` (
        \`movie_id\`,
        \`room_id\`,
        \`start_time\`,
        \`end_time\`,
        \`status\`,
        \`price_standard\`,
        \`price_vip\`,
        \`price_couple\`
      )
      SELECT
        (SELECT id FROM movies WHERE slug = 'thien-duong-mau' LIMIT 1),
        (SELECT id FROM rooms WHERE name = '01' LIMIT 1),
        '2026-05-01 08:00:00',
        '2026-05-01 10:46:00',
        'open',
        70000,
        85000,
        140000

      UNION ALL
      SELECT
        (SELECT id FROM movies WHERE slug = 'avatar-3-fire-and-ash' LIMIT 1),
        (SELECT id FROM rooms WHERE name = '02' LIMIT 1),
        '2026-05-01 08:30:00',
        '2026-05-01 11:16:00',
        'open',
        90000,
        110000,
        180000

      UNION ALL
      SELECT
        (SELECT id FROM movies WHERE slug = 'ai-thuong-ai-men' LIMIT 1),
        (SELECT id FROM rooms WHERE name = '03' LIMIT 1),
        '2026-05-01 09:00:00',
        '2026-05-01 11:46:00',
        'sold_out',
        65000,
        80000,
        130000

      UNION ALL
      SELECT
        (SELECT id FROM movies WHERE slug = 'dino-family-jurassic' LIMIT 1),
        (SELECT id FROM rooms WHERE name = '04' LIMIT 1),
        '2026-05-01 09:30:00',
        '2026-05-01 12:15:00',
        'open',
        60000,
        75000,
        120000

      UNION ALL
      SELECT
        (SELECT id FROM movies WHERE slug = 'tom-jerry-magic-compass' LIMIT 1),
        (SELECT id FROM rooms WHERE name = '05' LIMIT 1),
        '2026-05-01 10:00:00',
        '2026-05-01 12:14:00',
        'open',
        55000,
        70000,
        110000

      UNION ALL
      SELECT
        (SELECT id FROM movies WHERE slug = 'thien-duong-mau' LIMIT 1),
        (SELECT id FROM rooms WHERE name = '01' LIMIT 1),
        '2026-05-01 11:20:00',
        '2026-05-01 14:06:00',
        'open',
        75000,
        90000,
        150000

      UNION ALL
      SELECT
        (SELECT id FROM movies WHERE slug = 'avatar-3-fire-and-ash' LIMIT 1),
        (SELECT id FROM rooms WHERE name = '02' LIMIT 1),
        '2026-05-01 11:50:00',
        '2026-05-01 14:36:00',
        'sold_out',
        95000,
        115000,
        190000

      UNION ALL
      SELECT
        (SELECT id FROM movies WHERE slug = 'ai-thuong-ai-men' LIMIT 1),
        (SELECT id FROM rooms WHERE name = '03' LIMIT 1),
        '2026-05-01 12:20:00',
        '2026-05-01 15:06:00',
        'open',
        68000,
        82000,
        135000

      UNION ALL
      SELECT
        (SELECT id FROM movies WHERE slug = 'dino-family-jurassic' LIMIT 1),
        (SELECT id FROM rooms WHERE name = '04' LIMIT 1),
        '2026-05-01 12:50:00',
        '2026-05-01 15:35:00',
        'open',
        62000,
        77000,
        125000

      UNION ALL
      SELECT
        (SELECT id FROM movies WHERE slug = 'tom-jerry-magic-compass' LIMIT 1),
        (SELECT id FROM rooms WHERE name = '05' LIMIT 1),
        '2026-05-01 13:20:00',
        '2026-05-01 15:34:00',
        'open',
        58000,
        72000,
        115000
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_showtimes_room_start\` ON \`showtimes\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_showtimes_movie_id\` ON \`showtimes\``,
    );
    await queryRunner.query(`DROP TABLE \`showtimes\``);
  }
}
