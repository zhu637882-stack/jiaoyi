---
name: git-push
description: 将药赚赚项目代码推送到 GitHub 仓库，自动处理 Token 认证和安全清理。Use when the user asks to push, upload, sync code to GitHub, or mentions "推送", "上传代码", "git push".
---

# Git 推送到 GitHub

## 仓库信息
- 仓库：https://github.com/zhu637882-stack/jiaoyi
- 分支：main
- 认证：需要 Personal Access Token（账户不支持密码登录）

## 推送流程

### Step 1: 检查工作区状态
```bash
cd /Users/a1234/jiaoyi && git status
```

### Step 2: 提交未保存的更改（如有）
```bash
git add -A
git -c user.name="developer" -c user.email="dev@yaozhuanzhuan.com" commit -m "提交信息"
```
注意：本机未配置全局 Git 用户信息，必须用 `-c` 参数临时指定。

### Step 3: 向用户索取 Token
向用户索取 GitHub Personal Access Token（格式：ghp_xxxxx）。**不要使用记忆中缓存的旧 Token，每次都需要用户提供。**

### Step 4: 推送代码
```bash
git remote set-url origin https://zhu637882-stack:TOKEN@github.com/zhu637882-stack/jiaoyi.git
git push -u origin main
```

### Step 5: 安全清理（必须执行）
推送完成后立即清理 URL 中的 Token：
```bash
git remote set-url origin https://github.com/zhu637882-stack/jiaoyi.git
```

## 安全注意事项
- **绝不**在记忆中永久存储 Token
- 推送完成后**必须**清理 remote URL
- 每次推送都需要用户重新提供 Token
