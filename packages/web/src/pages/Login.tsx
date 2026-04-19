import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, message, Tabs } from 'antd'
import { UserOutlined, LockOutlined, LoginOutlined, UserAddOutlined } from '@ant-design/icons'
import { authApi } from '../services/api'
import logoPng from '../assets/logo.png'

const { Title, Text } = Typography

// 粒子背景组件
const ParticleBackground = () => {
  useEffect(() => {
    const canvas = document.getElementById('particle-canvas') as HTMLCanvasElement
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      radius: number
      opacity: number
    }> = []

    const particleCount = 50

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.2,
      })
    }

    let animationId: number

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((particle, i) => {
        particle.x += particle.vx
        particle.y += particle.vy

        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1

        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(240, 185, 11, ${particle.opacity})`
        ctx.fill()

        // 连接线
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[j].x - particle.x
          const dy = particles[j].y - particle.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 150) {
            ctx.beginPath()
            ctx.moveTo(particle.x, particle.y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(240, 185, 11, ${0.15 * (1 - distance / 150)}`
            ctx.stroke()
          }
        }
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas
      id="particle-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  )
}

const Login = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('login')
  const [loginForm] = Form.useForm()
  const [registerForm] = Form.useForm()

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const response = await authApi.login(values.username, values.password)
      if (response.access_token) {
        localStorage.setItem('access_token', response.access_token)
        if (response.refresh_token) {
          localStorage.setItem('refresh_token', response.refresh_token)
        }
        localStorage.setItem('user', JSON.stringify(response.user))
        message.success('登录成功')
        navigate('/')
      } else {
        message.error(response.message || '登录失败')
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (values: { 
    username: string; 
    password: string; 
    confirmPassword: string;
    realName?: string;
    phone?: string;
  }) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      await authApi.register({
        username: values.username,
        password: values.password,
        realName: values.realName,
        phone: values.phone,
      })
      message.success('注册成功，请登录')
      setActiveTab('login')
      loginForm.setFieldsValue({ username: values.username })
      registerForm.resetFields()
    } catch (error: any) {
      message.error(error.response?.data?.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  const loginItems = [
    {
      key: 'login',
      label: (
        <span style={{
          color: activeTab === 'login' ? '#F0B90B' : '#848E9C',
          fontWeight: activeTab === 'login' ? 600 : 400,
          transition: 'all 0.3s ease',
        }}>
          <LoginOutlined style={{ marginRight: 8 }} />
          登录
        </span>
      ),
      children: (
        <Form
          form={loginForm}
          name="login"
          onFinish={handleLogin}
          autoComplete="off"
          size="large"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#848E9C' }} />}
              placeholder="用户名"
              style={{
                background: '#181A20',
                borderColor: '#2B3139',
                color: '#EAECEF',
                borderRadius: 8,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#F0B90B'
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(240, 185, 11, 0.2)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#2B3139'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#848E9C' }} />}
              placeholder="密码"
              style={{
                background: '#181A20',
                borderColor: '#2B3139',
                color: '#EAECEF',
                borderRadius: 8,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#F0B90B'
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(240, 185, 11, 0.2)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#2B3139'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{
                width: '100%',
                height: 44,
                fontSize: 16,
                fontWeight: 500,
                background: 'linear-gradient(135deg, #F0B90B 0%, #D4A20A 100%)',
                border: 'none',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(240, 185, 11, 0.3)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(240, 185, 11, 0.5)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(240, 185, 11, 0.3)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'register',
      label: (
        <span style={{
          color: activeTab === 'register' ? '#F0B90B' : '#848E9C',
          fontWeight: activeTab === 'register' ? 600 : 400,
          transition: 'all 0.3s ease',
        }}>
          <UserAddOutlined style={{ marginRight: 8 }} />
          注册
        </span>
      ),
      children: (
        <Form
          form={registerForm}
          name="register"
          onFinish={handleRegister}
          autoComplete="off"
          size="large"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
              { max: 20, message: '用户名最多20个字符' },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#848E9C' }} />}
              placeholder="用户名"
              style={{
                background: '#181A20',
                borderColor: '#2B3139',
                color: '#EAECEF',
                borderRadius: 8,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#F0B90B'
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(240, 185, 11, 0.2)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#2B3139'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#848E9C' }} />}
              placeholder="密码"
              style={{
                background: '#181A20',
                borderColor: '#2B3139',
                color: '#EAECEF',
                borderRadius: 8,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#F0B90B'
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(240, 185, 11, 0.2)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#2B3139'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            rules={[{ required: true, message: '请确认密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#848E9C' }} />}
              placeholder="确认密码"
              style={{
                background: '#181A20',
                borderColor: '#2B3139',
                color: '#EAECEF',
                borderRadius: 8,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#F0B90B'
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(240, 185, 11, 0.2)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#2B3139'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </Form.Item>

          <Form.Item name="realName">
            <Input
              prefix={<UserOutlined style={{ color: '#848E9C' }} />}
              placeholder="真实姓名（选填）"
              style={{
                background: '#181A20',
                borderColor: '#2B3139',
                color: '#EAECEF',
                borderRadius: 8,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#F0B90B'
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(240, 185, 11, 0.2)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#2B3139'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </Form.Item>

          <Form.Item name="phone">
            <Input
              prefix={<UserOutlined style={{ color: '#848E9C' }} />}
              placeholder="手机号（选填）"
              style={{
                background: '#181A20',
                borderColor: '#2B3139',
                color: '#EAECEF',
                borderRadius: 8,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#F0B90B'
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(240, 185, 11, 0.2)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#2B3139'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{
                width: '100%',
                height: 44,
                fontSize: 16,
                fontWeight: 500,
                background: 'linear-gradient(135deg, #F0B90B 0%, #D4A20A 100%)',
                border: 'none',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(240, 185, 11, 0.3)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(240, 185, 11, 0.5)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(240, 185, 11, 0.3)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              注册
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ]

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#181A20',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 背景渐变 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(ellipse at 20% 20%, rgba(240, 185, 11, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(14, 203, 129, 0.05) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(240, 185, 11, 0.03) 0%, transparent 70%)
          `,
        }}
      />

      {/* 粒子背景 */}
      <ParticleBackground />

      {/* 内容区域 */}
      <div style={{ position: 'relative', zIndex: 1, width: '90%', maxWidth: 420, padding: '0 24px' }}>
        {/* Logo 区域 */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img
            src={logoPng}
            alt="零钱保"
            style={{
              height: 64,
              width: 'auto',
              marginBottom: 20,
            }}
          />
          <Title
            level={2}
            style={{
              color: '#EAECEF',
              margin: '0 0 4px',
              fontWeight: 700,
              letterSpacing: 2,
              fontSize: 24,
            }}
          >
            多客数智旗下 · 零钱保
          </Title>
          <Text style={{ color: '#848E9C', fontSize: 14, letterSpacing: 1 }}>
            我出资质你出钱，零钱保理赚零钱
          </Text>
        </div>

        {/* 登录卡片 */}
        <Card
          style={{
            background: 'rgba(30, 35, 41, 0.85)',
            border: '1px solid rgba(43, 49, 57, 0.6)',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
          styles={{ body: { padding: '32px' } }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={loginItems}
            centered
            style={{
              '--ant-tabs-ink-bar-color': 'linear-gradient(90deg, #F0B90B, #D4A20A)',
            } as React.CSSProperties}
          />
        </Card>

        {/* 底部信息 */}
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <Text style={{ color: '#3C4043', fontSize: 12 }}>
          </Text>
        </div>
      </div>
    </div>
  )
}

export default Login
