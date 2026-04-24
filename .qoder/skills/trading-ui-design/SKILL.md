---
name: trading-ui-design
description: 金融交易类UI设计技能，基于GitHub TOP10开源项目的专业设计规范。涵盖深色主题系统、交易面板布局、K线图集成、订单簿组件、投资组合卡片、移动端适配。Use when the user asks to "美化界面", "UI优化", "界面设计", "交易界面", "深色主题", "组件设计", "页面改造".
---

# 金融交易UI设计规范

基于 PancakeSwap、Binance Clone、RevS AI、Trading Dashboard React 等 TOP10 开源项目提炼的设计规范。

## 一、色彩系统

### 深色主题（默认）
```css
/* 背景层级 */
--bg-primary: #0a0e27;       /* 主背景 - 深蓝黑 */
--bg-secondary: #141829;     /* 卡片/面板背景 */
--bg-tertiary: #1a1f3a;      /* 输入框/hover态 */
--bg-hover: rgba(255,255,255,0.05);

/* 文字 */
--text-primary: #ffffff;
--text-secondary: #b3b7c0;
--text-muted: #848e9c;

/* 品牌色 - 药赚赚灰黄配色 */
--brand-primary: #f0ad4e;    /* 金黄主色 */
--brand-hover: #d4982a;

/* 语义色 */
--color-up: #0ECB81;         /* 上涨/盈利 绿色 */
--color-down: #F6465D;       /* 下跌/亏损 红色 */
--color-warning: #FAAD14;    /* 警告 橙黄 */
--color-info: #1890FF;       /* 信息 蓝色 */
```

### 通用间距
```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
--radius-sm: 6px;
--radius-md: 12px;
--radius-lg: 16px;
```

## 二、卡片与面板

### 标准卡片
```css
.card {
  background: var(--bg-secondary);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}
.card:hover {
  border-color: rgba(255, 255, 255, 0.15);
}
```

### 玻璃态卡片（高级）
```css
.glass-card {
  background: rgba(20, 24, 41, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
}
```

### 数据统计卡
```tsx
<div className="stat-card">
  <span className="stat-label">总资产</span>
  <span className="stat-value">¥1,234,567.89</span>
  <span className="stat-change up">+2.34%</span>
</div>
```

## 三、交易面板布局

### PC端 — 三栏布局（参考币安）
```
┌─────────────────────────────────────────┐
│  顶部导航栏（品牌Logo + 菜单 + 用户）    │
├──────────┬──────────────┬───────────────┤
│ 左栏     │ 中间主区域    │ 右栏          │
│ 药品列表  │ K线图表      │ 订单面板      │
│ 筛选过滤  │ 深度图       │ 买入/卖出     │
│          │ 成交记录      │ 余额显示      │
├──────────┴──────────────┴───────────────┤
│  底部：持仓列表 / 订单历史 / 交易记录      │
└─────────────────────────────────────────┘
```

### 移动端 — 单栏堆叠
```
┌────────────────────┐
│ 药品信息 + 价格     │
├────────────────────┤
│ 迷你K线图          │
├────────────────────┤
│ 快捷操作按钮        │
├────────────────────┤
│ 认购弹窗（底部抽屉）│
└────────────────────┘
```

## 四、关键组件模式

### 1. 认购弹窗（参考手机版）
```tsx
// 底部抽屉式弹窗，包含：
// 1. 药品信息行（名称 + 单价）
// 2. 数量输入（-/+ 按钮控制）
// 3. 金额实时计算
// 4. 支付方式三选一卡片
// 5. 确认按钮（品牌金黄色）
```

### 2. 状态徽章
```css
.badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; }
.badge.pending   { background: rgba(250,173,20,0.15); color: #FAAD14; }
.badge.activated { background: rgba(14,203,129,0.15); color: #0ECB81; }
.badge.expired   { background: rgba(132,142,156,0.15); color: #848E9C; }
```

### 3. 数据表格
```css
.table-row:hover { background: var(--bg-hover); }
.amount-up { color: var(--color-up); }
.amount-down { color: var(--color-down); }
/* 固定表头、斑马纹间隔、右对齐金额列 */
```

### 4. 按钮系统
```css
.btn-primary { background: var(--brand-primary); color: #000; font-weight: 600; }
.btn-buy { background: var(--color-up); }
.btn-sell { background: var(--color-down); }
.btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.2); }
```

## 五、K线图集成

推荐库: **lightweight-charts**（TradingView出品）
```bash
npm install lightweight-charts
```

```tsx
import { createChart } from 'lightweight-charts';

const chart = createChart(container, {
  layout: { background: { color: '#0a0e27' }, textColor: '#b3b7c0' },
  grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
  crosshair: { mode: 0 },
});

const candleSeries = chart.addCandlestickSeries({
  upColor: '#0ECB81', downColor: '#F6465D',
  borderUpColor: '#0ECB81', borderDownColor: '#F6465D',
  wickUpColor: '#0ECB81', wickDownColor: '#F6465D',
});
```

## 六、动画与微交互

### 数值变化动画
```css
.price-flash-up { animation: flashGreen 0.6s ease-out; }
.price-flash-down { animation: flashRed 0.6s ease-out; }

@keyframes flashGreen {
  0% { background: rgba(14,203,129,0.3); }
  100% { background: transparent; }
}
```

### 页面过渡
```tsx
import { motion } from 'framer-motion';

<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
  {content}
</motion.div>
```

## 七、响应式断点

```css
/* Mobile first */
@media (min-width: 768px)  { /* 平板 */ }
@media (min-width: 1024px) { /* 桌面 */ }
@media (min-width: 1440px) { /* 大屏 */ }
```

移动端关键规则：
- Modal 自动转为底部抽屉
- 表格转为卡片列表
- 侧栏折叠为底部Tab
- 触摸目标最小 44px

## 八、参考项目速查

| 需求 | 参考项目 | GitHub |
|------|---------|--------|
| 设计令牌系统 | PancakeSwap Storybook | pancakeswap/storybook |
| 全栈交易平台 | RevS AI | surenab/revs_ai |
| 移动端金融App | Stock Market App | bhavyajshah/stock-market-app-ui-template |
| 实时数据面板 | Trading Dashboard | galafis/trading-dashboard-react |
| 币安风格布局 | Binance Clone | APZdev/binance-clone-react |
| 订单簿组件 | React Order Book | lab49/react-order-book |
| 管理后台模板 | TailAdmin | TailAdmin/free-react-tailwind-admin-dashboard |

## 九、推荐技术栈

```json
{
  "ui": "shadcn/ui + Ant Design（后台）",
  "样式": "CSS变量 + 内联样式（当前项目方案）",
  "图表": "lightweight-charts（K线）+ Recharts（通用）",
  "动画": "framer-motion",
  "状态": "React useState/useContext（当前）",
  "实时": "WebSocket + React Query"
}
```
