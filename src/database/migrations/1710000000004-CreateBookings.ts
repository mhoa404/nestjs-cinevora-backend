import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookings1710000000004 implements MigrationInterface {
  name = 'CreateBookings1710000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE \`bookings\` (
                \`id\`              INT             NOT NULL AUTO_INCREMENT,
                \`user_id\`         VARCHAR(36)     NOT NULL,
                \`showtime_id\`     INT             NOT NULL,
                \`ticket_count\`    INT             NOT NULL,
                \`total_price\`     DECIMAL(12,0)   NOT NULL,
                \`payment_method\`  ENUM('cash', 'momo', 'zalopay', 'credit_card'),
                \`booked_at\`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`status\`          ENUM('pending', 'confirmed', 'cancelled', 'used') NOT NULL DEFAULT 'pending',
                \`snapshot_movie_title\` VARCHAR(255) NOT NULL,
                \`snapshot_cinema_name\` VARCHAR(100) NOT NULL,
                \`snapshot_room_name\` VARCHAR(20) NOT NULL,
                \`snapshot_showtime_start\` TIMESTAMP NOT NULL,
                \`created_at\`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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

    await queryRunner.query(`
            CREATE TABLE \`booking_seats\` (
                \`id\`          INT             NOT NULL AUTO_INCREMENT,
                \`booking_id\`  INT             NOT NULL,
                \`seat_id\`     INT             NOT NULL,
                \`seat_key\`    VARCHAR(10)     NOT NULL,
                \`price\`       DECIMAL(10,0)   NOT NULL,
                \`snapshot_seat_type\` ENUM('standard', 'vip', 'couple') NOT NULL DEFAULT 'standard',
                \`created_a\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
      `DROP INDEX \`IDX_bookings_user_id\` ON \`bookings\``,
    );
    await queryRunner.query(`DROP TABLE \`bookings\``);
  }
}
