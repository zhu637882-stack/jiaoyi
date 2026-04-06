#!/bin/bash

# ============================================
#   药赚赚 · 交易终端 - 一键启动脚本
# ============================================

echo ""
echo "=========================================="
echo "   药赚赚 · 交易终端 启动中..."
echo "=========================================="
echo ""

# 项目根目录
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 停止已有进程
echo "🔄 检查并停止已有服务..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
sleep 1

# 启动后端服务
echo "🚀 启动后端服务 (端口 3000)..."
cd "$PROJECT_DIR/packages/server"
npm run dev > /tmp/yaozhuanzhuan-server.log 2>&1 &
SERVER_PID=$!

# 启动前端服务
echo "🚀 启动前端服务 (端口 5173)..."
cd "$PROJECT_DIR/packages/web"
npm run dev > /tmp/yaozhuanzhuan-web.log 2>&1 &
WEB_PID=$!

# 等待服务启动
echo ""
echo "⏳ 等待服务启动..."
sleep 5

echo ""
echo "=========================================="
echo "   ✅ 所有服务已启动!"
echo "=========================================="
echo ""
echo "   🌐 前端访问地址: http://localhost:5173"
echo "   🔧 后端API地址: http://localhost:3000"
echo ""
echo "   📋 登录账号:"
echo "   ┌──────────────────────────────────────┐"
echo "   │ 管理员:  admin     / admin123        │"
echo "   │ 投资者1: investor1 / investor123     │"
echo "   │ 投资者2: investor2 / investor123     │"
echo "   └──────────────────────────────────────┘"
echo ""
echo "   📝 日志文件:"
echo "   后端: /tmp/yaozhuanzhuan-server.log"
echo "   前端: /tmp/yaozhuanzhuan-web.log"
echo ""
echo "   ❌ 停止服务: 运行 ./stop.sh 或按 Ctrl+C"
echo "=========================================="
echo ""

# 自动打开浏览器
if command -v open &> /dev/null; then
    sleep 2
    open "http://localhost:5173"
    echo "   🌐 已自动打开浏览器"
    echo ""
fi

# 保持脚本运行，Ctrl+C 可退出
trap "echo ''; echo '🛑 正在停止所有服务...'; kill $SERVER_PID $WEB_PID 2>/dev/null; echo '✅ 服务已停止'; exit 0" SIGINT SIGTERM

wait
