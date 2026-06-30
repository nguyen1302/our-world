# We Were Here – Digital Memory Map

## Mục tiêu

Xây dựng một website cá nhân lưu giữ kỷ niệm của hai người trên **bản đồ thế giới**, có thể sử dụng và cập nhật trong nhiều năm.

Website không phải là một gallery ảnh, mà là một **bản đồ ký ức**, nơi mỗi địa điểm lưu giữ một phần câu chuyện của hai người.

---

# Đối tượng sử dụng

Hiện tại:

* Chỉ có một người sử dụng (admin).

Tương lai:

* Có thể mở cho người yêu cùng sử dụng.

---

# Luồng sử dụng

1. Mở website trên iPhone (Safari).
2. Chọn **Import Photos**.
3. Chọn một hoặc nhiều ảnh/video từ Photos.
4. Website upload ảnh.
5. Backend tự động:

   * Đọc EXIF.
   * Lấy thời gian chụp.
   * Lấy GPS.
   * Reverse Geocoding thành tên địa điểm.
   * Tạo thumbnail.
   * Gom các ảnh gần nhau thành một Memory.
6. Memory xuất hiện ngay trên bản đồ.

Người dùng **không cần nhập**:

* thời gian
* địa điểm
* GPS

Các thông tin này đều lấy từ metadata của ảnh.

---

# Memory

Một Memory đại diện cho **một kỷ niệm**, không phải một ảnh.

Ví dụ:

```
Đà Lạt
29–30/06/2026

32 ảnh
4 video
```

Memory gồm:

* Tiêu đề (AI gợi ý hoặc tự sửa)
* Địa điểm
* Quốc gia
* Thành phố
* Thời gian bắt đầu
* Thời gian kết thúc
* Cover ảnh
* Danh sách ảnh
* Danh sách video
* Ghi chú (tùy chọn)

---

# World Map

Website sử dụng bản đồ thế giới làm giao diện chính.

Mỗi Memory hiển thị dưới dạng một marker.

Marker được tạo tự động từ GPS của ảnh.

Click marker sẽ mở Memory Card.

Memory Card hiển thị:

* Cover
* Gallery
* Ngày
* Địa điểm
* Ghi chú

---

# Timeline

Timeline không phải danh sách sự kiện.

Timeline là công cụ điều hướng.

Người dùng drill-down theo thời gian.

```
Year
    ↓
Month
    ↓
Day
    ↓
Time Cluster
    ↓
Memory
```

Ví dụ:

```
2026

↓

June

↓

30

↓

Morning

↓

Cafe

↓

Gallery
```

Khi click timeline:

* Bản đồ tự động pan.
* Zoom đến khu vực tương ứng.
* Highlight Memory.

Timeline và bản đồ luôn đồng bộ hai chiều.

---

# Cluster

Nếu nhiều ảnh:

* chụp gần nhau
* cùng địa điểm
* cùng khoảng thời gian

thì hệ thống tự gom thành một Memory.

Ví dụ:

```
09:15

09:22

09:40

10:05
```

↓

```
Memory

Cafe Tùng
```

---

# Statistics

Website tự thống kê:

* Số Memory
* Số ảnh
* Số video
* Số thành phố
* Số quốc gia

---

# On This Day

Đúng ngày kỷ niệm.

Ví dụ:

```
30 June

2 years ago

You were here.
```

Marker tương ứng sẽ được highlight.

---

# Scratch Map

Những quốc gia đã từng có Memory sẽ được tô màu.

Sau nhiều năm, bản đồ dần được "khám phá".

Hiện tại chỉ mới đi ở Việt Nam

---

# Storage

Metadata:

* PostgreSQL

File:

* Amazon S3

Ảnh:

* Original
* Thumbnail

Mục tiêu là xây dựng một sản phẩm có thể sử dụng trong nhiều năm, nơi mỗi chuyến đi hoặc mỗi kỷ niệm mới chỉ cần import ảnh từ iPhone để tự động xuất hiện trên bản đồ và dòng thời gian.
