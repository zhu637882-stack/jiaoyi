# 零钱保网站一键部署脚本
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
Write-Host "[1/8] 安装 Chocolatey..." -ForegroundColor Yellow
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    refreshenv
}
Write-Host "   Chocolatey 安装完成" -ForegroundColor Green

# 2. 安装 Node.js 18
Write-Host "[2/8] 安装 Node.js 18..." -ForegroundColor Yellow
choco install nodejs-lts -y --version=18.20.4
refreshenv
Write-Host "   Node.js 安装完成" -ForegroundColor Green

# 3. 安装 pnpm
Write-Host "[3/8] 安装 pnpm..." -ForegroundColor Yellow
npm install -g pnpm
Write-Host "   pnpm 安装完成" -ForegroundColor Green

# 4. 安装 PostgreSQL 14
Write-Host "[4/8] 安装 PostgreSQL 14..." -ForegroundColor Yellow
choco install postgresql14 -y --params '/Password:jasonmaz'
Write-Host "   PostgreSQL 安装完成" -ForegroundColor Green

# 5. 安装 Redis
Write-Host "[5/8] 安装 Redis..." -ForegroundColor Yellow
choco install redis-64 -y
Write-Host "   Redis 安装完成" -ForegroundColor Green

# 6. 安装 Git
Write-Host "[6/8] 安装 Git..." -ForegroundColor Yellow
choco install git -y
refreshenv
Write-Host "   Git 安装完成" -ForegroundColor Green

# 7. 克隆代码
Write-Host "[7/8] 克隆代码仓库..." -ForegroundColor Yellow
if (Test-Path "$workDir\jiaoyi") {
    Remove-Item -Recurse -Force "$workDir\jiaoyi"
}
# 请修改为您的 GitHub 仓库地址
git clone https://github.com/yourusername/jiaoyi.git
Set-Location "$workDir\jiaoyi"
Write-Host "   代码克隆完成" -ForegroundColor Green

# 8. 安装依赖并构建
Write-Host "[8/8] 安装依赖并构建..." -ForegroundColor Yellow
pnpm install

# 构建后端
cd packages\server
pnpm run build
cd ..\..

# 构建前端
cd packages\web
pnpm run build
cd ..\..

Write-Host "   依赖安装和构建完成" -ForegroundColor Green

# 9. 创建启动脚本
Write-Host ""
Write-Host "创建启动脚本..." -ForegroundColor Yellow

$startScript = @"
@echo off
echo Starting Lingqianbao Website...
start "" cmd /k "cd /d $workDir\jiaoyi\packages\server && pnpm run start:prod"
timeout /t 5
start "" cmd /k "cd /d $workDir\jiaoyi\packages\web && pnpm run preview"
timeout /t 5
start "" cmd /k "cd /d $workDir\jiaoyi && node proxy-server-v2.js"
echo.
echo All services started!
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo Website: http://mufend.com
pause
"@

$startScript | Out-File -Encoding ASCII "$workDir\start-website.bat"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   部署完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "请执行以下操作：" -ForegroundColor Yellow
Write-Host "1. 配置 .env 文件（数据库连接等）"
Write-Host "2. 运行 D:\wwwroot\jiaoyi\start-website.bat 启动网站"
Write-Host ""
Write-Host "数据库信息：" -ForegroundColor Cyan
Write-Host "  用户名: postgres"
Write-Host "  密码: jasonmaz"
Write-Host "  端口: 5432"
Write-Host ""
pause
