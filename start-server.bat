@echo off
chcp 65001 >nul
echo ==========================================
echo   零钱保 - Windows服务器一键启动脚本
echo ==========================================
echo.

set PROJECT_DIR=C:\yuebao
set SERVER_DIR=%PROJECT_DIR%\packages\server

REM 检查项目目录
if not exist "%PROJECT_DIR%" (
    echo [错误] 项目目录不存在: %PROJECT_DIR%
    echo 请先克隆项目: git clone https://github.com/zhu637882-stack/jiaoyi.git C:\yuebao
    pause
    exit /b 1
)

cd /d %PROJECT_DIR%

REM 创建 .env 文件（如果不存在）
if not exist "%SERVER_DIR%\.env" (
    echo [1/5] 创建 .env 配置文件...
    (
        echo # 数据库配置
        echo DB_HOST=localhost
        echo DB_PORT=5432
        echo DB_USERNAME=postgres
        echo DB_PASSWORD=postgres
        echo DB_DATABASE=yuebao
        echo.
        echo # JWT密钥
        echo JWT_SECRET=yuebao_jwt_secret_key_2024
        echo JWT_EXPIRES_IN=7d
        echo.
        echo # Redis配置（可选）
        echo REDIS_HOST=127.0.0.1
        echo REDIS_PORT=6379
        echo.
        echo # 服务器配置
        echo PORT=3000
        echo NODE_ENV=production
    ) > "%SERVER_DIR%\.env"
    echo [✓] .env 文件已创建
) else (
    echo [1/5] .env 文件已存在，跳过
)

REM 安装依赖
echo [2/5] 安装依赖...
call pnpm install
if errorlevel 1 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)
echo [✓] 依赖安装完成

REM 构建项目
echo [3/5] 构建项目...
call pnpm run build
if errorlevel 1 (
    echo [错误] 构建失败
    pause
    exit /b 1
)
echo [✓] 构建完成

REM 复制前端文件
echo [4/5] 复制前端文件到网站目录...
if not exist "C:\inetpub\wwwroot" mkdir "C:\inetpub\wwwroot"
xcopy /E /I /Y "%PROJECT_DIR%\packages\web\dist\*" "C:\inetpub\wwwroot\" >nul
echo [✓] 前端文件已复制

REM 启动后端服务
echo [5/5] 启动后端服务...
cd /d %SERVER_DIR%
echo.
echo ==========================================
echo   服务启动成功！
echo ==========================================
echo.
echo   管理后台: http://localhost
echo   API地址: http://localhost:3000
echo.
echo   按 Ctrl+C 停止服务
echo ==========================================
echo.
npm run start

pause
