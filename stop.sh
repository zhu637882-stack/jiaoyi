#!/bin/bash

# 药赚赚 · 停止所有服务
echo "🛑 停止所有服务..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
echo "✅ 所有服务已停止"
