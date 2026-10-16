# Dophuc AI 🇻🇳

Website chat AI tiếng Việt, chạy trên Cloudflare Workers AI và Cloudflare D1.

## Tính năng
- Đăng ký bằng email/mật khẩu, đăng nhập và đăng xuất.
- Mật khẩu được băm PBKDF2-SHA-256; session token lưu dạng hash trong D1 và cookie HttpOnly/Secure.
- Lưu cuộc trò chuyện và tin nhắn trong Cloudflare D1, đồng bộ khi đăng nhập trên thiết bị khác.
- Chỉ chủ sở hữu mới có thể đọc/xóa hội thoại.
- Xuất lịch sử chat JSON và giao diện responsive tiếng Việt.
- Cloudflare Workers AI dùng mô hình Llama 3.3 70B Instruct.

## Deploy
1. Cài Node.js LTS (18+) từ https://nodejs.org/.
2. Xác nhận database D1 có ID `ec978717-6cf0-4a18-b6f8-32d81799194e` trong tài khoản Cloudflare bạn sẽ dùng. Nếu database chưa tồn tại trong tài khoản đó, hãy tạo D1 database tên `dophuc-ai-db` và cập nhật `database_id` trong `wrangler.toml`.
3. Chạy:
   ```bash
   bash build.sh
   ```
   Script đăng nhập Cloudflare nếu cần, áp dụng migration lên D1 từ xa rồi deploy Worker.
4. Mở URL `workers.dev` mà Wrangler in ra. Tạo tài khoản mới để bắt đầu chat.

### Chạy local
```bash
npx wrangler login
npx wrangler d1 migrations apply ec978717-6cf0-4a18-b6f8-32d81799194e --remote
npx wrangler dev
```

## Database
Migration `migrations/0001_initial.sql` tạo bảng `users`, `sessions`, `conversations`, `messages`. Migration được áp dụng tự động khi chạy `build.sh`.

## API
- `GET /api/health`
- `POST /api/auth/register` — `{ "email": "...", "password": "ít nhất 10 ký tự" }`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET/POST /api/conversations`
- `GET/DELETE /api/conversations/:id`
- `POST /api/chat` — cần đăng nhập và gửi `conversationId` cùng `messages`.

## Bảo mật
Dùng HTTPS/Cloudflare Workers; cookie session HttpOnly, Secure, SameSite=Lax. Mật khẩu không được lưu nguyên văn. Trước khi mở công khai quy mô lớn, nên thêm rate limiting/chống bot, email verification, đặt lại mật khẩu và chính sách sao lưu/retention. Không commit bí mật vào GitHub.
