# Chạy app + API (cổng 3000)

## Cấu trúc thư mục
```
Project/
  api/            ← source API (server.js đã có khối APP_BUILD)
  app/            ← source React
  run.command     ← macOS: nhấp đúp để build + chạy
  run.bat         ← Windows: chạy bằng lệnh (all | build | start | install)
  run-click.bat   ← Windows: nhấp đúp để build + chạy
```

## Cài đặt lần đầu (macOS)
1. Copy `run.command` vào thư mục `Project/` (cạnh `api/` và `app/`).
2. Nhấp đúp `run.command`. Nếu macOS báo **"run.command" Not Opened**, làm một trong hai cách:
   - **Cách 1**: bấm **Done**, vào **Cài đặt hệ thống → Quyền riêng tư & Bảo mật**, kéo xuống mục bảo mật, bấm **Open Anyway** cho `run.command`, nhập mật khẩu. Nhấp đúp lại và chọn **Open**.
   - **Cách 2**: mở Terminal, gõ `cd ` rồi kéo thư mục `Project` vào cửa sổ, Enter, rồi chạy:
     ```
     xattr -d com.apple.quarantine run.command
     chmod +x run.command
     ```
     Sau đó nhấp đúp lại.

Không chọn **Move to Trash**: file không độc hại, chỉ là macOS chưa tin file tải về.

## Chạy trên macOS
- Nhấp đúp `run.command`. Lệnh này sẽ tự:
  1. Kiểm tra Node.js và npm.
  2. Cài thư viện cho `api/` và `app/` nếu thiếu (`npm install`).
  3. Build app (`npm run build`), kiểm tra có `app/build/index.html`.
  4. Xóa `api/build` cũ, copy build mới sang `api/build`.
  5. Kiểm tra `api/server.js` có khối giao diện React.
  6. Chạy server ở cổng 3000.
- Khi server dừng hoặc có lỗi, cửa sổ sẽ chờ bạn nhấn Enter trước khi đóng.
- Dừng server: nhấn Ctrl+C hoặc đóng cửa sổ.

## Chạy trên Windows
- Nhấp đúp `run-click.bat`: chạy đầy đủ như `run.bat` rồi giữ cửa sổ.
- Hoặc mở Command Prompt trong thư mục `Project` và chạy:
  ```
  run.bat           :: build + copy + chạy server (mặc định)
  run.bat build     :: chỉ build + copy
  run.bat start     :: chỉ chạy server
  run.bat install   :: chỉ cài thư viện
  ```

## Mở ứng dụng
- Trên máy chạy server: `http://localhost:3000`
- Trên máy khác hoặc tivi cùng mạng: `http://<IP-máy-server>:3000`

## Cập nhật
- **Sửa app**: chạy lại `run.command` (hoặc `run.bat`). Lệnh sẽ build lại và copy build mới.
- **Sửa API**: chỉ cần khởi động lại server (`run.bat start`, hoặc nhấp đúp `run.command` lần nữa).

## Lỗi thường gặp
- **Chưa cài Node.js**: cài bản LTS từ nodejs.org rồi thử lại.
- **`api/server.js chưa có khối giao diện React`**: copy `server.js` từ thư mục `combined` vào `api/`.
- **Cổng 3000 bị chiếm (`EADDRINUSE`)**: tắt tiến trình đang dùng cổng. Kiểm tra bằng `lsof -i :3000` (macOS) hoặc `netstat -ano | findstr :3000` (Windows).
- **Mở `http://localhost:3000` nhưng không có danh sách file**: kiểm tra API đang chạy bằng cách mở `http://localhost:3000/public/`, phải thấy dữ liệu JSON.

## Chạy nền (tùy chọn, không giữ cửa sổ)
Trên macOS/Linux dùng `pm2`:
```
npm i -g pm2
cd api
pm2 start server.js --name app
pm2 logs app      # xem log
pm2 stop app      # dừng
```
