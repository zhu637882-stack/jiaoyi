import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ProLayout } from '@ant-design/pro-components'
import {
  FundOutlined,
  WalletOutlined,
  FileTextOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuOutlined,
} from '@ant-design/icons'
import { Avatar, Dropdown, Space, Typography, message, Button, Drawer } from 'antd'
import { accountApi } from '../services/api'

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
  const [collapsed, setCollapsed] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)

  // 根据用户角色获取菜单项
  const menuItems = getMenuItems(userInfo?.role)

  // 响应式检测
  const checkMobile = useCallback(() => {
    const mobile = window.innerWidth < 768
    setIsMobile(mobile)
    if (mobile && !collapsed) {
      setCollapsed(true)
    }
  }, [collapsed])

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
    if (isMobile) {
      setDrawerVisible(false)
    }
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

  // 移动端菜单抽屉
  const mobileMenuDrawer = isMobile && (
    <Drawer
      placement="left"
      closable={false}
      onClose={() => setDrawerVisible(false)}
      open={drawerVisible}
      width={240}
      styles={{
        body: { padding: 0, background: '#0D1117' },
        header: { display: 'none' },
      }}
    >
      <div style={{ padding: '16px 0' }}>
        {menuItems.map((item) => (
          <div
            key={item.path}
            onClick={() => handleMenuClick(item.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 24px',
              color: location.pathname === item.path ? '#E6EDF3' : '#8B949E',
              background: location.pathname === item.path ? '#21262D' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {item.icon}
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </Drawer>
  )

  return (
    <ProLayout
      title="药赚赚・交易终端"
      logo="/vite.svg"
      layout="mix"
      fixSiderbar
      fixedHeader
      collapsed={collapsed}
      onCollapse={setCollapsed}
      breakpoint="md"
      location={{
        pathname: location.pathname,
      }}
      route={{
        path: '/',
        routes: menuItems.map(item => ({
          path: item.path,
          name: item.name,
          icon: item.icon,
        })),
      }}
      menuItemRender={(item, dom) => (
        <div onClick={() => handleMenuClick(item.path || '/')}>{dom}</div>
      )}
      headerContentRender={() => (
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 12 }}>
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined style={{ color: '#8B949E' }} />}
              onClick={() => setDrawerVisible(true)}
            />
          )}
          <Text style={{ color: '#8B949E', fontSize: 14 }}>
            专业药品流通垫资交易服务
          </Text>
        </div>
      )}
      rightContentRender={() => (
        <Space size={isMobile ? 12 : 16}>
          {/* 余额显示 - 移动端隐藏 */}
          {balanceInfo && !isMobile && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '4px 12px',
                background: '#161B22',
                border: '1px solid #30363D',
                borderRadius: 6,
                height: 32,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: '#8B949E', fontSize: 12 }}>可用</Text>
                <Text
                  style={{
                    color: '#00D4AA',
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
                background: '#30363D',
              }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: '#8B949E', fontSize: 12 }}>收益</Text>
                <Text
                  style={{
                    color: balanceInfo.totalProfit >= 0 ? '#00D4AA' : '#FF4D4F',
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
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: '#1890FF' }}>
                {userInfo?.username?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
              {!isMobile && (
                <div style={{ lineHeight: 1.2 }}>
                  <Text style={{ color: '#E6EDF3', display: 'block', fontSize: 14 }}>
                    {userInfo?.realName || userInfo?.username || '用户'}
                  </Text>
                  <Text style={{ color: '#8B949E', fontSize: 12 }}>
                    {userInfo?.role === 'admin' ? '管理员' : '投资者'}
                  </Text>
                </div>
              )}
            </Space>
          </Dropdown>
        </Space>
      )}
      token={{
        header: {
          colorBgHeader: '#161B22',
          colorHeaderTitle: '#E6EDF3',
          colorTextMenu: '#8B949E',
          colorTextMenuSecondary: '#8B949E',
          colorTextMenuSelected: '#E6EDF3',
          colorTextMenuActive: '#E6EDF3',
          colorBgMenuItemSelected: '#21262D',
          colorBgMenuItemHover: '#21262D',
        },
        sider: {
          colorMenuBackground: '#0D1117',
          colorMenuItemDivider: '#30363D',
          colorTextMenu: '#8B949E',
          colorTextMenuSelected: '#E6EDF3',
          colorTextMenuActive: '#E6EDF3',
          colorBgMenuItemSelected: '#21262D',
          colorBgMenuItemHover: '#21262D',
          colorBgCollapsedButton: '#161B22',
          colorTextCollapsedButton: '#8B949E',
        },
        pageContainer: {
          colorBgPageContainer: '#0D1117',
          colorBgPageContainerFixed: '#0D1117',
        },
      }}
    >
      {mobileMenuDrawer}
      <div style={{ padding: isMobile ? 8 : 12, minHeight: '100%' }}>
        <Outlet />
      </div>
    </ProLayout>
  )
}

export default BasicLayout
