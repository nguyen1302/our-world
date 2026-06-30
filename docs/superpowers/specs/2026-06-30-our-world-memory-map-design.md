# Our World – Digital Memory Map — Design Spec

- **Ngày:** 2026-06-30
- **Trạng thái:** Approved design (chờ chuyển sang implementation plan)
- **Tác giả:** dev1.bachkhoa@gmail.com

## 1. Mục tiêu

Một website cá nhân lưu giữ kỷ niệm của hai người trên **bản đồ thế giới**, dùng và cập nhật trong nhiều năm. Không phải gallery ảnh — mà là **bản đồ ký ức**: mỗi địa điểm giữ một phần câu chuyện.

Luồng cốt lõi: mở web trên iPhone → import ảnh → backend tự đọc EXIF (thời gian, GPS), reverse geocode, tạo thumbnail, gom thành **Memory** → Memory hiện ngay trên bản đồ và timeline. Người dùng **không nhập tay** thời gian/địa điểm/GPS.

### Nguyên tắc thiết kế xuyên suốt
- **YAGNI cho v1**, nhưng schema và interface chừa sẵn cho mở rộng (video, multi-tenant, share link, AI).
- **Dễ deploy bằng Docker**; **dễ mở rộng** để sau này có thể kinh doanh.

## 2. Phạm vi

### Trong v1
- Đăng nhập (tài khoản hardcode), 2 role: `admin` (upload + view + sửa/xóa), `viewer` (chỉ view).
- Import **ảnh** (chỉ ảnh — **không nhận video ở v1** để tránh chi phí lưu trữ/ffmpeg).
- Upload thẳng browser → S3 qua presigned URL.
- Pipeline xử lý nền: EXIF → reverse geocode → thumbnail → clustering thành Memory.
- World Map (Leaflet + OSM), **mặc định focus Việt Nam**, marker cluster, Memory Card.
- Xem được ảnh ngay tại **từng node** (click marker → gallery ảnh của Memory đó).
- Timeline drill-down Year→Month→Day→TimeCluster→Memory, đồng bộ 2 chiều với map.
- Scratch Map theo **tỉnh/thành Việt Nam** (tô màu tỉnh/thành đã có Memory).
- Statistics (đếm Memory/ảnh/tỉnh-thành/quốc gia).
- On This Day.
- Mỗi Memory có **title** (gợi ý rule-based theo địa điểm + ngày, admin sửa được) và **mô tả** (description — đoạn text admin tự viết kể về kỷ niệm, tùy chọn).
- **Extras v1:** Route line hành trình (có toggle ẩn/hiện), strip GPS khỏi thumbnail, soft-delete + thùng rác.

### Ngoài v1 (Backlog — xem §11)
Video, AI title thật, share link công khai, export/backup, PWA, On This Day push/email, multi-tenant đầy đủ.

## 3. Quyết định nền tảng

| Quyết định | Lựa chọn | Lý do |
|---|---|---|
| Stack | **Next.js full-stack (TypeScript)**, App Router | 1 codebase UI + API, deploy gọn, dễ mở rộng |
| Storage | **S3** sau interface `StorageProvider` | Chấp nhận phí nhỏ khi vượt free tier; abstraction để đổi R2/MinIO sau |
| AI title | **Rule-based** ở v1 | Không tốn API; chừa sẵn để gắn Claude API sau |
| Deploy | **EC2 t3.micro + Docker Compose + DuckDNS** | Đáp ứng yêu cầu Docker; chạy được worker + sharp; HTTPS qua Caddy |
| Map | **Leaflet + OpenStreetMap** | Free, không cần API key |
| Queue | **Bảng `jobs` trong Postgres** | Không cần Redis ở v1; interface để swap SQS/Redis sau |

### Vì sao EC2+Docker thay vì Vercel
Sản phẩm nặng xử lý media nền (EXIF, thumbnail bằng sharp, clustering, reverse geocode). Serverless của Vercel giới hạn body ~4.5MB và timeout ngắn, làm pipeline này rất gượng. Yêu cầu "dùng Docker" cũng loại Vercel. File lớn đi thẳng browser→S3 nên app server không bị nghẽn.

## 4. Kiến trúc tổng thể

```
Browser (iPhone Safari)
   │  (1) presigned PUT — file đi thẳng
   ▼
[ S3 ]  ◄───────────────┐ (worker đọc original, ghi thumbnail)
   ▲                     │
   │ (2) notify keys     │
[ Caddy: TLS+proxy ] ─► [ web: Next.js (UI + API routes) ] ─► [ Postgres ]
                              │ (3) enqueue (bảng jobs)            ▲
                              ▼                                    │
                       [ worker: Node ] ─ EXIF / geocode / thumbnail / cluster
```

**Container (Docker Compose):**
- `caddy` — reverse proxy + auto-HTTPS (Let's Encrypt) cho domain DuckDNS.
- `web` — Next.js: UI + API routes (auth, presigned URL, CRUD memory, stats).
- `worker` — Node cùng repo: poll bảng `jobs`, xử lý media.
- `postgres` — metadata.
- `S3` — ngoài cluster (AWS), qua interface `StorageProvider`.

**Vì sao tách `worker` khỏi `web`:** xử lý ảnh là việc nền, dài, có thể retry — không nên chặn request HTTP. Tách ra giúp scale/độc lập, và sau này đổi sang SQS không đụng web.

## 5. Luồng upload (không chặn app server)

1. Browser xin app N presigned PUT URL (app validate **chỉ image/* ** và kích thước tối đa).
2. Browser upload thẳng ảnh lên S3.
3. Browser POST danh sách S3 key về app → app tạo `photo` (status=`pending`) + enqueue `process_photo` job.
4. Worker mỗi job: đọc EXIF (thời gian chụp, GPS), reverse geocode (cache), tạo thumbnail bằng sharp (**strip toàn bộ EXIF/GPS khỏi thumbnail**), cập nhật `photo`, rồi chạy clustering để gán hoặc tạo `Memory`.
5. Photo không có GPS hoặc EXIF lỗi → vẫn lưu, gắn cờ `needs_review`, không lên map cho tới khi admin gán thủ công (tương lai) — v1: hiển thị trong danh sách "chưa định vị".
6. Frontend revalidate (poll nhẹ hoặc refetch khi quay lại) → Memory hiện trên bản đồ.

## 6. Clustering — gom ảnh thành Memory

Một Memory = một kỷ niệm (nhiều ảnh), không phải một ảnh.

**Quy tắc:** hai ảnh thuộc cùng Memory nếu **gần nhau về không gian VÀ thời gian**:
- Khoảng cách GPS < `CLUSTER_DISTANCE_KM` (mặc định **1.5 km**).
- Khoảng cách thời gian tới ảnh kế tiếp trong cụm < `CLUSTER_TIME_GAP_HOURS` (mặc định **6 giờ**).

Thuật toán (incremental, chạy khi có ảnh mới):
1. Sắp ảnh theo `taken_at`.
2. Tìm Memory hiện có mà ảnh mới thỏa cả 2 ngưỡng (so với khoảng thời gian + tâm vị trí của Memory) → gán vào.
3. Không có → tạo Memory mới; `lat/lng` = trung bình tọa độ; `start_at`/`end_at` = min/max `taken_at`; `country/city/place_name` = từ reverse geocode của ảnh đại diện; `cover_photo_id` = ảnh đầu; `title` rule-based.
4. Ngưỡng nằm trong config (env), chỉnh được không cần sửa code.

## 7. Đăng nhập & phân quyền

- Tài khoản **hardcode** qua env `USERS` (JSON: `username`, `password_hash` (bcrypt), `role`, `space_id`).
- Role: `admin` (upload + view + sửa/xóa), `viewer` (chỉ view).
- Session: JWT trong **httpOnly cookie** (ký bằng `AUTH_SECRET`).
- Next.js middleware gác route: mọi API ghi (presigned URL, notify, sửa/xóa Memory) yêu cầu `admin`; route đọc cho cả 2 role.
- Auth tách sau interface để v1 hardcode, sau này thay bằng đăng ký thật mà không đụng UI.

## 8. Mô hình dữ liệu

Mọi bảng nghiệp vụ mang `space_id` (v1 có **1 space mặc định**). Mở cho người yêu / nhiều cặp đôi sau này = thêm row, **không migrate schema**.

```
spaces(id, name, created_at)

users(id, space_id, username, password_hash, role['admin'|'viewer'], created_at)

memories(
  id, space_id,
  title, country, city, place_name,
  province_code,              -- mã tỉnh/thành VN, khớp GeoJSON Scratch Map
  lat, lng,
  start_at, end_at,
  cover_photo_id,
  description,                 -- mô tả kỷ niệm (text tự do, tùy chọn)
  deleted_at NULL,            -- soft-delete
  created_at, updated_at
)

photos(
  id, space_id, memory_id NULL,
  type['photo'|'video'],      -- v1 chỉ 'photo'; chừa sẵn video
  s3_key_original, s3_key_thumb,
  taken_at, lat, lng,
  width, height, duration NULL,
  status['pending'|'processed'|'needs_review'|'error'],
  exif_json,                  -- EXIF gốc (chỉ lưu server-side)
  deleted_at NULL,            -- soft-delete
  created_at
)

jobs(
  id, type['process_photo'|...],
  payload_json, status['queued'|'running'|'done'|'error'],
  attempts, last_error NULL,
  created_at, updated_at
)

geocode_cache(
  id, lat_rounded, lng_rounded,   -- cache theo ô lưới làm tròn
  country, city, place_name,
  created_at
)
```

Ghi chú:
- **Soft-delete:** `deleted_at` trên `memories` và `photos`; query mặc định lọc `deleted_at IS NULL`; thùng rác = list các bản ghi có `deleted_at`. Có hành động restore.
- **Strip GPS:** `exif_json` (kèm GPS) chỉ tồn tại server-side; thumbnail public đã strip EXIF.
- `geocode_cache` để không spam Nominatim và tôn trọng usage policy.

## 9. Frontend (map-first)

- **World Map:** Leaflet + OSM tiles; **mặc định center + zoom vào Việt Nam** (toàn cảnh các tỉnh đã đi). `leaflet.markercluster` gom marker.
- **Node = một Memory.** Click marker → **Memory Card** hiện **gallery ảnh ngay tại node đó** (cover, lưới ảnh, ngày, địa điểm, title + mô tả kỷ niệm). Admin sửa được title và mô tả ngay trên card. Click ảnh → xem lớn / lướt gallery. Đây là cách "xem được ảnh ở từng node".
- **Route line:** vẽ polyline nối các Memory theo thứ tự `start_at` — "hành trình" của hai người; có **toggle ẩn/hiện** trên UI.
- **Timeline:** công cụ điều hướng drill-down Year→Month→Day→TimeCluster→Memory. Đồng bộ **2 chiều** với map: click timeline → map pan/zoom + highlight Memory; chọn marker → timeline cuộn tới. State điều hướng dùng chung (shared store) để hai view không lệch.
- **Scratch Map (tỉnh/thành Việt Nam):** layer GeoJSON ranh giới **63 tỉnh/thành Việt Nam**, tô màu tỉnh/thành có ≥1 Memory; "khám phá" dần Việt Nam qua năm tháng (hiện tại mới đi vài tỉnh). Click một tỉnh đã tô màu → danh sách Memory trong tỉnh đó (mở được gallery). Cấu trúc dữ liệu chừa sẵn để nâng lên cấp quốc gia khi sau này đi nước ngoài.
- **Statistics:** đếm Memory, ảnh, (video=0 ở v1), tỉnh/thành, quốc gia.
- **On This Day:** Memory trùng ngày-tháng hôm nay được highlight ("30 June — 2 years ago — You were here.").

## 10. Reverse geocoding

- **Nominatim (OpenStreetMap)** — free, cần tôn trọng usage policy (rate limit, User-Agent). Lấy tới cấp **tỉnh/thành** (`state`/`province` trong địa chỉ OSM) để map vào Scratch Map.
- Kết quả cache vào `geocode_cache` theo ô lưới (làm tròn lat/lng) → tránh gọi lại.
- **Scratch Map theo tỉnh/thành:** sau khi có `province` từ geocode, ánh xạ tên tỉnh về mã tỉnh chuẩn (khớp với `properties` của GeoJSON ranh giới 63 tỉnh/thành VN). Lưu `province_code` trên Memory để tô màu nhanh, không phải point-in-polygon lúc render.
- Fallback offline cho **country** (dataset offline) khi Nominatim lỗi/quá hạn rate.

## 11. Tính mở rộng & Backlog

Thiết kế đã chừa sẵn:
- **Video:** `photos.type` + `duration` đã có; bật bằng cách cho phép `video/*` ở presigned URL + thêm bước ffmpeg tạo poster trong worker.
- **Multi-tenant / kinh doanh:** `space_id` xuyên suốt; thay auth hardcode → đăng ký thật.
- **AI title thật:** thay bước rule-based bằng gọi Claude API.
- **Share link công khai:** Memory read-only qua token (viên gạch thương mại đầu tiên).
- **Storage linh hoạt:** `StorageProvider` → đổi sang Cloudflare R2 / MinIO.
- **Queue:** bảng `jobs` → swap SQS/Redis khi tải lớn.
- **Khác:** export/backup, PWA (Add to Home Screen), On This Day push/email.

## 12. Deploy

- **EC2 t3.micro** (free tier 12 tháng), Docker Compose: `caddy` + `web` + `worker` + `postgres`.
- **Domain:** subdomain DuckDNS (free) trỏ về IP EC2.
- **HTTPS:** Caddy tự cấp/đổi mới Let's Encrypt.
- **S3:** bucket riêng; IAM user quyền tối thiểu (put/get object). Bucket **không public**; ảnh phục vụ qua presigned GET (hoặc qua app).
- **Backup:** dump Postgres định kỳ (cron) lên S3; file gốc đã ở S3.
- **Config:** qua biến môi trường (`USERS`, `AUTH_SECRET`, S3 creds, ngưỡng cluster, Nominatim UA...). Có `.env.example`.

## 13. Rủi ro & lưu ý

- **Free tier hết hạn sau 12 tháng** và S3 vượt 5GB → phát sinh phí; abstraction storage + chỉ-ảnh-ở-v1 giảm thiểu.
- **t3.micro yếu** → giữ thumbnail nhẹ, xử lý tuần tự trong worker, không nhận video.
- **Ảnh thiếu GPS/EXIF** (vd ảnh chụp màn hình, ảnh tải về) → gắn `needs_review`, không lên map.
- **Nominatim rate limit** → cache + fallback offline.
- **iPhone Safari** quyết định luồng upload (input file nhận nhiều ảnh) → cần test thực tế trên Safari.
