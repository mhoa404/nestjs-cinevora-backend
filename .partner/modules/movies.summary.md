# Movies Module Summary

## Purpose
Quản lý phim và quan hệ với genres.

## Main Files
- `src/modules/movies/movies.controller.ts`
- `src/modules/movies/movies.service.ts`
- `src/modules/movies/utils/movie-input.util.ts`

## Routes
### Public
- `GET /movies`
- `GET /movies/:slugOrId`

### Admin / Super Admin
- `POST /movies`
- `PUT /movies/:id`
- `DELETE /movies/:id`

## Key Behaviors
### Create
- Validate `endDate`
- Normalize input text fields
- Validate `genreIds`
- Save movie lần 1 để lấy id
- Build slug theo format: `baseSlug-XXX`
- Save lần 2 để cập nhật slug

### Read
- `findAll` load luôn `genres`
- `findOneBySlugOrId` hỗ trợ:
  - nếu param toàn số -> tìm theo id
  - ngược lại -> tìm theo slug

### Update
- Find movie theo id
- Validate `endDate`
- Normalize input
- Validate `genreIds`
- Rebuild slug theo title mới
- Update relations genres

### Delete
- Chỉ được xoá khi `status === ended`

## Validation Rules
- `duration > 0`
- `endDate` phải cách ít nhất 7 ngày kể từ hôm nay
- `endDate` phải sau `releaseDate`
- `genreIds` phải tồn tại hết trong DB

## Slug Rule
Slug không chỉ là title slugify, mà là:
`{baseSlug}-{id_pad_3}`

Ví dụ:
- title: `Thiên Đường Máu`
- slug base: `thien-duong-mau`
- id: `1`
- final slug: `thien-duong-mau-001`

## Related Tests
- `test/api/movies/create-movie.api.spec.ts`
- `test/api/movies/update-movie.api.spec.ts`
- `test/api/movies/delete-movie.api.spec.ts`