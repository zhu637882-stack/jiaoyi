#!/bin/bash
# 自动部署到 Windows 服务器脚本

SERVER_IP="103.43.188.127"
SERVER_USER="administrator"
SSH_KEY="/Users/a1234/jiaoyi/.qoder/ssh/yuebao_server_key"

echo "=========================================="
echo "  药赚赚系统自动部署脚本"
echo "=========================================="

# 检查 SSH 密钥
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH 密钥不存在: $SSH_KEY"
    exit 1
fi

# 执行远程部署
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'REMOTESCRIPT'
@echo off
echo [1/4] 拉取最新代码...
cd C:\yuebao
git pull origin main

echo [2/4] 安装依赖...
call pnpm install

echo [3/4] 构建项目...
call pnpm run build

echo [4/4] 重启服务...
:: 查找并结束 Node 进程
taskkill /F /IM node.exe /T 2>nul
:: 启动后端服务
cd C:\yuebao\packages\server
start /B npm run start

echo ==========================================
echo 部署完成！
echo 后端服务: http://103.43.188.127:3000
echo 前端访问: http://103.43.188.127
echo ==========================================
REMOTESCRIPT

echo "✅ 部署完成"
