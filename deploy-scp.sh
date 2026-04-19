#!/bin/bash
# 一键部署到服务器 - SCP方式

SERVER_IP="103.43.188.127"
SERVER_USER="administrator"
SERVER_PASS="jasonmaz"
SERVER_DIR="C:/yuebao"

echo "=========================================="
echo "    药赚赚一键部署 (SCP方式)"
echo "=========================================="

# 构建项目
echo "[1/3] 构建项目..."
pnpm run build

# 压缩前端文件
echo "[2/3] 打包前端文件..."
cd packages/web/dist
tar -czf /tmp/web-dist.tar.gz .
cd ../../..

# 传输到服务器 (使用sshpass自动输入密码)
echo "[3/3] 传输到服务器..."

# 安装 sshpass (macOS)
if ! command -v sshpass &> /dev/null; then
    echo "正在安装 sshpass..."
    brew install sshpass
fi

# 传输前端文件到服务器
sshpass -p "$SERVER_PASS" scp /tmp/web-dist.tar.gz "$SERVER_USER@$SERVER_IP:C:/yuebao/packages/web/"

# 传输后端文件 (dist目录)
sshpass -p "$SERVER_PASS" scp -r packages/server/dist "$SERVER_USER@$SERVER_IP:C:/yuebao/packages/server/"

# 远程执行重启
sshpass -p "$SERVER_PASS" ssh "$SERVER_USER@$SERVER_IP" 'powershell -Command "
    cd C:\yuebao\packages\web
    tar -xzf web-dist.tar.gz -C dist\ 2>\$null
    Remove-Item web-dist.tar.gz -Force 2>\$null
    cd C:\yuebao\packages\server
    Stop-Process -Name node -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Start-Process npm -ArgumentList \"run\",\"start\" -WorkingDirectory \"C:\yuebao\packages\server\" -WindowStyle Hidden
    Write-Host \"部署完成!\"
"'

echo "=========================================="
echo "部署完成！访问: http://$SERVER_IP"
echo "=========================================="
