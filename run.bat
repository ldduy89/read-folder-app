@echo off
REM Build app -> copy build sang api -> chạy server (cổng 8081)
REM Cách dùng (chạy từ thư mục gốc chứa api\ và app\):
REM   run.bat            : cài thư viện (nếu thiếu), build app, copy, chạy server
REM   run.bat build      : chỉ build app + copy sang api (không chạy server)
REM   run.bat start      : chỉ chạy server (dùng build đã có)
REM   run.bat install    : chỉ cài thư viện cho api và app

setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
set "API=%ROOT%api"
set "APP=%ROOT%app"
set "MODE=%~1"
if "%MODE%"=="" set "MODE=all"

where node >nul 2>nul || (echo LOI: Chua cai Node.js ^(can ban LTS 18/20^). & exit /b 1)
where npm  >nul 2>nul || (echo LOI: Chua cai npm. & exit /b 1)
if not exist "%API%\server.js" (echo LOI: Khong thay %API%\server.js & exit /b 1)
if not exist "%APP%\package.json" (echo LOI: Khong thay %APP%\package.json & exit /b 1)

if /I "%MODE%"=="install" goto :install
if /I "%MODE%"=="build"   goto :build
if /I "%MODE%"=="start"   goto :start
if /I "%MODE%"=="all"     goto :all
echo LOI: Tham so khong hop le: %MODE% ^(dung: all ^| build ^| start ^| install^)
exit /b 1

:install
call :install_deps
exit /b %ERRORLEVEL%

:build
call :install_deps || exit /b 1
call :build_app || exit /b 1
call :deploy_build || exit /b 1
exit /b 0

:start
call :start_server
exit /b %ERRORLEVEL%

:all
call :install_deps || exit /b 1
call :build_app || exit /b 1
call :deploy_build || exit /b 1
call :start_server
exit /b %ERRORLEVEL%

:install_deps
if not exist "%API%\node_modules" (
  echo.
  echo ==^> Cai thu vien API
  pushd "%API%" && call npm install && popd
)
if not exist "%APP%\node_modules" (
  echo.
  echo ==^> Cai thu vien app
  pushd "%APP%" && call npm install && popd
)
exit /b 0

:build_app
echo.
echo ==^> Build app ^(npm run build^)
pushd "%APP%" && call npm run build
if errorlevel 1 (popd & echo LOI: Build app that bai. & exit /b 1)
popd
if not exist "%APP%\build\index.html" (echo LOI: Build khong tao ra index.html & exit /b 1)
exit /b 0

:deploy_build
echo.
echo ==^> Copy build sang api\build
if exist "%API%\build" rmdir /s /q "%API%\build"
xcopy "%APP%\build" "%API%\build" /E /I /Y >nul
if not exist "%API%\build\index.html" (echo LOI: Copy build that bai. & exit /b 1)
exit /b 0

:start_server
findstr /C:"APP_BUILD" "%API%\server.js" >nul 2>nul
if errorlevel 1 (echo LOI: api\server.js chua co khoi giao dien React. Copy server.js tu thu muc combined vao api\. & exit /b 1)
if not exist "%API%\build\index.html" (echo LOI: Chua co api\build. Chay "run.bat build" truoc. & exit /b 1)
echo.
echo ==^> Chay server tai http://localhost:8081 ^(Ctrl+C de dung^)
pushd "%API%" && node server.js
popd
exit /b %ERRORLEVEL%
