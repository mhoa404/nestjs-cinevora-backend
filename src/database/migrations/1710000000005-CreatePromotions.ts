import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePromotions1710000000005 implements MigrationInterface {
    name = 'CreatePromotions1710000000005';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`promotions\` (
                \`id\`               INT             NOT NULL AUTO_INCREMENT,
                \`title\`            VARCHAR(255)    NOT NULL,
                \`description\`      TEXT,
                \`image_url\`        TEXT,
                \`discount_percent\` DECIMAL(5,2),
                \`promotion_type\`   ENUM('highlight', 'grid', 'top') NOT NULL DEFAULT 'grid',
                \`start_date\`       DATE,
                \`end_date\`         DATE,
                \`is_active\`        TINYINT(1)      NOT NULL DEFAULT 1,
                \`created_at\`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT \`PK_promotions\` PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`promotions\``);
    }
}
