import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSchemaToMatchERD1776829727986 implements MigrationInterface {
  name = 'UpdateSchemaToMatchERD1776829727986';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`booking_seats\` DROP FOREIGN KEY \`FK_booking_seats_booking\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`booking_seats\` DROP FOREIGN KEY \`FK_booking_seats_seat\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`seats\` DROP FOREIGN KEY \`FK_seats_room\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` DROP FOREIGN KEY \`FK_showtimes_movie\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` DROP FOREIGN KEY \`FK_showtimes_room\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` DROP FOREIGN KEY \`FK_bookings_showtime\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` DROP FOREIGN KEY \`FK_bookings_user\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` DROP FOREIGN KEY \`FK_refresh_tokens_user\``,
    );
    await queryRunner.query(`DROP INDEX \`UQ_genres_name\` ON \`genres\``);
    await queryRunner.query(`DROP INDEX \`UQ_genres_slug\` ON \`genres\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_movies_age_rating\` ON \`movies\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_movies_release_date\` ON \`movies\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_movies_status\` ON \`movies\``);
    await queryRunner.query(`DROP INDEX \`slug\` ON \`movies\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_booking_seats_booking_id\` ON \`booking_seats\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_booking_seats_seat_id\` ON \`booking_seats\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_showtimes_movie_id\` ON \`showtimes\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_showtimes_room_start\` ON \`showtimes\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_bookings_user_id\` ON \`bookings\``,
    );
    await queryRunner.query(`DROP INDEX \`UQ_users_email\` ON \`users\``);
    await queryRunner.query(`DROP INDEX \`UQ_users_phone\` ON \`users\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_refresh_tokens_token\` ON \`refresh_tokens\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_refresh_tokens_user_id\` ON \`refresh_tokens\``,
    );
    await queryRunner.query(
      `DROP INDEX \`UQ_refresh_tokens_token\` ON \`refresh_tokens\``,
    );
    await queryRunner.query(
      `CREATE TABLE \`movie_genre\` (\`movie_id\` int NOT NULL, \`genre_id\` int NOT NULL, INDEX \`IDX_ff1bda1a663d0de5974851fa53\` (\`movie_id\`), INDEX \`IDX_e84764c059f38c3f9d99d2e5de\` (\`genre_id\`), PRIMARY KEY (\`movie_id\`, \`genre_id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(`ALTER TABLE \`rooms\` DROP COLUMN \`room_type\``);
    await queryRunner.query(
      `ALTER TABLE \`genres\` ADD \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`movies\` ADD \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`booking_seats\` ADD \`snapshot_seat_type\` enum ('standard', 'vip', 'premium', 'couple') NOT NULL DEFAULT 'standard'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`booking_seats\` ADD \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`booking_seats\` ADD \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`seats\` ADD \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`seats\` ADD \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` ADD \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` ADD \`snapshot_movie_title\` varchar(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` ADD \`snapshot_cinema_name\` varchar(100) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` ADD \`snapshot_room_name\` varchar(20) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` ADD \`snapshot_showtime_start\` timestamp NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` ADD \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`genres\` CHANGE \`name\` \`name\` varchar(100) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`genres\` ADD UNIQUE INDEX \`IDX_f105f8230a83b86a346427de94\` (\`name\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`genres\` CHANGE \`slug\` \`slug\` varchar(100) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`genres\` ADD UNIQUE INDEX \`IDX_d1cbe4fe39bdfc77c76e94eada\` (\`slug\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`genres\` CHANGE \`created_at\` \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`movies\` CHANGE \`slug\` \`slug\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`movies\` ADD UNIQUE INDEX \`IDX_6ed86498aefe0e545548ca31b7\` (\`slug\`)`,
    );
    await queryRunner.query(`ALTER TABLE \`movies\` DROP COLUMN \`rated\``);
    await queryRunner.query(
      `ALTER TABLE \`movies\` ADD \`rated\` varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`movies\` DROP COLUMN \`created_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`movies\` ADD \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`rooms\` CHANGE \`name\` \`name\` varchar(20) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`rooms\` ADD UNIQUE INDEX \`IDX_48b79438f8707f3d9ca83d85ea\` (\`name\`)`,
    );
    await queryRunner.query(`ALTER TABLE \`rooms\` DROP COLUMN \`created_at\``);
    await queryRunner.query(
      `ALTER TABLE \`rooms\` ADD \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(`ALTER TABLE \`rooms\` DROP COLUMN \`updated_at\``);
    await queryRunner.query(
      `ALTER TABLE \`rooms\` ADD \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` DROP COLUMN \`start_time\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` ADD \`start_time\` timestamp NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` DROP COLUMN \`end_time\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` ADD \`end_time\` timestamp NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` DROP COLUMN \`created_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` ADD \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(`ALTER TABLE \`bookings\` DROP COLUMN \`user_id\``);
    await queryRunner.query(
      `ALTER TABLE \`bookings\` ADD \`user_id\` varchar(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` CHANGE \`total_price\` \`total_price\` decimal(10,0) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` CHANGE \`payment_method\` \`payment_method\` enum ('cash', 'momo', 'zalopay', 'credit_card') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` DROP COLUMN \`booked_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` ADD \`booked_at\` timestamp NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` DROP COLUMN \`created_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` ADD \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`id\` \`id\` varchar(36) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`email\` \`email\` varchar(150) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`date_of_birth\` \`date_of_birth\` date NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`phone\` \`phone\` varchar(15) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD UNIQUE INDEX \`IDX_a000cca60bcf04454e72769949\` (\`phone\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`id_card_number\` \`id_card_number\` varchar(20) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD UNIQUE INDEX \`IDX_ab9010c1b50c0336539f9763e6\` (\`id_card_number\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`promotions\` DROP COLUMN \`created_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`promotions\` ADD \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` CHANGE \`token\` \`token\` varchar(64) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` ADD UNIQUE INDEX \`IDX_4542dd2f38a61354a040ba9fd5\` (\`token\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` CHANGE \`created_at\` \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`booking_seats\` ADD CONSTRAINT \`FK_25c8b5c1e010af1cd2f699c5926\` FOREIGN KEY (\`booking_id\`) REFERENCES \`bookings\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`booking_seats\` ADD CONSTRAINT \`FK_ce3eaf629a9df599803acd0d936\` FOREIGN KEY (\`seat_id\`) REFERENCES \`seats\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`seats\` ADD CONSTRAINT \`FK_657a29871b8dd6a5107da320458\` FOREIGN KEY (\`room_id\`) REFERENCES \`rooms\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` ADD CONSTRAINT \`FK_cbe689b0c116fbc866d8ea21759\` FOREIGN KEY (\`movie_id\`) REFERENCES \`movies\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` ADD CONSTRAINT \`FK_7dac5a1df6dbc1f355112a11d8d\` FOREIGN KEY (\`room_id\`) REFERENCES \`rooms\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` ADD CONSTRAINT \`FK_64cd97487c5c42806458ab5520c\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` ADD CONSTRAINT \`FK_311925ef3f94966ea9482de9df3\` FOREIGN KEY (\`showtime_id\`) REFERENCES \`showtimes\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` ADD CONSTRAINT \`FK_3ddc983c5f7bcf132fd8732c3f4\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`movie_genre\` ADD CONSTRAINT \`FK_ff1bda1a663d0de5974851fa53a\` FOREIGN KEY (\`movie_id\`) REFERENCES \`movies\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`movie_genre\` ADD CONSTRAINT \`FK_e84764c059f38c3f9d99d2e5de9\` FOREIGN KEY (\`genre_id\`) REFERENCES \`genres\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`movie_genre\` DROP FOREIGN KEY \`FK_e84764c059f38c3f9d99d2e5de9\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`movie_genre\` DROP FOREIGN KEY \`FK_ff1bda1a663d0de5974851fa53a\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` DROP FOREIGN KEY \`FK_3ddc983c5f7bcf132fd8732c3f4\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` DROP FOREIGN KEY \`FK_311925ef3f94966ea9482de9df3\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` DROP FOREIGN KEY \`FK_64cd97487c5c42806458ab5520c\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` DROP FOREIGN KEY \`FK_7dac5a1df6dbc1f355112a11d8d\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` DROP FOREIGN KEY \`FK_cbe689b0c116fbc866d8ea21759\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`seats\` DROP FOREIGN KEY \`FK_657a29871b8dd6a5107da320458\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`booking_seats\` DROP FOREIGN KEY \`FK_ce3eaf629a9df599803acd0d936\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`booking_seats\` DROP FOREIGN KEY \`FK_25c8b5c1e010af1cd2f699c5926\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` CHANGE \`created_at\` \`created_at\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` DROP INDEX \`IDX_4542dd2f38a61354a040ba9fd5\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` CHANGE \`token\` \`token\` varchar(64) COLLATE "utf8mb4_unicode_ci" NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`promotions\` DROP COLUMN \`created_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`promotions\` ADD \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP INDEX \`IDX_ab9010c1b50c0336539f9763e6\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`id_card_number\` \`id_card_number\` varchar(20) COLLATE "utf8mb4_unicode_ci" NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP INDEX \`IDX_a000cca60bcf04454e72769949\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`phone\` \`phone\` varchar(15) COLLATE "utf8mb4_unicode_ci" NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`date_of_birth\` \`date_of_birth\` date NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`email\` \`email\` varchar(150) COLLATE "utf8mb4_unicode_ci" NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`id\` \`id\` varchar(36) COLLATE "utf8mb4_unicode_ci" NOT NULL DEFAULT 'uuid()'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` DROP COLUMN \`created_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` ADD \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` DROP COLUMN \`booked_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` ADD \`booked_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` CHANGE \`payment_method\` \`payment_method\` enum COLLATE "utf8mb4_unicode_ci" ('cash', 'momo', 'zalopay', 'credit_card') NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` CHANGE \`total_price\` \`total_price\` decimal(12,0) NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE \`bookings\` DROP COLUMN \`user_id\``);
    await queryRunner.query(
      `ALTER TABLE \`bookings\` ADD \`user_id\` varchar(36) COLLATE "utf8mb4_unicode_ci" NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` DROP COLUMN \`created_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` ADD \`created_at\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` DROP COLUMN \`end_time\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` ADD \`end_time\` datetime NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` DROP COLUMN \`start_time\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` ADD \`start_time\` datetime NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE \`rooms\` DROP COLUMN \`updated_at\``);
    await queryRunner.query(
      `ALTER TABLE \`rooms\` ADD \`updated_at\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(`ALTER TABLE \`rooms\` DROP COLUMN \`created_at\``);
    await queryRunner.query(
      `ALTER TABLE \`rooms\` ADD \`created_at\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`rooms\` DROP INDEX \`IDX_48b79438f8707f3d9ca83d85ea\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`rooms\` CHANGE \`name\` \`name\` varchar(20) COLLATE "utf8mb4_unicode_ci" NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`movies\` DROP COLUMN \`created_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`movies\` ADD \`created_at\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(`ALTER TABLE \`movies\` DROP COLUMN \`rated\``);
    await queryRunner.query(
      `ALTER TABLE \`movies\` ADD \`rated\` varchar(255) COLLATE "utf8mb4_unicode_ci" NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`movies\` DROP INDEX \`IDX_6ed86498aefe0e545548ca31b7\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`movies\` CHANGE \`slug\` \`slug\` varchar(255) COLLATE "utf8mb4_unicode_ci" NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`genres\` CHANGE \`created_at\` \`created_at\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE \`genres\` DROP INDEX \`IDX_d1cbe4fe39bdfc77c76e94eada\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`genres\` CHANGE \`slug\` \`slug\` varchar(100) COLLATE "utf8mb4_unicode_ci" NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`genres\` DROP INDEX \`IDX_f105f8230a83b86a346427de94\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`genres\` CHANGE \`name\` \`name\` varchar(100) COLLATE "utf8mb4_unicode_ci" NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` DROP COLUMN \`updated_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` DROP COLUMN \`snapshot_showtime_start\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` DROP COLUMN \`snapshot_room_name\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` DROP COLUMN \`snapshot_cinema_name\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` DROP COLUMN \`snapshot_movie_title\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` DROP COLUMN \`updated_at\``,
    );
    await queryRunner.query(`ALTER TABLE \`seats\` DROP COLUMN \`updated_at\``);
    await queryRunner.query(`ALTER TABLE \`seats\` DROP COLUMN \`created_at\``);
    await queryRunner.query(
      `ALTER TABLE \`booking_seats\` DROP COLUMN \`updated_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`booking_seats\` DROP COLUMN \`created_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`booking_seats\` DROP COLUMN \`snapshot_seat_type\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`movies\` DROP COLUMN \`updated_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`genres\` DROP COLUMN \`updated_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`rooms\` ADD \`room_type\` enum COLLATE "utf8mb4_unicode_ci" ('2D', '3D', 'IMAX', '4DX') NOT NULL DEFAULT '2D'`,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_e84764c059f38c3f9d99d2e5de\` ON \`movie_genre\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_ff1bda1a663d0de5974851fa53\` ON \`movie_genre\``,
    );
    await queryRunner.query(`DROP TABLE \`movie_genre\``);
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`UQ_refresh_tokens_token\` ON \`refresh_tokens\` (\`token\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_refresh_tokens_user_id\` ON \`refresh_tokens\` (\`user_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_refresh_tokens_token\` ON \`refresh_tokens\` (\`token\`)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`UQ_users_phone\` ON \`users\` (\`phone\`)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`UQ_users_email\` ON \`users\` (\`email\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_bookings_user_id\` ON \`bookings\` (\`user_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_showtimes_room_start\` ON \`showtimes\` (\`room_id\`, \`start_time\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_showtimes_movie_id\` ON \`showtimes\` (\`movie_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_booking_seats_seat_id\` ON \`booking_seats\` (\`seat_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_booking_seats_booking_id\` ON \`booking_seats\` (\`booking_id\`)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`slug\` ON \`movies\` (\`slug\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_movies_status\` ON \`movies\` (\`status\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_movies_release_date\` ON \`movies\` (\`release_date\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_movies_age_rating\` ON \`movies\` (\`age_rating\`)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`UQ_genres_slug\` ON \`genres\` (\`slug\`)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`UQ_genres_name\` ON \`genres\` (\`name\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` ADD CONSTRAINT \`FK_refresh_tokens_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` ADD CONSTRAINT \`FK_bookings_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`bookings\` ADD CONSTRAINT \`FK_bookings_showtime\` FOREIGN KEY (\`showtime_id\`) REFERENCES \`showtimes\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` ADD CONSTRAINT \`FK_showtimes_room\` FOREIGN KEY (\`room_id\`) REFERENCES \`rooms\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`showtimes\` ADD CONSTRAINT \`FK_showtimes_movie\` FOREIGN KEY (\`movie_id\`) REFERENCES \`movies\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`seats\` ADD CONSTRAINT \`FK_seats_room\` FOREIGN KEY (\`room_id\`) REFERENCES \`rooms\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`booking_seats\` ADD CONSTRAINT \`FK_booking_seats_seat\` FOREIGN KEY (\`seat_id\`) REFERENCES \`seats\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`booking_seats\` ADD CONSTRAINT \`FK_booking_seats_booking\` FOREIGN KEY (\`booking_id\`) REFERENCES \`bookings\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
