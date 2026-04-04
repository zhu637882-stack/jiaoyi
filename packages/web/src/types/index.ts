// 通用类型定义

// 用户类型
export interface User {
  id: string
  username: string
  role: 'admin' | 'trader' | 'viewer'
  status: 'active' | 'inactive'
  createdAt: string
}

// 药品类型
export interface Drug {
  id: string
  name: string
  spec: string
  basePrice: number
  currentPrice: number
  change: number
  changePercent: number
  stock: number
  status: 'active' | 'inactive'
}

// 行情数据类型
export interface MarketData {
  drugId: string
  drugName: string
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: string
}

// 交易订单类型
export interface TradeOrder {
  id: string
  drugId: string
  drugName: string
  type: 'buy' | 'sell'
  quantity: number
  price: number
  fundingRatio: number
  fundingAmount: number
  status: 'pending' | 'completed' | 'cancelled'
  createdAt: string
}

// 持仓类型
export interface Position {
  id: string
  drugId: string
  drugName: string
  quantity: number
  costPrice: number
  currentPrice: number
  profit: number
  profitRate: number
  status: 'holding' | 'closed'
}

// 清算记录类型
export interface Settlement {
  id: string
  settlementNo: string
  date: string
  drugId: string
  drugName: string
  amount: number
  fundingAmount: number
  profit: number
  status: 'completed' | 'processing' | 'pending'
}

// API 响应类型
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

// 分页响应类型
export interface PaginatedResponse<T = any> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// WebSocket 消息类型
export interface WebSocketMessage {
  type: 'market' | 'trade' | 'system'
  data: any
  timestamp: string
}

// 登录响应类型
export interface LoginResponse {
  access_token: string
  refresh_token?: string
  user: User
}
