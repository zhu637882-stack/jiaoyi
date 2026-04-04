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

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    url = 'ws://localhost:3000/ws',
    autoConnect = true,
    onMarketUpdate,
    onMarketSnapshot,
    onMarketTicker,
    onTradeUpdate,
    onFundingUpdate,
    onSettlementComplete,
    onSystemNotification,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 连接 WebSocket
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

    // 注册事件处理器
    if (onMarketUpdate) {
      wsService.on('market:update', onMarketUpdate)
    }
    if (onMarketSnapshot) {
      wsService.on('market:snapshot', onMarketSnapshot)
    }
    if (onMarketTicker) {
      wsService.on('market:ticker', onMarketTicker)
    }
    if (onTradeUpdate) {
      wsService.on('trade:update', onTradeUpdate)
    }
    if (onFundingUpdate) {
      wsService.on('funding:update', onFundingUpdate)
    }
    if (onSettlementComplete) {
      wsService.on('settlement:complete', onSettlementComplete)
    }
    if (onSystemNotification) {
      wsService.on('system:notification', onSystemNotification)
    }

    return () => {
      clearInterval(checkConnection)
      if (onMarketUpdate) {
        wsService.off('market:update', onMarketUpdate)
      }
      if (onMarketSnapshot) {
        wsService.off('market:snapshot', onMarketSnapshot)
      }
      if (onMarketTicker) {
        wsService.off('market:ticker', onMarketTicker)
      }
      if (onTradeUpdate) {
        wsService.off('trade:update', onTradeUpdate)
      }
      if (onFundingUpdate) {
        wsService.off('funding:update', onFundingUpdate)
      }
      if (onSettlementComplete) {
        wsService.off('settlement:complete', onSettlementComplete)
      }
      if (onSystemNotification) {
        wsService.off('system:notification', onSystemNotification)
      }
      disconnect()
    }
  }, [autoConnect, connect, disconnect, onMarketUpdate, onMarketSnapshot, onMarketTicker, onTradeUpdate, onFundingUpdate, onSettlementComplete, onSystemNotification])

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
