@echo off
chcp 65001 >nul
echo ==========================================
echo    安装零钱保服务为 Windows 自启动服务
echo ==========================================
echo.

:: 设置项目目录
set "PROJECT_DIR=d:\wwwroot\jiaoyi"
cd /d "%PROJECT_DIR%"

:: 查找 Node.js
set "NODE_PATH="
if exist "C:\Program Files\nodejs\node.exe" set "NODE_PATH=C:\Program Files\nodejs\node.exe"
if exist "D:\Program Files\nodejs\node.exe" set "NODE_PATH=D:\Program Files\nodejs\node.exe"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE_PATH=C:\Program Files (x86)\nodejs\node.exe"

if "%NODE_PATH%"=="" (
    echo [错误] 未找到 Node.js
    pause
    exit /b 1
)
echo [信息] Node.js 路径: %NODE_PATH%

:: 检查 nssm 是否存在
if not exist "nssm.exe" (
    echo [下载] 正在下载 nssm...
    powershell -Command "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile 'nssm.zip'"
    powershell -Command "Expand-Archive -Path 'nssm.zip' -DestinationPath '.' -Force"
    copy "nssm-2.24\win64\nssm.exe" "nssm.exe" >nul
    rmdir /s /q "nssm-2.24" >nul
    del "nssm.zip" >nul
    echo [完成] nssm 下载完成
)

echo.
echo [1/4] 停止并删除旧服务...
nssm stop Lingqianbao-Backend >nul 2>&1
nssm remove Lingqianbao-Backend confirm >nul 2>&1
nssm stop Lingqianbao-Frontend >nul 2>&1
nssm remove Lingqianbao-Frontend confirm >nul 2>&1
nssm stop Lingqianbao-Proxy >nul 2>&1
nssm remove Lingqianbao-Proxy confirm >nul 2>&1
echo        已清理旧服务

echo.
echo [2/4] 安装后端服务...
nssm install Lingqianbao-Backend "%NODE_PATH%"
nssm set Lingqianbao-Backend AppDirectory "%PROJECT_DIR%\packages\server"
nssm set Lingqianbao-Backend AppParameters "dist\main"
nssm set Lingqianbao-Backend Environment "DB_USERNAME=postgres;DB_PASSWORD=123456;DB_DATABASE=jiaoyi;DB_HOST=localhost;DB_PORT=5432;REDIS_HOST=localhost;REDIS_PORT=6379;JWT_SECRET=jiaoyi-secret-key;PORT=3000"
nssm set Lingqianbao-Backend DisplayName "零钱保-后端服务"
nssm set Lingqianbao-Backend Description "零钱保交易平台后端 API 服务"
nssm set Lingqianbao-Backend Start SERVICE_AUTO_START
nssm start Lingqianbao-Backend
echo        后端服务已安装并启动

echo.
echo [3/4] 安装前端服务...
nssm install Lingqianbao-Frontend "%NODE_PATH%"
nssm set Lingqianbao-Frontend AppDirectory "%PROJECT_DIR%\packages\web"
nssm set Lingqianbao-Frontend AppParameters "node_modules\vite\bin\vite.js --host"
nssm set Lingqianbao-Frontend DisplayName "零钱保-前端服务"
nssm set Lingqianbao-Frontend Description "零钱保交易平台前端 Vite 服务"
nssm set Lingqianbao-Frontend Start SERVICE_AUTO_START
nssm start Lingqianbao-Frontend
echo        前端服务已安装并启动

echo.
echo [4/4] 安装代理服务...
nssm install Lingqianbao-Proxy "%NODE_PATH%"
nssm set Lingqianbao-Proxy AppDirectory "%PROJECT_DIR%"
nssm set Lingqianbao-Proxy AppParameters "proxy-server-v2.js"
nssm set Lingqianbao-Proxy DisplayName "零钱保-反向代理"
nssm set Lingqianbao-Proxy Description "零钱保交易平台 80 端口反向代理"
nssm set Lingqianbao-Proxy Start SERVICE_AUTO_START
nssm start Lingqianbao-Proxy
echo        代理服务已安装并启动

echo.
echo ==========================================
echo    服务安装完成!
echo ==========================================
echo.
echo 已安装的服务:
echo   - Lingqianbao-Backend (端口 3000)
echo   - Lingqianbao-Frontend (端口 5173)
echo   - Lingqianbao-Proxy (端口 80)
echo.
echo 服务已设置为自动启动，服务器重启后会自动运行。
echo.
echo 访问地址:
echo   http://mufend.com
echo   http://www.mufend.com
echo   http://103.43.188.127
echo.
pause
