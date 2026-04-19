import React, { Suspense } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import TabBar from './components/TabBar'
import Login from './pages/Login'

const Home = React.lazy(() => import('./pages/Home'))
const Trade = React.lazy(() => import('./pages/Trade'))
const Portfolio = React.lazy(() => import('./pages/Portfolio'))
const Profile = React.lazy(() => import('./pages/Profile'))

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('access_token')
  if (!token) return <Navigate to="/m/login" replace />
  return <>{children}</>
}

const TabLayout = () => {
  return (
    <div className="mobile-layout">
      <div className="mobile-layout-content"><Outlet /></div>
      <TabBar />
    </div>
  )
}

const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--color-bg-primary)', color: 'var(--color-text-secondary)' }}>
    加载中...
  </div>
)

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/m/login" element={<Login />} />
        <Route path="/m/trade/:drugId" element={<PrivateRoute><Trade /></PrivateRoute>} />
        <Route
          path="/m"
          element={
            <PrivateRoute>
              <TabLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/m" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
