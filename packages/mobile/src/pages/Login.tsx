import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Toast, Modal } from 'antd-mobile'
import { authApi } from '../services/api'
import logoImg from '../assets/logo.png'
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
  const [btnState, setBtnState] = useState<'idle' | 'loading' | 'success'>('idle')
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
  const [regReferrer, setRegReferrer] = useState(() => searchParams.get('code') || '')

  // URL参数变化时自动填充邀请码
  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      setRegReferrer(code)
    }
  }, [searchParams])

  const handleLogin = async () => {
    if (!loginUsername || !loginPassword) {
      Toast.show({ content: '请输入用户名和密码', icon: 'fail' })
      return
    }
    setLoading(true)
    setBtnState('loading')
    try {
      const res = await authApi.login(loginUsername, loginPassword) as any
      const data = res?.data || res
      
      // 检查审核状态
      if (data?.status === 'pending') {
        Toast.show({ content: '账号审核中，请耐心等待', icon: 'fail' })
        setLoading(false)
        setBtnState('idle')
        return
      }
      if (data?.status === 'rejected') {
        Modal.alert({
          content: `账号审核未通过${data.remark ? '，原因：' + data.remark : ''}`,
          confirmText: '知道了',
        })
        setLoading(false)
        setBtnState('idle')
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
        setBtnState('success')
        Toast.show({ content: '登录成功', icon: 'success' })
        setTimeout(() => {
          navigate('/m')
        }, 800)
      } else if (data?.message) {
        Toast.show({ content: data.message, icon: 'fail' })
        setBtnState('idle')
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || '登录失败'
      Toast.show({ content: msg, icon: 'fail' })
      setBtnState('idle')
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
        invitationCode: regReferrer || undefined,
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
      {/* 粒子浮动背景 */}
      <div className="login-particles">
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
      </div>
      
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
          <img src={logoImg} alt="零钱保" className="login-logo-img" loading="lazy" />
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
              className={`login-submit-btn ${btnState === 'loading' ? 'is-loading' : ''} ${btnState === 'success' ? 'is-success' : ''}`}
              onClick={handleLogin}
              disabled={loading}
            >
              <span className="btn-text">{loading ? '登录中...' : '登录'}</span>
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
            
            {/* 邀请码输入框 */}
            <div className="login-input-wrapper">
              <label className="login-input-label">邀请码 <span className="login-optional">（选填）</span></label>
              <div className="login-input-box">
                <input
                  type="text"
                  placeholder="请输入6位邀请码"
                  value={regReferrer}
                  onChange={(e) => setRegReferrer(e.target.value)}
                  className="login-input"
                  maxLength={10}
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
