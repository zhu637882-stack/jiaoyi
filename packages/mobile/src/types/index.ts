// 用户类型
export interface User {
  id: number
  username: string
  realName?: string
  phone?: string
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
  actualSellingPrice?: number
  actualPriceUpdatedAt?: string
  totalQuantity: number
  subscribedQuantity: number
  remainingQuantity: number
  operationFeeRate: number
  slowSellingDays: number
  batchNo?: string
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

// 市场总览条目类型
export interface MarketOverviewItem {
  drugId?: string | number
  drugName?: string
  id?: string | number
  name?: string
  code?: string
  purchasePrice: number
  sellingPrice: number
  actualSellingPrice?: number
  dailySalesQuantity?: number
  dailySalesRevenue?: number
  averageSellingPrice?: number
  dailyReturn: number
  dailyReturnRate?: number
  cumulativeReturn?: number
  cumulativeReturnRate?: number
  remainingQuantity: number
  totalQuantity: number
  subscribedQuantity: number
  fundingHeat?: number
  change?: number
  changePercent?: number
  status?: string
  operationFeeRate?: number
  slowSellingDays?: number
  batchNo?: string
  actualPriceUpdatedAt?: string
}

// 市场统计类型
export interface MarketStats {
  totalDrugs?: number
  activeDrugs?: number
  totalSubscribed?: number
  totalRevenue?: number
  todayRevenue?: number
  todaySales?: number
  [key: string]: unknown
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
  type: TransactionType | string
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
export interface ApiResponse<T = unknown> {
  code?: number
  success?: boolean
  message?: string
  data: T
}

// 分页响应类型
export interface PaginatedResponse<T = unknown> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  pagination?: PaginationData
}

// WebSocket 消息类型
export interface WebSocketMessage<T = unknown> {
  type: 'market' | 'trade' | 'system'
  data: T
  timestamp: string
}

// 登录响应类型
export interface LoginResponse {
  access_token: string
  refresh_token?: string
  user: User
}

// 账户余额类型
export interface BalanceData {
  availableBalance: number
  frozenBalance: number
  frozenAmount?: number
  balance: number
  totalProfit: number
  totalInvested: number
}

// 出金订单类型
export interface WithdrawOrder {
  id: string
  orderNo: string
  amount: number
  balanceBefore: number
  status: 'pending' | 'approved' | 'rejected'
  bankInfo: string
  description: string
  rejectReason: string
  createdAt: string
  approvedAt: string
}

// 认购摘要类型
export interface SubscriptionSummary {
  totalOrderCount: number
  totalQuantity: number
  totalAmount: number
  totalSettledQuantity: number
  totalProfit: number
  totalLoss: number
  activeOrderCount: number
  activeAmount: number
  totalUnsettledAmount: number
  totalConfirmedAmount: number
  totalEffectiveAmount: number
}

// K线数据点类型
export interface KLineDataPoint {
  time: number | string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// WebSocket 市场更新数据类型
export interface WsMarketUpdateData {
  drugId?: string | number
  price?: number
  change?: number
  changePercent?: number
  volume?: number
}

// WebSocket ticker 数据项类型
export interface WsTickerItem {
  drugId?: string | number
  price?: number
  change?: number
  changePercent?: number
}

// 药品列表项类型（Home/TradeList页面使用）
export interface DrugItem {
  id: string | number
  name: string
  code: string
  purchasePrice: number
  sellingPrice: number
  change: number
  changePercent: number
  status: string
  remainingQuantity: number
  totalQuantity: number
  subscribedQuantity?: number
  fundingHeat?: number
  dailyReturn: number
  cumulativeReturn?: number
  actualSellingPrice?: number
  actualPriceUpdatedAt?: string
  operationFeeRate?: number
  slowSellingDays?: number
  batchNo?: string
}

// 认购列表项类型（Portfolio页面使用）
export interface SubItem {
  id: string | number
  orderNo: string
  drugId: string | number
  drugName?: string
  drug?: { id?: string | number; name?: string }
  quantity: number
  amount: number
  unsettledAmount: number
  settledQuantity: number
  status: string
  confirmedAt: string
  effectiveAt: string
  slowSellingDeadline?: string
  totalProfit: number
  totalLoss: number
  createdAt: string
  auditStatus?: string
  [key: string]: unknown
}

// 资产变化数据点类型
export interface AssetChangePoint {
  date: string
  value: number
}

// 分页类型定义
export interface PaginationData {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

// 系统消息类型
export interface SystemMessage {
  id: string
  title: string
  content: string
  type: 'announcement' | 'notification' | 'maintenance'
  status: 'draft' | 'published' | 'archived'
  publishedBy?: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

// 邀请记录类型
export interface InvitationRecord {
  id: string | number
  inviterId?: string | number
  inviteeId?: string | number
  inviteeUsername?: string
  reward?: number
  status?: string
  createdAt?: string
  [key: string]: unknown
}
