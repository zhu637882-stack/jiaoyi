---
name: start-services
description: 一键启动药赚赚交易系统的全部服务（PostgreSQL、Redis、后端、前端）。Use when the user asks to start, launch, or run the project services, or mentions "启动服务".
---

# 一键启动服务

## 启动流程

按以下顺序启动所有服务：

### Step 1: 检查并启动 PostgreSQL
```bash
pg_isready -h localhost -p 5432 || brew services start postgresql@14
```

### Step 2: 检查并启动 Redis
```bash
redis-cli ping || brew services start redis
```

### Step 3: 启动后端（NestJS）
```bash
cd /Users/a1234/jiaoyi/packages/server
nohup npx nest start --watch > /tmp/yaozhuanzhuan-server.log 2>&1 &
```
等待后端就绪（端口 3000）：
```bash
for i in {1..30}; do curl -s http://localhost:3000/api/health > /dev/null && break; sleep 1; done
```

### Step 4: 启动前端（Vite）
```bash
cd /Users/a1234/jiaoyi/packages/web
nohup npx vite > /tmp/yaozhuanzhuan-web.log 2>&1 &
```

### Step 5: 验证
- 后端：`curl -s http://localhost:3000/api/health`
- 前端：`curl -s http://localhost:5173`

## 停止所有服务
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
```

## 测试账号
- 管理员：admin / admin123
- 投资者1：investor1 / investor123
- 投资者2：investor2 / investor123
