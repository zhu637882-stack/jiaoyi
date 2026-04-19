# 零钱保 - Windows 服务器部署指南

## 服务器信息
- **IP**: 103.43.191.71:33890
- **用户名**: Administrator
- **密码**: jasonmaz
- **配置**: 2核4G，140G硬盘，5M带宽

---

## 方案一：Windows + Docker Desktop（推荐）

### 步骤 1：远程连接服务器
```bash
# Mac/Linux
rdesktop 103.43.191.71:33890 -u Administrator -p jasonmaz

# Windows
mstsc /v:103.43.191.71:33890
```

### 步骤 2：安装 Docker Desktop
1. 下载 Docker Desktop for Windows
2. 安装时选择 "Use WSL 2 instead of Hyper-V"
3. 重启服务器

### 步骤 3：上传项目文件
```bash
# 使用 SCP 或 FTP 上传项目到服务器
scp -r ./jiaoyi Administrator@103.43.191.71:/C:/lingqianbao/
```

### 步骤 4：部署
在服务器上打开 PowerShell：
```powershell
cd C:\lingqianbao\jiaoyi
copy .env.example .env
# 编辑 .env 文件

# 部署
docker-compose up --build -d
```

---

## 方案二：Windows + 直接运行（无需 Docker）

如果 Docker 安装困难，可以直接在 Windows 上运行：

### 1. 安装依赖
- Node.js 20: https://nodejs.org/
- PostgreSQL 15: https://www.postgresql.org/download/windows/
- Redis: https://github.com/microsoftarchive/redis/releases

### 2. 配置数据库
```sql
-- 在 PostgreSQL 中创建数据库
CREATE DATABASE lingqianbao;
CREATE USER lingqianbao WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE lingqianbao TO lingqianbao;
```

### 3. 启动后端
```powershell
cd C:\lingqianbao\jiaoyi\packages\server
npm install -g pnpm
pnpm install
# 修改 .env 文件中的数据库连接
pnpm run start:prod
```

### 4. 构建并启动前端
```powershell
cd C:\lingqianbao\jiaoyi\packages\web
pnpm install
pnpm run build
# 使用 nginx 或 serve 部署静态文件
npm install -g serve
serve -s dist -l 80
```

---

## 方案三：安装 Linux 子系统（WSL2）

在 Windows 上安装 Ubuntu 子系统，然后使用 Linux 部署方式：

```powershell
# 安装 WSL2
wsl --install -d Ubuntu-22.04

# 进入 Ubuntu
wsl

# 然后按照 Linux 部署步骤执行
cd /mnt/c/lingqianbao/jiaoyi
./deploy.sh
```

---

## 安全组配置

确保服务器安全组开放以下端口：
- 80 (HTTP)
- 443 (HTTPS)
- 3000 (后端 API，可选)
- 3389 (RDP 远程桌面)

---

## 快速部署脚本（PowerShell）

```powershell
# 保存为 deploy.ps1
$ErrorActionPreference = "Stop"

Write-Host "🚀 开始部署零钱保系统..." -ForegroundColor Green

# 检查 Docker
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker 未安装，请先安装 Docker Desktop" -ForegroundColor Red
    exit 1
}

# 进入项目目录
$projectPath = "C:\lingqianbao\jiaoyi"
Set-Location $projectPath

# 检查 .env
if (!(Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "⚠️  请编辑 .env 文件后再运行" -ForegroundColor Yellow
    exit 1
}

# 部署
docker-compose down 2>$null
docker-compose up --build -d

Write-Host "✅ 部署完成！访问 http://103.43.191.71" -ForegroundColor Green
```

---

## 建议

考虑到这是 Windows 服务器，**推荐方案一（Docker Desktop）** 或 **方案三（WSL2）**，可以保持与开发环境一致，便于维护。

如果需要，我可以帮你：
1. 生成 Windows 批处理部署脚本
2. 配置 IIS + 反向代理（替代 Nginx）
3. 设置 Windows 服务自动启动
