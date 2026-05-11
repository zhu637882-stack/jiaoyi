---
name: env-setup
description: 开发环境初始化工具，检测并安装 Homebrew、Node.js、pnpm、PostgreSQL、Redis、Git 等常用开发工具，自动配置 Git alias，最后输出完整环境摘要。触发词：环境配置、环境初始化、env setup、安装环境、新电脑配置
---

# 开发环境初始化

## 检测与安装流程

### 1. Homebrew (macOS)
```bash
# 检测
which brew

# 安装（如未安装）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### 2. Node.js (via nvm)
```bash
# 检测 nvm
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
which nvm

# 安装 nvm（如未安装）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 安装 LTS Node
nvm install --lts
nvm use --lts
nvm alias default lts/*
```

### 3. pnpm
```bash
# 检测
which pnpm

# 安装（如未安装）
curl -fsSL https://get.pnpm.io/install.sh | sh -
# 或: brew install pnpm
```

### 4. PostgreSQL
```bash
# 检测
which psql

# 安装（如未安装）
brew install postgresql@15
brew services start postgresql@15

# 验证
psql --version
brew services list | grep postgresql
```

### 5. Redis
```bash
# 检测
which redis-cli

# 安装（如未安装）
brew install redis
brew services start redis

# 验证
redis-cli ping  # 应返回 PONG
brew services list | grep redis
```

### 6. Git
```bash
# 检测
which git

# 安装（如未安装）
brew install git

# 配置常用 alias
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.lg "log --oneline --graph --decorate"
git config --global alias.last "log -1 HEAD"
```

## 环境摘要输出
```bash
echo "========== 环境摘要 =========="
echo "Homebrew: $(brew --version | head -1)"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "pnpm: $(pnpm --version)"
echo "PostgreSQL: $(psql --version)"
echo "Redis: $(redis-cli --version)"
echo "Git: $(git --version)"
echo "=============================="
```
