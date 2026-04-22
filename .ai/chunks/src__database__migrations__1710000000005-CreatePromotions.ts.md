# FILE: src/database/migrations/1710000000005-CreatePromotions.ts

path: src/database/migrations/1710000000005-CreatePromotions.ts
module: database
kind: migration
language: ts
line_count: 28
size_bytes: 1248
sha256: 019e38e760a9c9d37ac436aedee5c223eb3aab1330bd0ede3bc8743cea017cda
updated_at: 2026-04-08T04:56:34.037Z

## SYMBOLS
- CreatePromotions1710000000005

## CODE

````ts
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

````
