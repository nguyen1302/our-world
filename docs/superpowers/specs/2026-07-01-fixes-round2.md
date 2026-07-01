# Fixes Round 2 — spec / brainstorm (chưa code, chờ duyệt)

Ngày: 2026-07-01. 6 vấn đề từ người dùng + ảnh chụp mobile.

## 1. Journey: di chuyển xong không cần zoom-out
**Hiện tại:** mỗi chặng `flyToBounds` (zoom OUT để đóng khung 2 điểm) → chạy xe → `flyTo` (zoom IN). Cảm giác giật ra–vào.
**Đề xuất:** bỏ zoom-out trung gian. Chọn **1 mức zoom cố định cho cả journey** (mặc định ~13, chặng xa hơn thì zoom thấp hơn 1 nấc). Khi chạy: **pan theo xe ở zoom không đổi**; tới nơi **giữ nguyên zoom** (không zoom-out). Chặng quá xa (máy bay) mới hạ zoom để thấy đường bay, nhưng **không zoom-out rồi in lại**.
→ Kết quả: mượt, luôn ở mức nhìn rõ, không chớp ra-vào.

## 2. Xem từng ảnh full màn hình như Drive
**Hiện tại:** lightbox có nhưng "bấm vào rất khó xem" (có thể bị panel che / z-index / thao tác kém).
**Đề xuất:** viewer full-screen thật sự:
- Render qua **portal ra `body`**, `z-index` cao nhất, phủ 100dvw×100dvh, nền đen.
- Ảnh center, to hết cỡ (`contain`).
- **Mobile: vuốt trái/phải** chuyển ảnh; **desktop: mũi tên + phím ←/→**; tap nền/nút ✕ để đóng; số thứ tự "3/12".
- (Tùy chọn) pinch-zoom 1 ảnh — để sau nếu cần.

## 3 + 4. Thêm / xoá ảnh + đổi ảnh bìa tại từng mốc
**Nguyên nhân chính:** nút ★ (đặt bìa) và 🗑 (xoá) chỉ hiện khi **hover** → **điện thoại không bấm được**.
**Đề xuất:**
- Trong thẻ chi tiết một **địa điểm (mốc nhỏ)**, mỗi ảnh **luôn hiện** 2 nút nhỏ ★ / 🗑 (không cần hover) — hoặc một nút "Sửa" bật chế độ chọn.
- **Xoá ảnh** (đã có API) → xoá cả S3 + tính lại bìa/khoảng thời gian. Đảm bảo hoạt động trên touch.
- **Đặt ảnh bìa** (đã có API) → touch dùng được.
- **THÊM ảnh vào mốc (mới):** nút "➕ Thêm ảnh" trong thẻ địa điểm → chọn ảnh → upload → **gán thẳng vào memory (địa điểm) này** (không qua clustering), rồi tính lại bìa/trip. Cần: `/api/upload/complete` nhận `memoryId` tùy chọn để worker đính vào đúng place; hoặc endpoint `POST /api/places/:id/add`.

## 5. UI mobile — panel journey rối, đè nhau
**Hiện tại:** panel nhồi badge + Thoát + nhạc + trạng thái + Tiếp trên 1 hàng hẹp → xuống dòng loạn; 2 panel (lớn/nhỏ) chồng thẻ.
**Đề xuất (mobile):**
- Panel journey = **thanh gọn 1 hàng** ghim **đáy màn** (trên timeline): trái = ✕, giữa = "Chặng x/y · tên" (1 dòng, cắt bớt), phải = **Tiếp ▸**. Bỏ badge chữ dài + nút nhạc (đưa nhạc vào menu).
- Panel mốc nhỏ (khi có) = **thanh thứ 2 mảnh** ngay trên panel lớn, cùng kiểu.
- Thẻ chi tiết = bottom-sheet; khi journey chạy, thu gọn để không đè panel.
- Mục tiêu: **mỗi lúc chỉ 1–2 hàng gọn**, chữ đọc được, không chồng.

## 6. Bản đồ load không mượt, bị trắng khi zoom
**Nguyên nhân:** tile Esri tải chậm; nền trống hiện **trắng**; và trên mobile map như co lại (viền xám).
**Đề xuất:**
- Nền map + container = **màu tối** (`--ink`) để lúc chưa có tile là nền tối, không phải trắng (đỡ chói).
- `updateWhenIdle: true`, `keepBuffer` cao, `zoomSnap`/`zoomDelta` mượt; thêm hiệu ứng fade tile.
- Xem lại **chiều cao map trên mobile** (phải full `100dvh` sau topbar) — sửa viền xám.
- Cân nhắc **đổi/để chọn basemap nhẹ hơn** (CARTO Voyager) nếu vẫn chậm — nhưng bạn muốn kiểu vệ tinh (iPhone Find), nên giữ Esri + tối ưu; fallback tối màu.

## Câu hỏi cần chốt trước khi code
1. Journey zoom: dùng **zoom cố định + pan theo xe** (mượt, không ra-vào) đúng ý chứ?
2. Sửa ảnh tại mốc: nút ★/🗑/➕ **luôn hiện** trên mỗi ảnh, hay ẩn sau nút **"Sửa"**?
3. "Thêm ảnh" gán vào **đúng địa điểm** đang mở (đúng chứ?).
4. Bản đồ: giữ **vệ tinh Esri** + tối ưu (nền tối, fade), hay cho **nút đổi giữa Vệ tinh / Bản đồ nhẹ** để mượt hơn?
