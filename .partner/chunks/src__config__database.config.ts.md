# FILE: src/config/database.config.ts

path: src/config/database.config.ts
module: config
kind: config
language: ts
line_count: 13
size_bytes: 375
sha256: 616a4f1e63942566d918d58a980972ba3d6a1ef3603de4415360b1c8d7844ef9
updated_at: 2026-03-22T08:37:56.689Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false,
  autoLoadEntities: true,
}));

````
