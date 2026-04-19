# ===== 构建阶段 =====
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 先复制依赖文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/web/package.json ./packages/web/

# 安装依赖
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# 复制源码
COPY packages/web/ ./packages/web/
COPY tsconfig.json ./

# 构建前端
RUN cd packages/web && pnpm build

# ===== 生产阶段（nginx 静态文件服务） =====
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# 复制 nginx 配置（替代 proxy-server-v2.js）
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

# 删除默认的 nginx 配置，避免冲突
RUN rm -f /etc/nginx/conf.d/default.conf.bak

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
