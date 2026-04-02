# Active Context

## Trọng tâm làm việc hiện tại
- Database PostgreSQL đã chạy thành công trên Docker local (container: zalo-crm-db-dev, port 5435).
- Toàn bộ 12 bảng schema đã được push thành công vào database.
- Backend dependencies đã cài đặt xong (npm install).
- Prisma Client đã generate thành công.

## Những thay đổi gần đây
- 2026-03-28: Clone source code ZaloCRM từ GitHub.
- 2026-03-28: Tạo file .env (root + backend) với secret keys tự sinh.
- 2026-03-28: Tạo file prisma.config.ts (Prisma 7 yêu cầu).
- 2026-03-28: Đổi port DB dev sang 5435 (port 5432-5434 đã bận bởi các dự án khác).
- 2026-03-28: Chạy prisma db push thành công - 12 bảng đã tạo.

## Cấu hình hiện tại
- DB Container: zalo-crm-db-dev
- DB Port: localhost:5435
- DB User: crmuser / devpassword
- DB Name: zalocrm
- DATABASE_URL: postgresql://crmuser:devpassword@localhost:5435/zalocrm

## Bước tiếp theo
- Chạy backend: cd backend && npm run dev
- Cài frontend dependencies: cd frontend && npm install
- Chạy frontend: cd frontend && npm run dev
- Truy cập app, tạo tài khoản admin đầu tiên.
