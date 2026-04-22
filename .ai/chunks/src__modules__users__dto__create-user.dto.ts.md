# FILE: src/modules/users/dto/create-user.dto.ts

path: src/modules/users/dto/create-user.dto.ts
module: users
kind: dto
language: ts
line_count: 15
size_bytes: 298
sha256: d862fcdefc890b3247d4bf40ebc6cb6a00d0f2eed20da3ce10face63d03d341e
updated_at: 2026-04-15T11:45:47.298Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { UserSex } from '../entities/user.entity';

export interface CreateUserDto {
  fullName: string;
  email: string;
  password: string;
  dateOfBirth: string;
  phone: string;
  sex?: UserSex;
  city?: string;
  district?: string;
  address?: string;
  IDCardNumber?: string;
}

````
