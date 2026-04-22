# FILE: src/common/decorators/roles.decorator.ts

path: src/common/decorators/roles.decorator.ts
module: common
kind: decorator
language: ts
line_count: 6
size_bytes: 214
sha256: d63d2113eb18e5409604f476f7f464c8af90ded012d2a0c72e306aced277858a
updated_at: 2026-04-09T11:54:23.326Z

## SYMBOLS
- ROLES_KEY
- Roles

## CODE

````ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../constants/role.constant';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

````
