// 通用类型定义

// 用户类型
export interface User {
  id: number
  username: string
  realName?: string
  phone?: string
  role: 'user' | 'viewer' | 'manager' | 'admin'
  status: 'active' | 'inactive' | 'pending' | 'approved' | 'rejected'
  reviewRemark?: string
  reviewedAt?: string
  agreedToAgreement?: boolean
  agreedAt?: string
  createdAt: string
  updatedAt?: string
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
  fundedQuantity?: number
  subscribedQuantity: number
  remainingQuantity: number
  operationFeeRate: number
  batchNo?: string
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

// 市场总览条目类型
export interface MarketOverviewItem {
  drugId: string
  drugName: string
  drugCode: string
  purchasePrice: number
  sellingPrice: number
  actualSellingPrice?: number
  dailySalesQuantity: number
  dailySalesRevenue: number
  averageSellingPrice: number
  dailyReturn: number
  dailyReturnRate: number
  cumulativeReturn?: number
  cumulativeReturnRate?: number
  remainingQuantity: number
  totalQuantity: number
  subscribedQuantity: number
  fundingHeat?: number
  change?: number
  changePercent?: number
  status?: string
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

// 账户余额类型
export interface BalanceData {
  availableBalance: number
  frozenBalance: number
  frozenAmount?: number
  balance: number
  totalProfit: number
  totalInvested: number
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

// 审计日志类型
export interface AuditLog {
  id: string | number
  action: string
  detail?: string
  operator?: string
  targetUserId?: string
  createdAt: string
  [key: string]: unknown
}

// 通知类型定义
export interface NotificationItem {
  id: string
  type: 'confirmed' | 'effective' | 'returned' | 'slow-sell-refund' | 'cancelled'
  title: string
  content: string
  timestamp: string
  read: boolean
  data?: Record<string, unknown>
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

// 分页类型定义
export interface PaginationData {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  code?: number
  success: boolean
  message?: string
  data: T
}

// 分页响应类型
export interface PaginatedResponse<T = unknown> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages?: number
  pagination?: PaginationData
}

// 登录响应类型
export interface LoginResponse {
  access_token: string
  refresh_token?: string
  user: User
}

// WebSocket 消息类型
export interface WebSocketMessage<T = unknown> {
  type: 'market' | 'trade' | 'system'
  data: T
  timestamp: string
}

// 药品创建/编辑表单类型
export interface DrugFormData {
  name: string
  code: string
  purchasePrice: number
  sellingPrice: number
  totalQuantity: number
  batchNo: string
  operationFeeRate: number
  slowSellingDays: number
  actualSellingPrice?: number
}

// 销售记录类型
export interface SalesRecord {
  id: string
  drugId: string
  drugName: string
  drugCode: string
  saleDate: string
  quantity: number
  actualSellingPrice: number
  totalRevenue: number
  terminal: string
  createdAt: string
}

// 用户余额类型（管理员视角）
export interface UserBalance {
  userId: string | number
  username: string
  realName?: string
  availableBalance: number
  frozenBalance: number
  totalBalance: number
  totalProfit: number
  totalInvested: number
}

// 账户概览类型
export interface AccountOverview {
  totalBalance: number
  totalAvailable: number
  totalFrozen: number
  totalProfit: number
  totalUsers: number
}

// 待审核订单类型
export interface PendingOrder {
  id: string | number
  orderNo: string
  userId: string | number
  username: string
  drugId: string | number
  drugName: string
  quantity: number
  amount: number
  status: string
  createdAt: string
  [key: string]: unknown
}

// 补贴金待填项类型
export interface PendingSubsidyItem {
  id: string | number
  orderId: string
  drugName: string
  username: string
  yieldDate: string
  dailyYield: number
  subsidy: number
  [key: string]: unknown
}

// 体验金记录类型
export interface TrialBonusRecord {
  id: string | number
  userId: string | number
  username: string
  amount: number
  status: string
  createdAt: string
  [key: string]: unknown
}

// 邀请记录类型
export interface InvitationRecord {
  id: string | number
  inviterId: string | number
  inviteeId: string | number
  inviteeUsername: string
  reward: number
  status: string
  createdAt: string
  [key: string]: unknown
}

// 资产变化数据点类型
export interface AssetChangePoint {
  date: string
  value: number
}
