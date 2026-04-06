import React, { Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import BasicLayout from './layouts/BasicLayout'
import Login from './pages/Login'

// 动态导入页面组件（代码拆分）
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const Market = React.lazy(() => import('./pages/Market'))
const Trade = React.lazy(() => import('./pages/Trade'))
const Portfolio = React.lazy(() => import('./pages/Portfolio'))
const Settlement = React.lazy(() => import('./pages/Settlement'))
const Admin = React.lazy(() => import('./pages/Admin'))

// 获取当前用户角色
const getUserRole = (): string | null => {
  const userStr = localStorage.getItem('user')
  if (userStr) {
    try {
      const user = JSON.parse(userStr)
      return user.role || null
    } catch {
      return null
    }
  }
  return null
}

// 路由守卫组件
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    setIsAuthenticated(!!token)
  }, [location])

  if (isAuthenticated === null) {
    return null // 加载中
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

// 管理员路由守卫组件
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const role = getUserRole()
    setIsAuthenticated(!!token)
    setIsAdmin(role === 'admin')
  }, [location])

  if (isAuthenticated === null) {
    return null // 加载中
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!isAdmin) {
    // 非管理员重定向到首页
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// 加载中 fallback 组件
const PageLoading = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: '#0D1117',
    color: '#E6EDF3'
  }}>
    加载中...
  </div>
)

function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <BasicLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="market" element={<Market />} />
          <Route path="trade/:drugId" element={<Trade />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="settlement" element={<Settlement />} />
          <Route path="admin" element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          } />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
