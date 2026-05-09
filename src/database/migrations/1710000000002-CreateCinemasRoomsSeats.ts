import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCinemasRoomsSeats1710000000002 implements MigrationInterface {
  name = 'CreateCinemasRoomsSeats1710000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`rooms\` (
        \`id\`          INT             NOT NULL AUTO_INCREMENT,
        \`name\`        VARCHAR(20)     NOT NULL,
        \`created_at\`  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`PK_rooms\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`UQ_rooms_name\` UNIQUE (\`name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`seats\` (
        \`id\`          INT             NOT NULL AUTO_INCREMENT,
        \`room_id\`     INT             NOT NULL,
        \`seat_key\`    VARCHAR(10)     NOT NULL,
        \`row_label\`   VARCHAR(10)     NOT NULL,
        \`seat_number\` INT             NOT NULL,
        \`seat_type\`   ENUM('standard', 'vip', 'couple') NOT NULL DEFAULT 'standard',
        \`is_active\`   TINYINT(1)      NOT NULL DEFAULT 1,
        \`created_at\`  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`PK_seats\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`UQ_seats_room_seat_key\` UNIQUE (\`room_id\`, \`seat_key\`),
        CONSTRAINT \`FK_seats_room\` FOREIGN KEY (\`room_id\`)
          REFERENCES \`rooms\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      INSERT INTO \`rooms\` (\`name\`) VALUES
      ('01'),
      ('02'),
      ('03'),
      ('04'),
      ('05')
    `);

    const roomOneRowLabels = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
    const vipRows = new Set<string>(['E', 'F']);

    const seatValues = roomOneRowLabels
      .flatMap((rowLabel) => {
        const seatType = vipRows.has(rowLabel) ? 'vip' : 'standard';

        return Array.from({ length: 10 }, (_, index) => {
          const seatNumber = index + 1;
          const seatKey = `${rowLabel}${seatNumber}`;

          return `((SELECT \`id\` FROM \`rooms\` WHERE \`name\` = '01'), '${seatKey}', '${rowLabel}', ${seatNumber}, '${seatType}')`;
        });
      })
      .join(',\n');

    await queryRunner.query(`
  INSERT INTO \`seats\`
    (\`room_id\`, \`seat_key\`, \`row_label\`, \`seat_number\`, \`seat_type\`)
  VALUES
    ${seatValues}
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`seats\``);
    await queryRunner.query(`DROP TABLE \`rooms\``);
  }
}
