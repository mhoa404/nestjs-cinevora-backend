# FILE: src/modules/rooms/dto/create-room.dto.ts

path: src/modules/rooms/dto/create-room.dto.ts
module: rooms
kind: dto
language: ts
line_count: 12
size_bytes: 458
sha256: d070f857fbd3e2d5e73f91c87a2625f3103b97118c94252b6426848e996a0b09
updated_at: 2026-04-15T15:02:49.490Z

## SYMBOLS
- CreateRoomDto

## CODE

````ts
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateRoomDto {
  @IsString({ message: 'Tên phòng phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên phòng không được để trống' })
  @MaxLength(20, { message: 'Tên phòng không được vượt quá 20 ký tự' })
  @Matches(/^[0-9]{2}$/, {
    message: 'Tên phòng phải theo định dạng 01, 02, 03... (2 chữ số)',
  })
  name!: string;
}

````
