import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Popup, Button, Toast, List } from 'antd-mobile'
import { authApi, accountApi, paymentApi } from '../services/api'
import './Profile.css'

const Profile: React.FC = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [balance, setBalance] = useState<any>(null)
  const [showRecharge, setShowRecharge] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [payChannel, setPayChannel] = useState<'alipay' | 'wechat'>('alipay')
  const [payLoading, setPayLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [profileRes, balanceRes] = await Promise.all([
        authApi.getProfile() as any,
        accountApi.getBalance() as any,
      ])
      setUser(profileRes?.data || profileRes)
      setBalance(balanceRes?.data || balanceRes)
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
      const res = await (payChannel === 'alipay'
        ? paymentApi.createAlipayOrder(amount)
        : paymentApi.createWechatOrder(amount)) as any
      const payData = res?.data || res
      if (payData?.qrUrl || payData?.payUrl) {
        window.open(payData.qrUrl || payData.payUrl, '_blank')
        Toast.show({ content: '请完成支付', icon: 'success' })
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
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    navigate('/m/login')
  }

  return (
    <div className="mobile-profile">
      <div className="mobile-profile-header">
        <div className="profile-avatar">
          {user?.username?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div className="profile-info">
          <div className="profile-name">{user?.realName || user?.username || '未登录'}</div>
          <div className="profile-role">{user?.role === 'admin' ? '管理员' : '投资者'}</div>
        </div>
      </div>

      {balance && (
        <div className="profile-balance-card">
          <div className="profile-balance-row">
            <span className="profile-balance-label">账户余额</span>
            <span className="profile-balance-amount">¥{balance.balance?.toFixed(2) || '0.00'}</span>
          </div>
          <div className="profile-balance-row">
            <span className="profile-balance-label">冻结金额</span>
            <span className="profile-balance-sub">¥{balance.frozenAmount?.toFixed(2) || '0.00'}</span>
          </div>
          <div className="profile-balance-row">
            <span className="profile-balance-label">累计收益</span>
            <span className="profile-balance-profit">¥{balance.totalProfit?.toFixed(2) || '0.00'}</span>
          </div>
        </div>
      )}

      <div className="profile-actions">
        <div className="profile-action-btn" onClick={() => setShowRecharge(true)}>
          <span className="action-icon">💰</span>
          <span>充值</span>
        </div>
        <div className="profile-action-btn" onClick={() => navigate('/m/portfolio')}>
          <span className="action-icon">📋</span>
          <span>认购记录</span>
        </div>
        <div className="profile-action-btn" onClick={() => Toast.show({ content: '功能开发中' })}>
          <span className="action-icon">📊</span>
          <span>收益明细</span>
        </div>
      </div>

      <List style={{ '--border-inner': 'rgba(255,255,255,0.04)', '--border-top': 'none', '--border-bottom': 'none' } as any}>
        <List.Item
          onClick={() => Toast.show({ content: '功能开发中' })}
          description="修改个人信息"
          style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
        >
          个人设置
        </List.Item>
        <List.Item
          onClick={() => Toast.show({ content: '功能开发中' })}
          description="账户安全"
          style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
        >
          安全中心
        </List.Item>
      </List>

      <div className="profile-logout">
        <Button block size="large" onClick={handleLogout} style={{ borderRadius: 8, background: '#F6465D', color: '#fff', border: 'none' }}>
          退出登录
        </Button>
      </div>

      <Popup
        visible={showRecharge}
        onMaskClick={() => setShowRecharge(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '36vh', background: 'var(--color-bg-secondary)' }}
      >
        <div className="recharge-popup">
          <div className="recharge-header">
            <span>充值</span>
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
          <input
            type="number"
            placeholder="输入自定义金额"
            value={rechargeAmount}
            onChange={e => setRechargeAmount(e.target.value)}
            className="recharge-input"
          />
          <div className="recharge-channels">
            <div className={`recharge-channel ${payChannel === 'alipay' ? 'active' : ''}`} onClick={() => setPayChannel('alipay')}>
              🔵 支付宝
            </div>
            <div className={`recharge-channel ${payChannel === 'wechat' ? 'active' : ''}`} onClick={() => setPayChannel('wechat')}>
              🟢 微信支付
            </div>
          </div>
          <Button
            block
            color="primary"
            size="large"
            loading={payLoading}
            onClick={handleRecharge}
            style={{ '--background-color': '#F0B90B', '--border-color': '#F0B90B', borderRadius: 8, marginTop: 16 }}
          >
            确认充值
          </Button>
        </div>
      </Popup>
    </div>
  )
}

export default Profile
