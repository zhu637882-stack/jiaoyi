@echo off
chcp 65001 >nul
echo ==========================================
echo    启动药赚赚全部服务 (修复版)
echo ==========================================
echo.

:: 设置项目目录
set "PROJECT_DIR=d:\wwwroot\jiaoyi"
cd /d "%PROJECT_DIR%"

:: 查找 Node.js 路径
set "NODE_PATH="
if exist "C:\Program Files\nodejs\node.exe" set "NODE_PATH=C:\Program Files\nodejs\node.exe"
if exist "D:\Program Files\nodejs\node.exe" set "NODE_PATH=D:\Program Files\nodejs\node.exe"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE_PATH=C:\Program Files (x86)\nodejs\node.exe"

if "%NODE_PATH%"=="" (
    echo [错误] 未找到 Node.js，请确保已安装 Node.js
    pause
    exit /b 1
)
echo [信息] Node.js 路径: %NODE_PATH%

:: 设置环境变量
set DB_USERNAME=postgres
set DB_PASSWORD=123456
set DB_DATABASE=jiaoyi
set DB_HOST=localhost
set DB_PORT=5432
set REDIS_HOST=localhost
set REDIS_PORT=6379
set JWT_SECRET=jiaoyi-secret-key
set PORT=3000

echo.
echo [1/6] 停止现有 Node.js 进程...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo        已停止旧进程
echo.

echo [2/6] 检查 PostgreSQL...
set PGPASSWORD=123456
"C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] PostgreSQL 未运行或未安装
    echo        请确保 PostgreSQL 服务已启动
)
echo.

echo [3/6] 检查并编译后端...
cd /d "%PROJECT_DIR%\packages\server"
if not exist "dist\main.js" (
    echo        编译后端代码...
    call pnpm run build
)

echo [4/6] 启动后端服务 (端口 3000)...
start "药赚赚-后端" cmd /c "cd /d %PROJECT_DIR%\packages\server && set DB_USERNAME=postgres&& set DB_PASSWORD=123456&& set DB_DATABASE=jiaoyi&& set DB_HOST=localhost&& set DB_PORT=5432&& set REDIS_HOST=localhost&& set REDIS_PORT=6379&& set JWT_SECRET=jiaoyi-secret-key&& set PORT=3000&& pnpm run start:prod"
timeout /t 5 /nobreak >nul
echo        后端启动中...
echo.

echo [5/6] 启动前端服务 (端口 5173)...
start "药赚赚-前端" cmd /c "cd /d %PROJECT_DIR%\packages\web && %NODE_PATH% node_modules/vite/bin/vite.js --host"
timeout /t 5 /nobreak >nul
echo        前端启动中...
echo.

echo [6/6] 启动反向代理 (端口 80)...
start "药赚赚-代理" cmd /c "cd /d %PROJECT_DIR% && %NODE_PATH% proxy-server-v2.js"
timeout /t 3 /nobreak >nul
echo        代理启动中...
echo.

echo [检查] 服务状态:
echo.
echo 端口 80 (反向代理):
netstat -ano | findstr ":80" | findstr "LISTENING" | head -1
echo.
echo 端口 3000 (后端):
netstat -ano | findstr ":3000" | findstr "LISTENING" | head -1
echo.
echo 端口 5173 (前端):
netstat -ano | findstr ":5173" | findstr "LISTENING" | head -1
echo.

echo ==========================================
echo    启动完成!
echo ==========================================
echo.
echo 访问地址:
echo   http://mufend.com
echo   http://www.mufend.com
echo   http://103.43.188.127
echo.
echo 注意: 如果端口 80 被占用，请以管理员身份运行此脚本
echo.
pause
