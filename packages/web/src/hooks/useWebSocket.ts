import { useEffect, useRef, useCallback, useState } from 'react'
import { wsService } from '../services/websocket'

interface UseWebSocketOptions {
  url?: string
  autoConnect?: boolean
  onMarketUpdate?: (data: any) => void
  onMarketSnapshot?: (data: any) => void
  onMarketTicker?: (data: any) => void
  onTradeUpdate?: (data: any) => void
  onFundingUpdate?: (data: any) => void
  onSettlementComplete?: (data: any) => void
  onSystemNotification?: (data: any) => void
}

// 根据环境获取 WebSocket URL
const getDefaultWebSocketUrl = (): string => {
  // 浏览器环境：使用当前页面域名（不要加 /ws，否则 socket.io 会把 /ws 当成 namespace 导致 Invalid namespace 错误）
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    return `${protocol}//${host}`
  }
  // 非浏览器环境：尝试从环境变量获取
  if (import.meta.env?.VITE_API_URL) {
    const apiUrl = import.meta.env.VITE_API_URL as string
    return apiUrl.replace(/^http/, 'ws')
  }
  // 非浏览器环境且无环境变量：不应回退到localhost
  console.warn('WebSocket: 无法确定连接地址，请在环境变量中设置 VITE_API_URL')
  return ''
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    url = getDefaultWebSocketUrl(),
    autoConnect = true,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 用 ref 保存回调，避免 useEffect 因回调引用变化反复触发
  const callbacksRef = useRef(options)
  callbacksRef.current = options

  // 连接 WebSocket（只依赖 url）
  const connect = useCallback(() => {
    wsService.connect(url)
  }, [url])

  // 断开连接
  const disconnect = useCallback(() => {
    wsService.disconnect()
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  // 订阅市场行情
  const subscribeMarket = useCallback((drugId?: string) => {
    wsService.subscribeMarket(drugId)
  }, [])

  // 订阅交易更新
  const subscribeTrades = useCallback((userId?: string) => {
    wsService.subscribeTrades(userId)
  }, [])

  // 订阅行情ticker
  const subscribeTicker = useCallback(() => {
    wsService.subscribeTicker()
  }, [])

  // 取消订阅行情ticker
  const unsubscribeTicker = useCallback(() => {
    wsService.unsubscribeTicker()
  }, [])

  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    // 监听连接状态
    const checkConnection = setInterval(() => {
      setIsConnected(wsService.isConnected())
    }, 1000)

    // 注册事件处理器（使用 ref 中的回调，避免依赖变化导致重注册）
    const cb = callbacksRef.current
    if (cb.onMarketUpdate) {
      wsService.on('market:update', cb.onMarketUpdate)
    }
    if (cb.onMarketSnapshot) {
      wsService.on('market:snapshot', cb.onMarketSnapshot)
    }
    if (cb.onMarketTicker) {
      wsService.on('market:ticker', cb.onMarketTicker)
    }
    if (cb.onTradeUpdate) {
      wsService.on('trade:update', cb.onTradeUpdate)
    }
    if (cb.onFundingUpdate) {
      wsService.on('funding:update', cb.onFundingUpdate)
    }
    if (cb.onSettlementComplete) {
      wsService.on('settlement:complete', cb.onSettlementComplete)
    }
    if (cb.onSystemNotification) {
      wsService.on('system:notification', cb.onSystemNotification)
    }

    return () => {
      clearInterval(checkConnection)
      // 清理时移除回调
      if (cb.onMarketUpdate) wsService.off('market:update', cb.onMarketUpdate)
      if (cb.onMarketSnapshot) wsService.off('market:snapshot', cb.onMarketSnapshot)
      if (cb.onMarketTicker) wsService.off('market:ticker', cb.onMarketTicker)
      if (cb.onTradeUpdate) wsService.off('trade:update', cb.onTradeUpdate)
      if (cb.onFundingUpdate) wsService.off('funding:update', cb.onFundingUpdate)
      if (cb.onSettlementComplete) wsService.off('settlement:complete', cb.onSettlementComplete)
      if (cb.onSystemNotification) wsService.off('system:notification', cb.onSystemNotification)
      disconnect()
    }
    // 只在 autoConnect/connect/disconnect 变化时触发，不再依赖回调函数
  }, [autoConnect, connect, disconnect])

  return {
    isConnected,
    connect,
    disconnect,
    subscribeMarket,
    subscribeTrades,
    subscribeTicker,
    unsubscribeTicker,
  }
}

export default useWebSocket
