---
name: db-reset
description: 重置药赚赚交易系统数据库，清除所有数据并重新初始化种子数据。Use when the user asks to reset database, reinitialize data, clear data, or mentions "重置数据库", "清库", "重新seed".
---

# 数据库重置

## 数据库信息
- 类型：PostgreSQL
- 用户：a1234（无密码）
- 数据库名：yaozhuanzhuan
- 连接：postgresql://a1234@localhost:5432/yaozhuanzhuan

## 重置流程

### Step 1: 确认操作
**此操作会删除所有数据！** 必须先向用户确认。

### Step 2: 停止后端服务
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
```

### Step 3: 删除并重建数据库
```bash
dropdb -U a1234 yaozhuanzhuan
createdb -U a1234 yaozhuanzhuan
```

### Step 4: 启动后端（TypeORM synchronize 会自动创建表）
```bash
cd /Users/a1234/jiaoyi/packages/server
npx nest start --watch &
```
等待后端启动完成（约 10 秒）。

### Step 5: 运行数据库迁移
```bash
cd /Users/a1234/jiaoyi/packages/server
npx ts-node src/database/seeds/initial.seed.ts
```

### Step 6: 运行迁移文件（如有）
```bash
npx typeorm migration:run -d src/database/data-source.ts
```

### Step 7: 验证
```bash
psql -U a1234 -d yaozhuanzhuan -c "SELECT count(*) FROM drug;"
psql -U a1234 -d yaozhuanzhuan -c "SELECT count(*) FROM \"user\";"
```

## 预期结果
- 5+ 个药品记录
- 3 个用户（admin、investor1、investor2）
- 空的交易和订单数据
