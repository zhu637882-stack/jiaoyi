@echo off
cd /d D:\wwwroot\jiaoyi

:: 启动后端
echo Starting Backend...
start "Backend" cmd /c "cd packages\server && pnpm run start:prod"

:: 等待5秒
timeout /t 5 /nobreak >nul

:: 启动前端
echo Starting Frontend...
start "Frontend" cmd /c "cd packages\web && pnpm run preview"

:: 等待5秒
timeout /t 5 /nobreak >nul

:: 启动代理
echo Starting Proxy...
start "Proxy" cmd /c "node proxy-server-v2.js"

echo.
echo All services started!
pause
