# 📚 Mini Reading Tracker

Một ứng dụng web giúp người dùng **tìm kiếm sách**, **lưu vào tủ sách cá nhân**, và **theo dõi tiến độ đọc** trực quan. 
Dữ liệu sách được lấy từ Public API của [Open Library](https://openlibrary.org/).

*(Vui lòng thay thế đoạn này bằng ảnh chụp màn hình UI ứng dụng của bạn)*
<!-- ![Demo App](./screenshot.png) -->

---

## 🛠️ Công nghệ sử dụng

- **Frontend:** Vue.js 3, Vite, Vanilla CSS (Glassmorphism UI, Không dùng Tailwind).
- **Backend:** Node.js thuần (Native HTTP Module - không dùng Express), Axios.
- **Database:** MySQL.
- **Tích hợp API:** [Open Library Search API](https://openlibrary.org/dev/docs/api/search) & [Books API](https://openlibrary.org/dev/docs/api/books).

---

## 🚀 Hướng dẫn chạy Local (Môi trường phát triển)

### Yêu cầu hệ thống:
- [Node.js](https://nodejs.org/en/) (phiên bản 16+)
- [MySQL Server](https://dev.mysql.com/downloads/mysql/) đang hoạt động.

### Bước 1: Khởi tạo Database
1. Mở công cụ MySQL (như MySQL Workbench hoặc CLI).
2. Chạy nội dung file `structsql.txt` đính kèm ở thư mục gốc. 
   - Lệnh này sẽ tự động khởi tạo database tên `reading_tracker` và bảng `books`.

### Bước 2: Chạy Backend (Node.js)
1. Mở Terminal và di chuyển vào thư mục `be`:
   ```bash
   cd be
   ```
2. Cài đặt các gói phụ thuộc (nếu chưa cài):
   ```bash
   npm install
   ```
3. Cấu hình Database: Mở file `be/.env` và sửa đổi `DB_PASSWORD` / `DB_USER` sao cho khớp với tài khoản MySQL của bạn.
4. Chạy Server:
   ```bash
   npm start
   ```
   *Terminal hiển thị: `Node.js HTTP Server is running on http://localhost:3000` là thành công.*

### Bước 3: Chạy Frontend (Vue.js)
1. Mở một Terminal khác, di chuyển vào thư mục `frontend`:
   ```bash
   cd frontend
   ```
2. Cài đặt các gói phụ thuộc:
   ```bash
   npm install
   ```
3. Khởi chạy Vite Dev Server:
   ```bash
   npm run dev
   ```
4. Truy cập ứng dụng qua đường dẫn được cung cấp (Thường là `http://localhost:5173`).

---

## 🏗️ Mô tả kiến trúc

- **Kiến trúc:** Client-Server. 
  - Frontend (Vue) không bao giờ gọi trực tiếp API của bên thứ 3 (Open Library) để tránh lộ logic và gặp lỗi CORS. 
  - Backend Node.js đóng vai trò như một Proxy server gọi dữ liệu, lọc gọn chuỗi JSON khổng lồ trả về dạng đơn giản nhất, sau đó mới gửi lại cho Frontend.
- **Sơ đồ Database (Bảng `books`):**
  - Quản lý metadata sách (`open_library_work_id`, `title`, `author`, `cover_url`, `total_pages`,...).
  - Quản lý tracking cá nhân (`status` kiểu Enum: `WANT_TO_READ`, `READING`, `READ`, `current_page`, `rating`, `note`).
  - Tự động hóa dấu mốc (`started_at`, `finished_at`).
  - Indexing: Được thiết lập chỉ mục (index) cho `status` và `created_at` để truy xuất tốc độ cao.

---

## 📡 Danh sách API (Backend endpoints)

**Base URL:** `http://localhost:3000`

### 1. Proxy Open Library
- `GET /api/books/search?q={keyword}&page={n}&limit=20` : Tìm kiếm sách.
- `GET /api/books/:workId` : Lấy chi tiết tác phẩm (Ví dụ: `/api/books/OL27448W`).

### 2. Library CRUD
- `GET /api/library` : Lấy danh sách tủ sách cá nhân (Hỗ trợ filter `?status=READING`).
- `GET /api/library/stats` : Lấy thống kê số lượng (Tổng / Đang đọc / Đã đọc).
- `POST /api/library` : Thêm sách vào tủ. 
  - Trả về `409 Conflict` nếu trùng lặp `workId`.
- `PATCH /api/library/:id` : Cập nhật tiến độ đọc (`current_page`), trạng thái, sao (`rating`), ghi chú (`note`). 
  - Kèm Logic tự động chuyển trạng thái hoàn thành (READ) nếu số trang đọc bằng tổng số trang.
- `DELETE /api/library/:id` : Xoá sách khỏi tủ.

---

## 🌐 Deploy (Cập nhật sau)

*(Vui lòng điền thông tin sau khi bạn deploy thành công)*
- **Frontend URL:** `https://...`
- **Backend URL:** `https://...`
- **Phương thức triển khai:** (Ví dụ: Vercel cho Frontend, Render cho Backend Node.js, Clever Cloud cho MySQL...).

## 💡 Giả định & Hướng cải thiện

- **Giả định:** API Open Library đôi khi thiếu sót thông tin `total_pages`. Backend đã tính toán và bỏ qua validate auto-complete nếu `total_pages` bị NULL để ứng dụng không gặp lỗi.
- **Cải thiện:**
  - Triển khai Caching bằng Redis (hoặc trong RAM) cho các request `GET /api/books/search` vì Open Library trả dữ liệu khá chậm.
  - Tích hợp thêm logic Pagination (phân trang) cho danh sách thư viện cá nhân nếu dữ liệu tủ sách lớn.
