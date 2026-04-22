# FILE: src/modules/auth/interfaces/auth-tokens.interface.ts

path: src/modules/auth/interfaces/auth-tokens.interface.ts
module: auth
kind: interface
language: ts
line_count: 6
size_bytes: 105
sha256: cdeea1f30a536b889944f3273c0deeceef6f1121e5ae29a1620f95883305bd6d
updated_at: 2026-03-23T10:41:25.773Z

## SYMBOLS
- (none detected)

## CODE

````ts
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

````
