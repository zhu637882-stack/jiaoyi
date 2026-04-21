import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './TabBar.css'

// ============================================
// 专业SVG图标组件 - 币安/富途风格
// ============================================

/**
 * 行情图标 - 折线图风格
 * 选中时显示发光效果和装饰点
 */
const MarketIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* 主折线 */}
    <path 
      d="M3 14l4-4 3 3 5-5 6 6" 
      stroke={active ? '#F0B90B' : '#848E9C'} 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      fill="none"
    />
    {/* 上升箭头 */}
    <path 
      d="M17 10h3v6" 
      stroke={active ? '#F0B90B' : '#848E9C'} 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      fill="none"
    />
    {/* 选中时的装饰点 */}
    {active && (
      <>
        <circle cx="7" cy="10" r="1.5" fill="#F0B90B" opacity="0.6"/>
        <circle cx="10" cy="13" r="1.5" fill="#F0B90B" opacity="0.6"/>
        <circle cx="15" cy="8" r="1.5" fill="#F0B90B" opacity="0.4"/>
      </>
    )}
  </svg>
)

/**
 * 交易图标 - K线图风格
 * 选中时显示填充效果和发光
 */
const TradeIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* 外框 */}
    <rect 
      x="3" 
      y="3" 
      width="18" 
      height="18" 
      rx="3" 
      stroke={active ? '#F0B90B' : '#848E9C'} 
      strokeWidth="1.8" 
      fill={active ? 'rgba(240, 185, 11, 0.08)' : 'none'}
    />
    {/* 上升趋势线 */}
    <path 
      d="M8 15l3-3 2 2 3-3" 
      stroke={active ? '#F0B90B' : '#848E9C'} 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      fill="none"
    />
    {/* 箭头 */}
    <path 
      d="M14 8h3v3" 
      stroke={active ? '#F0B90B' : '#848E9C'} 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      fill="none"
    />
    {/* 选中时的背景光效 */}
    {active && (
      <path 
        d="M8 15l3-3 2 2 3-3" 
        stroke="#F0B90B" 
        strokeWidth="3" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        opacity="0.2" 
        fill="none"
      />
    )}
  </svg>
)

/**
 * 持仓图标 - 柱状图风格
 * 选中时柱子渐变高度，更有层次感
 */
const PortfolioIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* 第一根柱子 */}
    <rect 
      x="3" 
      y="13" 
      width="4" 
      height="8" 
      rx="1" 
      fill={active ? '#F0B90B' : '#848E9C'} 
      opacity={active ? 1 : 0.5}
    />
    {/* 第二根柱子 */}
    <rect 
      x="10" 
      y="8" 
      width="4" 
      height="13" 
      rx="1" 
      fill={active ? '#F0B90B' : '#848E9C'} 
      opacity={active ? 0.8 : 0.4}
    />
    {/* 第三根柱子 */}
    <rect 
      x="17" 
      y="3" 
      width="4" 
      height="18" 
      rx="1" 
      fill={active ? '#F0B90B' : '#848E9C'} 
      opacity={active ? 0.6 : 0.3}
    />
    {/* 选中时的顶部高光 */}
    {active && (
      <>
        <rect x="3" y="13" width="4" height="2" rx="1" fill="#FCD535" opacity="0.8"/>
        <rect x="10" y="8" width="4" height="2" rx="1" fill="#FCD535" opacity="0.8"/>
        <rect x="17" y="3" width="4" height="2" rx="1" fill="#FCD535" opacity="0.8"/>
      </>
    )}
  </svg>
)

/**
 * 我的图标 - 用户头像风格
 * 选中时显示填充发光效果
 */
const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* 头部圆形 */}
    <circle 
      cx="12" 
      cy="8" 
      r="4" 
      stroke={active ? '#F0B90B' : '#848E9C'} 
      strokeWidth="1.8" 
      fill={active ? 'rgba(240, 185, 11, 0.15)' : 'none'}
    />
    {/* 身体轮廓 */}
    <path 
      d="M4 20c0-4 3.6-7 8-7s8 3 8 7" 
      stroke={active ? '#F0B90B' : '#848E9C'} 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      fill="none"
    />
    {/* 选中时的装饰 */}
    {active && (
      <>
        <circle cx="12" cy="8" r="2" fill="#F0B90B" opacity="0.3"/>
      </>
    )}
  </svg>
)

// ============================================
// TabBar 配置
// ============================================

interface TabItem {
  key: string
  label: string
  Icon: React.FC<{ active: boolean }>
}

const tabs: TabItem[] = [
  { key: '/m', label: '行情', Icon: MarketIcon },
  { key: '/m/trade', label: '交易', Icon: TradeIcon },
  { key: '/m/portfolio', label: '持仓', Icon: PortfolioIcon },
  { key: '/m/profile', label: '我的', Icon: ProfileIcon },
]

// ============================================
// TabBar 组件
// ============================================

const TabBar: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  // 计算当前激活的tab
  const activeKey = React.useMemo(() => {
    // 精确匹配优先
    const exactMatch = tabs.find(tab => location.pathname === tab.key)
    if (exactMatch) return exactMatch.key
    
    // 否则匹配路径前缀（排除根路径）
    const prefixMatch = tabs.find(tab => 
      tab.key !== '/m' && location.pathname.startsWith(tab.key)
    )
    if (prefixMatch) return prefixMatch.key
    
    // 交易详情页面特殊处理 - 匹配 /m/trade/:drugId
    if (location.pathname.startsWith('/m/trade/')) {
      return '/m/trade'
    }
    
    return '/m'
  }, [location.pathname])

  // 处理点击
  const handleClick = React.useCallback((key: string) => {
    if (key !== activeKey) {
      navigate(key)
    }
  }, [activeKey, navigate])

  return (
    <div className="mobile-tabbar">
      {tabs.map(tab => {
        const isActive = activeKey === tab.key
        return (
          <div
            key={tab.key}
            className={`mobile-tabbar-item ${isActive ? 'active' : ''}`}
            onClick={() => handleClick(tab.key)}
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
          >
            <div className="mobile-tabbar-icon-wrap">
              <tab.Icon active={isActive} />
              {isActive && <div className="mobile-tabbar-dot" />}
            </div>
            <span className="mobile-tabbar-label">{tab.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default TabBar
