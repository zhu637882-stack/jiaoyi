import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '24px',
          color: '#EAECEF',
          textAlign: 'center',
          background: '#0B0E11',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 16, opacity: 0.5 }}>
            <circle cx="12" cy="12" r="10" stroke="#F6465D" strokeWidth="2"/>
            <path d="M12 8v4M12 16h.01" stroke="#F6465D" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#EAECEF' }}>页面加载出错</p>
          <p style={{ fontSize: 13, color: '#848E9C', marginBottom: 16, maxWidth: 280 }}>
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '10px 32px',
              background: '#F0B90B',
              color: '#181A20',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
