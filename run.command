#!/usr/bin/env bash
# macOS: nhấp đúp file này để cài thư viện (nếu thiếu), build app, copy build sang api và chạy server (cổng 3000).
# Đặt file này trong thư mục gốc chứa api/ và app/.
cd "$(dirname "$0")" || exit 1
ROOT="$(pwd)"
API="$ROOT/api"
APP="$ROOT/app"

die() {
  echo
  echo "LOI: $*"
  echo "Nhan Enter de dong cua so."
  read -r _
  exit 1
}
log() { echo; echo "==> $*"; }

# ---- Kiểm tra môi trường
command -v node >/dev/null 2>&1 || die "Chua cai Node.js (can ban LTS 18/20). Tai tai nodejs.org."
command -v npm  >/dev/null 2>&1 || die "Chua cai npm."
[ -f "$API/server.js" ] || die "Khong thay $API/server.js"
[ -f "$APP/package.json" ] || die "Khong thay $APP/package.json"

# ---- Cài thư viện nếu thiếu
if [ ! -d "$API/node_modules" ]; then
  log "Cai thu vien API"
  (cd "$API" && npm install) || die "npm install cho API that bai."
fi
if [ ! -d "$APP/node_modules" ]; then
  log "Cai thu vien app"
  (cd "$APP" && npm install) || die "npm install cho app that bai."
fi

# ---- Build app
log "Build app (npm run build)"
(cd "$APP" && npm run build) || die "Build app that bai."
[ -f "$APP/build/index.html" ] || die "Build khong tao ra $APP/build/index.html"

# ---- Copy build sang api/build
log "Copy build sang api/build"
rm -rf "$API/build"
cp -R "$APP/build" "$API/build" || die "Copy build that bai."
[ -f "$API/build/index.html" ] || die "Copy build that bai."

# ---- Kiểm tra server.js có khối giao diện React
if ! grep -q "APP_BUILD" "$API/server.js"; then
  die "api/server.js chua co khoi giao dien React. Copy server.js tu thu muc combined vao api/."
fi

# ---- Chạy server
log "Chay server tai http://localhost:3000 (dong cua so hoac Ctrl+C de dung)"
cd "$API" || die "Khong vao duoc $API"
node server.js
status=$?
echo
echo "Server da dung (ma $status). Nhan Enter de dong cua so."
read -r _
