#!/usr/bin/env bash
set -Eeuo pipefail

# Dophuc AI — cài công cụ cần thiết và deploy lên Cloudflare Workers.
# Chạy tại thư mục dự án bằng: bash build.sh

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

info() { printf "${GREEN}[Dophuc AI]${RESET} %s\n" "$*"; }
warn() { printf "${YELLOW}[Lưu ý]${RESET} %s\n" "$*"; }
fail() { printf "${RED}[Lỗi]${RESET} %s\n" "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || fail "Chưa cài Node.js. Hãy cài Node.js LTS từ https://nodejs.org/ rồi chạy lại."
command -v npm >/dev/null 2>&1 || fail "Không tìm thấy npm. Hãy cài lại Node.js LTS."

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( NODE_MAJOR < 18 )); then
  fail "Cần Node.js phiên bản 18 trở lên. Phiên bản hiện tại: $(node --version)"
fi

[[ -f "wrangler.toml" ]] || fail "Không tìm thấy wrangler.toml. Hãy chạy script trong repository Dophuc AI."
[[ -f "src/index.js" ]] || fail "Không tìm thấy src/index.js."
[[ -f "web/index.html" ]] || fail "Không tìm thấy web/index.html."

WRANGLER=(npx --yes wrangler@latest)

info "Node.js $(node --version) đã sẵn sàng."
info "Kiểm tra đăng nhập Cloudflare..."
if "${WRANGLER[@]}" whoami; then
  info "Đã đăng nhập Cloudflare."
else
  warn "Bạn cần đăng nhập Cloudflare trong trình duyệt."
  "${WRANGLER[@]}" login
  "${WRANGLER[@]}" whoami || fail "Đăng nhập Cloudflare chưa thành công. Hãy chạy npx wrangler login rồi thử lại."
fi

info "Kiểm tra cấu hình và triển khai Dophuc AI..."
"${WRANGLER[@]}" deploy

printf "\n"
info "Hoàn tất lệnh deploy!"
info "Mở URL workers.dev được Wrangler in ra ở phía trên để kiểm tra website."
warn "Nếu API AI trả lỗi, hãy kiểm tra quyền/hạn mức Workers AI và model trong src/index.js."
