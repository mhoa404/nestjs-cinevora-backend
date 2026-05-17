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
        \`date_of_birth\`    DATE            NOT NULL,
        \`phone\`            VARCHAR(15)     NULL,
        \`city\`             VARCHAR(50)     NULL,
        \`district\`         VARCHAR(50)     NULL,
        \`address\`          VARCHAR(255)    NULL,
        \`sex\`              ENUM('Nam', 'Nữ', 'Khác') NULL,
        \`id_card_number\`   VARCHAR(20)     NULL,
        \`role\`             ENUM('customer', 'staff', 'admin', 'super_admin') NOT NULL DEFAULT 'customer',
        \`is_active\`        TINYINT(1)      NOT NULL DEFAULT 1,
        \`last_login_at\`    DATETIME(3)     NULL,
        \`created_at\`       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

        CONSTRAINT \`PK_users\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`UQ_users_email\` UNIQUE (\`email\`),
        CONSTRAINT \`UQ_users_phone\` UNIQUE (\`phone\`),
        CONSTRAINT \`UQ_users_id_card_number\` UNIQUE (\`id_card_number\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`users\``);
  }
}
