import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './TabBar.css'

// 专业SVG图标组件 - 币安/富途风格
const MarketIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M3 14l4-4 3 3 5-5 6 6" stroke={active ? '#F0B90B' : '#848E9C'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M17 10h3v6" stroke={active ? '#F0B90B' : '#848E9C'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {active && <circle cx="7" cy="10" r="1.5" fill="#F0B90B" opacity="0.6"/>}
    {active && <circle cx="10" cy="13" r="1.5" fill="#F0B90B" opacity="0.6"/>}
  </svg>
)

const TradeIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="3" stroke={active ? '#F0B90B' : '#848E9C'} strokeWidth="1.8" fill="none"/>
    <path d="M8 15l3-3 2 2 3-3" stroke={active ? '#F0B90B' : '#848E9C'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M14 8h3v3" stroke={active ? '#F0B90B' : '#848E9C'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {active && <path d="M8 15l3-3 2 2 3-3" stroke="#F0B90B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" fill="none"/>}
  </svg>
)

const PortfolioIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="13" width="4" height="8" rx="1" fill={active ? '#F0B90B' : '#848E9C'} opacity={active ? 1 : 0.5}/>
    <rect x="10" y="8" width="4" height="13" rx="1" fill={active ? '#F0B90B' : '#848E9C'} opacity={active ? 0.8 : 0.4}/>
    <rect x="17" y="3" width="4" height="18" rx="1" fill={active ? '#F0B90B' : '#848E9C'} opacity={active ? 0.6 : 0.3}/>
  </svg>
)

const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke={active ? '#F0B90B' : '#848E9C'} strokeWidth="1.8" fill={active ? 'rgba(240,185,11,0.15)' : 'none'}/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={active ? '#F0B90B' : '#848E9C'} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
  </svg>
)

const tabs = [
  { key: '/m', label: '行情', Icon: MarketIcon },
  { key: '/m/trade', label: '交易', Icon: TradeIcon },
  { key: '/m/portfolio', label: '持仓', Icon: PortfolioIcon },
  { key: '/m/profile', label: '我的', Icon: ProfileIcon },
]

const TabBar: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const activeKey = tabs.find(tab => location.pathname === tab.key || (tab.key !== '/m' && location.pathname.startsWith(tab.key)))?.key || '/m'

  return (
    <div className="mobile-tabbar">
      {tabs.map(tab => {
        const isActive = activeKey === tab.key
        return (
          <div
            key={tab.key}
            className={`mobile-tabbar-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(tab.key)}
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
