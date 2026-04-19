#!/bin/bash
# ============================================
# Docker 部署脚本 - 一键部署零钱保系统
# ============================================

set -e

SERVER="Administrator@103.43.188.127"
REMOTE_DIR="D:\\wwwroot\\jiaoyi"

echo "🚀 开始部署零钱保系统到服务器..."

# 1. 上传所有必要文件
echo "📦 上传项目文件..."
scp docker-compose.yml ${SERVER}:${REMOTE_DIR}\\docker-compose.yml
scp .env.docker ${SERVER}:${REMOTE_DIR}\\.env.docker
scp .dockerignore ${SERVER}:${REMOTE_DIR}\\.dockerignore
scp init-db.sql ${SERVER}:${REMOTE_DIR}\\init-db.sql
scp packages/server/Dockerfile ${SERVER}:${REMOTE_DIR}\\packages\\server\\Dockerfile
scp packages/web/Dockerfile ${SERVER}:${REMOTE_DIR}\\packages\\web\\Dockerfile
scp packages/web/nginx.conf ${SERVER}:${REMOTE_DIR}\\packages\\web\\nginx.conf

# 2. 上传完整项目源码（确保构建时文件完整）
echo "📂 同步后端源码..."
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.env' \
  packages/server/ ${SERVER}:${REMOTE_DIR}\\packages\\server\\

echo "📂 同步前端源码..."
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.env' \
  packages/web/ ${SERVER}:${REMOTE_DIR}\\packages\\web\\

echo "📂 同步根目录文件..."
scp package.json ${SERVER}:${REMOTE_DIR}\\package.json
scp pnpm-lock.yaml ${SERVER}:${REMOTE_DIR}\\pnpm-lock.yaml
scp pnpm-workspace.yaml ${SERVER}:${REMOTE_DIR}\\pnpm-workspace.yaml
scp tsconfig.json ${SERVER}:${REMOTE_DIR}\\tsconfig.json

# 3. 在服务器上构建和启动
echo "🏗️ 在服务器上构建 Docker 镜像并启动..."
ssh ${SERVER} "cd /d ${REMOTE_DIR} && copy .env.docker .env && docker compose up -d --build"

echo "✅ 部署完成！"
echo "🌐 访问 http://mufend.com"
