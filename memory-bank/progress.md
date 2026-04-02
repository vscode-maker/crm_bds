# Progress Tracking

## Trạng thái hiện tại
- Đã khởi động Docker container cho Database (`zalo-crm-db-dev` port 5435) thành công.
- Đã cài đặt dependencies và chạy Backend (port 3000) cùng Frontend Vite (port 5173).
- Hệ thống đã sẵn sàng để truy cập và phát triển.

## Chức năng đã hoạt động
- Hệ thống cơ sở dữ liệu PostgreSQL qua Docker hoàn chỉnh.
- Môi trường Backend (Prisma, Fastify) và Frontend (Vue + Vite).

## Quá trình ra Quyết định
- Phát hiện backend cần pass môi trường cho prisma client, đã thêm flag `--env-file=.env` vào script `dev` của `backend/package.json`.
- Giải phóng port 5173 bị kẹt để khởi động frontend.

## Vấn đề đã biết / Cần làm tiếp
- Đăng nhập thử ZaloCRM bằng user admin thông qua giao diện frontend tại `http://localhost:5173/`.
