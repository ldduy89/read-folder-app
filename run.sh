#!/usr/bin/env bash
# Build app -> copy build sang api -> chạy server (cổng 8081)
# Cách dùng (chạy từ thư mục gốc chứa api/ và app/):
#   ./run.sh            : cài thư viện (nếu thiếu), build app, copy, chạy server
#   ./run.sh build      : chỉ build app + copy sang api (không chạy server)
#   ./run.sh start      : chỉ chạy server (dùng build đã có)
#   ./run.sh install    : chỉ cài thư viện (npm install) cho api và app
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
API="$ROOT/api"
APP="$ROOT/app"
MODE="${1:-all}"

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nLỖI: %s\n' "$*" >&2; exit 1; }

check_env() {
  command -v node >/dev/null 2>&1 || die "Chưa cài Node.js (cần bản LTS 18/20)."
  command -v npm  >/dev/null 2>&1 || die "Chưa cài npm."
  [ -f "$API/server.js" ] || die "Không thấy $API/server.js"
  [ -f "$APP/package.json" ] || die "Không thấy $APP/package.json"
}

install_deps() {
  if [ ! -d "$API/node_modules" ]; then
    log "Cài thư viện API"
    (cd "$API" && npm install)
  fi
  if [ ! -d "$APP/node_modules" ]; then
    log "Cài thư viện app"
    (cd "$APP" && npm install)
  fi
}

build_app() {
  log "Build app (npm run build)"
  (cd "$APP" && npm run build)
  [ -f "$APP/build/index.html" ] || die "Build không tạo ra $APP/build/index.html"
}

deploy_build() {
  log "Copy build sang api/build"
  rm -rf "$API/build"
  cp -R "$APP/build" "$API/build"
  [ -f "$API/build/index.html" ] || die "Copy build thất bại"
}

check_server_block() {
  if ! grep -q "APP_BUILD" "$API/server.js"; then
    die "api/server.js chưa có khối phục vụ giao diện React. Hãy copy server.js từ thư mục combined vào api/."
  fi
}

start_server() {
  check_server_block
  [ -f "$API/build/index.html" ] || die "Chưa có api/build. Chạy './run.sh build' trước."
  log "Chạy server tại http://localhost:8081 (Ctrl+C để dừng)"
  cd "$API"
  exec node server.js
}

check_env
case "$MODE" in
  install) install_deps ;;
  build)   install_deps; build_app; deploy_build ;;
  start)   start_server ;;
  all)     install_deps; build_app; deploy_build; start_server ;;
  *)       die "Tham số không hợp lệ: $MODE (dùng: all | build | start | install)" ;;
esac
