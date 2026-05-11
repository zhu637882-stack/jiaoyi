import React, { Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import BasicLayout from './layouts/BasicLayout'
import Login from './pages/Login'

// 动态导入页面组件（代码拆分）
// 交易相关页面已从路由中移除，仅保留管理后台
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
    // admin/manager/viewer 都可以访问管理后台
    setIsAdmin(['admin', 'manager', 'viewer'].includes(role || ''))
  }, [location])

  if (isAuthenticated === null) {
    return null // 加载中
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!isAdmin) {
    // 非管理员重定向到登录页
    return <Navigate to="/login" replace />
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
          <Route index element={<Navigate to="/admin" replace />} />
          <Route path="admin" element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          } />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
