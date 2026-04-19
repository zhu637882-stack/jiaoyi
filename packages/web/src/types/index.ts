// 通用类型定义

// 用户类型
export interface User {
  id: number
  username: string
  role: 'admin' | 'investor'
  status: 'active' | 'inactive'
  createdAt: string
}

// 药品类型
export interface Drug {
  id: number
  name: string
  code: string
  spec?: string
  purchasePrice: number
  sellingPrice: number
  totalQuantity: number
  subscribedQuantity: number
  remainingQuantity: number
  operationFeeRate: number
  slowSellingDays: number
  status: 'pending' | 'funding' | 'selling' | 'completed' | 'active' | 'inactive'
  createdAt: string
  updatedAt: string
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

// 认购订单类型
export interface SubscriptionOrder {
  id: number
  orderNo: string
  userId: number
  drugId: number
  quantity: number
  amount: number
  settledQuantity: number
  unsettledAmount: number
  status: 'confirmed' | 'effective' | 'partial_returned' | 'returned' | 'cancelled' | 'slow_selling_refund'
  confirmedAt: string
  effectiveAt: string
  slowSellingDeadline: string
  returnedAt?: string
  totalProfit: number
  totalLoss: number
  queuePosition: number
  drug?: Drug
  user?: User
  createdAt: string
  updatedAt: string
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

// 资金记录交易类型
export type TransactionType = 
  | 'RECHARGE' 
  | 'WITHDRAW' 
  | 'SUBSCRIPTION' 
  | 'PRINCIPAL_RETURN' 
  | 'PROFIT_SHARE' 
  | 'LOSS_SHARE' 
  | 'SLOW_SELL_REFUND'

// 资金记录类型
export interface Transaction {
  id: number
  type: TransactionType
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  createdAt: string
}

// 清算记录类型
export interface Settlement {
  id: string
  settlementNo: string
  date: string
  drugId: string
  drugName: string
  amount: number
  operationFees: number
  returnedPrincipal: number
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
