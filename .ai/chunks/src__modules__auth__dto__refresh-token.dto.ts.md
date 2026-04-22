# FILE: src/modules/auth/dto/refresh-token.dto.ts

path: src/modules/auth/dto/refresh-token.dto.ts
module: auth
kind: dto
language: ts
line_count: 8
size_bytes: 263
sha256: d32de02dab7aa51a948952626d77d8acaa50beacee69117e04dba41cbda2bf53
updated_at: 2026-04-08T04:57:37.352Z

## SYMBOLS
- RefreshTokenDto

## CODE

````ts
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString({ message: 'Định dạng refresh token không hợp lệ.' })
  @IsNotEmpty({ message: 'Vui lòng cung cấp refresh token' })
  refreshToken!: string;
}

````
