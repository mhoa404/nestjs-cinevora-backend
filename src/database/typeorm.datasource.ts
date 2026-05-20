import * as dotenv from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';

dotenv.config({ path: '.env.local' });

const isTsRuntime = __filename.endsWith('.ts');

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false,
  timezone: 'Z',
  entities: [
    isTsRuntime
      ? join(__dirname, '../modules/**/entities/*.entity.ts')
      : join(__dirname, '../modules/**/entities/*.entity.js'),
  ],
  migrations: [
    isTsRuntime
      ? join(__dirname, './migrations/*.ts')
      : join(__dirname, './migrations/*.js'),
  ],
  migrationsTableName: 'typeorm_migrations',
});
