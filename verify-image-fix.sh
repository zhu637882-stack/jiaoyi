#!/bin/bash

# 图片显示问题修复验证脚本
# 用途：快速检查修复是否生效

echo "======================================"
echo "🔍 图片显示问题修复验证"
echo "======================================"
echo ""

# 1. 检查TypeScript编译
echo "✅ Step 1: 检查TypeScript编译..."
cd /Users/a1234/jiaoyi/packages/mobile
npx tsc --noEmit
if [ $? -eq 0 ]; then
  echo "   ✅ TypeScript编译通过"
else
  echo "   ❌ TypeScript编译失败"
  exit 1
fi
echo ""

# 2. 检查Vite代理配置
echo "✅ Step 2: 检查Vite代理配置..."
if grep -q "'/uploads'" vite.config.ts; then
  echo "   ✅ /uploads 代理配置已添加"
else
  echo "   ❌ /uploads 代理配置缺失"
  exit 1
fi
echo ""

# 3. 检查图片URL构建逻辑
echo "✅ Step 3: 检查图片URL构建逻辑..."
if grep -q "buildImageUrl" src/pages/TradeList.tsx; then
  echo "   ✅ buildImageUrl 函数已添加"
else
  echo "   ❌ buildImageUrl 函数缺失"
  exit 1
fi
echo ""

# 4. 检查错误处理
echo "✅ Step 4: 检查图片错误处理..."
if grep -q "console.warn.*图片加载失败" src/pages/TradeList.tsx; then
  echo "   ✅ 图片加载失败日志已添加"
else
  echo "   ❌ 图片加载失败日志缺失"
  exit 1
fi
echo ""

# 5. 检查Nginx配置
echo "✅ Step 5: 检查Nginx配置..."
if grep -q "location /uploads/" ../../nginx.conf.new; then
  echo "   ✅ Nginx /uploads/ 代理配置存在"
else
  echo "   ⚠️  Nginx配置未找到（可能在不同路径）"
fi
echo ""

# 6. 检查CSS优化
echo "✅ Step 6: 检查CSS占位符优化..."
if grep -q "tl-drug-img-placeholder::before" src/pages/TradeList.css; then
  echo "   ✅ 占位符网格纹理已添加"
else
  echo "   ❌ 占位符样式未优化"
  exit 1
fi
echo ""

echo "======================================"
echo "✅ 所有检查通过！"
echo "======================================"
echo ""
echo "📋 下一步操作："
echo "1. 启动开发服务器: npm run dev"
echo "2. 访问: http://localhost:5174/m/trade-list"
echo "3. 打开浏览器DevTools > Network，过滤 'uploads'"
echo "4. 确认图片请求状态码为 200"
echo ""
echo "🐛 如果图片仍不显示，检查："
echo "- 后端服务器是否运行（http://103.43.188.127:3000）"
echo "- 数据库中药品是否有 imageUrl 字段"
echo "- 图片文件是否存在于 /uploads/drugs/ 目录"
echo ""
