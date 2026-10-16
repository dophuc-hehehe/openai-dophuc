#!/usr/bin/env bash
set -Eeuo pipefail

# Dophuc AI — kiểm tra cấu hình, áp dụng schema D1 và deploy Cloudflare Workers.
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'
info() { printf "${GREEN}[Dophuc AI]${RESET} %s\n" "$*"; }
warn() { printf "${YELLOW}[Lưu ý]${RESET} %s\n" "$*"; }
fail() { printf "${RED}[Lỗi]${RESET} %s\n" "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || fail "Chưa cài Node.js LTS từ https://nodejs.org/."
command -v npm >/dev/null 2>&1 || fail "Không tìm thấy npm. Hãy cài Node.js LTS."
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
(( NODE_MAJOR >= 18 )) || fail "Cần Node.js phiên bản 18 trở lên; hiện tại $(node --version)."
for file in wrangler.toml src/index.js web/index.html migrations/0001_initial.sql; do
  [[ -f "$file" ]] || fail "Thiếu tệp bắt buộc: $file"
done
WRANGLER=(npx --yes wrangler@latest)
info "Node.js $(node --version) đã sẵn sàng."
if ! "${WRANGLER[@]}" whoami; then
  warn "Hãy đăng nhập tài khoản Cloudflare trong trình duyệt."
  "${WRANGLER[@]}" login
  "${WRANGLER[@]}" whoami || fail "Đăng nhập Cloudflare chưa thành công."
fi

info "Áp dụng cấu trúc bảng D1 lên database từ xa..."
"${WRANGLER[@]}" d1 migrations apply dophuc-ai-db --remote || fail "Không áp dụng được migration D1. Kiểm tra database ID, quyền tài khoản và migrations/."
info "Triển khai website và API..."
"${WRANGLER[@]}" deploy
printf "\n"
info "Deploy hoàn tất. Mở URL workers.dev mà Wrangler hiển thị."
warn "Database phải tồn tại trong đúng tài khoản Cloudflare và Workers AI cần được cấp quyền."
