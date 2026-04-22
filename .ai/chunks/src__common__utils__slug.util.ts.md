# FILE: src/common/utils/slug.util.ts

path: src/common/utils/slug.util.ts
module: common
kind: file
language: ts
line_count: 13
size_bytes: 309
sha256: 6ac71fc24081a3723a945278ce672dbc4b799136af512e74f11a7183d1d05452
updated_at: 2026-04-08T04:57:37.341Z

## SYMBOLS
- generateSlug

## CODE

````ts
export function generateSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

````
