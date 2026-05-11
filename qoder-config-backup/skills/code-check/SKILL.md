---
name: code-check
description: 代码质量检查，包括 ESLint、TypeScript 类型检查和编译测试。Use when the user asks to "检查代码", "code check", "lint", "typecheck", "代码质量".
---

# 代码质量检查

## 前端检查

### ESLint 检查
```bash
cd packages/web
pnpm eslint . --ext .ts,.tsx --max-warnings=0
```

### TypeScript 类型检查
```bash
cd packages/web
pnpm tsc --noEmit
```

### 构建测试
```bash
cd packages/web
pnpm build
```

## 后端检查

### ESLint 检查
```bash
cd packages/server
pnpm eslint . --ext .ts --max-warnings=0
```

### TypeScript 类型检查
```bash
cd packages/server
pnpm tsc --noEmit
```

### 构建测试
```bash
cd packages/server
pnpm build
```

## 未使用代码检查

### 检查未使用变量/导入
```bash
# 前端
cd packages/web
pnpm eslint . --ext .ts,.tsx --rule '@typescript-eslint/no-unused-vars: error'

# 后端
cd packages/server
pnpm eslint . --ext .ts --rule '@typescript-eslint/no-unused-vars: error'
```

## 汇总报告脚本

```bash
#!/bin/bash
ERRORS=0
WARNINGS=0

echo "=== 代码质量检查报告 ==="

# 前端检查
echo -e "\n[前端] ESLint 检查..."
cd packages/web
if pnpm eslint . --ext .ts,.tsx --max-warnings=0 2>/dev/null; then
  echo "✓ 通过"
else
  echo "✗ 失败"
  ((ERRORS++))
fi

echo -e "\n[前端] TypeScript 检查..."
if pnpm tsc --noEmit 2>/dev/null; then
  echo "✓ 通过"
else
  echo "✗ 失败"
  ((ERRORS++))
fi

# 后端检查
echo -e "\n[后端] ESLint 检查..."
cd ../server
if pnpm eslint . --ext .ts --max-warnings=0 2>/dev/null; then
  echo "✓ 通过"
else
  echo "✗ 失败"
  ((ERRORS++))
fi

echo -e "\n[后端] TypeScript 检查..."
if pnpm tsc --noEmit 2>/dev/null; then
  echo "✓ 通过"
else
  echo "✗ 失败"
  ((ERRORS++))
fi

# 汇总
echo -e "\n=== 检查结果 ==="
echo "错误: $ERRORS"
echo "警告: $WARNINGS"

[ $ERRORS -eq 0 ] && echo "✓ 全部通过" || echo "✗ 存在错误"
exit $ERRORS
```
