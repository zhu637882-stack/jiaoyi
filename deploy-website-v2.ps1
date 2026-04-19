# 零钱保网站一键部署脚本 (FTP版本)
# 在 PowerShell (管理员) 中运行

Write-Host "========================================" -ForegroundColor Green
Write-Host "   零钱保网站一键部署脚本" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 设置工作目录
$workDir = "D:\wwwroot\jiaoyi"
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
Set-Location $workDir

# 1. 安装 Chocolatey (包管理器)
Write-Host "[1/6] 安装 Chocolatey..." -ForegroundColor Yellow
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    refreshenv
}
Write-Host "   Chocolatey 安装完成" -ForegroundColor Green

# 2. 安装 Node.js 18
Write-Host "[2/6] 安装 Node.js 18..." -ForegroundColor Yellow
choco install nodejs-lts -y --version=18.20.4
refreshenv
Write-Host "   Node.js 安装完成" -ForegroundColor Green

# 3. 安装 pnpm
Write-Host "[3/6] 安装 pnpm..." -ForegroundColor Yellow
npm install -g pnpm
Write-Host "   pnpm 安装完成" -ForegroundColor Green

# 4. 安装 PostgreSQL 14
Write-Host "[4/6] 安装 PostgreSQL 14..." -ForegroundColor Yellow
choco install postgresql14 -y --params '/Password:jasonmaz'
Write-Host "   PostgreSQL 安装完成" -ForegroundColor Green

# 5. 安装 Redis
Write-Host "[5/6] 安装 Redis..." -ForegroundColor Yellow
choco install redis-64 -y
Write-Host "   Redis 安装完成" -ForegroundColor Green

# 6. 安装依赖并构建
Write-Host "[6/6] 安装依赖并构建..." -ForegroundColor Yellow
Set-Location $workDir

# 检查是否有 package.json
if (!(Test-Path "$workDir\package.json")) {
    Write-Host "   错误：找不到 package.json，请先上传代码到 $workDir" -ForegroundColor Red
    pause
    exit
}

pnpm install

# 构建后端
if (Test-Path "$workDir\packages\server") {
    cd packages\server
    pnpm run build
    cd ..\..
}

# 构建前端
if (Test-Path "$workDir\packages\web") {
    cd packages\web
    pnpm run build
    cd ..\..
}

Write-Host "   依赖安装和构建完成" -ForegroundColor Green

# 7. 创建启动脚本
Write-Host ""
Write-Host "创建启动脚本..." -ForegroundColor Yellow

$startScript = @"
@echo off
echo Starting Lingqianbao Website...
echo.
echo [1/3] Starting Backend (port 3000)...
start "" cmd /k "cd /d $workDir\packages\server && pnpm run start:prod"
timeout /t 5 >nul
echo.
echo [2/3] Starting Frontend (port 5173)...
start "" cmd /k "cd /d $workDir\packages\web && pnpm run preview"
timeout /t 5 >nul
echo.
echo [3/3] Starting Proxy (port 80)...
start "" cmd /k "cd /d $workDir && node proxy-server-v2.js"
echo.
echo ========================================
echo    All services started!
echo ========================================
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo Website:  http://mufend.com
echo ========================================
pause
"@

$startScript | Out-File -Encoding ASCII "$workDir\start-website.bat"

# 8. 创建停止脚本
$stopScript = @"
@echo off
echo Stopping Lingqianbao Website...
taskkill /f /im node.exe 2>nul
taskkill /f /im pnpm.exe 2>nul
echo All services stopped!
pause
"@

$stopScript | Out-File -Encoding ASCII "$workDir\stop-website.bat"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   部署完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "请执行以下操作：" -ForegroundColor Yellow
Write-Host "1. 配置 .env 文件（数据库连接等）"
Write-Host "   位置：$workDir\packages\server\.env"
Write-Host ""
Write-Host "2. 启动网站："
Write-Host "   双击运行：$workDir\start-website.bat"
Write-Host ""
Write-Host "3. 停止网站："
Write-Host "   双击运行：$workDir\stop-website.bat"
Write-Host ""
Write-Host "数据库信息：" -ForegroundColor Cyan
Write-Host "  用户名: postgres"
Write-Host "  密码: jasonmaz"
Write-Host "  端口: 5432"
Write-Host "  数据库: postgres"
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
pause
