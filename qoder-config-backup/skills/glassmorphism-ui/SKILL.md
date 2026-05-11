---
name: glassmorphism-ui
description: 毛玻璃浅色主题UI设计规范，适用于国际化金融理财移动端App。参考Revolut、Wise、Apple Finance风格。Use when the user asks to "毛玻璃", "glassmorphism", "浅色主题", "玻璃态", "金融App UI", "移动端美化", "轻量设计", "玻璃效果", "磨砂背景", "透明卡片".
---

# 毛玻璃浅色主题 UI 设计规范

基于 Revolut、Wise、Apple Finance 等国际顶级金融 App 提炼的 Glassmorphism 浅色主题设计系统。适用于移动端金融理财场景。

## 一、设计哲学

- **轻盈通透**：大面积留白 + 半透明层叠，营造空间感与呼吸感
- **克制用色**：低饱和度主色 + 高饱和度语义色，视觉焦点精准
- **层次分明**：通过 blur、opacity、border 三要素区分层级，不依赖阴影堆叠
- **触觉反馈**：每个可交互元素都需有明确的 hover/active 视觉回应
- **国际化优先**：文案预留 30% 扩展空间，图标优于文字，支持 RTL

## 二、色彩系统

### 浅色毛玻璃主色板
```css
/* 背景层级 — 核心三阶 */
--bg-base: #F2F4F8;              /* 页面底层背景 — 冷灰蓝 */
--bg-surface: rgba(255, 255, 255, 0.72);  /* 卡片/面板 — 半透明白 */
--bg-elevated: rgba(255, 255, 255, 0.88); /* 浮层/弹窗 — 高不透明白 */

/* 毛玻璃背景（带渐变纹理） */
--bg-glass-gradient: linear-gradient(
  135deg,
  rgba(255, 255, 255, 0.6) 0%,
  rgba(255, 255, 255, 0.3) 50%,
  rgba(240, 244, 255, 0.4) 100%
);

/* 文字层级 */
--text-primary: #1A1D26;         /* 主文字 — 近黑 */
--text-secondary: #6B7280;       /* 辅助文字 — 中灰 */
--text-tertiary: #9CA3AF;        /* 弱化文字 — 浅灰 */
--text-on-accent: #FFFFFF;       /* 品牌色上的文字 */

/* 品牌色 — 金融蓝紫（Revolut 风格） */
--accent-primary: #5B5FEF;       /* 主品牌色 — 靛蓝紫 */
--accent-secondary: #7C3AED;     /* 辅品牌色 — 紫罗兰 */
--accent-gradient: linear-gradient(135deg, #5B5FEF 0%, #7C3AED 100%);
--accent-light: rgba(91, 95, 239, 0.08);  /* 品牌浅底色 */

/* 语义色 */
--color-profit: #10B981;         /* 盈利 — 翡翠绿 */
--color-loss: #EF4444;           /* 亏损 — 珊瑚红 */
--color-warning: #F59E0B;        /* 警告 — 琥珀黄 */
--color-info: #3B82F6;           /* 信息 — 天空蓝 */
--color-success: #10B981;        /* 成功 — 翡翠绿 */

/* 语义色浅底（用于标签、徽章背景） */
--color-profit-bg: rgba(16, 185, 129, 0.10);
--color-loss-bg: rgba(239, 68, 68, 0.10);
--color-warning-bg: rgba(245, 158, 11, 0.10);
--color-info-bg: rgba(59, 130, 246, 0.10);

/* 边框 */
--border-glass: rgba(255, 255, 255, 0.5);    /* 玻璃态外边框 */
--border-subtle: rgba(0, 0, 0, 0.06);         /* 微弱分割线 */
--border-medium: rgba(0, 0, 0, 0.10);         /* 标准分割线 */
--border-focus: var(--accent-primary);         /* 聚焦态 */

/* 阴影（毛玻璃体系使用极轻阴影） */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.08);
--shadow-glass: 0 8px 32px rgba(31, 38, 135, 0.08);  /* 毛玻璃专用 */
```

### 深色模式适配（可选扩展）
```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-base: #0F1117;
    --bg-surface: rgba(30, 33, 48, 0.72);
    --bg-elevated: rgba(40, 44, 62, 0.88);
    --text-primary: #F1F2F6;
    --text-secondary: #9BA1B0;
    --border-glass: rgba(255, 255, 255, 0.08);
    --border-subtle: rgba(255, 255, 255, 0.05);
    --shadow-glass: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
}
```

## 三、毛玻璃组件系统

### 3.1 基础玻璃卡片
```css
.glass-card {
  background: var(--bg-surface);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--border-glass);
  border-radius: 16px;
  box-shadow: var(--shadow-glass);
  padding: 20px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-card:hover {
  background: rgba(255, 255, 255, 0.85);
  border-color: rgba(255, 255, 255, 0.7);
  box-shadow: 0 8px 40px rgba(31, 38, 135, 0.12);
  transform: translateY(-1px);
}

.glass-card:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}
```

### 3.2 高亮玻璃卡片（品牌渐变底）
```css
.glass-card-accent {
  background: var(--accent-gradient);
  border: none;
  border-radius: 16px;
  padding: 20px;
  position: relative;
  overflow: hidden;
  color: #FFFFFF;
}

/* 卡片内部毛玻璃层 — 用于叠加内容区 */
.glass-card-accent .glass-inner {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 12px;
}

/* 装饰光晕 */
.glass-card-accent::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -30%;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}
```

### 3.3 浮动面板（Bottom Sheet / Modal）
```css
.glass-panel {
  background: var(--bg-elevated);
  backdrop-filter: blur(40px) saturate(200%);
  -webkit-backdrop-filter: blur(40px) saturate(200%);
  border: 1px solid var(--border-glass);
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.08);
}

/* 拖拽指示条 */
.glass-panel .handle {
  width: 36px;
  height: 4px;
  background: rgba(0, 0, 0, 0.12);
  border-radius: 2px;
  margin: 8px auto 16px;
}
```

### 3.4 毛玻璃导航栏
```css
.glass-navbar {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid var(--border-glass);
  position: sticky;
  top: 0;
  z-index: 100;
}
```

### 3.5 毛玻璃底部TabBar
```css
.glass-tabbar {
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-top: 1px solid var(--border-glass);
  padding-bottom: env(safe-area-inset-bottom);
}
```

## 四、排版系统

### 字体
```css
/* 西文 — Inter（Revolut/Wise 风格） */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
/* 数字 — SF Mono / Tabular Nums（等宽对齐） */
--font-mono: 'SF Mono', 'Roboto Mono', 'Menlo', monospace;
--font-nums: var(--font-primary);
--nums-style: font-variant-numeric: tabular-nums;
```

### 字号梯度
```css
--text-xs: 11px;    /* 辅助标签 */
--text-sm: 13px;    /* 次要信息 */
--text-base: 15px;  /* 正文（移动端基准） */
--text-lg: 17px;    /* 小标题 */
--text-xl: 20px;    /* 区块标题 */
--text-2xl: 24px;   /* 页面标题 */
--text-3xl: 32px;   /* 大数字展示 */
--text-4xl: 40px;   /* 核心资产数字 */

/* 行高 */
--leading-tight: 1.2;
--leading-normal: 1.5;
--leading-relaxed: 1.75;

/* 字重 */
--font-regular: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 数字展示规范
```css
.amount-display {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  font-weight: var(--font-semibold);
}

.amount-large {
  font-size: var(--text-4xl);
  line-height: var(--leading-tight);
  letter-spacing: -0.03em;
}

.amount-currency {
  font-size: var(--text-lg);
  font-weight: var(--font-regular);
  color: var(--text-secondary);
  margin-right: 4px;
}
```

## 五、间距与圆角

```css
/* 间距系统 — 4px 基数 */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;

/* 页面边距 */
--page-padding: 20px;

/* 圆角系统 */
--radius-sm: 8px;      /* 小元素：标签、徽章 */
--radius-md: 12px;     /* 中元素：输入框、按钮 */
--radius-lg: 16px;     /* 大元素：卡片 */
--radius-xl: 20px;     /* 特大：底部面板 */
--radius-2xl: 24px;    /* 超大：弹窗 */
--radius-full: 9999px; /* 圆形：头像、FAB */
```

## 六、按钮系统

### 6.1 主按钮（品牌渐变）
```css
.btn-primary {
  background: var(--accent-gradient);
  color: #FFFFFF;
  font-weight: var(--font-semibold);
  font-size: var(--text-base);
  padding: 14px 24px;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 48px; /* 触摸安全区 */
}

.btn-primary:hover {
  box-shadow: 0 4px 16px rgba(91, 95, 239, 0.35);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: none;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
```

### 6.2 次按钮（毛玻璃边框）
```css
.btn-secondary {
  background: var(--bg-surface);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--accent-primary);
  font-weight: var(--font-medium);
  font-size: var(--text-base);
  padding: 14px 24px;
  border-radius: var(--radius-md);
  border: 1.5px solid rgba(91, 95, 239, 0.25);
  cursor: pointer;
  min-height: 48px;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  border-color: var(--accent-primary);
  background: var(--accent-light);
}
```

### 6.3 买入/卖出按钮
```css
.btn-buy {
  background: var(--color-profit);
  color: #FFFFFF;
  font-weight: var(--font-semibold);
  border-radius: var(--radius-md);
  min-height: 48px;
}

.btn-sell {
  background: var(--color-loss);
  color: #FFFFFF;
  font-weight: var(--font-semibold);
  border-radius: var(--radius-md);
  min-height: 48px;
}
```

### 6.4 幽灵按钮
```css
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: none;
  font-weight: var(--font-medium);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
}

.btn-ghost:hover {
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-primary);
}
```

### 6.5 图标按钮
```css
.btn-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-surface);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.9);
}
```

## 七、金融核心组件

### 7.1 资产总览卡（首页 C 位）
```tsx
// 渐变品牌底 + 内嵌毛玻璃子卡
<div className="glass-card-accent" style={{ padding: '24px 20px' }}>
  {/* 问候语 */}
  <p style={{ opacity: 0.8, fontSize: 13 }}>Good Morning, Alex</p>

  {/* 总资产 */}
  <p className="amount-large amount-display" style={{ color: '#fff', marginTop: 4 }}>
    <span className="amount-currency" style={{ color: 'rgba(255,255,255,0.7)' }}>¥</span>
    128,456.78
  </p>

  {/* 收益子卡 */}
  <div className="glass-inner" style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
    <div>
      <p style={{ fontSize: 11, opacity: 0.7 }}>今日收益</p>
      <p style={{ fontSize: 17, fontWeight: 600 }}>+1,234.56</p>
    </div>
    <div>
      <p style={{ fontSize: 11, opacity: 0.7 }}>收益率</p>
      <p style={{ fontSize: 17, fontWeight: 600 }}>+0.97%</p>
    </div>
  </div>
</div>
```

### 7.2 产品/理财产品卡
```css
.product-card {
  background: var(--bg-surface);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  transition: all 0.25s ease;
}

.product-card:active {
  transform: scale(0.98);
  background: rgba(255, 255, 255, 0.85);
}

.product-card .icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--accent-light);
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-card .rate {
  color: var(--color-profit);
  font-weight: var(--font-bold);
  font-size: var(--text-xl);
  font-variant-numeric: tabular-nums;
}
```

### 7.3 交易记录行
```css
.transaction-row {
  display: flex;
  align-items: center;
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--border-subtle);
}

.transaction-row:last-child {
  border-bottom: none;
}

.transaction-row .icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--accent-light);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.transaction-row .amount-positive {
  color: var(--color-profit);
  font-weight: var(--font-semibold);
  font-variant-numeric: tabular-nums;
}

.transaction-row .amount-negative {
  color: var(--color-loss);
  font-weight: var(--font-semibold);
  font-variant-numeric: tabular-nums;
}
```

### 7.4 快捷操作网格
```css
.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}

.quick-action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
}

.quick-action-item .icon-circle {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-glass);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.quick-action-item:active .icon-circle {
  transform: scale(0.92);
  background: var(--accent-light);
}

.quick-action-item .label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
```

### 7.5 输入框（毛玻璃）
```css
.glass-input {
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(8px);
  border: 1.5px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  font-size: var(--text-base);
  color: var(--text-primary);
  transition: all 0.2s ease;
  min-height: 48px;
  width: 100%;
}

.glass-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  background: rgba(255, 255, 255, 0.75);
  box-shadow: 0 0 0 3px rgba(91, 95, 239, 0.1);
}

.glass-input::placeholder {
  color: var(--text-tertiary);
}
```

### 7.6 状态徽章
```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.badge-profit {
  background: var(--color-profit-bg);
  color: var(--color-profit);
}

.badge-loss {
  background: var(--color-loss-bg);
  color: var(--color-loss);
}

.badge-pending {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.badge-info {
  background: var(--color-info-bg);
  color: var(--color-info);
}
```

### 7.7 切换开关组（Tab / Segment）
```css
.segment-control {
  background: rgba(0, 0, 0, 0.04);
  border-radius: var(--radius-md);
  padding: 3px;
  display: inline-flex;
}

.segment-control .segment-item {
  padding: 8px 16px;
  border-radius: calc(var(--radius-md) - 2px);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  transition: all 0.25s ease;
  cursor: pointer;
}

.segment-control .segment-item.active {
  background: #FFFFFF;
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}
```

## 八、页面布局模式

### 8.1 首页（Dashboard）
```
┌─────────────────────────┐
│  毛玻璃导航栏            │
│  Logo          👤 头像   │
├─────────────────────────┤
│  资产总览卡              │
│  ┌─────────────────────┐│
│  │ Good Morning, Alex  ││
│  │ ¥ 128,456.78       ││
│  │ ┌───────┬────────┐  ││
│  │ │今日收益 │ 收益率  │  ││
│  │ └───────┴────────┘  ││
│  └─────────────────────┘│
│                         │
│  快捷操作                │
│  [转入] [转出] [认购] [更多]│
│                         │
│  热门产品                │
│  ┌─────────────────────┐│
│  │ 🏦 零钱保  3.85%   ││
│  ├─────────────────────┤│
│  │ 📈 稳健组  5.20%   ││
│  └─────────────────────┘│
│                         │
│  最近交易                │
│  ┌─────────────────────┐│
│  │ 药品A买入  +2,000  ││
│  │ 药品B卖出  -1,500  ││
│  └─────────────────────┘│
├─────────────────────────┤
│  🏠  📊  💰  👤         │
│  毛玻璃底部TabBar        │
└─────────────────────────┘
```

### 8.2 产品详情页
```
┌─────────────────────────┐
│  ← 返回    药品详情  ⋮   │
├─────────────────────────┤
│  ┌─────────────────────┐│
│  │ 药品名称             ││
│  │ ¥ 45.60  +2.34%    ││
│  │ 迷你走势图           ││
│  └─────────────────────┘│
│                         │
│  [日] [周] [月] [年]     │
│                         │
│  ┌─────────────────────┐│
│  │  产品信息            ││
│  │  募集规模  500万     ││
│  │  年化收益  3.85%    ││
│  │  产品期限  90天     ││
│  └─────────────────────┘│
├─────────────────────────┤
│  [立即认购]              │
│  品牌渐变固定底栏按钮     │
└─────────────────────────┘
```

### 8.3 认购底部抽屉
```tsx
// 底部滑出，三段式结构
<div className="glass-panel">
  {/* 拖拽条 */}
  <div className="handle" />

  {/* 1. 产品信息行 */}
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px' }}>
    <span style={{ fontWeight: 600 }}>药品A</span>
    <span className="amount-display">¥45.60/份</span>
  </div>

  {/* 2. 数量输入 */}
  <div style={{ padding: '16px 20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button className="btn-icon">−</button>
      <input className="glass-input" style={{ textAlign: 'center', flex: 1 }} />
      <button className="btn-icon">+</button>
    </div>
    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>
      合计: <span className="amount-display">¥4,560.00</span>
    </p>
  </div>

  {/* 3. 支付方式选择 */}
  <div style={{ display: 'flex', gap: 8, padding: '0 20px' }}>
    {['余额', '微信', '银行卡'].map(method => (
      <div className="glass-card" style={{ flex: 1, textAlign: 'center', padding: 12, cursor: 'pointer' }}>
        {method}
      </div>
    ))}
  </div>

  {/* 4. 确认按钮 */}
  <div style={{ padding: '20px' }}>
    <button className="btn-primary" style={{ width: '100%' }}>确认认购</button>
  </div>
</div>
```

## 九、动画与微交互

### 9.1 页面过渡
```tsx
import { motion, AnimatePresence } from 'framer-motion';

// 页面进入
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -8 }}
  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
>
  {children}
</motion.div>

// 底部抽屉滑入
<motion.div
  initial={{ y: '100%' }}
  animate={{ y: 0 }}
  exit={{ y: '100%' }}
  transition={{ type: 'spring', damping: 30, stiffness: 350 }}
>
  <BottomSheet />
</motion.div>
```

### 9.2 数值变化闪烁
```css
@keyframes flashProfit {
  0%   { background: var(--color-profit-bg); }
  100% { background: transparent; }
}

@keyframes flashLoss {
  0%   { background: var(--color-loss-bg); }
  100% { background: transparent; }
}

.flash-profit { animation: flashProfit 0.8s ease-out; }
.flash-loss   { animation: flashLoss 0.8s ease-out; }
```

### 9.3 按钮涟漪效果
```css
.btn-primary {
  position: relative;
  overflow: hidden;
}

.btn-primary::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at var(--ripple-x, 50%) var(--ripple-y, 50%),
    rgba(255, 255, 255, 0.3) 0%, transparent 60%);
  opacity: 0;
  transition: opacity 0.4s ease;
}

.btn-primary:active::after {
  opacity: 1;
}
```

### 9.4 骨架屏
```css
.skeleton {
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.04) 25%,
    rgba(0, 0, 0, 0.08) 50%,
    rgba(0, 0, 0, 0.04) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

@keyframes skeleton-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 9.5 下拉刷新指示器
```css
.pull-indicator {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-surface);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-glass);
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
}
```

## 十、图标系统

### 图标规范
```css
/* 推荐图标库: Phosphor Icons（Revolut风格） / Lucide */
--icon-xs: 16px;
--icon-sm: 20px;
--icon-md: 24px;  /* 标准尺寸 */
--icon-lg: 32px;

/* 图标颜色规范 */
--icon-default: var(--text-secondary);
--icon-accent: var(--accent-primary);
--icon-profit: var(--color-profit);
--icon-loss: var(--color-loss);
```

### 金融场景图标映射
| 场景 | 图标 | 说明 |
|------|------|------|
| 总资产 | Wallet | 钱包容器 |
| 收益 | TrendUp | 上升趋势线 |
| 认购 | ShoppingCart | 购物车 |
| 转入 | ArrowDownLeft | 入账箭头 |
| 转出 | ArrowUpRight | 出账箭头 |
| 产品 | Package | 产品包 |
| 通知 | Bell | 铃铛 |
| 设置 | Gear | 齿轮 |
| 安全 | ShieldCheck | 盾牌+勾 |

## 十一、响应式与安全区

### 安全区域
```css
/* iOS 刘海屏适配 */
--safe-top: env(safe-area-inset-top);
--safe-bottom: env(safe-area-inset-bottom);
--safe-left: env(safe-area-inset-left);
--safe-right: env(safe-area-inset-right);

/* 固定底栏必须加 */
.fixed-bottom {
  padding-bottom: calc(var(--space-4) + var(--safe-bottom));
}

/* 固定顶栏必须加 */
.fixed-top {
  padding-top: calc(var(--space-2) + var(--safe-top));
}
```

### 触摸目标
```css
/* 最小触摸目标 44×44px（Apple HIG） */
.touchable {
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 列表行最小高度 */
.list-row {
  min-height: 56px;
}

/* 按钮最小高度 */
.button {
  min-height: 48px;
}
```

### 横屏适配
```css
@media (orientation: landscape) and (max-height: 500px) {
  .glass-card-accent {
    padding: 12px 20px;
  }
  .amount-large {
    font-size: var(--text-3xl);
  }
}
```

## 十二、性能优化要点

### 毛玻璃性能
```css
/*
  ⚠️ backdrop-filter 是 GPU 密集操作，必须遵循：
  1. 限制同时渲染的毛玻璃元素数量（≤4个）
  2. 为毛玻璃元素开启 GPU 加速：will-change: transform
  3. 避免对毛玻璃元素做复杂动画
  4. 低端设备降级方案：
*/

/* 降级：不支持 backdrop-filter 时回退 */
@supports not (backdrop-filter: blur(20px)) {
  .glass-card {
    background: rgba(255, 255, 255, 0.95);
    box-shadow: var(--shadow-md);
  }
}

/* GPU 加速 */
.glass-card,
.glass-navbar,
.glass-tabbar {
  will-change: transform;
  -webkit-transform: translateZ(0);
}
```

### 动画性能
```css
/* 仅动画 transform 和 opacity，避免 layout thrashing */
.animate-enter {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

/* 减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## 十三、暗色主题切换

### 切换策略
```tsx
// 通过 CSS 变量 + data-theme 属性实现主题切换
// 切换时只需修改根元素属性，所有组件自动适配

function toggleTheme() {
  const root = document.documentElement;
  const isDark = root.getAttribute('data-theme') === 'dark';
  root.setAttribute('data-theme', isDark ? 'light' : 'dark');
}
```

### 暗色模式覆盖变量
```css
[data-theme="dark"] {
  --bg-base: #0F1117;
  --bg-surface: rgba(30, 33, 48, 0.72);
  --bg-elevated: rgba(40, 44, 62, 0.88);
  --bg-glass-gradient: linear-gradient(
    135deg,
    rgba(30, 33, 48, 0.6) 0%,
    rgba(30, 33, 48, 0.3) 50%,
    rgba(40, 44, 80, 0.4) 100%
  );
  --text-primary: #F1F2F6;
  --text-secondary: #9BA1B0;
  --text-tertiary: #6B7280;
  --border-glass: rgba(255, 255, 255, 0.08);
  --border-subtle: rgba(255, 255, 255, 0.05);
  --border-medium: rgba(255, 255, 255, 0.10);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.4);
  --shadow-glass: 0 8px 32px rgba(0, 0, 0, 0.3);
  --accent-light: rgba(91, 95, 239, 0.15);
}
```

## 十四、国际化排版规范

```css
/* RTL 支持 */
[dir="rtl"] .transaction-row {
  flex-direction: row-reverse;
}

/* 多语言预留空间 */
.label-i18n {
  min-width: 80px;      /* 中文2字约56px，预留英文扩展 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 货币符号位置 */
.currency-prefix { margin-right: 2px; }  /* ¥ $ € */
.currency-suffix { margin-left: 4px; }   /* 元 円 ₩ */

/* 数字千分位：使用 Intl.NumberFormat */
// new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(128456.78)
// → "¥128,456.78"
```

## 十五、参考设计系统

| 需求 | 参考来源 | 风格关键词 |
|------|---------|-----------|
| 整体风格 | Revolut App | 渐变+毛玻璃+极简 |
| 卡片交互 | Wise App | 干净白卡+微动效 |
| 品牌色运用 | Apple Finance | 靛蓝紫+大数字 |
| 底部面板 | iOS Control Center | 毛玻璃+圆角+层次 |
| 数据展示 | Robinhood App | 大字体+涨跌色+卡片流 |
| 图标系统 | Phosphor Icons | 轻量+一致+可变粗细 |
| 动效参考 | Cash App | 流畅过渡+数字跳动 |
| 色彩系统 | Stripe Dashboard | 冷灰基底+语义色点缀 |

## 十六、UniApp 适配注意事项

### CSS 变量作用域
```css
/* UniApp 中 CSS 变量需在 page 或 view 上定义 */
page {
  --bg-base: #F2F4F8;
  /* ... 所有变量 ... */
}
```

### backdrop-filter 兼容
```css
/* UniApp H5 端正常使用 */
/* UniApp 小程序端不支持 backdrop-filter，需降级 */
/* #ifdef H5 */
.glass-card {
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}
/* #endif */

/* #ifdef MP */
.glass-card {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: var(--shadow-md);
}
/* #endif */
```

### rpx 适配
```css
/* 设计稿 750rpx 宽度下的间距换算 */
/* 1px ≈ 2rpx（375px 设计稿） */
--page-padding: 40rpx;   /* 20px */
--radius-lg: 32rpx;      /* 16px */
--radius-md: 24rpx;      /* 12px */
```

## 十七、完整 CSS 变量汇总

将以下变量复制到项目根样式文件中即可启用整个设计系统：

```css
:root {
  /* 背景 */
  --bg-base: #F2F4F8;
  --bg-surface: rgba(255, 255, 255, 0.72);
  --bg-elevated: rgba(255, 255, 255, 0.88);
  --bg-glass-gradient: linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.3) 50%, rgba(240,244,255,0.4) 100%);

  /* 文字 */
  --text-primary: #1A1D26;
  --text-secondary: #6B7280;
  --text-tertiary: #9CA3AF;
  --text-on-accent: #FFFFFF;

  /* 品牌 */
  --accent-primary: #5B5FEF;
  --accent-secondary: #7C3AED;
  --accent-gradient: linear-gradient(135deg, #5B5FEF 0%, #7C3AED 100%);
  --accent-light: rgba(91, 95, 239, 0.08);

  /* 语义 */
  --color-profit: #10B981;
  --color-loss: #EF4444;
  --color-warning: #F59E0B;
  --color-info: #3B82F6;
  --color-success: #10B981;
  --color-profit-bg: rgba(16, 185, 129, 0.10);
  --color-loss-bg: rgba(239, 68, 68, 0.10);
  --color-warning-bg: rgba(245, 158, 11, 0.10);
  --color-info-bg: rgba(59, 130, 246, 0.10);

  /* 边框 */
  --border-glass: rgba(255, 255, 255, 0.5);
  --border-subtle: rgba(0, 0, 0, 0.06);
  --border-medium: rgba(0, 0, 0, 0.10);
  --border-focus: var(--accent-primary);

  /* 阴影 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.08);
  --shadow-glass: 0 8px 32px rgba(31, 38, 135, 0.08);

  /* 间距 */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --page-padding: 20px;

  /* 圆角 */
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px;
  --radius-xl: 20px; --radius-2xl: 24px; --radius-full: 9999px;

  /* 字体 */
  --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'SF Mono', 'Roboto Mono', 'Menlo', monospace;

  /* 字号 */
  --text-xs: 11px; --text-sm: 13px; --text-base: 15px; --text-lg: 17px;
  --text-xl: 20px; --text-2xl: 24px; --text-3xl: 32px; --text-4xl: 40px;

  /* 字重 */
  --font-regular: 400; --font-medium: 500; --font-semibold: 600; --font-bold: 700;

  /* 行高 */
  --leading-tight: 1.2; --leading-normal: 1.5; --leading-relaxed: 1.75;

  /* 图标 */
  --icon-xs: 16px; --icon-sm: 20px; --icon-md: 24px; --icon-lg: 32px;
}
```
