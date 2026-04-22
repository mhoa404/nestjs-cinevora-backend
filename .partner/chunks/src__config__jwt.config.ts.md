# FILE: src/config/jwt.config.ts

path: src/config/jwt.config.ts
module: config
kind: config
language: ts
line_count: 9
size_bytes: 276
sha256: 935c1f2c390d9d77dc86fc53538334c23a8e3a941e4f38f5df6c171caf280574
updated_at: 2026-04-08T04:57:37.349Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_TOKEN,
  refreshSecret: process.env.JWT_REFRESH_TOKEN,
  accessExpiresInSeconds: 15 * 60,
  refreshExpiresInSeconds: 30 * 24 * 60 * 60,
}));

````
