#!/bin/bash
# 服务器端部署脚本
# 在服务器上执行此脚本

set -e

echo "=========================================="
echo "   零钱保 - 服务器部署脚本"
echo "=========================================="

# 项目目录
PROJECT_DIR="/opt/yuebao"
BACKUP_DIR="/opt/backups/yuebao-$(date +%Y%m%d-%H%M%S)"

echo ""
echo "📦 1. 备份现有代码..."
if [ -d "$PROJECT_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    cp -r "$PROJECT_DIR" "$BACKUP_DIR/"
    echo "✅ 备份完成: $BACKUP_DIR"
else
    echo "⚠️ 首次部署，无需备份"
fi

echo ""
echo "📥 2. 拉取最新代码..."
if [ ! -d "$PROJECT_DIR" ]; then
    git clone https://github.com/zhu637882-stack/jiaoyi.git "$PROJECT_DIR"
else
    cd "$PROJECT_DIR"
    git pull origin main
fi

echo ""
echo "🔧 3. 安装依赖..."
cd "$PROJECT_DIR"
pnpm install

echo ""
echo "🏗️ 4. 构建项目..."
pnpm run build

echo ""
echo "🔄 5. 执行数据库同步..."
cd "$PROJECT_DIR/packages/server"
npx typeorm schema:sync -d dist/database/data-source.js || echo "⚠️ 数据库同步失败，请检查配置"

echo ""
echo "🚀 6. 重启服务..."
# 停止现有服务
pm2 stop yuebao-server 2>/dev/null || true
pm2 delete yuebao-server 2>/dev/null || true

# 启动后端服务
cd "$PROJECT_DIR/packages/server"
pm2 start dist/main.js --name yuebao-server -- --port 3000

# 复制前端文件到Nginx目录
cp -r "$PROJECT_DIR/packages/web/dist"/* /var/www/html/
cp -r "$PROJECT_DIR/packages/mobile/dist"/* /var/www/html/mobile/ 2>/dev/null || true

echo ""
echo "=========================================="
echo "   ✅ 部署完成!"
echo "=========================================="
echo ""
echo "   🌐 管理后台: http://47.94.18.96"
echo "   📱 移动端: http://47.94.18.96/mobile"
echo "   🔧 API地址: http://47.94.18.96:3000"
echo ""
echo "   📋 登录账号:"
echo "   ┌──────────────────────────────────────┐"
echo "   │ 管理员:  admin     / admin123        │"
echo "   └──────────────────────────────────────┘"
echo ""
echo "=========================================="
