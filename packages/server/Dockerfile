# ===== 构建阶段 =====
FROM node:20-alpine AS builder

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 先复制依赖文件，利用 Docker 缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/server/package.json ./packages/server/

# 安装依赖（包含 devDependencies，构建需要）
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# 复制源码
COPY packages/server/ ./packages/server/
COPY tsconfig.json ./

# 构建
RUN cd packages/server && pnpm build

# ===== 生产阶段 =====
FROM node:20-alpine

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制依赖文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/server/package.json ./packages/server/

# 只安装生产依赖
ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod 2>/dev/null || pnpm install --prod

# 复制构建产物
COPY --from=builder /app/packages/server/dist ./packages/server/dist

# 数据库迁移文件也需要
COPY packages/server/src/database/migrations ./packages/server/src/database/migrations

WORKDIR /app/packages/server

EXPOSE 3000

CMD ["node", "dist/main"]
