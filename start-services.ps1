# 零钱保服务启动脚本 (PowerShell)
# 以管理员身份运行

$PROJECT_DIR = "d:\wwwroot\jiaoyi"
$NODE_PATHS = @(
    "C:\Program Files\nodejs\node.exe",
    "D:\Program Files\nodejs\node.exe",
    "C:\Program Files (x86)\nodejs\node.exe"
)

# 查找 Node.js
$NODE_PATH = $null
foreach ($path in $NODE_PATHS) {
    if (Test-Path $path) {
        $NODE_PATH = $path
        break
    }
}

if (-not $NODE_PATH) {
    Write-Host "[错误] 未找到 Node.js" -ForegroundColor Red
    exit 1
}

Write-Host "[信息] Node.js 路径: $NODE_PATH" -ForegroundColor Green

# 停止现有进程
Write-Host "`n[1/5] 停止现有 Node.js 进程..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Write-Host "        已停止旧进程" -ForegroundColor Green

# 设置环境变量
$env:DB_USERNAME = "postgres"
$env:DB_PASSWORD = "123456"
$env:DB_DATABASE = "jiaoyi"
$env:DB_HOST = "localhost"
$env:DB_PORT = "5432"
$env:REDIS_HOST = "localhost"
$env:REDIS_PORT = "6379"
$env:JWT_SECRET = "jiaoyi-secret-key"
$env:PORT = "3000"

# 检查并编译后端
Write-Host "`n[2/5] 检查并编译后端..." -ForegroundColor Yellow
Set-Location "$PROJECT_DIR\packages\server"
if (-not (Test-Path "dist\main.js")) {
    Write-Host "        编译后端代码..." -ForegroundColor Cyan
    pnpm run build
}

# 启动后端
Write-Host "`n[3/5] 启动后端服务 (端口 3000)..." -ForegroundColor Yellow
$backendCmd = "cd /d $PROJECT_DIR\packages\server && set DB_USERNAME=postgres&& set DB_PASSWORD=123456&& set DB_DATABASE=jiaoyi&& set DB_HOST=localhost&& set DB_PORT=5432&& set REDIS_HOST=localhost&& set REDIS_PORT=6379&& set JWT_SECRET=jiaoyi-secret-key&& set PORT=3000&& pnpm run start:prod"
Start-Process cmd -ArgumentList "/c", $backendCmd -WindowStyle Normal
Start-Sleep -Seconds 5
Write-Host "        后端启动中..." -ForegroundColor Green

# 启动前端
Write-Host "`n[4/5] 启动前端服务 (端口 5173)..." -ForegroundColor Yellow
$frontendCmd = "cd /d $PROJECT_DIR\packages\web && $NODE_PATH node_modules\vite\bin\vite.js --host"
Start-Process cmd -ArgumentList "/c", $frontendCmd -WindowStyle Normal
Start-Sleep -Seconds 5
Write-Host "        前端启动中..." -ForegroundColor Green

# 启动代理
Write-Host "`n[5/5] 启动反向代理 (端口 80)..." -ForegroundColor Yellow
$proxyCmd = "cd /d $PROJECT_DIR && $NODE_PATH proxy-server-v2.js"
Start-Process cmd -ArgumentList "/c", $proxyCmd -WindowStyle Normal -Verb RunAs
Start-Sleep -Seconds 3
Write-Host "        代理启动中..." -ForegroundColor Green

# 检查端口
Write-Host "`n[检查] 服务状态:" -ForegroundColor Cyan
Write-Host "端口 80 (反向代理):" -ForegroundColor Gray
netstat -ano | findstr ":80" | findstr "LISTENING" | Select-Object -First 1

Write-Host "`n端口 3000 (后端):" -ForegroundColor Gray
netstat -ano | findstr ":3000" | findstr "LISTENING" | Select-Object -First 1

Write-Host "`n端口 5173 (前端):" -ForegroundColor Gray
netstat -ano | findstr ":5173" | findstr "LISTENING" | Select-Object -First 1

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "    启动完成!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "`n访问地址:" -ForegroundColor Cyan
Write-Host "  http://mufend.com" -ForegroundColor White
Write-Host "  http://www.mufend.com" -ForegroundColor White
Write-Host "  http://103.43.188.127" -ForegroundColor White

Read-Host "`n按 Enter 键退出"
