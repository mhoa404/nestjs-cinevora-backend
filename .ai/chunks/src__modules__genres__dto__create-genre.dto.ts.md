# FILE: src/modules/genres/dto/create-genre.dto.ts

path: src/modules/genres/dto/create-genre.dto.ts
module: genres
kind: dto
language: ts
line_count: 9
size_bytes: 332
sha256: d5547a80197d072321a1623062ac02dac33971b8420be063197963c7747efe41
updated_at: 2026-04-08T04:56:34.037Z

## SYMBOLS
- CreateGenreDto

## CODE

````ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateGenreDto {
  @MaxLength(100, { message: 'Tên thể loại tối đa 100 ký tự.' })
  @IsString({ message: 'Tên thể loại không hợp lệ.' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên thể loại.' })
  name!: string;
}

````
