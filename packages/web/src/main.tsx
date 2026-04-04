import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#F0B90B',
          colorSuccess: '#0ECB81',
          colorError: '#F6465D',
          colorWarning: '#F0B90B',
          colorInfo: '#F0B90B',
          colorTextBase: '#EAECEF',
          colorBgBase: '#181A20',
          colorBorder: '#2B3139',
          borderRadius: 6,
          wireframe: false,
        },
        components: {
          Layout: {
            headerBg: '#1E2329',
            siderBg: '#181A20',
            triggerBg: '#1E2329',
            triggerColor: '#848E9C',
          },
          Menu: {
            darkItemBg: '#181A20',
            darkItemSelectedBg: '#2B3139',
            darkItemColor: '#848E9C',
            darkItemSelectedColor: '#EAECEF',
            darkSubMenuItemBg: '#181A20',
          },
          Card: {
            colorBgContainer: '#1E2329',
            colorBorderSecondary: '#2B3139',
          },
          Table: {
            colorBgContainer: '#1E2329',
            headerBg: '#2B3139',
            borderColor: '#2B3139',
            rowHoverBg: '#2B3139',
          },
          Input: {
            colorBgContainer: '#181A20',
            colorBorder: '#2B3139',
            activeBorderColor: '#F0B90B',
            hoverBorderColor: '#848E9C',
          },
          Select: {
            colorBgContainer: '#181A20',
            colorBorder: '#2B3139',
          },
          Button: {
            colorBgContainer: '#2B3139',
            colorBorder: '#2B3139',
          },
          Modal: {
            contentBg: '#1E2329',
            headerBg: '#1E2329',
            footerBg: '#1E2329',
          },
          Drawer: {
            colorBgElevated: '#1E2329',
          },
        },
      }}
    >
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
)
