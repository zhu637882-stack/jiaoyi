import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  FundOutlined,
  WalletOutlined,
  FileTextOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Dropdown, Space, Typography, message } from 'antd'
import { accountApi } from '../services/api'
import logoPng from '../assets/logo.png'

const { Text } = Typography

interface UserInfo {
  username: string
  role: string
  realName?: string
}

interface BalanceInfo {
  availableBalance: number
  frozenBalance: number
  totalProfit: number
}

const getMenuItems = (role?: string) => {
  const items = [
    {
      path: '/',
      name: '交易终端',
      icon: <FundOutlined />,
    },
    {
      path: '/portfolio',
      name: '我的持仓',
      icon: <WalletOutlined />,
    },
    {
      path: '/settlement',
      name: '清算记录',
      icon: <FileTextOutlined />,
    },
  ]

  // 只有管理员才显示管理后台菜单
  if (role === 'admin') {
    items.push({
      path: '/admin',
      name: '管理后台',
      icon: <SettingOutlined />,
    })
  }

  return items
}

const BasicLayout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  // 根据用户角色获取菜单项
  const menuItems = getMenuItems(userInfo?.role)

  // 响应式检测
  const checkMobile = useCallback(() => {
    const mobile = window.innerWidth < 768
    setIsMobile(mobile)
  }, [])

  useEffect(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [checkMobile])

  useEffect(() => {
    // 从 localStorage 获取用户信息
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        setUserInfo(JSON.parse(userStr))
      } catch (e) {
        console.error('Failed to parse user info')
      }
    }

    // 获取账户余额
    fetchBalance()
  }, [])

  const fetchBalance = async () => {
    try {
      const response = await accountApi.getBalance()
      if (response) {
        setBalanceInfo({
          availableBalance: Number(response.availableBalance) || 0,
          frozenBalance: Number(response.frozenBalance) || 0,
          totalProfit: Number(response.totalProfit) || 0,
        })
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error)
    }
  }

  const handleMenuClick = (key: string) => {
    navigate(key)
  }

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    message.success('已退出登录')
    navigate('/login')
  }

  const avatarDropdownItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  // 格式化金额显示
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  // 移动端底部导航栏
  const mobileBottomNav = isMobile && (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        background: '#181A20',
        borderTop: '1px solid #2B3139',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 1000,
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      {menuItems.map((item) => {
        const isActive = location.pathname === item.path
        return (
          <div
            key={item.path}
            onClick={() => handleMenuClick(item.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              height: '100%',
              color: isActive ? '#F0B90B' : '#848E9C',
              cursor: 'pointer',
              transition: 'color 0.2s',
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1, marginBottom: 2 }}>{item.icon}</span>
            <span style={{ fontSize: 11, lineHeight: 1.2 }}>{item.name}</span>
          </div>
        )
      })}
    </nav>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0D1117' }}>
      {/* 币安风格顶部导航栏 */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: isMobile ? 56 : 64,
          background: '#181A20',
          borderBottom: '1px solid #2B3139',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0 12px' : '0 24px',
        }}
      >
        {/* 左侧：Logo + 菜单 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 32 }}>
          {/* Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/')}
          >
            <img
              src={logoPng}
              alt="零钱保"
              style={{ width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, borderRadius: 4 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <Text
                style={{
                  color: '#F0B90B',
                  fontSize: isMobile ? 16 : 18,
                  fontWeight: 700,
                  letterSpacing: '-0.5px',
                }}
              >
                零钱保
              </Text>
              {!isMobile && (
                <Text
                  style={{
                    color: '#848E9C',
                    fontSize: 11,
                    fontWeight: 400,
                  }}
                >
                  多客数智旗下
                </Text>
              )}
            </div>
          </div>

          {/* 桌面端导航菜单 */}
          {!isMobile && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <button
                    key={item.path}
                    onClick={() => handleMenuClick(item.path)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      background: isActive ? '#2B3139' : 'transparent',
                      border: 'none',
                      borderRadius: 4,
                      color: isActive ? '#EAECEF' : '#848E9C',
                      fontSize: 14,
                      fontWeight: isActive ? 500 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.color = '#EAECEF'
                        e.currentTarget.style.background = '#2B3139'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.color = '#848E9C'
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                  </button>
                )
              })}
            </nav>
          )}
        </div>

        {/* 右侧：账户信息 + 用户 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
          {/* 余额显示 - 移动端隐藏 */}
          {balanceInfo && !isMobile && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '6px 16px',
                background: '#0D1117',
                border: '1px solid #2B3139',
                borderRadius: 6,
                height: 36,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: '#848E9C', fontSize: 12 }}>可用</Text>
                <Text
                  style={{
                    color: '#cf1322',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "'JetBrains Mono', 'DIN', monospace",
                  }}
                >
                  {formatAmount(balanceInfo.availableBalance)}
                </Text>
              </div>
              <div
                style={{
                  width: 1,
                  height: 16,
                  background: '#2B3139',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: '#848E9C', fontSize: 12 }}>收益</Text>
                <Text
                  style={{
                    color: balanceInfo.totalProfit >= 0 ? '#cf1322' : '#00b96b',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "'JetBrains Mono', 'DIN', monospace",
                  }}
                >
                  {balanceInfo.totalProfit >= 0 ? '+' : ''}
                  {formatAmount(balanceInfo.totalProfit)}
                </Text>
              </div>
            </div>
          )}

          {/* 用户信息 */}
          <Dropdown
            menu={{ items: avatarDropdownItems }}
            placement="bottomRight"
          >
            <Space style={{ cursor: 'pointer' }} size={8}>
              <Avatar
                style={{
                  backgroundColor: '#F0B90B',
                  color: '#181A20',
                  fontWeight: 600,
                }}
                size="small"
                icon={<UserOutlined />}
              >
                {userInfo?.username?.charAt(0).toUpperCase()}
              </Avatar>
              {!isMobile && (
                <div style={{ lineHeight: 1.3 }}>
                  <Text
                    style={{
                      color: '#EAECEF',
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {userInfo?.realName || userInfo?.username || '用户'}
                  </Text>
                  <Text
                    style={{
                      color: '#848E9C',
                      fontSize: 11,
                    }}
                  >
                    {userInfo?.role === 'admin' ? '管理员' : '投资者'}
                  </Text>
                </div>
              )}
            </Space>
          </Dropdown>
        </div>
      </header>

      {/* 移动端底部导航栏 */}
      {mobileBottomNav}

      {/* 主内容区域 - 占满100%宽度 */}
      <main
        style={{
          paddingTop: isMobile ? 56 : 64,
          paddingBottom: isMobile ? 56 : 0,
          minHeight: '100vh',
          background: '#0D1117',
        }}
      >
        <Outlet />
      </main>
    </div>
  )
}

export default BasicLayout
