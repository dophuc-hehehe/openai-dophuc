# Dophuc AI 🇻🇳

Website chat AI với giao diện tiếng Việt, lấy cảm hứng từ trải nghiệm chat của [bonnydark/open-sorce-AI-me](https://github.com/bonnydark/open-sorce-AI-me). Đây là bản triển khai riêng, không sao chép nguyên văn toàn bộ mã nguồn dự án tham khảo.

## Tính năng
- Giao diện chat responsive, mặc định tiếng Việt.
- Gọi Cloudflare Workers AI với mô hình Llama 3.3 70B Instruct.
- Nhiều cuộc trò chuyện và lịch sử được lưu trong trình duyệt hiện tại bằng `localStorage`.
- Xuất lịch sử hội thoại ra tệp JSON và xóa lịch sử cục bộ.
- API kiểm tra trạng thái `GET /api/health`.
- Worker kiểm tra dữ liệu đầu vào và trả lỗi dễ hiểu bằng tiếng Việt.

**Giới hạn hiện tại:** chưa có tài khoản/đăng nhập, lịch sử chưa đồng bộ giữa thiết bị, chưa có D1/Durable Objects/Agents SDK. Không gửi dữ liệu nhạy cảm. Trước khi mở dịch vụ công khai, hãy bổ sung giới hạn tốc độ và xác thực.

## Triển khai Cloudflare

### 1. Cài công cụ
Cài Node.js LTS từ https://nodejs.org/, sau đó trong thư mục dự án chạy:

```bash
npm install -g wrangler
wrangler login
```

### 2. Chạy thử
```bash
wrangler dev
```
Mở URL local mà Wrangler hiển thị.

### 3. Deploy
```bash
wrangler deploy
```
Tệp `wrangler.toml` đã cấu hình static assets từ `web/` và binding Workers AI tên `AI`. Tài khoản Cloudflare phải có quyền dùng Workers AI. Nếu mô hình mặc định không khả dụng trên tài khoản, đổi hằng `MODEL` trong `src/index.js` sang mô hình được hỗ trợ.

### 4. Kiểm tra
Mở `https://TEN-WORKER.TEN-TAI-KHOAN.workers.dev/api/health`. Trường `ai` phải là `true`.

## API
- `GET /api/health` — trạng thái dịch vụ và binding AI.
- `POST /api/chat` — gửi `{"messages":[{"role":"user","content":"Xin chào!"}]}`; vai trò hợp lệ là `user` và `assistant`.

## Cấu trúc
- `web/index.html` — giao diện chat tiếng Việt.
- `src/index.js` — Cloudflare Worker và API chat.
- `wrangler.toml` — cấu hình deploy.

## Nguồn tham khảo
- https://github.com/bonnydark/open-sorce-AI-me
- https://developers.cloudflare.com/workers-ai/
- https://developers.cloudflare.com/workers/static-assets/
