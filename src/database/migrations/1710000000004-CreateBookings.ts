// src/database/migrations/1710000000004-CreateBookings.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookings1710000000004 implements MigrationInterface {
  name = 'CreateBookings1710000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`bookings\` (
        \`id\`                      INT             NOT NULL AUTO_INCREMENT,
        \`user_id\`                 VARCHAR(36)     NOT NULL,
        \`showtime_id\`             INT             NOT NULL,
        \`ticket_count\`            INT             NOT NULL,
        \`total_price\`             DECIMAL(12,0)   NOT NULL,
        \`booked_at\`               DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`expires_at\`              DATETIME(3)     NOT NULL,
        \`status\`                  ENUM('pending', 'confirmed', 'cancelled', 'expired') NOT NULL DEFAULT 'pending',
        \`snapshot_movie_title\`    VARCHAR(255)    NOT NULL,
        \`snapshot_room_name\`      VARCHAR(20)     NOT NULL,
        \`snapshot_showtime_start\` DATETIME(3)     NOT NULL,
        \`created_at\`              DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`              DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        CONSTRAINT \`PK_bookings\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_bookings_user\` FOREIGN KEY (\`user_id\`)
          REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`FK_bookings_showtime\` FOREIGN KEY (\`showtime_id\`)
          REFERENCES \`showtimes\`(\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(
      `CREATE INDEX \`IDX_bookings_user_id\` ON \`bookings\`(\`user_id\`)`,
    );

    await queryRunner.query(
      `CREATE INDEX \`IDX_bookings_showtime_id\` ON \`bookings\`(\`showtime_id\`)`,
    );

    await queryRunner.query(`
      CREATE INDEX \`IDX_bookings_showtime_status_expires\`
      ON \`bookings\`(\`showtime_id\`, \`status\`, \`expires_at\`)
    `);

    await queryRunner.query(`
      CREATE TABLE \`payments\` (
        \`id\`                INT             NOT NULL AUTO_INCREMENT,
        \`booking_id\`        INT             NOT NULL,
        \`transaction_id\`    VARCHAR(255)    NULL,
        \`payment_method\`    ENUM('momo', 'zalopay', 'vnpay') NOT NULL,
        \`amount\`            DECIMAL(10,0)   NOT NULL,
        \`status\`            ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'pending',
        \`provider_response\` JSON            NULL,
        \`created_at\`        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        CONSTRAINT \`PK_payments\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_payments_booking\` FOREIGN KEY (\`booking_id\`)
          REFERENCES \`bookings\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(
      `CREATE INDEX \`IDX_payments_booking_id\` ON \`payments\`(\`booking_id\`)`,
    );

    await queryRunner.query(`
      CREATE TABLE \`booking_seats\` (
        \`id\`                 INT             NOT NULL AUTO_INCREMENT,
        \`booking_id\`         INT             NOT NULL,
        \`seat_id\`            INT             NOT NULL,
        \`seat_key\`           VARCHAR(10)     NOT NULL,
        \`price\`              DECIMAL(10,0)   NOT NULL,
        \`snapshot_seat_type\` ENUM('standard', 'vip', 'couple') NOT NULL DEFAULT 'standard',
        \`created_at\`         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        CONSTRAINT \`PK_booking_seats\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_booking_seats_booking\` FOREIGN KEY (\`booking_id\`)
          REFERENCES \`bookings\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_booking_seats_seat\` FOREIGN KEY (\`seat_id\`)
          REFERENCES \`seats\`(\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(
      `CREATE INDEX \`IDX_booking_seats_booking_id\` ON \`booking_seats\`(\`booking_id\`)`,
    );

    await queryRunner.query(
      `CREATE INDEX \`IDX_booking_seats_seat_id\` ON \`booking_seats\`(\`seat_id\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_booking_seats_seat_id\` ON \`booking_seats\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_booking_seats_booking_id\` ON \`booking_seats\``,
    );
    await queryRunner.query(`DROP TABLE \`booking_seats\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_payments_booking_id\` ON \`payments\``,
    );
    await queryRunner.query(`DROP TABLE \`payments\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_bookings_showtime_status_expires\` ON \`bookings\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_bookings_showtime_id\` ON \`bookings\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_bookings_user_id\` ON \`bookings\``,
    );
    await queryRunner.query(`DROP TABLE \`bookings\``);
  }
}
