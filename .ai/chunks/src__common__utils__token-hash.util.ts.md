# FILE: src/common/utils/token-hash.util.ts

path: src/common/utils/token-hash.util.ts
module: common
kind: file
language: ts
line_count: 12
size_bytes: 413
sha256: 0a2b1bddeef84516c39055a774f4ef69bd89a5680ae3291861554f30cc018b06
updated_at: 2026-04-08T04:57:37.341Z

## SYMBOLS
- hashRefreshToken

## CODE

````ts
import { createHash } from 'crypto';

/**
 * Hash một refresh token (raw JWT) bằng SHA-256 trước khi lưu DB.
 * Raw token vẫn trả về cho client, chỉ hash mới được persist.
 *
 * SHA-256 output: 64 ký tự hex — không thể reverse về JWT gốc.
 */
export function hashRefreshToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

````
