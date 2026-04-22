# FILE: src/common/constants/role.constant.ts

path: src/common/constants/role.constant.ts
module: common
kind: file
language: ts
line_count: 14
size_bytes: 294
sha256: 18d44a5f5f1b23fb114aaa85cf6a522526e147b1385479460f7aafe55f4f84fe
updated_at: 2026-04-08T04:57:37.341Z

## SYMBOLS
- ROLE_LEVEL

## CODE

````ts
export enum UserRole {
  CUSTOMER = 'customer',
  STAFF = 'staff',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export const ROLE_LEVEL: Record<UserRole, number> = {
  [UserRole.CUSTOMER]: 0,
  [UserRole.STAFF]: 10,
  [UserRole.ADMIN]: 50,
  [UserRole.SUPER_ADMIN]: 99,
};

````
