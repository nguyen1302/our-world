# We Were Here – Digital Memory Map

Bản đồ ký ức của hai người. Import ảnh từ iPhone → tự đọc EXIF/GPS, reverse geocode,
tạo thumbnail, gom thành **Memory** → hiện trên bản đồ Việt Nam + timeline.

Spec: `docs/superpowers/specs/2026-06-30-our-world-memory-map-design.md`
Plan: `docs/superpowers/plans/2026-06-30-our-world-memory-map.md`

## Tech
Next.js 14 (TS) · Postgres + Drizzle · S3 (presigned upload) · worker xử lý ảnh nền
· Leaflet + OSM · Docker Compose + Caddy.

## Chạy local (dev)
```bash
npm install
cp .env.example .env        # điền S3 + đổi AUTH_SECRET, USERS
# cần một Postgres đang chạy ở DATABASE_URL
npm run db:migrate && npm run db:seed
npm run dev                 # web
npm run worker              # worker (terminal khác)
```

## Tài khoản
Hardcode qua biến `USERS` (JSON, bcrypt hash). Tạo hash:
```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" 'matkhau'
```
Role: `admin` (upload + sửa/xóa), `viewer` (chỉ xem).

## Deploy

**Hướng dẫn đầy đủ (AWS S3 + IAM + EC2 + Caddy + DuckDNS): xem [`DEPLOY.md`](DEPLOY.md).** Tóm tắt nhanh:

### Deploy (EC2 + Docker + DuckDNS)
```bash
cp .env.example .env        # đặt SITE_ADDRESS=ten.duckdns.org, S3 creds, USERS, AUTH_SECRET
docker compose up -d --build
```
Caddy tự cấp HTTPS cho `SITE_ADDRESS`. Cần DuckDNS trỏ về IP EC2 và mở cổng 80/443.

## Test
```bash
npm test          # unit tests (config, auth, exif, thumbnail, cluster, geocode, ...)
```

## Kiến trúc nhanh
- `web` (Next.js): UI + API routes. Upload đi thẳng browser → S3 (presigned PUT).
- `worker`: poll bảng `jobs` → EXIF → geocode → thumbnail (strip GPS) → clustering.
- Bản đồ mặc định focus Việt Nam; Scratch Map tô tỉnh/thành đã có Memory
  (`public/vn-provinces.geojson`).
- v1 chỉ nhận ảnh; video/AI-title/share để backlog (schema đã chừa sẵn).
