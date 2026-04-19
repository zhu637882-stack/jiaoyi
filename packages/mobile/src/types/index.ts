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

// 登录响应类型
export interface LoginResponse {
  access_token: string
  refresh_token?: string
  user: User
}
