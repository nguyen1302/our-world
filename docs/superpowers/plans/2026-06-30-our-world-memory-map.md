# Our World – Memory Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Website bản đồ ký ức cho hai người: import ảnh từ iPhone → backend tự đọc EXIF/GPS, reverse geocode, thumbnail, gom thành Memory → hiện trên bản đồ Việt Nam + timeline.

**Architecture:** Monorepo Next.js (App Router, TS) chạy cả UI + API routes; một worker Node cùng repo poll bảng `jobs` trong Postgres để xử lý ảnh nền (EXIF → geocode → thumbnail → clustering). File gốc + thumbnail trên S3 (sau interface `StorageProvider`), browser upload thẳng lên S3 qua presigned URL. Deploy bằng Docker Compose: `caddy` + `web` + `worker` + `postgres`.

**Tech Stack:** Next.js 14, TypeScript, Drizzle ORM + Postgres, jose (JWT cookie), @aws-sdk/client-s3 (+ presigner), exifr (EXIF), sharp (thumbnail), react-leaflet + leaflet.markercluster (map), Nominatim (geocode), Docker Compose, Caddy.

## Global Constraints

- TypeScript strict; Node 20.
- **v1 chỉ nhận ảnh** (`image/*`); chặn video ở presigned URL + validate MIME. Schema vẫn giữ `type`/`duration` cho video tương lai.
- Mọi bảng nghiệp vụ mang `space_id`; v1 có 1 space mặc định (seed).
- 2 role: `admin` (upload + view + sửa/xóa), `viewer` (chỉ view). Tài khoản hardcode qua env `USERS` (JSON, password bcrypt hash).
- Thumbnail **strip toàn bộ EXIF/GPS**; tọa độ chỉ lưu trong DB.
- Soft-delete (`deleted_at`) cho `memories` và `photos`.
- Bản đồ mặc định focus Việt Nam; Scratch Map theo 63 tỉnh/thành (GeoJSON), tô tỉnh có ≥1 Memory.
- Cluster mặc định: `CLUSTER_DISTANCE_KM=1.5`, `CLUSTER_TIME_GAP_HOURS=6` (đọc từ env).
- Queue = bảng `jobs` trong Postgres (không Redis ở v1).

---

## File Structure

```
our-world/
  docker-compose.yml          # caddy + web + worker + postgres
  Dockerfile                  # multi-stage; build chung, command khác cho web/worker
  Caddyfile                   # reverse proxy + auto HTTPS (DuckDNS)
  .env.example
  drizzle.config.ts
  package.json / tsconfig.json / next.config.mjs
  src/
    db/
      schema.ts               # Drizzle schema: spaces/users/memories/photos/jobs/geocode_cache
      index.ts                # db client (pg Pool + drizzle)
      seed.ts                 # seed space mặc định + users từ env
    lib/
      config.ts               # đọc & validate env
      auth.ts                 # JWT cookie: createSession/verifySession, role guard
      storage.ts              # StorageProvider interface + S3Provider (presign put/get)
      geocode.ts              # Nominatim + cache + map province_code
      provinces.ts            # bảng tra tên tỉnh OSM -> province_code VN
      cluster.ts              # assignToMemory(photo): tìm/ tạo Memory theo dist+time
      exif.ts                 # đọc taken_at/lat/lng/size từ buffer
      thumbnail.ts            # sharp resize + strip metadata
      title.ts                # rule-based title từ place + date
      jobs.ts                 # enqueue/claim/complete job
    worker/
      index.ts                # vòng lặp poll jobs, gọi processPhoto
      processPhoto.ts         # pipeline 1 ảnh
    app/
      layout.tsx / globals.css
      login/page.tsx          # form đăng nhập
      page.tsx                # trang chính: Map + Timeline + panels (client)
      api/auth/login/route.ts
      api/auth/logout/route.ts
      api/upload/presign/route.ts   # admin: tạo presigned PUT
      api/upload/complete/route.ts  # admin: tạo photo rows + enqueue
      api/memories/route.ts         # GET list (geojson-ish) cho map/timeline
      api/memories/[id]/route.ts    # GET detail, PATCH (title/description), DELETE (soft)
      api/photos/[id]/url/route.ts  # presigned GET cho ảnh
      api/stats/route.ts            # thống kê
      api/scratch/route.ts          # tỉnh đã có memory
      middleware.ts                 # gác route theo session/role
    components/
      WorldMap.tsx            # react-leaflet, markers, route line toggle
      MemoryCard.tsx          # gallery + title/description edit
      Timeline.tsx            # drill-down + sync map
      ScratchMap.tsx          # GeoJSON tỉnh tô màu
      Stats.tsx / OnThisDay.tsx / UploadButton.tsx
      mapStore.ts             # zustand store đồng bộ map<->timeline
  public/
    vn-provinces.geojson      # ranh giới 63 tỉnh/thành
  tests/                      # vitest unit tests cho lib/*
```

---

### Task 1: Project scaffold + tooling

**Files:** Create `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`, `src/lib/config.ts`, `tests/config.test.ts`

**Produces:** `getConfig(): AppConfig` với các field: `databaseUrl`, `authSecret`, `users: User[]`, `s3: {bucket, region, endpoint?, accessKeyId, secretAccessKey, publicBaseUrl?}`, `clusterDistanceKm`, `clusterTimeGapHours`, `nominatimUserAgent`, `defaultSpaceId`.

- [ ] Step 1: `package.json` với deps (next, react, drizzle-orm, pg, jose, bcryptjs, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, exifr, sharp, react-leaflet, leaflet, leaflet.markercluster, zustand) + devDeps (typescript, vitest, @types/*, drizzle-kit, tsx).
- [ ] Step 2: tsconfig strict, next.config, vitest config, .gitignore, .env.example.
- [ ] Step 3 (TDD): `tests/config.test.ts` — `getConfig` parse `USERS` JSON, fail nếu thiếu `AUTH_SECRET`/`DATABASE_URL`.
- [ ] Step 4: implement `src/lib/config.ts`. Run `npx vitest run config` → PASS. Commit.

### Task 2: DB schema + client + migrations

**Files:** Create `src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`, `src/db/seed.ts`, `tests/schema.test.ts`

**Consumes:** `getConfig`.
**Produces:** Drizzle tables `spaces, users, memories, photos, jobs, geocodeCache`; `db` client; `seed()`.

Schema theo §8 spec (memories có `provinceCode`, `description`, `deletedAt`; photos có `type`, `duration`, `status`, `exifJson`, `deletedAt`).

- [ ] Step 1: viết `schema.ts` đủ cột + enums + indexes (memories.spaceId, photos.memoryId, jobs.status).
- [ ] Step 2: `index.ts` tạo pg Pool + drizzle. `drizzle.config.ts` cho `drizzle-kit generate/push`.
- [ ] Step 3: `seed.ts` insert space `defaultSpaceId` + users từ config (idempotent, on conflict do nothing).
- [ ] Step 4: smoke test biên dịch schema (vitest import). Commit.

### Task 3: Auth (JWT cookie + role guard) + middleware

**Files:** Create `src/lib/auth.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/middleware.ts`, `tests/auth.test.ts`

**Consumes:** `getConfig`.
**Produces:** `createSessionToken(user)`, `verifySessionToken(token): Session|null`, `requireRole(req, 'admin'|'viewer')`. Cookie name `ow_session`, httpOnly.

- [ ] Step 1 (TDD): test sign+verify round-trip; verify rejects tampered token.
- [ ] Step 2: implement auth.ts với jose (HS256, `authSecret`). bcryptjs compare password trong login route.
- [ ] Step 3: login route — validate username/password vs config.users → set cookie; logout clears.
- [ ] Step 4: middleware — redirect chưa login → `/login`; chặn API ghi nếu không phải admin (403).
- [ ] Step 5: run vitest auth → PASS. Commit.

### Task 4: Storage provider (S3 presign)

**Files:** Create `src/lib/storage.ts`, `tests/storage.test.ts`

**Consumes:** `getConfig`.
**Produces:** interface `StorageProvider { presignPut(key, contentType): Promise<string>; presignGet(key): Promise<string>; putObject(key, body, contentType): Promise<void>; getObject(key): Promise<Buffer> }`; `getStorage(): StorageProvider` (S3Provider). Key scheme: `originals/{spaceId}/{uuid}.{ext}`, `thumbs/{spaceId}/{uuid}.webp`.

- [ ] Step 1 (TDD): test key builder `originalKey/thumbKey` cho ra đúng prefix + ext.
- [ ] Step 2: implement S3Provider (S3Client + getSignedUrl). Hỗ trợ `endpoint` (R2/MinIO sau).
- [ ] Step 3: run vitest storage → PASS. Commit.

### Task 5: EXIF + thumbnail + title (pure libs)

**Files:** Create `src/lib/exif.ts`, `src/lib/thumbnail.ts`, `src/lib/title.ts`, `tests/exif.test.ts`, `tests/thumbnail.test.ts`, `tests/title.test.ts`, fixtures ảnh test.

**Produces:**
- `readExif(buf): { takenAt: Date|null, lat: number|null, lng: number|null, width: number|null, height: number|null }`
- `makeThumbnail(buf, maxPx=1200): Promise<Buffer>` (webp, **strip metadata**)
- `buildTitle({placeName, city, startAt, endAt}): string` (vd "Đà Lạt · 29–30/06/2026")

- [ ] Step 1 (TDD): title test các case (cùng ngày / khác ngày / thiếu place).
- [ ] Step 2: implement title.ts. Vitest → PASS.
- [ ] Step 3 (TDD): thumbnail test — output webp, kích thước ≤ maxPx, **không còn EXIF** (đọc lại bằng exifr ra rỗng).
- [ ] Step 4: implement thumbnail.ts (sharp `.rotate().resize().webp()` + không `withMetadata`). Vitest → PASS.
- [ ] Step 5 (TDD): exif test trên fixture có GPS → trả lat/lng/takenAt; fixture không GPS → null.
- [ ] Step 6: implement exif.ts (exifr). Vitest → PASS. Commit.

### Task 6: Geocode + provinces mapping

**Files:** Create `src/lib/provinces.ts`, `src/lib/geocode.ts`, `tests/geocode.test.ts`

**Consumes:** `getConfig`, `db` (geocodeCache).
**Produces:** `reverseGeocode(lat, lng): Promise<{ country, city, placeName, provinceCode }>` (cache theo lat/lng làm tròn 3 chữ số); `resolveProvinceCode(stateName): string|null`.

- [ ] Step 1: `provinces.ts` — map tên tỉnh OSM (vi/en) → mã (vd `VN-DALAT`/dùng mã tỉnh chuẩn). Đủ 63 tỉnh; fuzzy normalize bỏ dấu.
- [ ] Step 2 (TDD): test `resolveProvinceCode("Lâm Đồng")`/("Lam Dong")/("Da Lat" qua city) → mã đúng; tên lạ → null.
- [ ] Step 3 (TDD): test reverseGeocode dùng cache hit (mock fetch gọi 1 lần cho 2 toạ độ cùng ô lưới).
- [ ] Step 4: implement geocode.ts (fetch Nominatim với User-Agent, parse address.state/city/town/village; ghi cache). Vitest → PASS. Commit.

### Task 7: Clustering

**Files:** Create `src/lib/cluster.ts`, `tests/cluster.test.ts`

**Consumes:** `db`, config thresholds.
**Produces:** `assignPhotoToMemory(photo): Promise<memoryId>` — tìm Memory cùng space thỏa khoảng cách (haversine ≤ km) và thời gian (|taken_at - [start,end]| ≤ gap) → gán; nếu không có → tạo Memory mới (lat/lng = vị trí ảnh, start/end = takenAt, title rule-based, country/city/place/provinceCode từ geocode). Cập nhật bounds + cover khi gán.

- [ ] Step 1 (TDD): `haversineKm(a,b)` test khoảng cách biết trước.
- [ ] Step 2: implement haversine. PASS.
- [ ] Step 3 (TDD): test logic chọn memory với 2 ảnh gần (cùng memory) và 1 ảnh xa/khác thời gian (memory mới) — dùng in-memory fake repo.
- [ ] Step 4: implement `assignPhotoToMemory` (tách phần thuần `pickMemory(candidates, photo, cfg)` để test không cần DB). Vitest → PASS. Commit.

### Task 8: Jobs queue helpers

**Files:** Create `src/lib/jobs.ts`, `tests/jobs.test.ts`

**Produces:** `enqueue(type, payload)`, `claimNext(): Job|null` (SELECT ... FOR UPDATE SKIP LOCKED, set running), `completeJob(id)`, `failJob(id, err)` (attempts++, status error/queued retry < 3).

- [ ] Step 1: implement helpers (raw SQL qua drizzle/pg cho SKIP LOCKED).
- [ ] Step 2 (TDD nếu DB test khả thi, else smoke import). Commit.

### Task 9: Upload API (presign + complete)

**Files:** Create `src/app/api/upload/presign/route.ts`, `src/app/api/upload/complete/route.ts`

**Consumes:** auth (admin), storage, jobs.
**Produces:**
- `POST /api/upload/presign` body `{files:[{filename, contentType}]}` → `{items:[{key, url}]}`. **Reject nếu contentType không phải `image/*`.**
- `POST /api/upload/complete` body `{keys:[{key, contentType, filename}]}` → tạo `photos`(status `pending`) + `enqueue('process_photo', {photoId})` mỗi ảnh.

- [ ] Step 1: presign route (admin guard, validate image/*). Commit.
- [ ] Step 2: complete route (insert photos + enqueue). Commit.

### Task 10: Worker pipeline

**Files:** Create `src/worker/index.ts`, `src/worker/processPhoto.ts`

**Consumes:** jobs, storage, exif, thumbnail, geocode, cluster, db.
**Produces:** `processPhoto(photoId)` — getObject original → readExif → nếu thiếu GPS set status `needs_review` & return; reverseGeocode → makeThumbnail → putObject thumb → update photo (taken_at, lat/lng, thumb key, width/height, status `processed`) → assignPhotoToMemory. `index.ts` vòng lặp claimNext mỗi 2s, completeJob/failJob.

- [ ] Step 1: processPhoto.ts. Step 2: index.ts loop với graceful shutdown. Commit.

### Task 11: Read APIs (memories, photo url, stats, scratch)

**Files:** Create `src/app/api/memories/route.ts`, `src/app/api/memories/[id]/route.ts`, `src/app/api/photos/[id]/url/route.ts`, `src/app/api/stats/route.ts`, `src/app/api/scratch/route.ts`

**Produces:**
- `GET /api/memories` → `[{id,title,lat,lng,startAt,endAt,coverThumbUrl,provinceCode,photoCount}]` (deletedAt null), sort theo startAt.
- `GET /api/memories/:id` → detail + photos (mỗi photo `thumbUrl` presigned).
- `PATCH /api/memories/:id` (admin) → sửa `title`,`description`.
- `DELETE /api/memories/:id` (admin) → set deletedAt (soft).
- `GET /api/photos/:id/url` → `{url}` presigned GET original.
- `GET /api/stats` → `{memories, photos, videos:0, provinces, countries}`.
- `GET /api/scratch` → `{provinceCodes:[...]}` đã có memory.

- [ ] Step per route, commit cuối. (Presigned URL cache ngắn để tránh chậm.)

### Task 12: Frontend — map store + WorldMap + MemoryCard

**Files:** Create `src/components/mapStore.ts`, `WorldMap.tsx`, `MemoryCard.tsx`, `public/vn-provinces.geojson`

**Produces:** zustand store `{memories, selectedId, showRoute, focus, select(id), setMemories, toggleRoute}`. WorldMap: react-leaflet center VN (`[16.0, 107.8]`, zoom 6), markercluster, route polyline (toggle), click marker → select. MemoryCard: gallery (thumbUrl, click → full url), title/description edit (admin PATCH).

- [ ] Steps: store → WorldMap (dynamic import, ssr:false) → MemoryCard. Commit.

### Task 13: Frontend — Timeline + ScratchMap + Stats + OnThisDay + Upload + page

**Files:** Create `Timeline.tsx`, `ScratchMap.tsx`, `Stats.tsx`, `OnThisDay.tsx`, `UploadButton.tsx`, `src/app/page.tsx`, `login/page.tsx`, `layout.tsx`, `globals.css`

**Produces:** Timeline drill-down Year→Month→Day→cluster→memory, click → store.focus + select (map pan). ScratchMap GeoJSON tô tỉnh từ `/api/scratch`. Stats hiển thị số liệu. OnThisDay highlight. UploadButton: chọn nhiều ảnh → presign → PUT S3 → complete → poll refresh. page.tsx ghép tất cả; login form.

- [ ] Steps theo component, commit cuối.

### Task 14: Docker + Caddy + compose + seed-on-start

**Files:** Create `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `scripts/start-web.sh`, `scripts/start-worker.sh`, update README

**Produces:** image multi-stage (deps → build → runner); compose services postgres/web/worker/caddy; web chạy migrate+seed rồi `next start`; worker chạy `tsx src/worker/index.ts`. Caddy reverse proxy `:80/:443` → web:3000 với domain DuckDNS (env `SITE_ADDRESS`).

- [ ] Step 1: Dockerfile + start scripts. Step 2: compose + Caddyfile + .env.example đầy đủ. Step 3: `docker compose build`. Commit.

### Task 15: End-to-end verify

- [ ] `docker compose up -d`; chờ healthy.
- [ ] Mở web → login bằng user admin từ env.
- [ ] Upload vài ảnh có GPS (fixture) → worker xử lý → marker hiện trên bản đồ VN; tỉnh tô màu; stats tăng.
- [ ] Sửa title/description trên MemoryCard; toggle route line; soft-delete.
- [ ] Ghi kết quả verify (lệnh + output) vào PR/commit message.

---

## Self-Review

- **Spec coverage:** auth/role (T3), chỉ-ảnh (T9), upload→S3 presign (T4,T9), EXIF/geocode/thumbnail/cluster pipeline (T5–T7,T10), jobs queue (T8), map focus VN + node gallery (T12), timeline sync (T13), scratch map tỉnh/thành (T11,T13), stats/on-this-day (T11,T13), route line toggle (T12), strip GPS (T5), soft-delete (T2,T11), title+description (T5,T11,T12), Docker+Caddy+DuckDNS (T14). ✓
- **Placeholders:** none — mỗi task có file path + interface + lệnh test cụ thể.
- **Type consistency:** `assignPhotoToMemory`, `reverseGeocode`, `StorageProvider`, `readExif`, `makeThumbnail`, `buildTitle` dùng nhất quán giữa T5–T7, T10.
- Backlog (video/AI title/share/PWA) ngoài phạm vi — đúng spec.
