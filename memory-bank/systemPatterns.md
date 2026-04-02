# System Patterns

## Kiến trúc Hệ thống
Dự án được phân tách thành 2 luồng chính: Backend (cung cấp API, lưu trữ db, webhook nhận message) và Frontend (Dashboard SPA giao diện người dùng).
Hệ thống sử dụng Docker Compose để gom nhóm và chạy tất cả các services (app, db, backup).

## Quyết định Thiết kế Kỹ thuật
- **Kiến trúc Server:** Tách rời Frontend và Backend. Backend sử dụng mô hình REST API cùng hệ thống sự kiện kết hợp Socket.io, giúp truyền tin nhắn realtime cực nhanh tới Client.
- **Micro/Macro service pattern:**
  - **Node.js (Backend):** Sử dụng Fastify (phiên bản 5) vì hiệu năng cao kết hợp với Prisma ORM giúp quản lý model database an toàn kiểu typesafe.
  - **Tương tác Zalo:** Dùng thư viện `zca-js` bản 2.x để giao tiếp với Zalo qua cơ chế scan QR.
  - **Frontend (Vue 3/Vuetify):** Xây dựng dưới dạng Single Page Application (SPA), state management dùng Pinia.
- **Lưu trữ dữ liệu:** Phụ thuộc vào PostgreSQL 16 mạnh mẽ làm Source of Truth cho users, settings, messages, pipelines và lịch hẹn. Có cron/backup tự động.

## Các Pattern Đang Sử Dụng
- **Repository/Service pattern trên Model (Dự kiến):** Gộp logic ORM vào Prisma client.
- **RESTful API:** Các API endpoint public/internal, kết hợp JWT Bearer Auth.
- **Webhook Events:** Sử dụng Observer Pattern để handle các sự kiện từ Zalo Server chuyển về hệ thống nội bộ.

## Đường dẫn triển khai quan trọng
- Quản lý Docker compose cho việc chạy môi trường development (`docker-compose.dev.yml`) và production (`docker-compose.yml`).
