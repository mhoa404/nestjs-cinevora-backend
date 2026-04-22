# FILE: src/common/types/jwt-payload.type.ts

path: src/common/types/jwt-payload.type.ts
module: common
kind: type
language: ts
line_count: 11
size_bytes: 218
sha256: 38cfef611850b62dd60fbdf13edb7349ea0411f182a65d1cac9f235a4e46f699
updated_at: 2026-04-08T04:57:37.341Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { UserRole } from '../constants/role.constant';
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  role_level?: number;
  jti?: string;
  iat?: number;
  exp?: number;
}

````
