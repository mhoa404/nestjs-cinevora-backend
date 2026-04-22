# FILE: src/database/migrations/1710000000002-CreateCinemasRoomsSeats.ts

path: src/database/migrations/1710000000002-CreateCinemasRoomsSeats.ts
module: database
kind: migration
language: ts
line_count: 39
size_bytes: 1780
sha256: 7fc74f0d32d9b0e66156836696f514d8990871025eb06bb04217edb7ab66e5d9
updated_at: 2026-04-15T15:01:57.991Z

## SYMBOLS
- CreateCinemasRoomsSeats1710000000002

## CODE

````ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCinemasRoomsSeats1710000000002 implements MigrationInterface {
  name = 'CreateCinemasRoomsSeats1710000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`rooms\` (
        \`id\`          INT             NOT NULL AUTO_INCREMENT,
        \`name\`        VARCHAR(20)     NOT NULL,
        \`room_type\`   ENUM('2D', '3D', 'IMAX', '4DX') NOT NULL DEFAULT '2D',
        \`created_at\`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`PK_rooms\` PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`seats\` (
        \`id\`          INT             NOT NULL AUTO_INCREMENT,
        \`room_id\`     INT             NOT NULL,
        \`seat_key\`    VARCHAR(10)     NOT NULL,
        \`row_label\`   VARCHAR(10)     NOT NULL,
        \`seat_number\` INT             NOT NULL,
        \`seat_type\`   ENUM('standard', 'vip', 'premium', 'couple') NOT NULL DEFAULT 'standard',
        \`is_active\`   TINYINT(1)      NOT NULL DEFAULT 1,
        CONSTRAINT \`PK_seats\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_seats_room\` FOREIGN KEY (\`room_id\`)
          REFERENCES \`rooms\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`seats\``);
    await queryRunner.query(`DROP TABLE \`rooms\``);
  }
}

````
