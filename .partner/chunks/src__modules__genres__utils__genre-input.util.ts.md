# FILE: src/modules/genres/utils/genre-input.util.ts

path: src/modules/genres/utils/genre-input.util.ts
module: genres
kind: file
language: ts
line_count: 24
size_bytes: 564
sha256: 9c6e45802724c8ab4ac2cb3599e4313ef10ba3d674d62f378af06cedaa2f5ca1
updated_at: 2026-04-08T04:57:37.370Z

## SYMBOLS
- prepareGenreInput

## CODE

````ts
import { BadRequestException } from '@nestjs/common';

import { generateSlug } from '../../../common/utils/slug.util';

export interface PreparedGenreInput {
  name: string;
  slug: string;
  normalizedName: string;
}

export function prepareGenreInput(rawName: string): PreparedGenreInput {
  const name = rawName.trim();

  if (name.length === 0) {
    throw new BadRequestException('Tên thể loại không được để trống.');
  }

  return {
    name,
    slug: generateSlug(name),
    normalizedName: name.toLowerCase(),
  };
}

````
