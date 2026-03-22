import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1710000000000 implements MigrationInterface {
    name = 'CreateUsers1710000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`users\` (
                \`id\`               VARCHAR(36)     NOT NULL DEFAULT (UUID()),
                \`full_name\`        VARCHAR(100)    NOT NULL,
                \`email\`            VARCHAR(150)    NOT NULL,
                \`password\`         VARCHAR(255)    NOT NULL,
                \`date_of_birth\`    DATE,
                \`phone\`            VARCHAR(15),
                \`city\`             VARCHAR(50),
                \`district\`         VARCHAR(50),
                \`address\`          VARCHAR(255),
                \`sex\`              ENUM('Nam', 'Nữ', 'Khác'),
                \`id_card_number\`   VARCHAR(20),
                \`role\`             ENUM('customer', 'staff', 'admin', 'super_admin') NOT NULL DEFAULT 'customer',
                \`role_level\`       INT             NOT NULL DEFAULT 0,
                \`is_active\`        TINYINT(1)      NOT NULL DEFAULT 1,
                \`last_login_at\`    DATETIME,
                \`created_at\`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT \`PK_users\` PRIMARY KEY (\`id\`),
                CONSTRAINT \`UQ_users_email\` UNIQUE (\`email\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`users\``);
    }
}
