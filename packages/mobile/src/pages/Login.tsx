import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Toast, Modal } from 'antd-mobile'
import { authApi } from '../services/api'
import './Login.css'

// 币安风格Logo组件
const BinanceLogo = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="login-logo-svg">
    <rect width="64" height="64" rx="12" fill="#F0B90B"/>
    <path d="M32 16L36.5 20.5L32 25L27.5 20.5L32 16Z" fill="#0B0E11"/>
    <path d="M20.5 27.5L25 32L20.5 36.5L16 32L20.5 27.5Z" fill="#0B0E11"/>
    <path d="M43.5 27.5L48 32L43.5 36.5L39 32L43.5 27.5Z" fill="#0B0E11"/>
    <path d="M32 39L36.5 43.5L32 48L27.5 43.5L32 39Z" fill="#0B0E11"/>
    <path d="M32 25L36.5 29.5L32 34L27.5 29.5L32 25Z" fill="#0B0E11"/>
    <path d="M25 32L29.5 36.5L25 41L20.5 36.5L25 32Z" fill="#0B0E11"/>
    <path d="M39 32L43.5 36.5L39 41L34.5 36.5L39 32Z" fill="#0B0E11"/>
    <path d="M32 34L36.5 38.5L32 43L27.5 38.5L32 34Z" fill="#0B0E11"/>
  </svg>
)

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

// 返回箭头图标
const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// 勾选图标
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <polyline points="20 6 9 17 4 12" stroke="#0B0E11" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const Login: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(() => {
    return searchParams.get('tab') === 'register' ? 'register' : 'login'
  })
  const [loading, setLoading] = useState(false)
  // 协议同意状态：从URL参数或localStorage检查
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
  const [regReferrer, setRegReferrer] = useState('')

  const handleLogin = async () => {
    if (!loginUsername || !loginPassword) {
      Toast.show({ content: '请输入用户名和密码', icon: 'fail' })
      return
    }
    setLoading(true)
    try {
      const res = await authApi.login(loginUsername, loginPassword) as any
      const data = res?.data || res
      
      // 检查审核状态
      if (data?.status === 'pending') {
        Toast.show({ content: '账号审核中，请耐心等待', icon: 'fail' })
        setLoading(false)
        return
      }
      if (data?.status === 'rejected') {
        Modal.alert({
          content: `账号审核未通过${data.remark ? '，原因：' + data.remark : ''}`,
          confirmText: '知道了',
        })
        setLoading(false)
        return
      }
      
      if (data?.access_token) {
        localStorage.setItem('access_token', data.access_token)
        if (data.refresh_token) {
          localStorage.setItem('refresh_token', data.refresh_token)
        }
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user))
        }
        Toast.show({ content: '登录成功', icon: 'success' })
        navigate('/m')
      } else if (data?.message) {
        Toast.show({ content: data.message, icon: 'fail' })
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || '登录失败'
      Toast.show({ content: msg, icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!regUsername || !regPassword || !regRealName || !regPhone) {
      Toast.show({ content: '请填写完整信息', icon: 'fail' })
      return
    }
    if (regPassword !== regConfirmPassword) {
      Toast.show({ content: '两次输入的密码不一致', icon: 'fail' })
      return
    }
    if (!/^1[3-9]\d{9}$/.test(regPhone)) {
      Toast.show({ content: '请输入正确的手机号', icon: 'fail' })
      return
    }
    if (regUsername.length < 3 || regUsername.length > 20) {
      Toast.show({ content: '用户名长度应为3-20个字符', icon: 'fail' })
      return
    }
    if (regPassword.length < 6) {
      Toast.show({ content: '密码至少6个字符', icon: 'fail' })
      return
    }
    if (!agreed) {
      Toast.show({ content: '请先同意服务协议', icon: 'fail' })
      navigate('/m/agreement')
      return
    }
    
    setLoading(true)
    try {
      const res = await authApi.register({
        username: regUsername,
        password: regPassword,
        realName: regRealName,
        phone: regPhone,
        agreedToAgreement: true,
      }) as any
      const data = res?.data || res
      
      if (data?.user || data?.success) {
        Toast.show({ content: data.message || '注册成功，请等待审核', icon: 'success' })
        setActiveTab('login')
        setLoginUsername(regUsername)
        // 清空注册表单
        setRegUsername('')
        setRegPassword('')
        setRegConfirmPassword('')
        setRegRealName('')
        setRegPhone('')
        setRegReferrer('')
        setAgreed(false)
      } else if (data?.message) {
        Toast.show({ content: data.message, icon: 'fail' })
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || '注册失败'
      Toast.show({ content: msg, icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mobile-login">
      {/* 顶部导航 - 仅在注册页显示 */}
      {activeTab === 'register' && (
        <div className="login-header">
          <button 
            className="login-back-btn"
            onClick={() => setActiveTab('login')}
          >
            <BackIcon />
          </button>
          <h1 className="login-header-title">注册</h1>
          <div className="login-header-placeholder" />
        </div>
      )}
      
      {/* 内容区域 */}
      <div className="login-content">
        {/* Logo区域 */}
        <div className="login-logo-section">
          <BinanceLogo />
          <h1 className="login-brand">零钱保</h1>
        </div>

        {/* 登录表单 */}
        {activeTab === 'login' && (
          <div className="login-form">
            {/* 用户名输入框 */}
            <div className="login-input-wrapper">
              <label className="login-input-label">用户名</label>
              <div className="login-input-box">
                <input
                  type="text"
                  placeholder="请输入用户名"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="login-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>
            
            {/* 密码输入框 */}
            <div className="login-input-wrapper">
              <label className="login-input-label">密码</label>
              <div className="login-input-box">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="login-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                />
                <button 
                  className="login-eye-btn"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  type="button"
                >
                  {showLoginPassword ? <EyeOpenIcon /> : <EyeCloseIcon />}
                </button>
              </div>
            </div>

            {/* 登录按钮 */}
            <button 
              className="login-submit-btn"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? '登录中...' : '登录'}
            </button>
            
            {/* 底部链接 */}
            <div className="login-footer-link">
              <span>还没有账号？</span>
              <button 
                className="login-link-btn"
                onClick={() => navigate('/m/agreement')}
              >
                立即注册
              </button>
            </div>
          </div>
        )}

        {/* 注册表单 */}
        {activeTab === 'register' && (
          <div className="login-form">
            {/* 用户名输入框 */}
            <div className="login-input-wrapper">
              <label className="login-input-label">用户名</label>
              <div className="login-input-box">
                <input
                  type="text"
                  placeholder="3-20个字符"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="login-input"
                />
              </div>
            </div>
            
            {/* 密码输入框 */}
            <div className="login-input-wrapper">
              <label className="login-input-label">密码</label>
              <div className="login-input-box">
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  placeholder="至少6个字符"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="login-input"
                />
                <button 
                  className="login-eye-btn"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  type="button"
                >
                  {showRegPassword ? <EyeOpenIcon /> : <EyeCloseIcon />}
                </button>
              </div>
            </div>
            
            {/* 确认密码输入框 */}
            <div className="login-input-wrapper">
              <label className="login-input-label">确认密码</label>
              <div className="login-input-box">
                <input
                  type={showRegConfirmPassword ? 'text' : 'password'}
                  placeholder="再次输入密码"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  className="login-input"
                />
                <button 
                  className="login-eye-btn"
                  onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                  type="button"
                >
                  {showRegConfirmPassword ? <EyeOpenIcon /> : <EyeCloseIcon />}
                </button>
              </div>
            </div>
            
            {/* 真实姓名输入框 */}
            <div className="login-input-wrapper">
              <label className="login-input-label">真实姓名</label>
              <div className="login-input-box">
                <input
                  type="text"
                  placeholder="请输入真实姓名"
                  value={regRealName}
                  onChange={(e) => setRegRealName(e.target.value)}
                  className="login-input"
                />
              </div>
            </div>
            
            {/* 手机号输入框 */}
            <div className="login-input-wrapper">
              <label className="login-input-label">手机号</label>
              <div className="login-input-box">
                <input
                  type="tel"
                  placeholder="请输入手机号"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="login-input"
                />
              </div>
            </div>
            
            {/* 推荐人ID输入框 */}
            <div className="login-input-wrapper">
              <label className="login-input-label">推荐人ID <span className="login-optional">（选填）</span></label>
              <div className="login-input-box">
                <input
                  type="text"
                  placeholder="可不填"
                  value={regReferrer}
                  onChange={(e) => setRegReferrer(e.target.value)}
                  className="login-input"
                />
              </div>
            </div>
            
            {/* 注册按钮 */}
            <button
              className="login-submit-btn"
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? '注册中...' : '注册'}
            </button>
            
            {/* 底部链接 */}
            <div className="login-footer-link">
              <span>已有账号？</span>
              <button 
                className="login-link-btn"
                onClick={() => setActiveTab('login')}
              >
                登录
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Login
