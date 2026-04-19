# 药赚赚前端组件使用规范

## 1. 页面分类标准

### 客户页面 (Dashboard, Trade, Portfolio)
- **目标**: 美观、专业、激发购买欲望
- **风格**: 深色主题、金融感、发光效果
- **优先级**: 视觉效果 > 信息密度

### 管理页面 (Admin)
- **目标**: 高效、实用、信息完整
- **风格**: 简洁、紧凑、高对比度
- **优先级**: 信息密度 > 视觉效果

## 2. 布局标准

### 客户页面布局
```
┌─────────────────────────────────────────────────┐
│  Header (56px)                                   │
├──────────┬──────────────────────────┬──────────┤
│          │                          │          │
│  Sidebar │       Main Content       │  Panel   │
│  (240px) │       (flex: 1)          │  (320px) │
│          │                          │          │
├──────────┴──────────────────────────┴──────────┤
│  Bottom Area (认购概览 + Tab面板)               │
└─────────────────────────────────────────────────┘
```

### 管理页面布局
```
┌─────────────────────────────────────────────────┐
│  Header (48px)                                   │
├──────────┬──────────────────────────────────────┤
│          │                                      │
│  Sidebar │       Main Content                   │
│  (200px) │       (flex: 1)                      │
│          │                                      │
└──────────┴──────────────────────────────────────┘
```

## 3. 组件使用规范

### 按钮 (Button)

#### 客户页面
```tsx
// 主要操作 - 大按钮，渐变背景
<button className="btn btn-primary">
  立即认购
</button>

// 次要操作
<button className="btn btn-secondary">
  查看详情
</button>
```

#### 管理页面
```tsx
// 主要操作
<Button type="primary" size="middle">
  保存
</Button>

// 次要操作
<Button size="middle">
  取消
</Button>

// 危险操作
<Button danger size="middle">
  删除
</Button>

// 小按钮（表格内操作）
<Button type="link" size="small">
  编辑
</Button>
```

### 输入框 (Input)

#### 客户页面
```tsx
<input 
  className="input" 
  placeholder="请输入认购数量"
  type="number"
/>
```

#### 管理页面
```tsx
<Form.Item label="药品名称" rules={[{ required: true }]}>
  <Input placeholder="请输入药品名称" />
</Form.Item>

<Form.Item label="采购价">
  <InputNumber 
    min={0} 
    precision={2} 
    style={{ width: '100%' }}
  />
</Form.Item>
```

### 卡片 (Card)

#### 客户页面
```tsx
<div className="card">
  <div className="card-title">认购概览</div>
  <div className="card-content">
    {/* 内容 */}
  </div>
</div>

// 高亮卡片
<div className="card card-highlight">
  {/* 内容 */}
</div>
```

#### 管理页面
```tsx
<Card title="药品信息" className="admin-card">
  {/* 内容 */}
</Card>

// 紧凑卡片
<Card className="admin-card card-compact">
  {/* 内容 */}
</Card>
```

### 表格 (Table)

#### 管理页面专用
```tsx
<Table
  columns={columns}
  dataSource={data}
  pagination={{
    pageSize: 20,
    showSizeChanger: true,
    showTotal: (total) => `共 ${total} 条`,
  }}
  scroll={{ x: 1200 }}
/>
```

### 标签 (Tag)

#### 客户页面
```tsx
// 收益率标签
<span className="tag tag-up">+12.5%</span>
<span className="tag tag-down">-2.3%</span>

// 状态标签
<span className="tag tag-primary">认购中</span>
```

#### 管理页面
```tsx
// Ant Design Tag
<Tag color="success">已通过</Tag>
<Tag color="warning">待审核</Tag>
<Tag color="error">已拒绝</Tag>
<Tag color="processing">处理中</Tag>
```

## 4. 文字排版规范

### 客户页面
| 元素 | 字号 | 字重 | 颜色 |
|------|------|------|------|
| 页面标题 | 24px | 700 | text-primary |
| 区块标题 | 18px | 600 | text-primary |
| 卡片标题 | 16px | 600 | text-primary |
| 正文 | 14px | 400 | text-primary |
| 辅助文字 | 12px | 400 | text-secondary |
| 价格 | 18px | 700 | up/down |
| 收益率 | 20px | 700 | up/down + glow |

### 管理页面
| 元素 | 字号 | 字重 | 颜色 |
|------|------|------|------|
| 页面标题 | 20px | 600 | text-primary |
| 区块标题 | 16px | 600 | text-primary |
| 表格文字 | 13px | 400 | text-primary |
| 标签文字 | 12px | 500 | text-secondary |
| 按钮文字 | 13px | 500 | - |
| 输入文字 | 14px | 400 | text-primary |

## 5. 间距规范

### 客户页面
- 页面内边距: 16px ~ 24px
- 卡片间距: 16px
- 卡片内边距: 16px ~ 20px
- 元素间距: 12px ~ 16px

### 管理页面
- 页面内边距: 12px ~ 16px
- 卡片间距: 12px
- 卡片内边距: 12px ~ 16px
- 表格行高: 44px
- 元素间距: 8px ~ 12px

## 6. 颜色使用规范

### 涨跌色（中国标准）
- 涨: `#cf1322` (红色)
- 跌: `#00b96b` (绿色)
- 平: `#8b949e` (灰色)

### 状态色
- 成功: `#52c41a`
- 警告: `#faad14`
- 错误: `#f5222d`
- 信息: `#1890ff`
- 处理中: `#1890ff`

### 背景色层级
1. 主背景: `#0d1117`
2. 次级背景: `#161b22`
3. 三级背景: `#21262d`
4. 浮层背景: `#30363d`

## 7. 响应式断点

```css
/* 移动端 */
@media (max-width: 768px) {
  /* 单列布局 */
  /* 隐藏侧边栏 */
  /* 全宽按钮 */
}

/* 平板 */
@media (min-width: 769px) and (max-width: 1024px) {
  /* 双列布局 */
  /* 收缩侧边栏 */
}

/* 桌面 */
@media (min-width: 1025px) {
  /* 完整布局 */
}
```

## 8. 动画规范

### 客户页面
```css
/* 悬停效果 */
transition: transform 250ms ease, box-shadow 250ms ease;

/* 悬停上浮 */
:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.5);
}

/* 发光效果 */
.glow-up {
  text-shadow: 0 0 10px rgba(207, 19, 34, 0.4);
}
```

### 管理页面
```css
/* 快速反馈 */
transition: background-color 150ms ease, border-color 150ms ease;

/* 行悬停 */
tr:hover {
  background: rgba(48, 54, 61, 0.5);
}
```

## 9. 导入规范

### CSS 导入
```tsx
// 全局样式
import '@/styles/design-system.css';

// 页面样式
import './Dashboard.css';

// 组件样式
import './style.css';
```

### 组件导入
```tsx
// 第三方组件
import { Button, Card, Table } from 'antd';

// 自定义组件
import KLineChart from '@/components/KLineChart';
import SubscriptionOverview from '@/components/SubscriptionOverview';

// 工具函数
import { formatAmount, formatPercent } from '@/utils/formatters';
```

## 10. 文件命名规范

### 组件文件
- 大驼峰命名: `KLineChart.tsx`, `OrderBook.tsx`
- 目录结构: `components/ComponentName/index.tsx`
- 样式文件: `components/ComponentName/style.css`

### 页面文件
- 大驼峰命名: `Dashboard.tsx`, `Admin.tsx`
- 样式文件: `pages/Dashboard.css`

### 工具文件
- 小驼峰命名: `formatters.ts`, `validators.ts`
- 目录: `utils/`, `hooks/`, `services/`
