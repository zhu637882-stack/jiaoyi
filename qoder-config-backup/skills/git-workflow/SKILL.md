---
name: git-workflow
description: Git 高级工作流工具，支持分支管理、Conventional Commits 提交规范、PR 创建模板、冲突处理、语义化版本标签、安全回滚等。触发词：创建分支、合并分支、解决冲突、创建PR、git workflow、rebase、cherry-pick
---

# Git 高级工作流

## 分支管理

### 创建规范分支
```bash
# Feature 分支
git checkout main && git pull origin main
git checkout -b feature/功能描述

# Fix 分支
git checkout -b fix/问题描述

# Hotfix 分支
git checkout -b hotfix/紧急修复描述
```

## Conventional Commits
```bash
# 格式: <type>(<scope>): <subject>
git commit -m "feat(auth): 添加用户登录功能"
git commit -m "fix(api): 修复空指针异常"
git commit -m "chore(deps): 更新依赖版本"
git commit -m "docs(readme): 更新安装说明"
git commit -m "refactor(utils): 重构日期处理函数"
git commit -m "test(user): 添加用户模块单元测试"
git commit -m "style(css): 统一代码格式"
```

## PR 创建模板
```markdown
## 变更内容
- 功能A实现
- 问题B修复

## 测试方式
- [ ] 单元测试通过
- [ ] 手动测试验证

## 影响范围
- 模块X
- API Y
```

## 冲突处理流程
```bash
# 1. 拉取最新代码
git pull origin main

# 2. 如有冲突，编辑冲突文件后
git add <冲突文件>
git commit -m "merge: 解决与 main 分支的冲突"

# 3. 继续 rebase（如使用）
git rebase --continue
```

## 语义化版本标签
```bash
# 打标签
git tag -a v1.2.3 -m "Release version 1.2.3"
git push origin v1.2.3

# 版本号规则：MAJOR.MINOR.PATCH
# MAJOR: 不兼容变更
# MINOR: 向下兼容功能添加
# PATCH: 向下兼容问题修复
```

## 安全回滚（禁止 force push）
```bash
# 查看历史
git lg

# 回滚指定提交（生成新提交）
git revert <commit-hash>
git push origin <branch>

# 查看美化日志
git log --oneline --graph --decorate --all
```

## Cherry-pick
```bash
# 将特定提交应用到当前分支
git cherry-pick <commit-hash>

# 如遇冲突，解决后
git add .
git cherry-pick --continue
```
