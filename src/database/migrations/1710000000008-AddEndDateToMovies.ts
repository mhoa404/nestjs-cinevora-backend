import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEndDateToMovies1710000000008 implements MigrationInterface {
  name = 'AddEndDateToMovies1710000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`movies\` ADD COLUMN \`end_date\` DATE NULL AFTER \`release_date\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`movies\` DROP COLUMN \`end_date\``);
  }
}
