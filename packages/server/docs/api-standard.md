# 药赚赚交易系统 API 设计规范

## 1. 接口响应标准格式

### 成功响应
```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

## 2. HTTP 状态码使用规范

| 状态码 | 使用场景 |
|--------|----------|
| 200 | 成功响应 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证/登录过期 |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如重复） |
| 422 | 业务逻辑错误 |
| 500 | 服务器内部错误 |

## 3. 命名规范

### URL 路径
- 使用小写字母
- 使用连字符 `-` 分隔单词
- 使用复数名词
- 示例: `/api/drugs`, `/api/orders`, `/api/market-snapshots`

### 请求参数
- 使用 camelCase
- 布尔值使用 `is` 前缀: `isActive`, `isDeleted`
- 时间使用 `At` 后缀: `createdAt`, `updatedAt`

### 响应字段
- 使用 camelCase
- 金额字段以 `Amount` 结尾: `totalAmount`, `profitAmount`
- 价格字段以 `Price` 结尾: `purchasePrice`, `sellingPrice`
- 数量字段以 `Quantity` 或 `Count` 结尾: `totalQuantity`, `orderCount`
- 比率字段以 `Rate` 结尾: `returnRate`, `feeRate`

## 4. 分页规范

### 请求参数
```json
{
  "page": 1,           // 当前页码，从1开始
  "pageSize": 20,      // 每页条数，默认20，最大100
  "sortBy": "createdAt", // 排序字段
  "sortOrder": "DESC"  // 排序方向: ASC/DESC
}
```

### 响应格式
```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

## 5. 数据类型规范

### 金额
- 使用 `DECIMAL(12, 2)` 存储
- 单位：人民币元
- 示例: `1234.56`

### 价格
- 使用 `DECIMAL(10, 2)` 存储
- 单位：人民币元
- 示例: `18.50`

### 比率/百分比
- 使用 `DECIMAL(8, 4)` 存储
- 小数形式: 5% = 0.05
- 示例: `0.0523` 表示 5.23%

### 收益率
- 使用 `DECIMAL(8, 4)` 存储
- 小数形式: 10% = 0.10
- 示例: `0.1085` 表示 10.85%

### 时间戳
- 使用 ISO 8601 格式
- 示例: `2026-04-20T10:30:00.000Z`

## 6. 错误码规范

### 通用错误 (COMMON)
- `COMMON_INVALID_PARAM` - 参数错误
- `COMMON_UNAUTHORIZED` - 未认证
- `COMMON_FORBIDDEN` - 无权限
- `COMMON_NOT_FOUND` - 资源不存在
- `COMMON_INTERNAL_ERROR` - 内部错误

### 用户错误 (USER)
- `USER_NOT_FOUND` - 用户不存在
- `USER_ALREADY_EXISTS` - 用户已存在
- `USER_INVALID_CREDENTIALS` - 凭证无效
- `USER_ACCOUNT_FROZEN` - 账户已冻结

### 药品错误 (DRUG)
- `DRUG_NOT_FOUND` - 药品不存在
- `DRUG_CODE_EXISTS` - 药品编码已存在
- `DRUG_INSUFFICIENT_QUANTITY` - 库存不足
- `DRUG_NOT_ON_SALE` - 药品未开售

### 订单错误 (ORDER)
- `ORDER_NOT_FOUND` - 订单不存在
- `ORDER_INVALID_STATUS` - 订单状态无效
- `ORDER_INSUFFICIENT_BALANCE` - 余额不足
- `ORDER_QUANTITY_EXCEEDED` - 超出限购数量

## 7. 安全规范

### 认证
- 使用 JWT Token
- Token 有效期: 24小时
- 刷新 Token 有效期: 7天

### 敏感数据
- 密码必须加密存储 (bcrypt)
- 身份证号、银行卡号脱敏显示
- 日志中禁止输出敏感信息

### 接口限流
- 登录接口: 5次/分钟
- 普通接口: 100次/分钟
- 导出接口: 10次/分钟

## 8. 文档规范

### 接口注释
```typescript
/**
 * 创建药品
 * @param createDrugDto 药品信息
 * @returns 创建的药品对象
 * @throws {BadRequestException} 药品编码已存在
 * @throws {UnauthorizedException} 未登录
 * @throws {ForbiddenException} 无权限
 */
@Post()
async create(@Body() createDrugDto: CreateDrugDto) { ... }
```

### 字段注释
```typescript
// 使用 JSDoc 注释字段含义
@Column('decimal', { precision: 10, scale: 2 })
/** 采购价（进价） */
purchasePrice: number;

@Column('decimal', { precision: 10, scale: 2 })
/** 实际成交价 - 财务每日填写 */
actualSellingPrice: number;
```
