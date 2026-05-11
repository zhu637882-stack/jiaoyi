---
name: project-init
description: 初始化全栈 Web 项目脚手架，创建 monorepo 结构。Use when the user asks to "初始化项目", "新项目", "project init", "scaffold", "创建项目".
---

# 全栈项目脚手架

## 前置确认

询问用户：
1. 项目名称（默认：my-app）
2. 前端框架：React / Vue / Next.js
3. 后端框架：NestJS / Express
4. 数据库：PostgreSQL / MySQL

## 创建流程

### Step 1: 创建项目目录
```bash
mkdir -p ${PROJECT_ROOT}/{packages/web,packages/server}
cd ${PROJECT_ROOT}
```

### Step 2: 初始化 pnpm workspace
```bash
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'packages/*'
EOF
```

### Step 3: 根目录 package.json
```bash
cat > package.json << 'EOF'
{
  "name": "${PROJECT_NAME}",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
EOF
```

### Step 4: 创建共享配置
```bash
# tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
EOF

# .gitignore
cat > .gitignore << 'EOF'
node_modules/
dist/
build/
.env
.env.local
*.log
.DS_Store
.vscode/
.idea/
coverage/
EOF

# .env.example
cat > .env.example << 'EOF'
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Backend
PORT=3000
JWT_SECRET=your-jwt-secret

# Frontend
VITE_API_URL=http://localhost:3000/api
EOF
```

### Step 5: 初始化 Git
```bash
git init
git add .
git commit -m "Initial commit"
```

### Step 6: 安装前端（以 React + Vite 为例）
```bash
cd packages/web
npm create vite@latest . -- --template react-ts
pnpm install
```

### Step 7: 安装后端（以 NestJS 为例）
```bash
cd packages/server
nest new . --strict --skip-git
pnpm install
```

## 预期结果

- 完整的 monorepo 结构
- pnpm workspace 配置
- 前后端可独立运行
- Git 仓库已初始化
