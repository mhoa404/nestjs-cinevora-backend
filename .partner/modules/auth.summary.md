# Auth Module Summary

## Purpose
Quản lý đăng ký, đăng nhập, refresh token và đăng xuất cho web/mobile.

## Main Files
- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/services/auth-cookie.service.ts`
- `src/modules/auth/services/auth-token.service.ts`
- `src/modules/auth/services/refresh-token.service.ts`
- `src/modules/auth/strategies/jwt.strategy.ts`

## Public Routes
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/mobile/login`
- `POST /auth/mobile/refresh`
- `POST /auth/mobile/logout`

## Key Behaviors
### Register
- Verify reCAPTCHA nếu `ENABLE_RECAPTCHA=true`
- Tạo user qua `UsersService`
- Trả user đã sanitize

### Login
- Validate email/password
- Update `lastLoginAt`
- Generate access token + refresh token
- Save hashed refresh token vào DB
- Web: refresh token lưu vào cookie
- Mobile: refresh token trả trong response body

### Refresh
- Verify refresh token bằng refresh secret
- Kiểm tra user còn active
- Revoke token cũ bằng cơ chế consume
- Generate cặp token mới
- Lưu hashed refresh token mới

### Logout
- Revoke refresh token hiện tại

## Security Notes
- Refresh token không lưu raw string trong DB, chỉ lưu hash SHA-256
- Access token lấy từ Authorization Bearer
- JWT strategy kiểm tra user còn tồn tại và active

## Related Tests
- `test/api/auth/register.api.spec.ts`
- `test/api/auth/login.api.spec.ts`
- `test/api/auth/refresh.api.spec.ts`
- `test/api/auth/logout.api.spec.ts`