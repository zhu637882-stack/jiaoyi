import { io, Socket } from 'socket.io-client'

class WebSocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000
  private listeners: Map<string, Function[]> = new Map()

  connect(url?: string): void {
    if (!url && typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      url = `${protocol}//${host}`
    }
    url = url || 'ws://localhost:3000'
    if (this.socket?.connected) return

    this.socket = io(url, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    })
    this.setupEventHandlers()
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.listeners.clear()
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) return
    this.socket.on('connect', () => {
      this.reconnectAttempts = 0
    })
    this.socket.on('disconnect', () => {})
    this.socket.on('connect_error', () => {
      this.reconnectAttempts++
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.socket?.disconnect()
      }
    })
    this.socket.on('market:update', (data: any) => this.emit('market:update', data))
    this.socket.on('market:snapshot', (data: any) => this.emit('market:snapshot', data))
    this.socket.on('market:ticker', (data: any) => this.emit('market:ticker', data))
    this.socket.on('trade:update', (data: any) => this.emit('trade:update', data))
    this.socket.on('funding:update', (data: any) => this.emit('funding:update', data))
    this.socket.on('subscription:confirmed', (data: any) => this.emit('subscription:confirmed', data))
    this.socket.on('subscription:effective', (data: any) => this.emit('subscription:effective', data))
    this.socket.on('subscription:returned', (data: any) => this.emit('subscription:returned', data))
    this.socket.on('settlement:complete', (data: any) => this.emit('settlement:complete', data))
    this.socket.on('system:notification', (data: any) => this.emit('system:notification', data))
  }

  subscribeMarket(drugId?: string): void {
    this.socket?.emit('subscribe:market', { drugId })
  }

  subscribeTicker(): void {
    this.socket?.emit('subscribe:ticker')
  }

  unsubscribeTicker(): void {
    this.socket?.emit('unsubscribe:ticker')
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) this.listeners.set(event, [])
    this.listeners.get(event)?.push(callback)
  }

  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) callbacks.splice(index, 1)
    }
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(cb => {
        try { cb(data) } catch (e) { console.error('WS callback error:', e) }
      })
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }
}

export const wsService = new WebSocketService()
export default wsService
