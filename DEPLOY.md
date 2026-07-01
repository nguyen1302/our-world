# Hướng dẫn Setup AWS & Deploy — We Were Here

Deploy bằng **Docker Compose** trên **1 EC2** (free tier), ảnh lưu **S3**, HTTPS tự động qua **Caddy**, domain free **DuckDNS**.

```
Browser ──(presigned PUT)──▶ S3 (ảnh gốc + thumbnail)
   │                              ▲
   ▼                              │ worker đọc/ghi
Caddy(443) ─▶ web(Next.js) ─▶ Postgres      worker(xử lý ảnh)
```

Ước lượng chi phí: **12 tháng đầu ~ $0** (t3.micro 750h/tháng + S3 5GB free). Sau đó EC2 t3.micro ~7–9$/tháng, S3 ~0.023$/GB. Chỉ nhận ảnh (v1) nên dung lượng tăng chậm.

---

## 0. Chuẩn bị
- Tài khoản AWS (đã có free tier).
- Máy cá nhân có SSH.
- ~30 phút.

---

## 1. Tạo S3 bucket (lưu ảnh)

1. AWS Console → **S3** → **Create bucket**.
   - Bucket name: `our-world-media` (tên toàn cầu phải unique — đổi nếu trùng).
   - Region: **ap-southeast-1 (Singapore)** (gần VN). Ghi nhớ region này.
   - **Block all public access: BẬT** (giữ nguyên — ảnh phục vụ qua presigned URL, không để public).
   - Create.

2. **CORS** (bắt buộc — browser upload thẳng lên S3): bucket → tab **Permissions** → **Cross-origin resource sharing (CORS)** → Edit → dán (đổi domain của bạn):
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["https://wewerehere.duckdns.org"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

---

## 2. Tạo IAM user (khoá truy cập S3, quyền tối thiểu)

1. AWS Console → **IAM** → **Users** → **Create user** → tên `our-world-app` → **không** cần console access.
2. Gán policy inline (Permissions → Add permissions → Create inline policy → JSON), đổi tên bucket nếu cần:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::our-world-media/*"
    }
  ]
}
```
3. User → **Security credentials** → **Create access key** → chọn *Application running outside AWS* → lưu lại **Access key ID** và **Secret access key** (dùng cho `.env`).

---

## 3. Tạo EC2 (server chạy Docker)

1. AWS Console → **EC2** → **Launch instance**.
   - Name: `our-world`.
   - AMI: **Ubuntu Server 24.04 LTS**.
   - Instance type: **t3.micro** (hoặc t2.micro — free tier 750h/tháng).
   - Key pair: tạo mới, tải file `.pem` về (để SSH).
   - **Network settings → Security group** mở:
     - SSH (22) — Source: **My IP**.
     - HTTP (80) — Source: **Anywhere 0.0.0.0/0**.
     - HTTPS (443) — Source: **Anywhere 0.0.0.0/0**.
   - Storage: 20–30 GB gp3.
   - Launch. Ghi lại **Public IPv4 address**.

2. SSH vào:
```bash
chmod 400 our-world.pem
ssh -i our-world.pem ubuntu@32.236.39.236
```

---

## 4. Domain free DuckDNS (trỏ về EC2)

1. Vào https://www.duckdns.org → đăng nhập (Google/GitHub).
2. Tạo subdomain, vd `ourworld` → thành `ourworld.duckdns.org`.
3. Ô **current ip**: điền **Public IPv4** của EC2 → **update ip**.
4. (Kiểm tra) `ping wewereher.duckdns.org` phải ra IP EC2.

> Caddy sẽ tự xin chứng chỉ HTTPS Let's Encrypt cho domain này (cần cổng 80/443 mở + domain trỏ đúng IP).

---

## 5. Cài Docker trên EC2

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
newgrp docker   # hoặc logout/login lại
docker --version && docker compose version
```

### ⚠️ 5.1 Tạo swap 2GB — BẮT BUỘC trên máy 1GB RAM

`next build` (type-check) ngốn RAM. EC2 t3.micro/t2.micro chỉ có **1GB RAM, không swap** → lúc build sẽ **hết RAM, treo SSH, instance kẹt ở `Stopping`** (phải **Force Stop**, Start lại, chờ **Status checks 2/2 Passed** mới SSH được). Tạo swap **trước khi build**:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # tự bật lại sau reboot
free -h   # kiểm tra: dòng Swap phải hiện 2.0Gi
```

---

## 6. Lấy code + cấu hình `.env`

```bash
git clone <URL_REPO_CUA_BAN> our-world
cd our-world
cp .env.example .env
```

**Tạo secret & mật khẩu:**
```bash
# AUTH_SECRET
openssl rand -base64 48

# Bcrypt hash cho mật khẩu — dùng container node tạm, KHÔNG build app image
# (⚠️ đừng dùng `docker compose run web ...` — nó sẽ build cả image và OOM trên 1GB RAM).
docker run --rm node:22-slim sh -lc \
  "npm i bcryptjs >/dev/null 2>&1 && node -e \"console.log(require('bcryptjs').hashSync('MAT_KHAU_CUA_BAN',10))\""
```

Sửa `.env` (dùng `nano .env`):
```bash
DATABASE_URL=postgres://ourworld:ourworld@postgres:5432/ourworld
AUTH_SECRET=krQcc0nMBdTe2OzFuftlITDvBsZNnNsadtlASaKE3j0Fdtj01AcKh2FeeLEmZVB3
DEFAULT_SPACE_ID=00000000-0000-0000-0000-000000000001

# ⚠️ Docker Compose nuốt ký tự $ trong env_file → PHẢI double mỗi "$" thành "$$" trong hash.
#   Hash gốc:  $2a$10$abc...   →  ghi:  $$2a$$10$$abc...
USERS=[{"username":"admin","passwordHash":"$$2a$$10$$....","role":"admin"},{"username":"em","passwordHash":"$$2a$$10$$....","role":"viewer"}]

# S3 thật (KHÔNG set S3_ENDPOINT — đó chỉ dùng cho MinIO local)
S3_BUCKET=our-world-media
S3_REGION=ap-southeast-1
S3_ACCESS_KEY_ID=<Access key ID>
S3_SECRET_ACCESS_KEY=<Secret access key>
# S3_ENDPOINT=            # để trống
# S3_FORCE_PATH_STYLE=    # để trống

CLUSTER_DISTANCE_KM=5
CLUSTER_TIME_GAP_HOURS=6
TRIP_DISTANCE_KM=80
TRIP_GAP_HOURS=36

NOMINATIM_USER_AGENT=our-world/1.0 (email-cua-ban@example.com)

# Domain cho Caddy (auto HTTPS)
SITE_ADDRESS=ourworld.duckdns.org
```

> `admin` = upload + sửa/xoá; `viewer` = chỉ xem. Nhớ `$$` cho mọi dấu `$` trong hash.

---

## 7. Deploy

```bash
docker compose up -d --build
```
Lần đầu build vài phút. Container: `postgres`, `web` (tự chạy migrate + seed), `worker`, `caddy`. Xem log:
```bash
docker compose logs -f web       # chờ "Ready"
docker compose logs -f caddy     # chờ Caddy cấp cert (obtained certificate)
```

Mở **https://ourworld.duckdns.org** → đăng nhập `admin` / mật khẩu bạn đặt → Import ảnh (ảnh có bật Location để ra địa điểm thật).

---

## 8. Vận hành

- **Cập nhật code (thủ công):**
```bash
cd /opt/apps/our-world && bash scripts/deploy.sh   # git pull + rebuild web/worker
```
- **Backup Postgres** (cron hằng ngày lên S3):
```bash
docker compose exec -T postgres pg_dump -U ourworld ourworld | gzip > backup-$(date +%F).sql.gz
# rồi: aws s3 cp backup-*.sql.gz s3://our-world-media/backups/   (cần cài aws cli + quyền)
```
  Ảnh gốc đã nằm sẵn trên S3.
- **Xem tài nguyên:** `docker stats`. t3.micro yếu → worker xử lý tuần tự; nếu upload nhiều, chờ vài phút.

---

## 8b. CD — tự động deploy khi push lên `main` (GitHub Actions)

Đã có sẵn `.github/workflows/deploy.yml` + `scripts/deploy.sh`. Mỗi khi push lên `main` (hoặc bấm **Run workflow**), GitHub Actions SSH vào EC2 chạy `scripts/deploy.sh` (git pull + rebuild web/worker).

**Bước 1 — Tạo SSH deploy key riêng (trên máy cá nhân):**
```bash
ssh-keygen -t ed25519 -f ~/.ssh/ourworld_deploy -N "" -C "github-actions deploy"
```
Copy **public key** lên EC2 (cho phép nó SSH vào):
```bash
ssh-copy-id -i ~/.ssh/ourworld_deploy.pub ubuntu@<EC2_IP>
# hoặc thủ công: dán nội dung .pub vào ~/.ssh/authorized_keys trên EC2
```

**Bước 2 — Thêm GitHub Secrets** (repo → Settings → Secrets and variables → Actions → New repository secret):
| Secret | Giá trị |
|---|---|
| `EC2_HOST` | IP EC2 (vd `3.27.111.225`) |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | **toàn bộ nội dung file private** `~/.ssh/ourworld_deploy` (kể cả dòng BEGIN/END) |
| `APP_DIR` | `/opt/apps/our-world` (tuỳ chọn, mặc định đã đúng) |
| `EC2_PORT` | `22` (tuỳ chọn) |

**Bước 3 — Kiểm tra:** push 1 commit lên `main` → tab **Actions** của repo → job **Deploy to EC2** phải xanh. Xong, từ giờ `git push` là tự deploy.

> Lưu ý: build chạy **trên EC2** (đã có swap 2GB). Nếu muốn nhẹ hơn nữa có thể build image ở nơi khác rồi push registry — chưa cần ở giai đoạn này.

---

## 9. Lỗi thường gặp

| Triệu chứng | Nguyên nhân / cách sửa |
|---|---|
| SSH lag rồi mất kết nối lúc build; instance kẹt `Stopping` | Hết RAM (OOM) do build không có swap. **Force Stop** → Start → chờ **Status checks 2/2** → SSH lại → tạo swap (mục 5.1) trước khi build lại. Build đã cap heap 896MB + bỏ ESLint để nhẹ hơn. |
| Đăng nhập luôn sai | Chưa double `$` → `$$` trong `USERS`. Kiểm tra: `docker compose exec web sh -c 'echo "$USERS"'` phải thấy hash đầy đủ `$2a$10$...` |
| Upload ảnh lỗi (CORS) | Thiếu/khác domain trong CORS của S3 (mục 1.2) — phải khớp `https://<domain>` |
| Caddy không cấp được HTTPS | Domain chưa trỏ đúng IP, hoặc cổng 80/443 chưa mở trong Security Group |
| Ảnh không hiện | Sai S3 key/secret/region, hoặc bucket khác region |
| Ảnh lên nhưng không có địa điểm | Ảnh không có GPS (đọc kỹ: iPhone Share → Options → bật Location trước khi lưu/gửi) |

---

## 10. Đổi sang Cloudflare R2 (tuỳ chọn, rẻ hơn — 10GB free, không phí egress)
Code đã tách sau interface `StorageProvider`. Chỉ cần trong `.env`:
```bash
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=true
S3_REGION=auto
S3_ACCESS_KEY_ID=<R2 key>
S3_SECRET_ACCESS_KEY=<R2 secret>
S3_BUCKET=our-world-media
```
Nhớ set CORS tương tự trên bucket R2.
