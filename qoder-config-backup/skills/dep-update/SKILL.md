---
name: dep-update
description: 依赖安全更新工具，扫描漏洞、分级报告、按 patch/minor/major 策略更新，自动创建备份分支，执行验证测试，生成更新报告。触发词：更新依赖、依赖升级、npm audit、安全漏洞、dep update、dependency update
---

# 依赖安全更新

## 漏洞扫描
```bash
# 扫描安全漏洞
npm audit
pnpm audit

# 查看详细报告
npm audit --audit-level=moderate
```

## 更新策略

### 分级更新（推荐顺序）
```bash
# 1. Patch 更新（安全修复）
npm update --save

# 2. Minor 更新（向下兼容功能）
npx npm-check-updates --target minor -u
npm install

# 3. Major 更新（谨慎操作，可能不兼容）
npx npm-check-updates --target major
# 手动检查每个 major 更新的变更日志后再更新
```

## 安全更新流程

### 1. 创建备份分支
```bash
git checkout -b deps/update-$(date +%Y%m%d)
```

### 2. 执行更新
```bash
# 查看可更新项
npx npm-check-updates

# 交互式选择更新
npx npm-check-updates -i

# 安装更新
npm install
```

### 3. 验证测试
```bash
# 类型检查
npx tsc --noEmit

# 编译验证
npm run build

# 运行测试
npm test
```

## Monorepo 多包更新
```bash
# pnpm workspace
pnpm -r update

# 更新特定包
pnpm --filter <package-name> update <dependency>

# 递归审计
pnpm audit --recursive
```

## 更新报告模板
```markdown
## 依赖更新报告

### 更新时间
2024-XX-XX

### 更新内容
| 包名 | 旧版本 | 新版本 | 类型 |
|------|--------|--------|------|
| pkg-a | 1.0.0 | 1.0.1 | patch |
| pkg-b | 2.0.0 | 2.1.0 | minor |

### 风险评估
- **低风险**: patch 更新，仅修复bug
- **中风险**: minor 更新，新增功能，需测试

### 验证结果
- [ ] 类型检查通过
- [ ] 编译成功
- [ ] 测试通过
```
