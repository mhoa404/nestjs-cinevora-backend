# Database Schema Current

## Purpose
File này mô tả **schema database hiện tại** của Cinevora backend dựa trên:
- TypeORM entities hiện có
- TypeORM migrations hiện có
- quan hệ thực tế giữa các bảng

Tài liệu này dùng để:
- giúp người đọc hiểu nhanh database structure
- giúp AI xác định bảng, khóa, quan hệ, enum và các điểm cần chú ý
- làm nguồn tham chiếu khi sửa entity, migration, service hoặc test liên quan DB

## Source of Truth
Ưu tiên đọc theo thứ tự:
1. `src/database/migrations/*`
2. `src/modules/**/entities/*.entity.ts`
3. sơ đồ ERD hình ảnh chỉ để nhìn tổng quan, không phải nguồn sự thật tuyệt đối

## Database Engine
- DBMS: MySQL
- ORM: TypeORM
- Strategy: dùng migrations, không dùng `synchronize: true`

---

## 1. users
### Purpose
Lưu thông tin tài khoản người dùng và phân quyền.

### Columns
- `id` (PK, uuid)
- `full_name`
- `email` (unique)
- `password`
- `date_of_birth`
- `phone` (unique)
- `city`
- `district`
- `address`
- `sex`
- `id_card_number`
- `role`
- `is_active`
- `last_login_at`
- `created_at`
- `updated_at`

### Relations
- 1 user -> n bookings
- 1 user -> n refresh_tokens

### Notes
- `role` dùng enum: `customer`, `staff`, `admin`, `super_admin`
- `email` và `phone` đang được kiểm tra unique ở cả DB và service layer

---

## 2. refresh_tokens
### Purpose
Lưu refresh token đã được hash để phục vụ login session và refresh token rotation.

### Columns
- `id` (PK)
- `user_id` (FK -> users.id)
- `token` (unique, hash SHA-256)
- `expires_at`
- `is_revoked`
- `created_at`

### Relations
- n refresh_tokens -> 1 user

### Notes
- Không lưu raw refresh token trong DB
- Token bị revoke khi logout hoặc khi refresh thành công

---

## 3. genres
### Purpose
Lưu danh sách thể loại phim.

### Columns
- `id` (PK)
- `name` (unique)
- `slug` (unique)
- `created_at`

### Relations
- n genres <-> n movies thông qua bảng join `movie_genres`

### Notes
- `slug` được generate từ `name`
- service có kiểm tra trùng `name` theo lowercase và kiểm tra trùng `slug`

---

## 4. movies
### Purpose
Lưu thông tin phim.

### Columns
- `id` (PK)
- `slug` (unique, nullable)
- `title`
- `poster_url`
- `trailer_url`
- `banner_url`
- `description`
- `duration`
- `director`
- `actor`
- `language`
- `age_rating`
- `rated`
- `status`
- `release_date`
- `end_date`
- `avg_rating`
- `created_at`

### Relations
- 1 movie -> n showtimes
- n movies <-> n genres qua `movie_genres`

### Notes
- `age_rating` enum: `P`, `C13`, `C16`, `C18`
- `status` enum: `now_showing`, `upcoming`, `ended`
- slug thực tế ở service đang build theo format: `baseSlug-XXX`

---

## 5. movie_genres
### Purpose
Bảng join many-to-many giữa movies và genres.

### Columns
- `movie_id` (PK, FK -> movies.id)
- `genre_id` (PK, FK -> genres.id)

### Relations
- n movie_genres -> 1 movie
- n movie_genres -> 1 genre

### Notes
- Tên bảng hiện tại trong code/migration là `movie_genres`

---

## 6. rooms
### Purpose
Lưu phòng chiếu.

### Columns
- `id` (PK)
- `name`
- `room_type`
- `created_at`
- `updated_at`

### Relations
- 1 room -> n seats
- 1 room -> n showtimes

### Notes
- DTO/service hiện tại đang tập trung vào `name`
- migration có `room_type`, nhưng entity/service hiện tại chưa khai thác đầy đủ field này

---

## 7. seats
### Purpose
Lưu ghế của từng phòng.

### Columns
- `id` (PK)
- `room_id` (FK -> rooms.id)
- `seat_key`
- `row_label`
- `seat_number`
- `seat_type`
- `is_active`

### Relations
- n seats -> 1 room
- 1 seat -> n booking_seats

### Notes
- `seat_type` enum: `standard`, `vip`, `premium`, `couple`

---

## 8. showtimes
### Purpose
Lưu suất chiếu của phim trong từng phòng.

### Columns
- `id` (PK)
- `movie_id` (FK -> movies.id)
- `room_id` (FK -> rooms.id)
- `start_time`
- `end_time`
- `price_standard`
- `price_vip`
- `price_premium`
- `price_couple`
- `created_at`

### Relations
- n showtimes -> 1 movie
- n showtimes -> 1 room
- 1 showtime -> n bookings

### Notes
- Giá vé tách theo loại ghế
- hiện DTO/service của module showtimes còn rất mỏng

---

## 9. bookings
### Purpose
Lưu đơn đặt vé.

### Columns
- `id` (PK)
- `user_id` (FK -> users.id)
- `showtime_id` (FK -> showtimes.id)
- `ticket_count`
- `total_price`
- `payment_method`
- `booked_at`
- `status`
- `created_at`

### Relations
- n bookings -> 1 user
- n bookings -> 1 showtime
- 1 booking -> n booking_seats

### Notes
- `payment_method` enum: `cash`, `momo`, `zalopay`, `credit_card`
- `status` enum: `pending`, `confirmed`, `cancelled`, `used`
- module bookings hiện mới có entity, service/controller vẫn còn stub

---

## 10. booking_seats
### Purpose
Lưu từng ghế thuộc một booking.

### Columns
- `id` (PK)
- `booking_id` (FK -> bookings.id)
- `seat_id` (FK -> seats.id)
- `seat_key`
- `price`

### Relations
- n booking_seats -> 1 booking
- n booking_seats -> 1 seat

### Notes
- dùng để snapshot ghế và giá ghế tại thời điểm đặt
- hiện tại schema thật mới có `seat_key` và `price`, chưa có các snapshot field mở rộng khác

---

## 11. promotions
### Purpose
Lưu chương trình khuyến mãi.

### Columns
- `id` (PK)
- `title`
- `description`
- `image_url`
- `discount_percent`
- `promotion_type`
- `start_date`
- `end_date`
- `is_active`
- `created_at`

### Notes
- `promotion_type` enum: `highlight`, `grid`, `top`
- module promotions hiện entity có rồi nhưng service/controller vẫn còn mỏng

---

## Relationship Summary
- `users` 1 - n `bookings`
- `users` 1 - n `refresh_tokens`
- `movies` 1 - n `showtimes`
- `rooms` 1 - n `seats`
- `rooms` 1 - n `showtimes`
- `showtimes` 1 - n `bookings`
- `bookings` 1 - n `booking_seats`
- `seats` 1 - n `booking_seats`
- `movies` n - n `genres` qua `movie_genres`

---

## Important Schema Notes
### 1. Current schema != ERD image 100%
Sơ đồ hình ảnh có thể đang phản ánh một bản thiết kế rộng hơn code hiện tại. Khi có khác biệt, ưu tiên migration + entity.

### 2. Fields currently mismatched or incomplete
Các điểm đang lệch giữa ERD mong muốn và code/migration hiện tại:
- bảng join hiện tại là `movie_genres`, không phải `movie_genre` (đã sửa ERD)
- `genres` hiện chưa có `updated_at` trong entity/migration hiện tại (thêm vào)
- `movies` hiện có `created_at` nhưng chưa có `updated_at` trong migration/entity hiện tại (thêm vào)
- `rooms` migration có `room_type`, nhưng entity hiện tại chưa expose field này (Bỏ trường này đi)
- `seats` hiện chưa có `created_at`, `updated_at` (thêm vào)
- `showtimes` hiện chưa có `updated_at` (thêm vào)
- `bookings` hiện chưa có `updated_at` và chưa có snapshot fields mở rộng (thêm vào)
- `booking_seats` hiện chưa có `snapshot_seat_type`, `created_at`, `updated_at` (thêm vào)

### 3. Implementation status
Schema phần auth, genres, movies, rooms khá rõ.
Các phần bookings, showtimes, seats, payments, promotions vẫn chưa hoàn thiện đồng đều ở service/controller layer.

---

## Related Files
- `src/database/migrations/1710000000000-CreateUsers.ts`
- `src/database/migrations/1710000000001-CreateMovies.ts`
- `src/database/migrations/1710000000002-CreateCinemasRoomsSeats.ts`
- `src/database/migrations/1710000000003-CreateShowtimes.ts`
- `src/database/migrations/1710000000004-CreateBookings.ts`
- `src/database/migrations/1710000000005-CreatePromotions.ts`
- `src/database/migrations/1710000000006.CreateRefreshTokens.ts`
- `src/database/migrations/1710000000007-CreateGenres.ts`
- `src/modules/**/entities/*.entity.ts`
- `.ai/entities-index.json`
- `.ai/diagrams/current-db-schema.png`