# Product Context

## Tại sao dự án này tồn tại?
Dự án được xây dựng để giải quyết bài toán quản lý nhiều tài khoản Zalo cá nhân cùng lúc của các doanh nghiệp hoặc đội ngũ sale/cskh. Việc chuyển đổi qua lại giữa nhiều tài khoản thủ công thường mất thời gian và dễ làm sót tin nhắn của khách hàng.

## Vấn đề được giải quyết
- Rào cản đăng nhập và quản lý nhiều thiết bị cho các tài khoản đa dạng.
- Rủi ro bị Zalo khóa tài khoản (block) do gửi tin nhắn liên tục được xử lý bằng cơ chế phân bổ và kiểm soát tin nhắn.
- Tình trạng quên chăm sóc khách hàng được giải quyết qua hệ thống Pipeline và lịch hẹn (cảnh báo tin nhắn chưa trả lời > 30 phút).
- Sự thiếu đồng bộ dữ liệu giữa các thành viên trong đội ngũ được xử lý bằng cơ chế phân quyền (Owner, Admin, Member).

## Trải nghiệm người dùng mục tiêu
- Một giao diện web duy nhất, mượt mà (hỗ trợ theme tối/sáng, thiết kế Liquid Silicon).
- Trải nghiệm chat liên tục, như dùng app native với độ nhạy cao nhờ tích hợp Socket.io.
- Thao tác quét QR dễ dàng và quản lý qua Dashboard toàn diện, nơi thông tin khách hàng được hiển thị rõ ràng trên từng thẻ.
