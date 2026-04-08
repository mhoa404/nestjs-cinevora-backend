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
