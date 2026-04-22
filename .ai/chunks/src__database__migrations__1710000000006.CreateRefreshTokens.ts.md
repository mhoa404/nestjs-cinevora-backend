# FILE: src/database/migrations/1710000000006.CreateRefreshTokens.ts

path: src/database/migrations/1710000000006.CreateRefreshTokens.ts
module: database
kind: migration
language: ts
line_count: 40
size_bytes: 1642
sha256: 60e5d0c64032fba84c5fec137a55087075845f80ac0330003a890808137994b0
updated_at: 2026-04-08T04:56:34.037Z

## SYMBOLS
- CreateRefreshTokens1710000000006

## CODE

````ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefreshTokens1710000000006 implements MigrationInterface {
  name = 'CreateRefreshTokens1710000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`refresh_tokens\` (
        \`id\`          INT             NOT NULL AUTO_INCREMENT,
        \`user_id\`     VARCHAR(36)     NOT NULL,
        \`token\`       VARCHAR(64)     NOT NULL,
        \`expires_at\`  DATETIME        NOT NULL,
        \`is_revoked\`  TINYINT(1)      NOT NULL DEFAULT 0,
        \`created_at\`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \`PK_refresh_tokens\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`UQ_refresh_tokens_token\` UNIQUE (\`token\`),
        CONSTRAINT \`FK_refresh_tokens_user\` FOREIGN KEY (\`user_id\`)
          REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(
      `CREATE INDEX \`IDX_refresh_tokens_user_id\` ON \`refresh_tokens\`(\`user_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_refresh_tokens_token\` ON \`refresh_tokens\`(\`token\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_refresh_tokens_token\` ON \`refresh_tokens\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_refresh_tokens_user_id\` ON \`refresh_tokens\``,
    );
    await queryRunner.query(`DROP TABLE \`refresh_tokens\``);
  }
}

````
