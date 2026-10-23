# Chạy app + API bằng một lệnh

## Cấu trúc thư mục
```
Project/
  api/          ← source API (server.js đã có khối APP_BUILD)
  app/          ← source React
  run.sh        ← macOS / Linux
  run.bat       ← Windows
```

## Chạy
macOS / Linux (lần đầu cần `chmod +x run.sh`):
```
./run.sh          # cài thư viện (nếu thiếu) + build app + copy + chạy server
./run.sh build    # chỉ build + copy (không chạy server)
./run.sh start    # chỉ chạy server
./run.sh install  # chỉ npm install cho api và app
```

Windows:
```
run.bat           :: cài thư viện (nếu thiếu) + build + copy + chạy server
run.bat build
run.bat start
run.bat install
```

Mở `http://localhost:80` (hoặc `http://<IP-máy-server>:80` trên tivi).

## Lưu ý
- Script tự chuyển vào đúng thư mục, bạn có thể chạy từ bất kỳ đâu.
- Sau khi sửa app: chạy `run.sh` (hoặc `run.bat`) lại. Lệnh này build lại và copy build mới.
- Sau khi sửa API: chỉ cần chạy `run.sh start` / `run.bat start`.
- Nếu báo `api/server.js chưa có khối giao diện React`, copy `server.js` từ thư mục `combined` vào `api/`.
- Nếu báo cổng 80 bị chiếm (`EADDRINUSE`), tắt tiến trình cũ rồi chạy lại.
- Chạy nền trên macOS/Linux: `npm i -g pm2`, rồi trong `api/`: `pm2 start server.js --name app`. Xem log: `pm2 logs app`. Dừng: `pm2 stop app`.
