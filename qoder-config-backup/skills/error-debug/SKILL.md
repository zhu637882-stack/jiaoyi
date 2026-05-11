---
name: error-debug
description: 系统化调试工具，分类处理编译/运行时/网络/数据库错误，提供信息收集清单、前后端调试方法、常见问题速查表、二分法定位和回归测试。触发词：调试、排查错误、debug、报错了、出错了、error debug、troubleshoot
---

# 系统化调试

## 错误分类

| 类型 | 特征 | 排查重点 |
|------|------|----------|
| 编译错误 | 构建失败、类型错误 | 语法、类型定义、依赖 |
| 运行时错误 | 程序崩溃、异常抛出 | 逻辑、空值、边界条件 |
| 网络错误 | 请求失败、超时 | 接口、CORS、连接状态 |
| 数据库错误 | 查询失败、连接错误 | SQL、连接池、权限 |

## 信息收集清单

排查前收集：
- [ ] 完整错误消息
- [ ] 堆栈追踪（stack trace）
- [ ] 复现步骤
- [ ] 环境信息（Node版本、OS、浏览器）
- [ ] 最近变更（git diff）

## 后端调试

```bash
# 1. 检查日志
tail -f logs/app.log
journalctl -u <service> -f

# 2. 检查数据库状态
psql -c "\dt"  # 查看表
psql -c "SELECT * FROM pg_stat_activity;"  # 连接状态

# 3. 测试API响应
curl -v http://localhost:3000/api/health

# 4. 检查环境变量
env | grep APP_
```

## 前端调试

```bash
# 1. 浏览器控制台
# - 查看 Console 错误
# - 查看 Network 请求状态
# - 查看 Application Storage

# 2. 检查构建输出
npm run build 2>&1 | tee build.log

# 3. 检查路由配置
cat src/router/index.ts
```

## 常见问题速查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 端口占用 | 进程未关闭 | `lsof -ti:3000 \| xargs kill -9` |
| 模块未找到 | 依赖未安装 | `rm -rf node_modules && npm install` |
| 类型错误 | TS定义不匹配 | 检查 interface/type 定义 |
| CORS错误 | 跨域配置 | 检查后端 CORS 中间件 |
| 认证失败 | Token过期 | 检查 Authorization 头 |

## 二分法定位（git bisect）

```bash
# 1. 开始二分查找
git bisect start

# 2. 标记当前版本有问题
git bisect bad

# 3. 标记已知正常版本
git bisect good <commit-hash>

# 4. 自动测试（如项目有测试脚本）
git bisect run npm test

# 5. 结束查找
git bisect reset
```

## 修复后验证

```bash
# 1. 确认修复
git diff HEAD

# 2. 本地验证
npm run build
npm test

# 3. 回归测试（检查是否引入新问题）
npm run test:e2e

# 4. 提交修复
git add .
git commit -m "fix: 修复XXX问题"
```
