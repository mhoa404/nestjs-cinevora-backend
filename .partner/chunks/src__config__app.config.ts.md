# FILE: src/config/app.config.ts

path: src/config/app.config.ts
module: config
kind: config
language: ts
line_count: 7
size_bytes: 217
sha256: d7e767935ea206da3ece22787805c10b7f0645d5bc9ca5c0cb1aa73cd8f60130
updated_at: 2026-04-08T04:57:37.349Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
}));

````
