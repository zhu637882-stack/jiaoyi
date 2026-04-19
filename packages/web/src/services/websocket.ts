import { io, Socket } from 'socket.io-client'

// WebSocket 服务类
class WebSocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000
  private listeners: Map<string, Function[]> = new Map()

  // 连接 WebSocket
  connect(url?: string): void {
    // 如果没有提供 URL，自动根据当前环境生成
    if (!url && typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      url = `${protocol}//${host}`
    }
    // 确保有默认 URL
    url = url || 'ws://localhost:3000'
    if (this.socket?.connected) {
      console.log('WebSocket already connected')
      return
    }

    this.socket = io(url, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    })

    this.setupEventHandlers()
  }

  // 断开连接
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.listeners.clear()
    }
  }

  // 设置事件处理器
  private setupEventHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('WebSocket connected:', this.socket?.id)
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.reconnectAttempts++
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached')
        this.socket?.disconnect()
      }
    })

    // 订阅确认
    this.socket.on('subscribed', (data) => {
      console.log('Subscribed to channel:', data)
    })

    // 市场行情更新
    this.socket.on('market:update', (data) => {
      this.emit('market:update', data)
    })

    // 行情快照更新
    this.socket.on('market:snapshot', (data) => {
      this.emit('market:snapshot', data)
    })

    // 行情ticker推送
    this.socket.on('market:ticker', (data) => {
      this.emit('market:ticker', data)
    })

    // 交易更新
    this.socket.on('trade:update', (data) => {
      this.emit('trade:update', data)
    })

    // 垫资更新
    this.socket.on('funding:update', (data) => {
      this.emit('funding:update', data)
    })

    // 认购状态更新
    this.socket.on('subscription:confirmed', (data) => {
      this.emit('subscription:confirmed', data)
    })

    this.socket.on('subscription:effective', (data) => {
      this.emit('subscription:effective', data)
    })

    this.socket.on('subscription:returned', (data) => {
      this.emit('subscription:returned', data)
    })

    this.socket.on('subscription:slow-sell-refund', (data) => {
      this.emit('subscription:slow-sell-refund', data)
    })

    // 清算完成通知
    this.socket.on('settlement:complete', (data) => {
      this.emit('settlement:complete', data)
    })

    // 系统通知
    this.socket.on('system:notification', (data) => {
      this.emit('system:notification', data)
    })
  }

  // 订阅市场行情
  subscribeMarket(drugId?: string): void {
    this.socket?.emit('subscribe:market', { drugId })
  }

  // 订阅交易更新
  subscribeTrades(userId?: string): void {
    this.socket?.emit('subscribe:trades', { userId })
  }

  // 订阅行情ticker
  subscribeTicker(): void {
    this.socket?.emit('subscribe:ticker')
  }

  // 取消订阅行情ticker
  unsubscribeTicker(): void {
    this.socket?.emit('unsubscribe:ticker')
  }

  // 添加事件监听器
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)?.push(callback)
  }

  // 移除事件监听器
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  // 触发事件
  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error('Error in event callback:', error)
        }
      })
    }
  }

  // 发送消息
  emitMessage(event: string, data: any): void {
    this.socket?.emit(event, data)
  }

  // 检查连接状态
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  // 获取 socket 实例
  getSocket(): Socket | null {
    return this.socket
  }
}

// 导出单例实例
export const wsService = new WebSocketService()

// 自定义 Hook 使用的辅助函数
export const useWebSocket = () => {
  return {
    connect: (url?: string) => wsService.connect(url),
    disconnect: () => wsService.disconnect(),
    subscribeMarket: (drugId?: string) => wsService.subscribeMarket(drugId),
    subscribeTrades: (userId?: string) => wsService.subscribeTrades(userId),
    on: (event: string, callback: Function) => wsService.on(event, callback),
    off: (event: string, callback: Function) => wsService.off(event, callback),
    isConnected: () => wsService.isConnected(),
  }
}

export default wsService
