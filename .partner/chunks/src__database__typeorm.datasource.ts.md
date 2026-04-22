# FILE: src/database/typeorm.datasource.ts

path: src/database/typeorm.datasource.ts
module: database
kind: file
language: ts
line_count: 29
size_bytes: 804
sha256: 37fe30dbdaa6c86397a37c5e54c5a0591eedf8516c833753c44d82d616a49bab
updated_at: 2026-04-08T04:57:37.352Z

## SYMBOLS
- AppDataSource

## CODE

````ts
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

const isTsRuntime = __filename.endsWith('.ts');

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false,
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

````
