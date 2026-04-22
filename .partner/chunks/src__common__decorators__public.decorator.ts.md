# FILE: src/common/decorators/public.decorator.ts

path: src/common/decorators/public.decorator.ts
module: common
kind: decorator
language: ts
line_count: 5
size_bytes: 154
sha256: 67d2c26dd0b30f371d271ee05b43630d5f29f525c06d4319bbee1eb99cbb11b9
updated_at: 2026-04-07T01:21:24.543Z

## SYMBOLS
- IS_PUBLIC_KEY
- Public

## CODE

````ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

````
