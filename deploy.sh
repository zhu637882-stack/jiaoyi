#!/bin/bash

# ==========================================
# 零钱保 - Docker 部署脚本
# ==========================================

set -e

echo "🚀 开始部署零钱保系统..."

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "⚠️  .env 文件不存在，从模板创建..."
    cp .env.example .env
    echo "⚠️  请编辑 .env 文件，填写必要的配置后再运行部署脚本"
    exit 1
fi

# 停止旧服务
echo "🛑 停止旧服务..."
docker-compose down 2>/dev/null || true

# 清理旧镜像（可选）
read -p "是否清理旧镜像以重新构建？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧹 清理旧镜像..."
    docker-compose rm -f
    docker rmi lingqianbao-backend lingqianbao-frontend 2>/dev/null || true
fi

# 构建并启动
echo "🔨 构建并启动服务..."
docker-compose up --build -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps

# 显示访问地址
echo ""
echo "✅ 部署完成！"
echo ""
echo "📱 访问地址："
echo "   - 前端: http://localhost 或 http://服务器IP"
echo "   - 后端 API: http://localhost:3000/api"
echo ""
echo "📊 常用命令："
echo "   - 查看日志: docker-compose logs -f"
echo "   - 停止服务: docker-compose down"
echo "   - 重启服务: docker-compose restart"
echo "   - 进入数据库: docker-compose exec postgres psql -U postgres -d lingqianbao"
echo ""
