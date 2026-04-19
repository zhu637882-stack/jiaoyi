@echo off
chcp 65001 >nul
title 零钱保 Windows 部署脚本

:: ==========================================
:: 零钱保 - Windows 服务器一键部署脚本
:: 在服务器上双击运行此文件
:: ==========================================

echo.
echo ==========================================
echo    零钱保 Windows 部署脚本
echo ==========================================
echo.

:: 设置项目路径
set "PROJECT_DIR=C:\lingqianbao"
set "ZIP_FILE=deploy.zip"

:: 检查 deploy.zip 是否存在
if not exist "%ZIP_FILE%" (
    echo [错误] 未找到 %ZIP_FILE%
    echo 请确保 deploy.zip 与此脚本在同一目录
echo.
    pause
    exit /b 1
)

echo [1/5] 正在解压项目文件...
if exist "%PROJECT_DIR%" (
    echo        检测到旧目录，正在备份...
    ren "%PROJECT_DIR%" "lingqianbao_backup_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%" 2>nul
)
powershell -Command "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '%PROJECT_DIR%' -Force"
if %errorlevel% neq 0 (
    echo [错误] 解压失败
    pause
    exit /b 1
)
echo        解压完成: %PROJECT_DIR%
echo.

:: 进入项目目录
cd /d "%PROJECT_DIR%"

echo [2/5] 检查环境...
:: 检查 Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] 未检测到 Node.js
    echo        请访问 https://nodejs.org/ 下载安装 Node.js 20.x
    echo        安装完成后重新运行此脚本
    start https://nodejs.org/
    pause
    exit /b 1
)
echo        Node.js 版本: 
node -v

:: 检查 pnpm
call pnpm -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [3/5] 安装 pnpm...
    npm install -g pnpm
) else (
    echo        pnpm 版本: 
    call pnpm -v
)
echo.

echo [4/5] 配置环境变量...
if not exist ".env" (
    copy .env.example .env
    echo        已创建 .env 文件，请编辑配置后重新运行
    notepad .env
    pause
    exit /b 0
)
echo        .env 文件已存在
echo.

echo [5/5] 请选择部署方式:
echo.
echo   [1] Docker 部署（推荐，需安装 Docker Desktop）
echo   [2] 直接运行（安装 PostgreSQL + Redis）
echo.
set /p choice="请输入选项 (1 或 2): "

if "%choice%"=="1" goto docker_deploy
if "%choice%"=="2" goto direct_deploy

echo [错误] 无效选项
goto end

:docker_deploy
echo.
echo ==========================================
echo    Docker 部署模式
echo ==========================================
echo.

:: 检查 Docker
docker -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Docker
    echo        请安装 Docker Desktop:
    echo        https://www.docker.com/products/docker-desktop
    start https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo [信息] 停止旧服务...
docker-compose down 2>nul

echo [信息] 构建并启动服务...
docker-compose up --build -d

echo.
echo [信息] 等待服务启动...
timeout /t 10 /nobreak >nul

echo [信息] 检查服务状态...
docker-compose ps

echo.
echo ==========================================
echo    部署完成！
echo ==========================================
echo.
echo 访问地址:
echo   - 前端: http://localhost 或 http://服务器IP
echo   - 后端 API: http://localhost:3000/api
echo.
echo 常用命令:
echo   - 查看日志: docker-compose logs -f
echo   - 停止服务: docker-compose down
echo   - 重启服务: docker-compose restart
echo.
goto end

:direct_deploy
echo.
echo ==========================================
echo    直接运行模式
echo ==========================================
echo.

echo [警告] 此模式需要手动安装:
echo   - PostgreSQL 15: https://www.postgresql.org/download/windows/
echo   - Redis: https://github.com/microsoftarchive/redis/releases
echo.
set /p confirm="确认已安装上述软件? (Y/N): "
if /i not "%confirm%"=="Y" goto end

echo.
echo [信息] 安装后端依赖...
cd packages\server
call pnpm install

echo [信息] 安装前端依赖...
cd ..\web
call pnpm install

echo [信息] 构建前端...
call pnpm run build

echo.
echo ==========================================
echo    启动服务
echo ==========================================
echo.
echo 请手动启动:
echo   1. 启动 PostgreSQL 服务
echo   2. 启动 Redis 服务
echo   3. 在 packages\server 目录运行: pnpm run start:prod
echo   4. 在 packages\web 目录运行: pnpm run preview 或使用 nginx 部署 dist 目录
echo.

:end
echo.
echo 按任意键退出...
pause >nul
