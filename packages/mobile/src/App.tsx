import React, { Suspense, useState, useEffect } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import TabBar from './components/TabBar'
import GuideOverlay from './components/GuideOverlay'
import OnboardingGuide from './components/OnboardingGuide'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import logoImg from './assets/logo.png'

const Home = React.lazy(() => import('./pages/Home'))
const Trade = React.lazy(() => import('./pages/Trade'))
const TradeList = React.lazy(() => import('./pages/TradeList'))
const Portfolio = React.lazy(() => import('./pages/Portfolio'))
const Profile = React.lazy(() => import('./pages/Profile'))
const Settlement = React.lazy(() => import('./pages/Settlement'))
const Transactions = React.lazy(() => import('./pages/Transactions'))
const ServiceAgreement = React.lazy(() => import('./pages/ServiceAgreement'))
const Invitation = React.lazy(() => import('./pages/Invitation'))
const HelpCenter = React.lazy(() => import('./pages/HelpCenter'))
const About = React.lazy(() => import('./pages/About'))

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('access_token')
  if (!token) return <Navigate to="/m/login" replace />
  return <>{children}</>
}

const TabLayout = () => {
  const location = useLocation()
  return (
    <div className="mobile-layout">
      <div key={location.pathname} className="mobile-layout-content page-fade"><Outlet /></div>
      <TabBar />
      <GuideOverlay />
      <OnboardingGuide />
    </div>
  )
}

const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--color-bg-primary)', color: 'var(--color-text-secondary)' }}>
    加载中...
  </div>
)

function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-logo">
        <img src={logoImg} alt="零钱宝" className="splash-logo-img" loading="lazy" />
      </div>
      <div className="splash-text">零钱宝</div>
      <div className="splash-subtitle">多客控股旗下药品交易平台</div>
    </div>
  )
}

function App() {
  const location = useLocation()
  const [showSplash, setShowSplash] = useState(true)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => setIsOffline(false)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (showSplash) {
    return <SplashScreen />
  }

  return (
    <ErrorBoundary>
      {isOffline && (
        <div className="offline-banner">当前为离线模式，数据可能不是最新</div>
      )}
      <Suspense fallback={<Loading />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/m/login" element={<Login />} />
          <Route path="/m/agreement" element={<div className="page-slide-up"><ServiceAgreement /></div>} />
          <Route path="/m/invitation" element={<PrivateRoute><div className="page-enter"><Invitation /></div></PrivateRoute>} />
          <Route path="/m/help-center" element={<PrivateRoute><div className="page-enter"><HelpCenter /></div></PrivateRoute>} />
          <Route path="/m/about" element={<PrivateRoute><div className="page-enter"><About /></div></PrivateRoute>} />
          <Route path="/m/trade/:drugId" element={<PrivateRoute><div className="page-enter"><Trade /></div></PrivateRoute>} />
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
