---
name: db-backup
description: 数据库备份与恢复，支持自动清理旧备份。Use when the user asks to "备份数据库", "恢复数据库", "db backup", "db restore", "数据库快照".
---

# 数据库备份与恢复

## 环境变量
```bash
DB_NAME=${DB_NAME:-myapp}
DB_USER=${DB_USER:-postgres}
BACKUP_DIR=${BACKUP_DIR:-./backups}
mkdir -p $BACKUP_DIR
```

## 全量备份

### 创建备份
```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_full_${TIMESTAMP}.sql"

pg_dump -U ${DB_USER} -d ${DB_NAME} > ${BACKUP_FILE}
gzip ${BACKUP_FILE}

echo "备份完成: ${BACKUP_FILE}.gz"
```

## 指定表备份

```bash
TABLES="users orders products"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_tables_${TIMESTAMP}.sql"

pg_dump -U ${DB_USER} -d ${DB_NAME} -t ${TABLES} > ${BACKUP_FILE}
gzip ${BACKUP_FILE}
```

## 恢复数据库

### 从备份恢复
```bash
# 先清空数据库
dropdb -U ${DB_USER} ${DB_NAME}
createdb -U ${DB_USER} ${DB_NAME}

# 恢复数据
gunzip -c ${BACKUP_FILE}.gz | psql -U ${DB_USER} -d ${DB_NAME}
```

## 列出备份

```bash
ls -lah ${BACKUP_DIR}/*.gz 2>/dev/null || echo "无备份文件"
```

## 清理旧备份

### 删除7天前的备份
```bash
find ${BACKUP_DIR} -name "*.gz" -mtime +7 -delete
echo "已清理7天前的备份"
```

## 一键备份脚本

```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql"

# 创建备份
pg_dump -U ${DB_USER} -d ${DB_NAME} | gzip > ${BACKUP_FILE}.gz

# 清理旧备份
find ${BACKUP_DIR} -name "*.gz" -mtime +7 -delete

echo "备份完成: ${BACKUP_FILE}.gz"
```
