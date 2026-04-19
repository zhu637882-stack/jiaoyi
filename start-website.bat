@echo off
echo Starting Lingqianbao Website Services...
echo.

cd /d d:\wwwroot\jiaoyi

echo [1/3] Starting Backend (port 3000)...
start "Backend" cmd /k "cd packages\server && npm run start:prod"

echo [2/3] Starting Frontend (port 5173)...
start "Frontend" cmd /k "cd packages\web && npm run preview"

echo [3/3] Starting Proxy (port 80)...
start "Proxy" cmd /k "node proxy-server-v2.js"

echo.
echo All services started!
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo Website: http://mufend.com
echo.
pause
