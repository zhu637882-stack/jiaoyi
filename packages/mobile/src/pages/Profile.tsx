import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Popup, Toast, Modal, Badge, Dialog } from 'antd-mobile'
import { authApi, accountApi, paymentApi, systemMessageApi, trialBonusApi } from '../services/api'
import { isWechatBrowser } from '../utils/browser'
import { ensureWechatOpenId, getStoredOpenId, redirectToWechatAuth } from '../utils/wechat-auth'
import { useCountUp, formatCountUpValue } from '../hooks/useCountUp'
import avatarLogo from '../assets/avatar-logo.png'
import './Profile.css'

// CountUp数字展示组件
const CountUpValue = ({ target, prefix = '¥' }: { target: number; prefix?: string }) => {
  // 防御性处理：确保 target 是有效数字
  const safeTarget = Number.isFinite(target) ? target : 0
  const animatedValue = useCountUp(safeTarget)
  // 如果动画值无效，回退到目标值
  const displayValue = Number.isFinite(animatedValue) ? animatedValue : safeTarget
  return (
    <span>{prefix}{formatCountUpValue(displayValue)}</span>
  )
}

// 快捷操作按钮
const QuickAction = ({ 
  icon, 
  label, 
  onClick,
  badge
}: { 
  icon: React.ReactNode
  label: string
  onClick: () => void
  badge?: number
}) => (
  <div className="profile-quick-action" onClick={onClick}>
    <div className="quick-action-icon">
      {icon}
      {badge !== undefined && badge > 0 && (
        <Badge content={badge > 99 ? '99+' : badge} className="quick-action-badge" />
      )}
    </div>
    <span className="quick-action-label">{label}</span>
  </div>
)

// 功能列表项
const MenuItem = ({ 
  icon, 
  title, 
  description, 
  onClick,
  arrow = true
}: { 
  icon: React.ReactNode
  title: string
  description?: string
  onClick: () => void
  arrow?: boolean
}) => (
  <div className="profile-menu-item" onClick={onClick}>
    <div className="menu-item-icon">{icon}</div>
    <div className="menu-item-content">
      <span className="menu-item-title">{title}</span>
      {description && <span className="menu-item-desc">{description}</span>}
    </div>
    {arrow && (
      <svg className="menu-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )}
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
      const errorMessage = this.state.error ? this.state.error.message : '未知错误，请稍后重试'
      return (
        <div style={{ 
          padding: 40, 
          textAlign: 'center', 
          color: '#EAECEF',
          background: '#0B0E11',
          minHeight: '100vh'
        }}>
          <h2 style={{ color: '#F6465D', marginBottom: 16 }}>页面加载出错</h2>
          <p style={{ color: '#848E9C', marginBottom: 24 }}>
            {errorMessage}
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: '#F0B90B',
              border: 'none',
              borderRadius: 8,
              color: '#181A20',
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
  const [showRecharge, setShowRecharge] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [payChannel, setPayChannel] = useState<'wechat'>('wechat')
  const [payLoading, setPayLoading] = useState(false)

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
    // 微信浏览器中从URL提取openId（OAuth回调后被动接收）
    if (isWechatBrowser()) {
      ensureWechatOpenId()
    }

    let isMounted = true
    
    const init = async () => {
      try {
        if (isMounted) await loadData()
      } catch (e) {
        console.error('Profile init error:', e)
      }
    }
    
    init()
    
    return () => {
      isMounted = false
    }
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

  const handleRecharge = async () => {
    const amount = Number(rechargeAmount)
    if (!amount || amount <= 0) {
      Toast.show({ content: '请输入有效金额', icon: 'fail' })
      return
    }
    setPayLoading(true)
    try {
      if (isWechatBrowser()) {
        // 微信浏览器内 → 检查openId，无则跳转OAuth
        const openId = getStoredOpenId()
        if (!openId) {
          Toast.show({ content: '正在获取微信授权...', icon: 'loading' })
          redirectToWechatAuth()
          return
        }
        // 微信浏览器内 → JSAPI支付
        const res = await paymentApi.createWechatJsapiOrder(amount, openId) as any
        const payData = res?.data || res

        if (payData?.timeStamp && payData?.paySign) {
          // JSAPI支付：调用WeixinJSBridge
          if ((window as any).WeixinJSBridge) {
            ;(window as any).WeixinJSBridge.invoke('getBrandWCPayRequest', {
              appId: payData.appId,
              timeStamp: payData.timeStamp,
              nonceStr: payData.nonceStr,
              package: payData.package,
              signType: payData.signType,
              paySign: payData.paySign,
            }, (res: any) => {
              if (res.err_msg === 'get_brand_wcpay_request:ok') {
                Dialog.alert({
                  title: '充值成功',
                  content: '资金已即时到账，可在账户中查看可用余额。',
                  confirmText: '我知道了',
                })
                loadData()
              }
            })
          }
        } else if (payData?.mwebUrl) {
          // H5支付降级：跳转支付URL
          window.location.href = payData.mwebUrl
        } else if (payData?.codeUrl) {
          // 兜底：二维码
          window.open(payData.codeUrl, '_blank')
        }
      } else {
        // 非微信浏览器 → 保持原有逻辑（NATIVE二维码）
        const res = await paymentApi.createWechatOrder(amount) as any
        const payData = res?.data || res
        if (payData?.qrUrl || payData?.payUrl || payData?.qrCode) {
          const payUrl = payData.qrUrl || payData.payUrl || payData.qrCode
          window.open(payUrl, '_blank')
          Toast.show({ content: '请在新窗口完成支付', icon: 'success' })
        }
      }
      setShowRecharge(false)
      setRechargeAmount('')
    } catch (e) {
      console.error('Recharge error:', e)
    } finally {
      setPayLoading(false)
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

  // 修改密码
  const handleChangePassword = async () => {
    if (!oldPassword) {
      Toast.show({ content: '请输入旧密码', icon: 'fail' })
      return
    }
    if (!newPassword) {
      Toast.show({ content: '请输入新密码', icon: 'fail' })
      return
    }
    if (newPassword.length < 6) {
      Toast.show({ content: '新密码至少6位', icon: 'fail' })
      return
    }
    if (newPassword !== confirmPassword) {
      Toast.show({ content: '两次密码不一致', icon: 'fail' })
      return
    }
    if (oldPassword === newPassword) {
      Toast.show({ content: '新密码不能与旧密码相同', icon: 'fail' })
      return
    }
    setChangePwdLoading(true)
    try {
      await authApi.changePassword({ oldPassword, newPassword })
      Toast.show({ content: '密码修改成功，请重新登录', icon: 'success' })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowSecurity(false)
      // 退出登录让用户重新登录
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

  // 加载系统消息
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

  // 打开消息通知
  const openMessages = () => {
    setShowMessages(true)
    loadMessages()
  }

  // 格式化消息时间
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

  // 消息类型标签
  const getMsgTypeLabel = (type: string) => {
    switch (type) {
      case 'announcement': return '公告'
      case 'notification': return '通知'
      case 'maintenance': return '维护'
      default: return '通知'
    }
  }

  // 获取用户首字母
  const getUserInitial = () => {
    const name = user?.realName || user?.username || 'U'
    return name.charAt(0).toUpperCase()
  }

  // 获取角色标签
  const getRoleLabel = () => {
    if (user?.role === 'admin') return '管理员'
    if (user?.role === 'partner') return '合伙人'
    return '投资者'
  }

  // 获取角色颜色
  const getRoleColor = () => {
    if (user?.role === 'admin') return '#F6465D'
    if (user?.role === 'partner') return '#F0B90B'
    return '#0ECB81'
  }

  return (
    <div className="mobile-profile">
      {/* 我的账户卡片 */}
      <div className="profile-user-section">
        <div className="profile-account-header">
          <span className="account-title">我的账户</span>
          <span className="account-status">已认证</span>
        </div>
        <div className="profile-account-main">
          <div className="profile-avatar">
            <img src={avatarLogo} alt="零钱保" className="avatar-logo" loading="lazy" />
          </div>
          <div className="profile-user-info">
            <div className="profile-name-row">
              <span className="profile-name">{user?.realName || user?.username || '未登录'}</span>
              <span 
                className="profile-role-badge" 
                style={{ backgroundColor: `${getRoleColor()}20`, color: getRoleColor() }}
              >
                {getRoleLabel()}
              </span>
            </div>
            <span className="profile-username">@{user?.username || '-'}</span>
          </div>
        </div>
      </div>

      {/* 资产卡片 */}
      {balance && (
        <div className="profile-asset-card">
          <div className="asset-header">
            <span className="asset-title">我的资产</span>
            <span className="asset-update">实时更新</span>
          </div>
          <div className="asset-main">
            <span className="asset-label">总资产</span>
            <span className="asset-value">
              <CountUpValue target={Number(balance?.availableBalance || 0) + Number(balance?.frozenBalance || 0)} />
            </span>
          </div>
          <div className="asset-stats">
            <div className="asset-stat">
              <span className="stat-label">可用余额</span>
              <span className="stat-value">
                <CountUpValue target={Number(balance?.availableBalance || 0)} />
              </span>
            </div>
            <div className="asset-stat">
              <span className="stat-label">冻结金额</span>
              <span className="stat-value frozen">
                <CountUpValue target={Number(balance?.frozenBalance || balance?.frozenAmount || 0)} />
              </span>
            </div>
            <div className="asset-stat">
              <span className="stat-label">累计收益</span>
              <span className={`stat-value ${Number(balance?.totalProfit || 0) >= 0 ? 'profit' : 'loss'}`}>
                <CountUpValue 
                  target={Math.abs(Number(balance?.totalProfit || 0))} 
                  prefix={Number(balance?.totalProfit || 0) >= 0 ? '+¥' : '-¥'}
                />
              </span>
            </div>
            {trialBonus?.hasTrialBonus && (
              <div className="asset-stat">
                <span className="stat-label">体验金</span>
                <span className="stat-value trial-bonus-value">
                  <span className="trial-bonus-amount">¥{Number(trialBonus.amount || 0).toFixed(2)}</span>
                  {(() => {
                    // 状态判断优先级：PENDING > ACTIVATED未过期 > ACTIVATED已过期/EXPIRED/USED
                    const status = trialBonus.status
                    const isActivatedNotExpired = status === 'activated' && (!trialBonus.expiresAt || new Date(trialBonus.expiresAt) > new Date())
                    if (status === 'pending') {
                      return <span className="trial-bonus-badge pending">待激活</span>
                    } else if (isActivatedNotExpired) {
                      return <span className="trial-bonus-badge activated">已激活</span>
                    } else {
                      return <span className="trial-bonus-badge expired">已过期</span>
                    }
                  })()}
                </span>
                {trialBonus.status === 'pending' && (
                  <span className="stat-sublabel">充值≥100元激活</span>
                )}
                {(() => {
                  const isActivatedNotExpired = trialBonus.status === 'activated' && (!trialBonus.expiresAt || new Date(trialBonus.expiresAt) > new Date())
                  if (isActivatedNotExpired && trialBonus.expiresAt) {
                    const days = Math.ceil((new Date(trialBonus.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    return <span className="stat-sublabel">{days}天后到期</span>
                  }
                  return null
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 快捷操作 */}
      <div className="profile-quick-actions">
        <QuickAction
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12l7-7 7 7" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          label="在线充值"
          onClick={() => setShowRecharge(true)}
        />
        <QuickAction
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="#F0B90B" strokeWidth="2"/>
              <path d="M3 10h18M9 21V9" stroke="#F0B90B" strokeWidth="2"/>
            </svg>
          }
          label="认购记录"
          onClick={() => navigate('/m/portfolio')}
        />
        <QuickAction
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#F0B90B" strokeWidth="2"/>
              <polyline points="14,2 14,8 20,8" stroke="#F0B90B" strokeWidth="2"/>
              <line x1="16" y1="13" x2="8" y2="13" stroke="#F0B90B" strokeWidth="2"/>
              <line x1="16" y1="17" x2="8" y2="17" stroke="#F0B90B" strokeWidth="2"/>
            </svg>
          }
          label="清算统计"
          onClick={() => navigate('/m/settlement')}
        />
        <QuickAction
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          label="交易明细"
          onClick={() => navigate('/m/transactions')}
        />
        <QuickAction
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="9" cy="7" r="4" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="19" y1="8" x2="19" y2="14" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round"/>
              <line x1="22" y1="11" x2="16" y2="11" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          }
          label="我的邀请"
          onClick={() => navigate('/m/invitation')}
        />
        <QuickAction
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#F6465D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="16,17 21,12 16,7" stroke="#F6465D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="21" y1="12" x2="9" y2="12" stroke="#F6465D" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          }
          label="退出登录"
          onClick={handleLogout}
        />
      </div>

      {/* 功能列表 */}
      <div className="profile-menu-section">
        <div className="menu-section-title">账户服务</div>
        <div className="profile-menu-list">
          <MenuItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="#F0B90B" strokeWidth="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            }
            title="账户安全"
            description="修改密码、安全设置"
            onClick={() => setShowSecurity(true)}
          />
          <MenuItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#F0B90B" strokeWidth="2"/>
                <polyline points="22,6 12,13 2,6" stroke="#F0B90B" strokeWidth="2"/>
              </svg>
            }
            title="消息通知"
            description="系统消息、交易提醒"
            onClick={openMessages}
          />
          <MenuItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#F0B90B" strokeWidth="2"/>
                <polyline points="14,2 14,8 20,8" stroke="#F0B90B" strokeWidth="2"/>
                <line x1="16" y1="13" x2="8" y2="13" stroke="#F0B90B" strokeWidth="2"/>
                <line x1="16" y1="17" x2="8" y2="17" stroke="#F0B90B" strokeWidth="2"/>
              </svg>
            }
            title="清算统计"
            description="查看清算分润记录"
            onClick={() => navigate('/m/settlement')}
          />
          <MenuItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            title="交易明细"
            description="查看全部交易流水"
            onClick={() => navigate('/m/transactions')}
          />
        </div>
      </div>

      {/* 账户安全弹窗 */}
      <Popup
        visible={showSecurity}
        onMaskClick={() => setShowSecurity(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '60vh', background: 'var(--color-bg-secondary)' }}
      >
        <div className="profile-security-popup">
          <div className="security-header">
            <span>账户安全</span>
            <span className="security-close" onClick={() => setShowSecurity(false)}>✕</span>
          </div>

          {/* 用户安全信息 */}
          <div className="security-info-section">
            <div className="security-info-card">
              <div className="security-info-item">
                <div className="security-info-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="12" cy="7" r="4" stroke="#F0B90B" strokeWidth="2"/>
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
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke="#F0B90B" strokeWidth="2"/>
                  </svg>
                </div>
                <div className="security-info-content">
                  <span className="security-info-label">绑定手机</span>
                  <span className="security-info-value">{user?.phone ? `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}` : '未绑定'}</span>
                </div>
              </div>
              <div className="security-info-item">
                <div className="security-info-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="#F0B90B" strokeWidth="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="security-info-content">
                  <span className="security-info-label">登录密码</span>
                  <span className="security-info-value" style={{ color: '#0ECB81' }}>已设置</span>
                </div>
              </div>
              <div className="security-info-item">
                <div className="security-info-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#F0B90B" strokeWidth="2"/>
                  </svg>
                </div>
                <div className="security-info-content">
                  <span className="security-info-label">账户角色</span>
                  <span className="security-info-value">{getRoleLabel()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 修改密码 */}
          <div className="security-divider">
            <span className="security-divider-text">修改密码</span>
          </div>
          <div className="security-form">
            <div className="security-input-wrapper">
              <span className="security-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="#848E9C" strokeWidth="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </span>
              <input
                type="password"
                placeholder="输入旧密码"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                className="security-input"
              />
            </div>
            <div className="security-input-wrapper">
              <span className="security-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="#848E9C" strokeWidth="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="16" r="1.5" fill="#848E9C"/>
                </svg>
              </span>
              <input
                type="password"
                placeholder="输入新密码（至少6位）"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="security-input"
              />
            </div>
            <div className="security-input-wrapper">
              <span className="security-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#848E9C" strokeWidth="2"/>
                  <path d="M9 12l2 2 4-4" stroke="#848E9C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <input
                type="password"
                placeholder="确认新密码"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="security-input"
              />
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

      {/* 消息通知弹窗 */}
      <Popup
        visible={showMessages}
        onMaskClick={() => { setShowMessages(false); setSelectedMessage(null) }}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '70vh', background: 'var(--color-bg-secondary)' }}
      >
        <div className="profile-messages-popup">
          <div className="messages-header">
            <span>消息通知</span>
            <span className="messages-close" onClick={() => { setShowMessages(false); setSelectedMessage(null) }}>✕</span>
          </div>

          {selectedMessage ? (
            /* 消息详情 */
            <div className="message-detail">
              <div className="message-detail-header">
                <span className="message-detail-type" style={{
                  color: selectedMessage.type === 'announcement' ? '#F0B90B' : selectedMessage.type === 'maintenance' ? '#F6465D' : '#848E9C',
                  backgroundColor: selectedMessage.type === 'announcement' ? 'rgba(240,185,11,0.15)' : selectedMessage.type === 'maintenance' ? 'rgba(246,70,93,0.15)' : 'rgba(132,142,156,0.15)'
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
            /* 消息列表 */
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
                        color: msg.type === 'announcement' ? '#F0B90B' : msg.type === 'maintenance' ? '#F6465D' : '#848E9C',
                        backgroundColor: msg.type === 'announcement' ? 'rgba(240,185,11,0.15)' : msg.type === 'maintenance' ? 'rgba(246,70,93,0.15)' : 'rgba(132,142,156,0.15)'
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

      {/* 充值弹窗 */}
      <Popup
        visible={showRecharge}
        onMaskClick={() => setShowRecharge(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '50vh', background: 'var(--color-bg-secondary)' }}
      >
        <div className="profile-recharge-popup">
          <div className="recharge-header">
            <span>账户充值</span>
            <span className="recharge-close" onClick={() => setShowRecharge(false)}>✕</span>
          </div>
          
          <div className="recharge-amounts">
            {[100, 500, 1000, 5000].map(amt => (
              <div
                key={amt}
                className={`recharge-amount-btn ${rechargeAmount === String(amt) ? 'active' : ''}`}
                onClick={() => setRechargeAmount(String(amt))}
              >
                ¥{amt}
              </div>
            ))}
          </div>
          
          <div className="recharge-input-section">
            <label className="recharge-input-label">自定义金额</label>
            <div className="recharge-input-wrapper">
              <span className="recharge-currency">¥</span>
              <input
                type="number"
                placeholder="输入充值金额"
                value={rechargeAmount}
                onChange={e => setRechargeAmount(e.target.value)}
                className="recharge-input"
                min="0.01"
                step="0.01"
              />
            </div>
          </div>
          
          <div className="recharge-channels">
            <div
              className={`recharge-channel ${payChannel === 'wechat' ? 'active' : ''}`}
              onClick={() => setPayChannel('wechat')}
            >
              <span className="channel-icon wechat">微</span>
              <span>微信支付</span>
            </div>
          </div>
          
          <button
            className="btn-confirm-recharge"
            disabled={payLoading || !rechargeAmount || Number(rechargeAmount) <= 0}
            onClick={handleRecharge}
          >
            {payLoading ? '处理中...' : '确认充值'}
          </button>
        </div>
      </Popup>
    </div>
  )
}

// 导出带错误边界的组件
const Profile: React.FC = () => {
  return (
    <ProfileErrorBoundary>
      <ProfileContent />
    </ProfileErrorBoundary>
  )
}

export default Profile
