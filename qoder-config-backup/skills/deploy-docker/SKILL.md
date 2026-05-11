---
name: deploy-docker
description: 生成 Docker 部署配置，包括多阶段 Dockerfile 和 docker-compose。Use when the user asks to "Docker部署", "容器化", "deploy docker", "生成Dockerfile".
---

# Docker 部署配置

## 生成 Dockerfile（后端）

```bash
cat > packages/server/Dockerfile << 'EOF'
# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build

# 生产阶段
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/main"]
EOF
```

## 生成 Dockerfile（前端）

```bash
cat > packages/web/Dockerfile << 'EOF'
# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build

# 生产阶段（nginx）
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF
```

## 生成 nginx.conf

```bash
cat > packages/web/nginx.conf << 'EOF'
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:3000/api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF
```

## 生成 docker-compose.yml

```bash
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-password}
      POSTGRES_DB: ${DB_NAME:-myapp}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./packages/server
    environment:
      DATABASE_URL: postgres://${DB_USER:-postgres}:${DB_PASSWORD:-password}@postgres:5432/${DB_NAME:-myapp}
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./packages/web
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
EOF
```

## 生成 .dockerignore

```bash
cat > .dockerignore << 'EOF'
node_modules/
dist/
build/
.env
.env.local
*.log
.git/
.gitignore
.vscode/
.idea/
coverage/
EOF
```

## 构建和启动

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```
