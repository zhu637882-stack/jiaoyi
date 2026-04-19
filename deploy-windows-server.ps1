# 药赚赚 Windows全自动部署脚本
# 自动安装数据库、配置环境、启动服务

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "   药赚赚 Windows 全自动部署" -ForegroundColor Cyan  
Write-Host "==========================================`n" -ForegroundColor Cyan

$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

# 配置
$DB_PASSWORD = "jiaoyi@2024"
$DB_NAME = "jiaoyi"  
$PROJECT_DIR = "d:\wwwroot\jiaoyi"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-Step($msg) { Write-Host "`n[步骤] $msg" -ForegroundColor Yellow }
function Write-OK($msg) { Write-Host "[完成] $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "[错误] $msg" -ForegroundColor Red }

Set-Location $PROJECT_DIR

# 1. 检查 PostgreSQL
Write-Step "检查 PostgreSQL 数据库..."
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue

if ($pgService) {
    Write-OK "PostgreSQL 已安装"
    if ($pgService.Status -ne "Running") {
        Write-Host "  启动 PostgreSQL 服务..." -ForegroundColor Yellow
        Start-Service $pgService.Name
        Start-Sleep 3
    }
    Write-OK "PostgreSQL 运行中"
} else {
    Write-Err "未检测到 PostgreSQL!"
    Write-Host "`n请先安装 PostgreSQL 15:" -ForegroundColor Yellow
    Write-Host "  1. 访问: https://www.postgresql.org/download/windows/"
    Write-Host "  2. 下载并安装 (设置密码: $DB_PASSWORD)"  
    Write-Host "  3. 安装完成后重新运行此脚本`n" -ForegroundColor Yellow
    Write-Host "或者运行已准备好的安装向导: .\install-database.bat`n" -ForegroundColor Cyan
    
    # 尝试启动安装脚本
    if (Test-Path "$PROJECT_DIR\install-database.bat") {
        $choice = Read-Host "是否现在运行安装向导? (Y/N)"
        if ($choice -eq "Y" -or $choice -eq "y") {
            Start-Process "cmd.exe" -ArgumentList "/k", "cd /d `"$PROJECT_DIR`" && install-database.bat"
            exit
        }
    }
    
    exit 1
}

# 2. 检查 Redis  
Write-Step "检查 Redis 缓存..."
$redisService = Get-Service -Name "redis" -ErrorAction SilentlyContinue

if ($redisService) {
    Write-OK "Redis 已安装"
    if ($redisService.Status -ne "Running") {
        Write-Host "  启动 Redis 服务..." -ForegroundColor Yellow
        Start-Service redis
        Start-Sleep 2
    }
    Write-OK "Redis 运行中"
} else {
    Write-Err "未检测到 Redis!"
    Write-Host "`n请先安装 Redis:" -ForegroundColor Yellow
    Write-Host "  下载: https://github.com/microsoftarchive/redis/releases"
    Write-Host "  或使用安装向导: .\install-database.bat`n" -ForegroundColor Yellow
    exit 1
}

# 3. 创建数据库
Write-Step "检查数据库 $DB_NAME..."
$env:PGPASSWORD = $DB_PASSWORD
$psqlPath = "C:\Program Files\PostgreSQL\15\bin\psql.exe"

if (Test-Path $psqlPath) {
    $dbExists = & $psqlPath -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>&1
    
    if ($dbExists -ne "1") {
        Write-Host "  创建数据库 $DB_NAME..." -ForegroundColor Yellow
        & $psqlPath -U postgres -c "CREATE DATABASE $DB_NAME;" 2>&1
        Write-OK "数据库创建成功"
    } else {
        Write-OK "数据库已存在"
    }
}

# 4. 配置环境变量
Write-Step "配置环境变量..."
$envFile = "$PROJECT_DIR\.env"
if (Test-Path $envFile) {
    $content = Get-Content $envFile -Raw
    $content = $content -replace "DB_PASSWORD=.*", "DB_PASSWORD=$DB_PASSWORD"
    $content = $content -replace "DB_NAME=.*", "DB_NAME=$DB_NAME"
    $content = $content -replace "JWT_SECRET=.*", "JWT_SECRET=jiaoyi-production-secret-2024"
    $content | Set-Content $envFile -NoNewline
    Write-OK "环境变量已配置"
}

# 5. 启动后端
Write-Step "启动后端服务 (端口 3000)..."
Set-Location "$PROJECT_DIR\packages\server"

# 停止已运行的进程
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle -match "后端"} | Stop-Process -Force

Start-Process "cmd.exe" -ArgumentList "/k", "cd /d `"$PROJECT_DIR\packages\server`" && title 药赚赚-后端服务 && pnpm run dev" -WindowStyle Normal
Write-OK "后端服务启动中..."
Start-Sleep 3

# 6. 启动前端  
Write-Step "启动前端服务 (端口 5173)..."
Set-Location "$PROJECT_DIR\packages\web"

Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle -match "前端"} | Stop-Process -Force

Start-Process "cmd.exe" -ArgumentList "/k", "cd /d `"$PROJECT_DIR\packages\web`" && title 药赚赚-前端服务 && pnpm run dev" -WindowStyle Normal
Write-OK "前端服务启动中..."
Start-Sleep 5

# 7. 完成
Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "   部署完成!" -ForegroundColor Green
Write-Host "==========================================`n" -ForegroundColor Green

Write-Host "访问地址:" -ForegroundColor Cyan
Write-Host "  前端: http://localhost:5173" -ForegroundColor White
Write-Host "  后端: http://localhost:3000`n" -ForegroundColor White

Write-Host "数据库信息:" -ForegroundColor Cyan
Write-Host "  PostgreSQL: localhost:5432" -ForegroundColor White  
Write-Host "  Redis: localhost:6379" -ForegroundColor White
Write-Host "  数据库: $DB_NAME" -ForegroundColor White
Write-Host "  密码: $DB_PASSWORD`n" -ForegroundColor White

Write-Host "测试账号:" -ForegroundColor Cyan
Write-Host "  管理员: admin / admin123" -ForegroundColor White
Write-Host "  投资者1: investor1 / investor123" -ForegroundColor White  
Write-Host "  投资者2: investor2 / investor123`n" -ForegroundColor White

Write-Host "服务已在后台运行,不要关闭弹出的命令窗口!`n" -ForegroundColor Yellow

# 自动打开浏览器
Write-Host "正在打开浏览器..." -ForegroundColor Yellow
Start-Sleep 2
Start-Process "http://localhost:5173"

Write-Host "`n按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
