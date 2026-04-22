# Architecture Summary

## Project Overview
Đây là backend của Cinevora, xây dựng bằng NestJS, TypeORM, MySQL, dùng pnpm để quản lý package, Docker để chạy dịch vụ và Jenkins để deploy.

## Core Stack
- Framework: NestJS
- ORM: TypeORM
- Database: MySQL
- Validation: class-validator + ValidationPipe
- Auth: JWT access token + refresh token
- Test: Jest + Supertest
- Deploy: Docker Compose + Jenkins

## Application Bootstrap
- Entry point: `src/main.ts`
- Root module: `src/app.module.ts`
- Global guard: `JwtAuthGuard`
- Global validation:
  - whitelist: true
  - forbidNonWhitelisted: true
  - transform: true
  - stopAtFirstError: true
- Global exception filter: `HttpExceptionFilter`
- Cookie parser enabled
- CORS enabled theo `app.frontendUrl`

## Auth Model
Hệ thống auth chia thành 2 flow:

### Web
- Login: trả `accessToken`, `refreshToken` được set vào cookie httpOnly
- Refresh: lấy refresh token từ cookie
- Logout: lấy refresh token từ cookie rồi revoke

### Mobile
- Login: trả cả `accessToken` và `refreshToken` trong response body
- Refresh: gửi refresh token qua body
- Logout: gửi refresh token qua body

Refresh token được hash SHA-256 trước khi lưu DB.

## Database Strategy
- Không dùng `synchronize: true`
- Dùng TypeORM migrations
- CLI datasource riêng ở `src/database/typeorm.datasource.ts`
- Runtime config dùng `database.config.ts`

## Main Business Modules
### Auth
Đã có logic hoàn chỉnh cho register/login/refresh/logout.

### Genres
Đã có CRUD tương đối đầy đủ, có xử lý trim input, slug, unique name, unique slug, chặn xoá nếu đang được dùng bởi movie.

### Movies
Đã có create/find/update/remove, hỗ trợ tìm theo `slugOrId`, kiểm tra genreIds hợp lệ, tạo slug theo `baseSlug-id`, validate `endDate`.

### Rooms
Đã có CRUD cơ bản, unique room name, chặn xoá nếu phòng đang có showtime.

## Modules Still Mostly Stub
- bookings
- payments
- promotions
- seats
- showtimes
- users (controller/DTO response/update còn mỏng)

## Testing
Test API hiện tập trung chủ yếu ở:
- auth
- genres
- movies
- rooms

## Deployment
- `docker-compose.yml` chạy MySQL, backend, Jenkins
- `Dockerfile` build app production
- `Jenkinsfile` build image backend và deploy qua docker compose