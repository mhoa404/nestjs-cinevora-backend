# Rooms Module Summary

## Purpose
Quản lý phòng chiếu.

## Main Files
- `src/modules/rooms/rooms.controller.ts`
- `src/modules/rooms/rooms.service.ts`

## Access
Toàn bộ controller yêu cầu:
- `admin`
- hoặc `super_admin`

## Routes
- `GET /rooms`
- `GET /rooms/:id`
- `POST /rooms`
- `PATCH /rooms/:id`
- `DELETE /rooms/:id`

## Validation Rules
- `name` là chuỗi
- bắt buộc nhập
- tối đa 20 ký tự
- phải đúng format 2 chữ số: `01`, `02`, `03`, ...

## Key Behaviors
### Create
- Check unique room name
- Save room

### Update
- Find room theo id
- Nếu đổi tên thì check unique name
- Save room

### Delete
- Không cho xoá nếu room đang có showtimes

## Important Errors
- `Phòng #id không tồn tại.`
- `Tên phòng đã tồn tại`
- `Không thể xoá phòng đang có suất chiếu`

## Related Tests
- `test/api/rooms/create-room.api.spec.ts`
- `test/api/rooms/update-room.api.spec.ts`
- `test/api/rooms/delete-room.api.spec.ts`
- `test/api/rooms/get-room-by-id.api.spec.ts`
- `test/api/rooms/get-rooms.api.spec.ts`