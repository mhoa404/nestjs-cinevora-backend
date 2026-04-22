# FILE: test/types/auth-user.type.ts

path: test/types/auth-user.type.ts
module: test
kind: type
language: ts
line_count: 20
size_bytes: 381
sha256: 7d9987598a9f50d4351e4171207556bae4ffda429750d238dfd82ba69fc18784
updated_at: 2026-04-02T08:59:54.830Z

## SYMBOLS
- (none detected)

## CODE

````ts
export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  dateOfBirth: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user: AuthUser;
};

````
