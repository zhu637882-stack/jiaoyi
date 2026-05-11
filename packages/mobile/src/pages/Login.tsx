import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Toast, Modal } from 'antd-mobile'
import { authApi } from '../services/api'
import './Login.css'

// 眼睛图标 - 显示密码
const EyeOpenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// 眼睛图标 - 隐藏密码
const EyeCloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// 手机图标
const PhoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// 锁图标
const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

// 品牌Logo - 黄色圆角方形 + 黑色双L互锁图形
const BrandLogo = () => (
  <svg width="72" height="72" viewBox="0 0 28 28">
    <rect width="28" height="28" rx="4.2" fill="#F0B90B"/>
    <path d="M5 5h18v18H5z M10 10v8h8v-8z" fill="#1B1D21" fillRule="evenodd"/>
  </svg>
)

const Login: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(() => {
    return searchParams.get('tab') === 'register' ? 'register' : 'login'
  })
  const [loading, setLoading] = useState(false)
  const [btnState, setBtnState] = useState<'idle' | 'loading' | 'success'>('idle')
  const [agreed, setAgreed] = useState(() => {
    return searchParams.get('agreed') === 'true' || localStorage.getItem('agreed_to_agreement') === 'true'
  })

  // 密码显示状态
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false)

  // 登录表单
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // 注册表单
  const [regUsername, setRegUsername] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')
  const [regRealName, setRegRealName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regReferrer, setRegReferrer] = useState(() => searchParams.get('code') || '')

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) setRegReferrer(code)
  }, [searchParams])

  const handleLogin = async () => {
    if (!loginUsername || !loginPassword) {
      Toast.show({ content: '请输入手机号和密码', icon: 'fail' })
      return
    }
    setLoading(true); setBtnState('loading')
    try {
      const res = await authApi.login(loginUsername, loginPassword) as any
      const data = res?.data || res
      if (data?.status === 'pending') {
        Toast.show({ content: '账号审核中，请耐心等待', icon: 'fail' })
        setLoading(false); setBtnState('idle'); return
      }
      if (data?.status === 'rejected') {
        Modal.alert({ content: `账号审核未通过${data.remark ? '，原因：' + data.remark : ''}`, confirmText: '知道了' })
        setLoading(false); setBtnState('idle'); return
      }
      if (data?.access_token) {
        localStorage.setItem('access_token', data.access_token)
        if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user))
        setBtnState('success')
        Toast.show({ content: '登录成功', icon: 'success' })
        setTimeout(() => navigate('/m'), 800)
      } else if (data?.message) {
        Toast.show({ content: data.message, icon: 'fail' }); setBtnState('idle')
      }
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.message || '登录失败', icon: 'fail' }); setBtnState('idle')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!regUsername || !regPassword || !regRealName || !regPhone) { Toast.show({ content: '请填写完整信息', icon: 'fail' }); return }
    if (regPassword !== regConfirmPassword) { Toast.show({ content: '两次输入的密码不一致', icon: 'fail' }); return }
    if (!/^1[3-9]\d{9}$/.test(regPhone)) { Toast.show({ content: '请输入正确的手机号', icon: 'fail' }); return }
    if (regUsername.length < 3 || regUsername.length > 20) { Toast.show({ content: '用户名长度应为3-20个字符', icon: 'fail' }); return }
    if (regPassword.length < 6) { Toast.show({ content: '密码至少6个字符', icon: 'fail' }); return }
    if (!agreed) { Toast.show({ content: '请先同意服务协议', icon: 'fail' }); navigate('/m/agreement'); return }
    setLoading(true)
    try {
      const res = await authApi.register({
        username: regUsername, password: regPassword, realName: regRealName, phone: regPhone,
        agreedToAgreement: true, invitationCode: regReferrer || undefined,
      }) as any
      const data = res?.data || res
      if (data?.user || data?.success) {
        Toast.show({ content: data.message || '注册成功，请等待审核', icon: 'success' })
        setActiveTab('login'); setLoginUsername(regUsername)
        setRegUsername(''); setRegPassword(''); setRegConfirmPassword('')
        setRegRealName(''); setRegPhone(''); setRegReferrer(''); setAgreed(false)
      } else if (data?.message) {
        Toast.show({ content: data.message, icon: 'fail' })
      }
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.message || '注册失败', icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mobile-login">
      {/* 装饰光晕 */}
      <div className="login-glow login-glow--tr" />
      <div className="login-glow login-glow--bl" />

      {/* 顶部导航 - 仅注册页 */}
      {activeTab === 'register' && (
        <div className="login-header">
          <button className="login-back-btn" onClick={() => setActiveTab('login')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="login-header-title">注册</h1>
          <div className="login-header-placeholder" />
        </div>
      )}

      <div className="login-content">
        {/* Logo区域 */}
        <div className="login-logo-section">
          <div className="login-logo-wrapper">
            <BrandLogo />
          </div>
          <span className="login-brand-name">零钱宝</span>
          <span className="login-brand-slogan">医药垫资 · 安全稳健</span>
        </div>

        {/* 登录表单 */}
        {activeTab === 'login' && (
          <div className="login-form">
            <div className="login-input-wrapper">
              <div className="login-input-box">
                <span className="login-input-icon"><PhoneIcon /></span>
                <input
                  type="text"
                  placeholder="请输入手机号"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="login-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>

            <div className="login-input-wrapper">
              <div className="login-input-box">
                <span className="login-input-icon"><LockIcon /></span>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="login-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                />
                <button className="login-eye-btn" onClick={() => setShowLoginPassword(!showLoginPassword)} type="button">
                  {showLoginPassword ? <EyeOpenIcon /> : <EyeCloseIcon />}
                </button>
              </div>
            </div>

            <div className="login-forgot-row">
              <button className="login-forgot-btn" type="button">忘记密码？</button>
            </div>

            <button
              className={`login-submit-btn ${btnState === 'loading' ? 'is-loading' : ''} ${btnState === 'success' ? 'is-success' : ''}`}
              onClick={handleLogin}
              disabled={loading}
            >
              <span className="btn-text">{loading ? '登录中...' : '登录'}</span>
            </button>

            <div className="login-divider">
              <span className="login-divider-line" />
              <span className="login-divider-text">其他方式</span>
              <span className="login-divider-line" />
            </div>

            <div className="login-footer-link">
              <span>还没有账号？</span>
              <button className="login-link-btn" onClick={() => navigate('/m/agreement')}>立即注册</button>
            </div>
          </div>
        )}

        {/* 注册表单 */}
        {activeTab === 'register' && (
          <div className="login-form">
            <div className="login-input-wrapper">
              <label className="login-input-label">用户名</label>
              <div className="login-input-box">
                <input type="text" placeholder="3-20个字符" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} className="login-input" />
              </div>
            </div>

            <div className="login-input-wrapper">
              <label className="login-input-label">密码</label>
              <div className="login-input-box">
                <input type={showRegPassword ? 'text' : 'password'} placeholder="至少6个字符" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="login-input" />
                <button className="login-eye-btn" onClick={() => setShowRegPassword(!showRegPassword)} type="button">
                  {showRegPassword ? <EyeOpenIcon /> : <EyeCloseIcon />}
                </button>
              </div>
            </div>

            <div className="login-input-wrapper">
              <label className="login-input-label">确认密码</label>
              <div className="login-input-box">
                <input type={showRegConfirmPassword ? 'text' : 'password'} placeholder="再次输入密码" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} className="login-input" />
                <button className="login-eye-btn" onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)} type="button">
                  {showRegConfirmPassword ? <EyeOpenIcon /> : <EyeCloseIcon />}
                </button>
              </div>
            </div>

            <div className="login-input-wrapper">
              <label className="login-input-label">真实姓名</label>
              <div className="login-input-box">
                <input type="text" placeholder="请输入真实姓名" value={regRealName} onChange={(e) => setRegRealName(e.target.value)} className="login-input" />
              </div>
            </div>

            <div className="login-input-wrapper">
              <label className="login-input-label">手机号</label>
              <div className="login-input-box">
                <input type="tel" placeholder="请输入手机号" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} className="login-input" />
              </div>
            </div>

            <div className="login-input-wrapper">
              <label className="login-input-label">邀请码 <span className="login-optional">（选填）</span></label>
              <div className="login-input-box">
                <input type="text" placeholder="请输入6位邀请码" value={regReferrer} onChange={(e) => setRegReferrer(e.target.value)} className="login-input" maxLength={10} />
              </div>
            </div>

            <button className="login-submit-btn" onClick={handleRegister} disabled={loading}>
              {loading ? '注册中...' : '注册'}
            </button>

            <div className="login-footer-link">
              <span>已有账号？</span>
              <button className="login-link-btn" onClick={() => setActiveTab('login')}>登录</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Login
