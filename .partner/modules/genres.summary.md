# Genres Module Summary

## Purpose
Quản lý thể loại phim.

## Main Files
- `src/modules/genres/genres.controller.ts`
- `src/modules/genres/genres.service.ts`
- `src/modules/genres/utils/genre-input.util.ts`

## Routes
### Public
- `GET /genres`
- `GET /genres/:id`

### Admin / Super Admin
- `POST /genres`
- `PATCH /genres/:id`
- `DELETE /genres/:id`

## Key Behaviors
### Input Normalization
- Trim `name`
- Nếu chuỗi sau trim rỗng -> throw `BadRequestException`
- Tạo `slug` bằng `generateSlug(name)`
- So sánh unique name theo lowercase

### Create
- Check unique name
- Check unique slug
- Save genre mới

### Update
- Tìm genre theo id
- Nếu name + slug không đổi thì return luôn
- Nếu đổi name -> check unique name
- Nếu đổi slug -> check unique slug

### Delete
- Không cho xoá nếu genre đang được dùng bởi movie

## Important Errors
- `Thể loại #id không tồn tại.`
- `Tên thể loại đã tồn tại`
- `Slug này đã tồn tại.`
- `Không thể xoá thể loại đang được sử dụng bởi X phim.`

## Related Tests
- `test/api/genres/create-genre.api.spec.ts`
- `test/api/genres/update-genre.api.spec.ts`
- `test/api/genres/delete-genre.api.spec.ts`