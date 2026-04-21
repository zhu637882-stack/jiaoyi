import React, { Suspense } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import TabBar from './components/TabBar'
import GuideOverlay from './components/GuideOverlay'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'

const Home = React.lazy(() => import('./pages/Home'))
const Trade = React.lazy(() => import('./pages/Trade'))
const TradeList = React.lazy(() => import('./pages/TradeList'))
const Portfolio = React.lazy(() => import('./pages/Portfolio'))
const Profile = React.lazy(() => import('./pages/Profile'))
const Settlement = React.lazy(() => import('./pages/Settlement'))
const Transactions = React.lazy(() => import('./pages/Transactions'))
const ServiceAgreement = React.lazy(() => import('./pages/ServiceAgreement'))

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
      <GuideOverlay />
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
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/m/login" element={<Login />} />
          <Route path="/m/agreement" element={<ServiceAgreement />} />
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
            <Route path="trade" element={<TradeList />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="settlement" element={<Settlement />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/m" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
