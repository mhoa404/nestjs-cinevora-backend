import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCinemasRoomsSeats1710000000002 implements MigrationInterface {
    name = 'CreateCinemasRoomsSeats1710000000002';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`cinemas\` (
                \`id\`          INT             NOT NULL AUTO_INCREMENT,
                \`name\`        VARCHAR(150)    NOT NULL,
                \`address\`     VARCHAR(255)    NOT NULL,
                \`city\`        VARCHAR(50)     NOT NULL,
                \`district\`    VARCHAR(50),
                \`phone\`       VARCHAR(15),
                \`created_at\`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT \`PK_cinemas\` PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await queryRunner.query(`
            CREATE TABLE \`rooms\` (
                \`id\`          INT             NOT NULL AUTO_INCREMENT,
                \`cinema_id\`   INT             NOT NULL,
                \`name\`        VARCHAR(20)     NOT NULL,
                \`total_seats\` INT             NOT NULL,
                \`created_at\`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT \`PK_rooms\` PRIMARY KEY (\`id\`),
                CONSTRAINT \`FK_rooms_cinema\` FOREIGN KEY (\`cinema_id\`)
                    REFERENCES \`cinemas\`(\`id\`) ON DELETE CASCADE
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
        await queryRunner.query(`DROP TABLE \`cinemas\``);
    }
}
