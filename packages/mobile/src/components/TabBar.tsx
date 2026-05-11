import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './TabBar.css'

/* ============================================
   图标组件 - 币安风格简洁SVG，选中色 #F0B90B
   ============================================ */

const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V9.5z"
      stroke={active ? '#F0B90B' : '#848E9C'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
)

/* 交易 - 购物车 */
const TradeIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M9 2L4.5 6.5H2v2h1.5l1.2 9.6a2 2 0 002 1.9h10.6a2 2 0 002-1.9l1.2-9.6H22v-2h-2.5L15 2h-2l3 4.5H8L11 2H9z"
      fill="none"
      stroke={active ? '#F0B90B' : '#848E9C'}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <circle cx="9" cy="18" r="1.5" fill={active ? '#F0B90B' : '#848E9C'} />
    <circle cx="17" cy="18" r="1.5" fill={active ? '#F0B90B' : '#848E9C'} />
  </svg>
)

/* 持仓 - 网格/仓库 */
const PortfolioIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="7" height="7" rx="1.5"
      stroke={active ? '#F0B90B' : '#848E9C'}
      strokeWidth="1.5"
      fill="none"
    />
    <rect x="14" y="3" width="7" height="7" rx="1.5"
      stroke={active ? '#F0B90B' : '#848E9C'}
      strokeWidth="1.5"
      fill="none"
    />
    <rect x="3" y="14" width="7" height="7" rx="1.5"
      stroke={active ? '#F0B90B' : '#848E9C'}
      strokeWidth="1.5"
      fill="none"
    />
    <rect x="14" y="14" width="7" height="7" rx="1.5"
      stroke={active ? '#F0B90B' : '#848E9C'}
      strokeWidth="1.5"
      fill="none"
    />
  </svg>
)

/* 资金 - 钱包 */
const FundsIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="6" width="20" height="14" rx="2"
      stroke={active ? '#F0B90B' : '#848E9C'}
      strokeWidth="1.5"
      fill="none"
    />
    <path d="M2 10h20"
      stroke={active ? '#F0B90B' : '#848E9C'}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="17" cy="15" r="1.5"
      fill={active ? '#F0B90B' : '#848E9C'}
    />
  </svg>
)

/* 我的 - 人像 */
const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle
      cx="12" cy="8" r="4"
      stroke={active ? '#F0B90B' : '#848E9C'}
      strokeWidth="1.5"
      fill="none"
    />
    <path
      d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
      stroke={active ? '#F0B90B' : '#848E9C'}
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
)

/* ============================================
   TabBar 配置 - 5等分标准布局
   ============================================ */

interface TabItem {
  key: string
  label: string
  Icon: React.FC<{ active: boolean }>
}

const tabs: TabItem[] = [
  { key: '/m', label: '首页', Icon: HomeIcon },
  { key: '/m/trade', label: '交易', Icon: TradeIcon },
  { key: '/m/portfolio', label: '持仓', Icon: PortfolioIcon },
  { key: '/m/transactions', label: '资金', Icon: FundsIcon },
  { key: '/m/profile', label: '我的', Icon: ProfileIcon },
]

/* ============================================
   TabBar 组件
   ============================================ */

const TabBar: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const activeKey = React.useMemo(() => {
    const exactMatch = tabs.find(tab => location.pathname === tab.key)
    if (exactMatch) return exactMatch.key

    const prefixMatch = tabs.find(tab =>
      tab.key !== '/m' && location.pathname.startsWith(tab.key)
    )
    if (prefixMatch) return prefixMatch.key

    if (location.pathname.startsWith('/m/trade/')) {
      return '/m/trade'
    }

    return '/m'
  }, [location.pathname])

  const handleClick = React.useCallback((key: string) => {
    if (key !== activeKey) {
      navigate(key)
    }
  }, [activeKey, navigate])

  return (
    <div className="tabbar">
      {tabs.map(tab => {
        const isActive = activeKey === tab.key
        return (
          <div
            key={tab.key}
            className={`tabbar-item ${isActive ? 'active' : ''}`}
            onClick={() => handleClick(tab.key)}
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
          >
            <div className="tabbar-icon-wrap">
              <tab.Icon active={isActive} />
            </div>
            <span className="tabbar-label">{tab.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default TabBar
