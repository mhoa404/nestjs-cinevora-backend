# FILE: src/modules/auth/dto/auth-response.dto.ts

path: src/modules/auth/dto/auth-response.dto.ts
module: auth
kind: dto
language: ts
line_count: 20
size_bytes: 391
sha256: 8f0e8eb609e4f0bec0b544ad83e35fd09d498cc9e77ad5866a99a2019500a7e5
updated_at: 2026-04-06T15:48:15.368Z

## SYMBOLS
- AuthUserDto
- AuthResponseDto

## CODE

````ts
export class AuthUserDto {
  id!: string;
  fullName!: string;
  email!: string;
  role!: string;
  isActive!: boolean;
  dateOfBirth!: Date | null;
  phone!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  lastLoginAt!: Date | null;
}

export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  user!: AuthUserDto;
}

````
