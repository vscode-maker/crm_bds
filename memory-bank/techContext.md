# Technical Context

## Công nghệ sử dụng
- **Backend Core:** Node.js 20, Fastify 5.
- **Frontend Core:** Vue 3 (Composition API), Pinia (State Management), Vuetify 3 (UI component library), Chart.js (để dựng Dashboard/Báo cáo).
- **ORM / Database:** Prisma 7 + PostgreSQL 16. Prisma migration quản lý schema.
- **Realtime Services:** Socket.IO quản lý chat 2 chiều.
- **Thư viện Zalo:** `zca-js` phiên bản 2.x dành riêng cho việc lấy session Zalo, scan QR.
- **Deployment:** Nền tảng Docker (Docker Compose) cùng các biến môi trường để chạy app.

## Thiết lập Môi trường Phát triển
- Yêu cầu cấu hình tối thiểu: 1 vCPU, 1 GB RAM, 10 GB ổ cứng chạy Linux/Windows có cài Docker 24+. Cấu hình đề xuất 2-4 vCPU, 4GB RAM, 20GB SSD.
- Các lệnh cơ bản: `docker compose up -d --build`, `docker compose ps` để kiểm tra.
- Ứng dụng khởi chạy và xuất cổng HTTP tại tuỳ chỉnh (Mặc định: `3080`).

## Ràng buộc kỹ thuật / Hạn chế
- Đối với module Zalo: Có giới hạn chống block tài khoản là 200 tin nhắn/ngày, có cơ chế phát hiện gửi quá nhanh.
- Hệ thống webhook cung cấp thông tin callback về sự kiện nhắn tin, liên kết tài khoản nên yêu cầu Server phải online hoặc thông qua Cloudflare Tunnel để nhận event nếu tích hợp ngoài hệ thống.

## Dependency
- Git sử dụng để update source trực tiếp.
- `openssl` cần chạy trên VPS/Terminal để gen secret tokens cho cấu hình môi trường.
