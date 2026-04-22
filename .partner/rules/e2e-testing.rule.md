# E2E Testing Rule

## Mục tiêu
Viết test E2E cho backend NestJS theo đúng pattern hiện tại của repo Cinevora:
- test chạy trên `AppModule` thật
- không mock service nghiệp vụ chính
- ưu tiên kiểm tra hành vi API từ ngoài vào trong
- mỗi file test tập trung vào **1 endpoint hoặc 1 luồng API chính**

---

## 1. Cấu trúc file test bắt buộc

Mỗi file E2E nên theo khung này:

1. Import:
- `INestApplication`, `ValidationPipe`
- `Test`, `TestingModule`
- `request`, `Response` từ `supertest`
- `cookieParser`
- `Server`
- `DataSource` nếu cần seed/cleanup DB
- `AppModule`
- helper từ `test/helpers/http-test.helper`
- helper report từ `test/helpers/excel-reporter`

2. Khai báo biến:
- `app`
- `server`
- `dataSource` nếu cần
- token (`adminToken`, `customerToken`) nếu route có auth
- ids hoặc seed data phục vụ test
- `results: TestCaseRecord[]`
- `PREFIX`
- `counter`

3. Hàm dùng lại:
- `nextId()`
- `stringifyProcedure()`
- `record()`

4. Hook:
- `beforeAll()`
- `afterAll()`

5. Nhóm test:
- validation / input lỗi
- auth / permission lỗi
- business rule lỗi
- happy path

---

## 2. Cách bootstrap app trong E2E

Trong `beforeAll()` luôn làm theo chuẩn này:

- set `process.env.ENABLE_RECAPTCHA = 'false'`
- tạo testing module từ `AppModule`
- tạo Nest app thật bằng `createNestApplication()`
- bật `ValidationPipe` giống runtime:
  - `whitelist: true`
  - `forbidNonWhitelisted: true`
  - `transform: true`
  - `stopAtFirstError: true`
- dùng `cookieParser()`
- `await app.init()`
- lấy `server = app.getHttpServer()`

Không tự tạo config lệch với `main.ts` nếu không có lý do thật sự rõ ràng.

---

## 3. Quy tắc auth trong test

### Route public
Không cần token.

### Route protected
Phải lấy token thật bằng cách login qua API:
- admin: `api_tester@gmail.com / Api_tester_123`
- customer: `api_client@gmail.com / Api_client_123`

Ưu tiên login qua:
- `POST /auth/mobile/login`

Lý do:
- response body trả trực tiếp `accessToken`
- dễ dùng cho test protected route

### Với Web auth
Nếu test route web liên quan refresh/logout:
- kiểm tra `set-cookie`
- gửi lại cookie qua header `Cookie`

---

## 4. Quy tắc đặt cấu trúc test case

Mỗi file nên đi theo thứ tự:

### A. Validation / Input lỗi
Ví dụ:
- thiếu field bắt buộc
- sai kiểu dữ liệu
- sai format
- gửi field lạ
- parse param lỗi

### B. Auth / Permission lỗi
Ví dụ:
- không gửi token
- token không hợp lệ
- role không đủ quyền

### C. Business rule lỗi
Ví dụ:
- dữ liệu trùng
- entity không tồn tại
- quan hệ không hợp lệ
- vi phạm rule nghiệp vụ

### D. Happy path
Ví dụ:
- tạo thành công
- cập nhật thành công
- lấy danh sách thành công
- xoá thành công

Không viết happy path trước rồi mới viết case lỗi.

---

## 5. Chuẩn assertion

Mỗi test phải assert theo thứ tự:

1. `response.status`
2. payload/error body
3. side effect quan trọng nếu có
4. cookie/header nếu endpoint có liên quan

### Với success
- dùng `parseApiData<T>(response)`
- chỉ assert các field quan trọng
- nếu service có normalize dữ liệu thì phải assert giá trị đã được normalize

Ví dụ:
- string bị trim
- slug đúng pattern
- danh sách trả về đúng thứ tự
- relation count đúng

### Với error
- dùng `parseApiError(response)`
- dùng `expectErrorMessage(...)`
- kiểm tra đúng status code và message chính

Không assert nguyên body quá cứng nếu không cần.

---

## 6. Chuẩn seed và cleanup dữ liệu

### Seed
Chỉ seed đúng phần cần cho test:
- tạo entity qua repository/DataSource khi cần setup nhanh
- hoặc gọi API trước nếu muốn test xuyên suốt theo luồng thật

### Cleanup
Trong `afterAll()` hoặc cuối file:
- xoá dữ liệu test đã tạo
- không để dữ liệu test bẩn ảnh hưởng file khác

Nếu file test tạo nhiều entity, phải lưu lại id đã tạo để cleanup.

---

## 7. Chuẩn report test

Mỗi file test phải:
- có `results: TestCaseRecord[]`
- có `PREFIX`
- có hàm `record(...)`
- gọi `exportTestReport(results, PREFIX, '<ReportName>')` trong `afterAll()`

`record()` phải luôn:
- ghi `testDate`
- ghi `actualResult`
- ghi `passed`
- push vào `results` cả khi test fail

---

## 8. Chuẩn naming

### File name
Theo pattern:
- `create-xxx.api.spec.ts`
- `update-xxx.api.spec.ts`
- `delete-xxx.api.spec.ts`
- `get-xxx.api.spec.ts`

### describe đầu file
Theo pattern:
- `[API] METHOD /route`

Ví dụ:
- `[API] POST /auth/login`
- `[API] PATCH /rooms/:id`

### Scope
Dùng thống nhất một trong các giá trị:
- `Web`
- `Mobile`
- `All`

### Test case id
Ưu tiên chuẩn:
- `ABC00`, `ABC01`, `ABC02`

Nếu file cũ đang dùng format khác thì file mới không bắt chước format lỗi; chuẩn hoá dần về 3 chữ cái in hoa + 2 chữ số.

---

## 9. Những gì luôn phải test cho một endpoint mới

Khi thêm E2E cho endpoint mới, tối thiểu phải có:

### Nếu là endpoint protected
- không có token
- token role sai

### Nếu có DTO input
- thiếu field bắt buộc
- sai kiểu dữ liệu
- sai format
- field lạ bị chặn bởi whitelist

### Nếu có business rule
- case vi phạm rule chính
- case entity liên quan không tồn tại
- case dữ liệu trùng nếu có unique

### Luôn có
- ít nhất 1 happy path

---

## 10. Quy tắc riêng theo repo Cinevora

### Auth
Phải test tách `Web` và `Mobile` nếu endpoint có 2 flow khác nhau.

### Genres / Movies / Rooms
Phải test đủ 3 lớp:
- validation
- role/permission
- business rule
- happy path

### Movies
Khi test create/update nên chú ý thêm:
- trim text
- `slug` pattern
- `genreIds` hợp lệ / không hợp lệ
- rule `endDate`

### Rooms
Khi test create/update nên chú ý:
- format room name `01`, `02`, ...
- unique name
- rule không xoá khi còn showtime

---

## 11. Những điều không được làm

- Không mock service nghiệp vụ chính trong API E2E
- Không bỏ qua `ValidationPipe` setup
- Không viết test chỉ assert status code mà không kiểm tra payload/message
- Không seed dữ liệu dư thừa không phục vụ test
- Không để data test tồn đọng sau khi file chạy xong
- Không trộn quá nhiều endpoint khác nhau vào cùng một spec file

---

## 12. Template ngắn phải bám theo

Mỗi spec file mới phải gần với form này:

- `beforeAll()`:
  - bootstrap app thật
  - disable recaptcha
  - init server
  - login lấy token nếu cần
  - seed data nếu cần

- `describe('Luồng lỗi validation')`
- `describe('Luồng lỗi phân quyền/xác thực')`
- `describe('Luồng lỗi nghiệp vụ')`
- `describe('Luồng thành công')`

- `afterAll()`:
  - cleanup data
  - export excel report
  - close app

---

## 13. Mục tiêu cuối cùng

Test E2E trong repo này phải:
- dễ đọc
- dễ mở rộng
- bám sát hành vi API thật
- có report xuất ra
- phản ánh đúng validation, auth, role và business rule đang chạy trong app

## 14. Database-Aware E2E
Trước khi viết E2E có liên quan DB:
1. đọc `.ai/database-schema-current.md`
2. xác định đúng bảng, FK và relation
3. seed dữ liệu theo schema thật hiện tại, không seed theo ERD dự kiến

Nếu schema trong ảnh ERD khác với migration/entity hiện tại, phải bám migration/entity hiện tại.