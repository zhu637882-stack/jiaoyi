import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Toast, Modal } from 'antd-mobile'
import { authApi } from '../services/api'
import logoPng from '../assets/logo.png'
import './Login.css'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [realName, setRealName] = useState('')
  const [phone, setPhone] = useState('')

  const handleLogin = async () => {
    if (!username || !password) {
      Toast.show({ content: '请输入用户名和密码', icon: 'fail' })
      return
    }
    setLoading(true)
    try {
      const res = await authApi.login(username, password) as any
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
    } catch (e) {
      console.error('Login error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!username || !password || !realName || !phone) {
      Toast.show({ content: '请填写完整信息', icon: 'fail' })
      return
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      Toast.show({ content: '请输入正确的手机号', icon: 'fail' })
      return
    }
    setLoading(true)
    try {
      const res = await authApi.register(username, password, realName, phone) as any
      const data = res?.data || res
      if (data?.user) {
        Toast.show({ content: data.message || '注册成功，请等待审核', icon: 'success' })
        setIsRegister(false)
        // 清空表单
        setUsername('')
        setPassword('')
        setRealName('')
        setPhone('')
      } else if (data?.message) {
        Toast.show({ content: data.message, icon: 'fail' })
      }
    } catch (e: any) {
      console.error('Register error:', e)
      Toast.show({ content: e?.response?.data?.message || '注册失败', icon: 'fail' })
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
              onEnterPress={isRegister ? handleRegister : handleLogin}
            />
          </div>
          {isRegister && (
            <>
              <div className="login-input-group" style={{ marginTop: 16 }}>
                <div className="login-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#848E9C" strokeWidth="1.8" strokeLinecap="round"/>
                    <circle cx="12" cy="7" r="4" stroke="#848E9C" strokeWidth="1.8"/>
                  </svg>
                </div>
                <Input
                  placeholder="真实姓名"
                  value={realName}
                  onChange={setRealName}
                  className="login-input"
                  style={{ '--color': '#EAECEF', '--placeholder-color': '#5E6673' } as any}
                />
              </div>
              <div className="login-input-group" style={{ marginTop: 16 }}>
                <div className="login-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M5 4h4l2 5l-2.5 1.5a11 11 0 005 5l1.5 -2.5l5 2v4a2 2 0 01-2 2a16 16 0 01-15 -15a2 2 0 012-2" stroke="#848E9C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <Input
                  placeholder="手机号"
                  value={phone}
                  onChange={setPhone}
                  className="login-input"
                  style={{ '--color': '#EAECEF', '--placeholder-color': '#5E6673' } as any}
                  type="tel"
                />
              </div>
            </>
          )}
          <Button
            block
            color="primary"
            size="large"
            loading={loading}
            onClick={isRegister ? handleRegister : handleLogin}
            className="login-btn"
            style={{ '--background-color': '#F0B90B', '--border-color': '#F0B90B', borderRadius: 12, marginTop: 28, height: 50, fontSize: 16, fontWeight: 600 } as any}
          >
            {isRegister ? '注 册' : '登 录'}
          </Button>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <a
              onClick={() => {
                setIsRegister(!isRegister)
                // 清空表单
                setUsername('')
                setPassword('')
                setRealName('')
                setPhone('')
              }}
              style={{ color: '#F0B90B', fontSize: 14 }}
            >
              {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
