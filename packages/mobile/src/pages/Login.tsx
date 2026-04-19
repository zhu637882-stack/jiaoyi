import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Toast } from 'antd-mobile'
import { authApi } from '../services/api'
import logoPng from '../assets/logo.png'
import './Login.css'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!username || !password) {
      Toast.show({ content: '请输入用户名和密码', icon: 'fail' })
      return
    }
    setLoading(true)
    try {
      const res = await authApi.login(username, password) as any
      const data = res?.data || res
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
      }
    } catch (e) {
      console.error('Login error:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mobile-login">
      <div className="login-bg-glow" />
      <div className="login-content">
        <div className="login-logo">
          <div className="login-logo-wrap">
            <img src={logoPng} alt="零钱保" className="login-logo-img" />
          </div>
          <p className="login-subtitle">药品垫资认购平台</p>
        </div>
        <div className="login-form">
          <div className="login-input-group">
            <div className="login-input-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" stroke="#848E9C" strokeWidth="1.8"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#848E9C" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <Input
              placeholder="用户名"
              value={username}
              onChange={setUsername}
              className="login-input"
              style={{ '--color': '#EAECEF', '--placeholder-color': '#5E6673' } as any}
            />
          </div>
          <div className="login-input-group">
            <div className="login-input-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="#848E9C" strokeWidth="1.8"/>
                <path d="M8 11V7a4 4 0 018 0v4" stroke="#848E9C" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <Input
              type="password"
              placeholder="密码"
              value={password}
              onChange={setPassword}
              className="login-input"
              style={{ '--color': '#EAECEF', '--placeholder-color': '#5E6673' } as any}
              onEnterPress={handleLogin}
            />
          </div>
          <Button
            block
            color="primary"
            size="large"
            loading={loading}
            onClick={handleLogin}
            className="login-btn"
            style={{ '--background-color': '#F0B90B', '--border-color': '#F0B90B', borderRadius: 12, marginTop: 28, height: 50, fontSize: 16, fontWeight: 600 } as any}
          >
            登 录
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Login
