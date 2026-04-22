# FILE: src/modules/auth/dto/login.dto.ts

path: src/modules/auth/dto/login.dto.ts
module: auth
kind: dto
language: ts
line_count: 12
size_bytes: 399
sha256: 91a0a86c42796022a511fcfd9c46bf601080f108b4e70bc9a34b6328869385e2
updated_at: 2026-04-02T08:59:54.787Z

## SYMBOLS
- LoginDto

## CODE

````ts
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Địa chỉ email không hợp lệ.' })
  @IsNotEmpty({ message: 'Vui lòng nhập địa chỉ email.' })
  email!: string;

  @IsString({ message: 'Mật khẩu không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu.' })
  password!: string;
}

````
