import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Popup, Toast, Modal } from 'antd-mobile'
import { authApi, accountApi, systemMessageApi, trialBonusApi } from '../services/api'
import { useCountUp, formatCountUpValue } from '../hooks/useCountUp'
import './Profile.css'

// CountUp数字展示组件
const CountUpValue = ({ target, prefix = '¥' }: { target: number; prefix?: string }) => {
  const safeTarget = Number.isFinite(target) ? target : 0
  const animatedValue = useCountUp(safeTarget)
  const displayValue = Number.isFinite(animatedValue) ? animatedValue : safeTarget
  return (
    <span>{prefix}{formatCountUpValue(displayValue)}</span>
  )
}

// 功能菜单项 - 币安风格
const MenuItem = ({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  onClick: () => void
}) => (
  <div className="profile-menu-item" onClick={onClick}>
    <div className="menu-item-icon">{icon}</div>
    <span className="menu-item-title">{title}</span>
    <svg className="menu-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
)

// 错误边界组件
class ProfileErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Profile Error Boundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 40,
          textAlign: 'center',
          color: '#fff',
          background: '#0B0E11',
          minHeight: '100vh'
        }}>
          <h2 style={{ color: '#EF4444', marginBottom: 16 }}>页面加载出错</h2>
          <p style={{ color: '#848E9C', marginBottom: 24 }}>
            {this.state.error ? this.state.error.message : '未知错误'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: '#F0B90B',
              border: 'none',
              borderRadius: 8,
              color: '#000',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            刷新页面
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const ProfileContent: React.FC = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [balance, setBalance] = useState<any>(null)
  const [trialBonus, setTrialBonus] = useState<any>(null)

  // 账户安全弹窗
  const [showSecurity, setShowSecurity] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changePwdLoading, setChangePwdLoading] = useState(false)

  // 消息通知弹窗
  const [showMessages, setShowMessages] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<any>(null)

  useEffect(() => {
    let isMounted = true
    const init = async () => {
      try {
        if (isMounted) await loadData()
      } catch (e) {
        console.error('Profile init error:', e)
      }
    }
    init()
    return () => { isMounted = false }
  }, [])

  const loadData = async () => {
    try {
      const [profileRes, balanceRes, trialRes] = await Promise.all([
        authApi.getProfile() as any,
        accountApi.getBalance() as any,
        trialBonusApi.getStatus().catch(() => null) as any,
      ])
      setUser(profileRes?.data || profileRes)
      setBalance(balanceRes?.data || balanceRes)
      setTrialBonus(trialRes?.data || trialRes)
    } catch (e) {
      console.error('Load profile error:', e)
    }
  }

  const handleLogout = () => {
    Modal.confirm({
      content: '确定要退出登录吗？',
      confirmText: '退出',
      cancelText: '取消',
      onConfirm: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user')
        navigate('/m/login')
        Toast.show({ content: '已退出登录', icon: 'success' })
      }
    })
  }

  const handleChangePassword = async () => {
    if (!oldPassword) { Toast.show({ content: '请输入旧密码', icon: 'fail' }); return }
    if (!newPassword) { Toast.show({ content: '请输入新密码', icon: 'fail' }); return }
    if (newPassword.length < 6) { Toast.show({ content: '新密码至少6位', icon: 'fail' }); return }
    if (newPassword !== confirmPassword) { Toast.show({ content: '两次密码不一致', icon: 'fail' }); return }
    if (oldPassword === newPassword) { Toast.show({ content: '新密码不能与旧密码相同', icon: 'fail' }); return }
    setChangePwdLoading(true)
    try {
      await authApi.changePassword({ oldPassword, newPassword })
      Toast.show({ content: '密码修改成功，请重新登录', icon: 'success' })
      setOldPassword(''); setNewPassword(''); setConfirmPassword('')
      setShowSecurity(false)
      setTimeout(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        navigate('/m/login')
      }, 1500)
    } catch (e: any) {
      const errMsg = e?.response?.data?.message || '密码修改失败，请检查旧密码是否正确'
      Toast.show({ content: Array.isArray(errMsg) ? errMsg.join('; ') : errMsg, icon: 'fail' })
    } finally {
      setChangePwdLoading(false)
    }
  }

  const loadMessages = async () => {
    setMessagesLoading(true)
    try {
      const res = await systemMessageApi.getPublished({ page: 1, pageSize: 50 }) as any
      const listData = res?.data?.list || res?.data?.items || res?.data || []
      setMessages(Array.isArray(listData) ? listData : [])
    } catch (e) {
      console.error('Load messages error:', e)
    } finally {
      setMessagesLoading(false)
    }
  }

  const openMessages = () => { setShowMessages(true); loadMessages() }

  const formatMsgTime = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}小时前`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 30) return `${diffDays}天前`
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  const getMsgTypeLabel = (type: string) => {
    switch (type) {
      case 'announcement': return '公告'
      case 'notification': return '通知'
      case 'maintenance': return '维护'
      default: return '通知'
    }
  }

  const getUserInitial = () => {
    const name = user?.realName || user?.username || 'U'
    return name.charAt(0).toUpperCase()
  }

  const getRoleLabel = () => {
    if (user?.role === 'admin') return '管理员'
    if (user?.role === 'partner') return '合伙人'
    return '资方'
  }

  const maskPhone = (phone: string) => {
    if (!phone) return '未绑定'
    if (phone.length >= 7) return `${phone.slice(0, 3)}****${phone.slice(-4)}`
    return phone
  }

  return (
    <div className="mobile-profile">
      {/* === 顶部渐变背景区域 === */}
      <div className="profile-header-gradient">
        <div className="profile-header-content">
          <div className="profile-header-bar">
            <span className="profile-header-title">我的</span>
            <button className="profile-settings-btn" onClick={() => setShowSecurity(true)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <div className="profile-user-section">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar-circle">
                {getUserInitial()}
              </div>
            </div>
            <div className="profile-user-detail">
              <div className="profile-name-row">
                <span className="profile-name">{user?.realName || user?.username || '未登录'}</span>
                <span className="profile-vip-badge">{getRoleLabel()}</span>
              </div>
              <span className="profile-phone">{maskPhone(user?.phone || '')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* === 资产概览卡片 === */}
      {balance && (
        <div className="profile-asset-card">
          <div className="asset-card-item">
            <span className="asset-card-label">总资产</span>
            <span className="asset-card-value">
              <CountUpValue target={Number(balance?.availableBalance || 0) + Number(balance?.frozenBalance || 0)} />
            </span>
          </div>
          <div className="asset-card-divider" />
          <div className="asset-card-item">
            <span className="asset-card-label">今日收益</span>
            <span className={`asset-card-value ${Number(balance?.todayProfit || 0) >= 0 ? 'positive' : 'negative'}`}>
              <CountUpValue
                target={Math.abs(Number(balance?.todayProfit || 0))}
                prefix={Number(balance?.todayProfit || 0) >= 0 ? '+¥' : '-¥'}
              />
            </span>
          </div>
          <div className="asset-card-divider" />
          <div className="asset-card-item">
            <span className="asset-card-label">累计收益</span>
            <span className={`asset-card-value ${Number(balance?.totalProfit || 0) >= 0 ? 'positive' : 'negative'}`}>
              <CountUpValue
                target={Math.abs(Number(balance?.totalProfit || 0))}
                prefix={Number(balance?.totalProfit || 0) >= 0 ? '+¥' : '-¥'}
              />
            </span>
          </div>
        </div>
      )}

      {/* === 功能菜单 - 第一组 === */}
      <div className="profile-menu-group">
        <div className="profile-menu-card">
          <MenuItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
                <rect x="9" y="3" width="6" height="4" rx="1" stroke="#848E9C" strokeWidth="2"/>
                <path d="M9 14l2 2 4-4" stroke="#848E9C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            title="我的订单"
            onClick={() => navigate('/m/transactions')}
          />
          <MenuItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M3 3h18v18H3z" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
                <path d="M3 9h18M9 21V9" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            }
            title="结算管理"
            onClick={() => navigate('/m/settlement')}
          />
          <MenuItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="#848E9C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="9" cy="7" r="4" stroke="#848E9C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="19" y1="8" x2="19" y2="14" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
                <line x1="22" y1="11" x2="16" y2="11" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            }
            title="邀请好友"
            onClick={() => navigate('/m/invitation')}
          />
        </div>
      </div>

      {/* === 功能菜单 - 第二组 === */}
      <div className="profile-menu-group">
        <div className="profile-menu-card">
          <MenuItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke="#848E9C" strokeWidth="2"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="#848E9C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            title="系统设置"
            onClick={() => setShowSecurity(true)}
          />
          <MenuItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#848E9C" strokeWidth="2"/>
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="17" r="0.5" fill="#848E9C"/>
              </svg>
            }
            title="帮助中心"
            onClick={() => navigate('/m/help-center')}
          />
          <MenuItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#848E9C" strokeWidth="2"/>
                <line x1="12" y1="16" x2="12" y2="12" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
                <line x1="12" y1="8" x2="12.01" y2="8" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            }
            title="关于我们"
            onClick={() => navigate('/m/about')}
          />
        </div>
      </div>

      {/* === 退出登录按钮 === */}
      <div className="profile-logout-section">
        <button className="profile-logout-btn" onClick={handleLogout}>
          退出登录
        </button>
      </div>

      {/* === 账户安全弹窗 === */}
      <Popup
        visible={showSecurity}
        onMaskClick={() => setShowSecurity(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, minHeight: '60vh', background: 'var(--color-bg-card)' }}
      >
        <div className="profile-security-popup">
          <div className="security-header">
            <span>账户安全</span>
            <span className="security-close" onClick={() => setShowSecurity(false)}>✕</span>
          </div>

          <div className="security-info-section">
            <div className="security-info-card">
              <div className="security-info-item">
                <div className="security-info-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="12" cy="7" r="4" stroke="#848E9C" strokeWidth="2"/>
                  </svg>
                </div>
                <div className="security-info-content">
                  <span className="security-info-label">用户名</span>
                  <span className="security-info-value">{user?.username || '-'}</span>
                </div>
              </div>
              <div className="security-info-item">
                <div className="security-info-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#848E9C" strokeWidth="2"/>
                  </svg>
                </div>
                <div className="security-info-content">
                  <span className="security-info-label">绑定手机</span>
                  <span className="security-info-value">{maskPhone(user?.phone || '')}</span>
                </div>
              </div>
              <div className="security-info-item">
                <div className="security-info-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="#848E9C" strokeWidth="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="security-info-content">
                  <span className="security-info-label">登录密码</span>
                  <span className="security-info-value" style={{ color: '#10B981' }}>已设置</span>
                </div>
              </div>
              <div className="security-info-item">
                <div className="security-info-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#848E9C" strokeWidth="2"/>
                  </svg>
                </div>
                <div className="security-info-content">
                  <span className="security-info-label">账户角色</span>
                  <span className="security-info-value">{getRoleLabel()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="security-divider">
            <span className="security-divider-text">修改密码</span>
          </div>
          <div className="security-form">
            <div className="security-input-wrapper">
              <span className="security-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="#848E9C" strokeWidth="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </span>
              <input type="password" placeholder="输入旧密码" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="security-input" />
            </div>
            <div className="security-input-wrapper">
              <span className="security-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="#848E9C" strokeWidth="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="16" r="1.5" fill="#848E9C"/>
                </svg>
              </span>
              <input type="password" placeholder="输入新密码（至少6位）" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="security-input" />
            </div>
            <div className="security-input-wrapper">
              <span className="security-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#848E9C" strokeWidth="2"/>
                  <path d="M9 12l2 2 4-4" stroke="#848E9C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <input type="password" placeholder="确认新密码" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="security-input" />
            </div>
            <button
              className="btn-confirm-security"
              disabled={changePwdLoading || !oldPassword || !newPassword || !confirmPassword}
              onClick={handleChangePassword}
            >
              {changePwdLoading ? '修改中...' : '确认修改'}
            </button>
          </div>
        </div>
      </Popup>

      {/* === 消息通知弹窗 === */}
      <Popup
        visible={showMessages}
        onMaskClick={() => { setShowMessages(false); setSelectedMessage(null) }}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, minHeight: '70vh', background: 'var(--color-bg-card)' }}
      >
        <div className="profile-messages-popup">
          <div className="messages-header">
            <span>消息通知</span>
            <span className="messages-close" onClick={() => { setShowMessages(false); setSelectedMessage(null) }}>✕</span>
          </div>

          {selectedMessage ? (
            <div className="message-detail">
              <div className="message-detail-header">
                <span className="message-detail-type" style={{
                  color: selectedMessage.type === 'announcement' ? '#F0B90B' : selectedMessage.type === 'maintenance' ? '#EF4444' : '#848E9C',
                  backgroundColor: selectedMessage.type === 'announcement' ? 'rgba(240,185,11,0.15)' : selectedMessage.type === 'maintenance' ? 'rgba(239,68,68,0.15)' : 'rgba(132,142,156,0.15)'
                }}>
                  {getMsgTypeLabel(selectedMessage.type)}
                </span>
                <span className="message-detail-time">{formatMsgTime(selectedMessage.publishedAt || selectedMessage.createdAt)}</span>
              </div>
              <h3 className="message-detail-title">{selectedMessage.title}</h3>
              <div className="message-detail-content">{selectedMessage.content}</div>
              <button className="message-detail-back" onClick={() => setSelectedMessage(null)}>返回列表</button>
            </div>
          ) : (
            <div className="messages-list">
              {messagesLoading ? (
                <div className="messages-loading">
                  <div className="loading-spinner"></div>
                  <span>加载中...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="messages-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#2B3139" strokeWidth="2"/>
                    <polyline points="22,6 12,13 2,6" stroke="#2B3139" strokeWidth="2"/>
                  </svg>
                  <span>暂无消息</span>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={msg.id || index}
                    className="message-item"
                    onClick={() => setSelectedMessage(msg)}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="message-item-header">
                      <span className="message-type-tag" style={{
                        color: msg.type === 'announcement' ? '#F0B90B' : msg.type === 'maintenance' ? '#EF4444' : '#848E9C',
                        backgroundColor: msg.type === 'announcement' ? 'rgba(240,185,11,0.15)' : msg.type === 'maintenance' ? 'rgba(239,68,68,0.15)' : 'rgba(132,142,156,0.15)'
                      }}>
                        {getMsgTypeLabel(msg.type)}
                      </span>
                      <span className="message-time">{formatMsgTime(msg.publishedAt || msg.createdAt)}</span>
                    </div>
                    <div className="message-item-title">{msg.title}</div>
                    <div className="message-item-summary">{msg.content?.length > 60 ? msg.content.slice(0, 60) + '...' : msg.content}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Popup>


    </div>
  )
}

const Profile: React.FC = () => {
  return (
    <ProfileErrorBoundary>
      <ProfileContent />
    </ProfileErrorBoundary>
  )
}

export default Profile
