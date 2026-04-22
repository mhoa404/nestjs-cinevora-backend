# FILE: src/modules/auth/dto/logout.dto.ts

path: src/modules/auth/dto/logout.dto.ts
module: auth
kind: dto
language: ts
line_count: 8
size_bytes: 257
sha256: 167b0ec2eda43643c70e1f8448d8568c0de7fcd713a109933e49887668b4b304
updated_at: 2026-04-08T04:57:37.352Z

## SYMBOLS
- LogoutDto

## CODE

````ts
import { IsNotEmpty, IsString } from 'class-validator';

export class LogoutDto {
  @IsString({ message: 'Định dạng refresh token không hợp lệ.' })
  @IsNotEmpty({ message: 'Vui lòng cung cấp refresh token' })
  refreshToken!: string;
}

````
