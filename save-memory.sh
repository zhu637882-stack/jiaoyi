#!/bin/bash
# 长期记忆体保存脚本

DATE=$(date +%Y-%m-%d)
MEMORY_DIR=".qoder/memory/conversations"
mkdir -p $MEMORY_DIR

# 检查是否有未提交的记忆
if [ -z "$(git status --porcelain .qoder/memory/)" ]; then
    echo "没有新的记忆需要保存"
    exit 0
fi

# 提交记忆
git add .qoder/memory/
git commit -m "memory: $DATE 记忆更新"

# 尝试推送（如果配置了token）
if git push origin main 2>/dev/null; then
    echo "✅ 记忆已同步到 GitHub"
else
    echo "⚠️ 本地记忆已保存，GitHub 推送需要 Token"
fi

echo "记忆保存完成: $DATE"
