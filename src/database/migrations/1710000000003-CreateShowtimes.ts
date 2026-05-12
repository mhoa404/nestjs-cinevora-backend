import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateShowtimes1710000000003 implements MigrationInterface {
  name = 'CreateShowtimes1710000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`showtimes\` (
        \`id\`              INT             NOT NULL AUTO_INCREMENT,
        \`movie_id\`        INT             NOT NULL,
        \`room_id\`         INT             NOT NULL,
        \`start_time\`      DATETIME(3)     NOT NULL,
        \`end_time\`        DATETIME(3)     NOT NULL,
        \`status\`          ENUM('open', 'sold_out') NOT NULL DEFAULT 'open',
        \`price_standard\`  DECIMAL(10,0)   NOT NULL,
        \`price_vip\`       DECIMAL(10,0)   NOT NULL,
        \`price_couple\`    DECIMAL(10,0)   NULL,
        \`created_at\`      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
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
