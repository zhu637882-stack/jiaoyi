import { useEffect, useState, useCallback, useMemo } from 'react'
import { Skeleton, Drawer, message, Tag } from 'antd'
import {
  ShoppingCartOutlined,
  StarOutlined,
  StarFilled,
  BellOutlined,
} from '@ant-design/icons'
import { marketApi, subscriptionApi, accountApi, systemMessageApi } from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { wsService } from '../services/websocket'
import KLineChart, { KLineData } from '../components/KLineChart'
import TickerBar from '../components/TickerBar'
import OrderBook from '../components/OrderBook'
import TradePanel from '../components/TradePanel'
import './Dashboard.css'
import dayjs from 'dayjs'

// 通知类型定义
interface Notification {
  id: string
  type: 'confirmed' | 'effective' | 'returned' | 'slow-sell-refund' | 'cancelled'
  title: string
  content: string
  timestamp: string
  read: boolean
  data?: any
}

// 交易类型映射
const transactionTypeMap: Record<string, { label: string; color: string }> = {
  RECHARGE: { label: '充值', color: '#cf1322' },
  WITHDRAW: { label: '提现', color: '#00b96b' },
  SUBSCRIPTION: { label: '认购冻结', color: '#1890FF' },
  PRINCIPAL_RETURN: { label: '份额退回', color: '#cf1322' },
  PROFIT_SHARE: { label: '收益分成', color: '#cf1322' },
  LOSS_SHARE: { label: '亏损承担', color: '#00b96b' },
  SLOW_SELL_REFUND: { label: '滞销退款', color: '#722ED1' },
  // 兼容旧类型
  recharge: { label: '充值', color: '#cf1322' },
  withdraw: { label: '提现', color: '#00b96b' },
  funding: { label: '认购冻结', color: '#1890FF' },
  principal_return: { label: '份额退回', color: '#cf1322' },
  profit_share: { label: '收益分成', color: '#cf1322' },
  loss_share: { label: '亏损承担', color: '#00b96b' },
  interest: { label: '利息', color: '#F0B90B' },
  sell: { label: '卖出', color: '#cf1322' },
}

// 认购状态映射
const subscriptionStatusMap: Record<string, { label: string; color: string }> = {
  confirmed: { label: '待生效', color: '#1890FF' },
  effective: { label: '认购中', color: '#cf1322' },
  partial_returned: { label: '部分退回', color: '#FAAD14' },
  returned: { label: '已退回', color: '#8B949E' },
  cancelled: { label: '已取消', color: '#00b96b' },
  slow_selling_refund: { label: '滞销退款', color: '#722ED1' },
}

// 资金记录类型定义
interface Transaction {
  id: string
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  createdAt: string
}

// 认购类型定义
interface Subscription {
  id: string
  drugId: string
  drugName: string
  quantity: number
  amount: number
  settledQuantity: number
  unsettledAmount: number
  status: 'confirmed' | 'effective' | 'partial_returned' | 'returned' | 'cancelled' | 'slow_selling_refund'
  confirmedAt: string
  effectiveAt: string
  slowSellingDeadline: string
  totalProfit: number
  totalLoss: number
}

// 系统消息类型定义
interface SystemMessage {
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
interface PaginationData {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

// 类型定义
interface MarketOverviewItem {
  drugId: string
  drugName: string
  drugCode: string
  purchasePrice: number
  sellingPrice: number
  dailySalesQuantity: number
  dailySalesRevenue: number
  averageSellingPrice: number
  dailyReturn: number
  cumulativeReturn: number
  totalFundingAmount: number
  fundingHeat: number
  queueDepth: number
  snapshotDate: string
}

interface MarketStats {
  totalDrugs: number
  totalFundingAmount: number
  totalSalesRevenue: number
  totalSettlementCount: number
  activeFunderCount: number
}

interface DepthData {
  ranges: {
    min: number
    max: number
    label: string
    count: number
    amount: number
  }[]
  totalAmount: number
  totalCount: number
}

// 认购摘要类型
interface SubscriptionSummary {
  totalQuantity: number
  totalSettledQuantity: number
  totalUnsettledAmount: number
  activeSubscriptions: Subscription[]
}

// MT4风格统一交易界面
const Dashboard = () => {

  // 状态管理
  const [marketOverview, setMarketOverview] = useState<MarketOverviewItem[]>([])
  const [, setMarketStats] = useState<MarketStats | null>(null)
  const [kLineData, setKLineData] = useState<KLineData[]>([])
  const [depthData, setDepthData] = useState<DepthData | null>(null)
  const [selectedDrugId, setSelectedDrugId] = useState<string>('')
  const [kLinePeriod, setKLinePeriod] = useState<'15m' | '1h' | '4h' | '1d' | '1w' | '1mo' | '7d' | '30d' | '90d' | 'all'>('1d')

  // 左侧药品面板状态
  const [marketTab, setMarketTab] = useState<'all' | 'favorites' | 'gainers' | 'losers'>('all')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // 底部Tab状态
  const [bottomTab, setBottomTab] = useState<'subscriptions' | 'completed' | 'funds' | 'holdings' | 'messages'>('subscriptions')

  // 通知状态
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)

  // 系统消息状态
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesPagination, setMessagesPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  })
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null)

  // 我的认购状态
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false)
  const [subscriptionsPagination, setSubscriptionsPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  })

  // 已完成认购状态
  const [completedSubscriptions, setCompletedSubscriptions] = useState<Subscription[]>([])
  const [completedLoading, setCompletedLoading] = useState(false)
  const [completedPagination, setCompletedPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  })

  // 资金记录状态
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [transactionsPagination, setTransactionsPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  })

  // 认购份额状态
  const [subscriptionSummary, setSubscriptionSummary] = useState<SubscriptionSummary | null>(null)
  const [holdingsLoading, setHoldingsLoading] = useState(false)

  // 加载状态
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [, setLoadingStats] = useState(true)
  const [loadingKLine, setLoadingKLine] = useState(true)
  const [loadingDepth, setLoadingDepth] = useState(true)

  // 响应式状态
  const [isMobile, setIsMobile] = useState(false)
  const [showTradeDrawer, setShowTradeDrawer] = useState(false)

  // TradePanel 高亮动画状态
  const [tradePanelHighlight, setTradePanelHighlight] = useState(false)

  // 响应式检测
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 获取市场总览
  const fetchMarketOverview = useCallback(async () => {
    try {
      setLoadingOverview(true)
      const res: any = await marketApi.getMarketOverview()
      if (res.success) {
        setMarketOverview(res.data)
        // 默认选择第一个药品
        if (res.data.length > 0 && !selectedDrugId) {
          setSelectedDrugId(res.data[0].drugId)
        }
      }
    } catch (error) {
      console.error('获取市场总览失败:', error)
    } finally {
      setLoadingOverview(false)
    }
  }, [selectedDrugId])

  // 获取平台统计
  const fetchMarketStats = useCallback(async () => {
    try {
      setLoadingStats(true)
      const res: any = await marketApi.getMarketStats()
      if (res.success) {
        setMarketStats(res.data)
      }
    } catch (error) {
      console.error('获取平台统计失败:', error)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  // 获取K线数据
  const fetchKLineData = useCallback(async (drugId: string, period: string) => {
    if (!drugId) return
    try {
      setLoadingKLine(true)
      const res: any = await marketApi.getDrugKLine(drugId, period as any)
      if (res.success) {
        setKLineData(res.data)
      }
    } catch (error) {
      console.error('获取K线数据失败:', error)
    } finally {
      setLoadingKLine(false)
    }
  }, [])

  // 获取深度数据
  const fetchDepthData = useCallback(async (drugId: string) => {
    if (!drugId) return
    try {
      setLoadingDepth(true)
      const res: any = await marketApi.getDrugDepth(drugId)
      if (res.success) {
        setDepthData(res.data)
      }
    } catch (error) {
      console.error('获取深度数据失败:', error)
    } finally {
      setLoadingDepth(false)
    }
  }, [])

  // 从localStorage加载收藏
  useEffect(() => {
    const savedFavorites = localStorage.getItem('drugFavorites')
    if (savedFavorites) {
      try {
        setFavorites(new Set(JSON.parse(savedFavorites)))
      } catch (e) {
        console.error('解析收藏数据失败:', e)
      }
    }
  }, [])

  // 保存收藏到localStorage
  const toggleFavorite = useCallback((drugId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFavorites(prev => {
      const newFavorites = new Set(prev)
      if (newFavorites.has(drugId)) {
        newFavorites.delete(drugId)
      } else {
        newFavorites.add(drugId)
      }
      localStorage.setItem('drugFavorites', JSON.stringify([...newFavorites]))
      return newFavorites
    })
  }, [])

  // 处理排序点击
  const handleSort = useCallback((column: 'name' | 'price' | 'change') => {
    setSortBy(prev => {
      if (prev === column) {
        setSortOrder(order => order === 'asc' ? 'desc' : 'asc')
        return prev
      }
      setSortOrder('asc')
      return column
    })
  }, [])

  // 初始加载
  useEffect(() => {
    fetchMarketOverview()
    fetchMarketStats()
    subscribeTicker()
  }, [])

  // 当选择药品变化时加载数据
  useEffect(() => {
    if (selectedDrugId) {
      fetchKLineData(selectedDrugId, kLinePeriod)
      fetchDepthData(selectedDrugId)
    }
  }, [selectedDrugId, kLinePeriod, fetchKLineData, fetchDepthData])

  // 搜索过滤、Tab过滤和排序
  const filteredDrugs = useMemo(() => {
    let result = marketOverview

    // Tab过滤
    switch (marketTab) {
      case 'favorites':
        result = result.filter(drug => favorites.has(drug.drugId))
        break
      case 'gainers':
        result = [...result].sort((a, b) => (b.dailyReturn || 0) - (a.dailyReturn || 0))
        break
      case 'losers':
        result = [...result].sort((a, b) => (a.dailyReturn || 0) - (b.dailyReturn || 0))
        break
    }

    // 排序
    if (marketTab !== 'gainers' && marketTab !== 'losers') {
      result = [...result].sort((a, b) => {
        let comparison = 0
        switch (sortBy) {
          case 'name':
            comparison = a.drugName.localeCompare(b.drugName)
            break
          case 'price':
            comparison = (a.sellingPrice || 0) - (b.sellingPrice || 0)
            break
          case 'change':
            comparison = (a.dailyReturn || 0) - (b.dailyReturn || 0)
            break
        }
        return sortOrder === 'asc' ? comparison : -comparison
      })
    }

    return result
  }, [marketOverview, marketTab, favorites, sortBy, sortOrder])

  // 当前选中药品
  const selectedDrug = useMemo(() => {
    return marketOverview.find((drug) => drug.drugId === selectedDrugId)
  }, [marketOverview, selectedDrugId])

  // 处理药品点击
  const handleDrugClick = (drugId: string) => {
    setSelectedDrugId(drugId)
    setTradePanelHighlight(true)
    setTimeout(() => setTradePanelHighlight(false), 500)
    if (isMobile) {
      // 移动端自动滚动到主区域
    }
  }

  // 刷新数据回调
  const handleOrderSuccess = useCallback(() => {
    fetchDepthData(selectedDrugId)
  }, [selectedDrugId, fetchDepthData])

  // 获取我的认购列表（活跃状态：confirmed, effective, partial_returned）
  const fetchSubscriptions = useCallback(async () => {
    setSubscriptionsLoading(true)
    try {
      const response: any = await subscriptionApi.getMySubscriptions({
        page: subscriptionsPagination.page,
        limit: subscriptionsPagination.pageSize,
      })
      const activeStatuses = ['confirmed', 'effective', 'partial_returned']
      const list = (response.data?.list || []).filter(
        (item: any) => activeStatuses.includes(item.status)
      )
      setSubscriptions(list)
      setSubscriptionsPagination(response.data?.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 0 })
    } catch (error) {
      console.error('获取我的认购失败:', error)
    } finally {
      setSubscriptionsLoading(false)
    }
  }, [subscriptionsPagination.page, subscriptionsPagination.pageSize])

  // 获取已完成认购列表（已完成状态：returned, slow_selling_refund, cancelled）
  const fetchCompletedSubscriptions = useCallback(async () => {
    setCompletedLoading(true)
    try {
      const response: any = await subscriptionApi.getMySubscriptions({
        page: completedPagination.page,
        limit: completedPagination.pageSize,
      })
      const completedStatuses = ['returned', 'slow_selling_refund', 'cancelled']
      const list = (response.data?.list || []).filter(
        (item: any) => completedStatuses.includes(item.status)
      )
      setCompletedSubscriptions(list)
      setCompletedPagination(response.data?.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 0 })
    } catch (error) {
      console.error('获取已完成认购失败:', error)
    } finally {
      setCompletedLoading(false)
    }
  }, [completedPagination.page, completedPagination.pageSize])

  // 获取资金记录列表
  const fetchTransactions = useCallback(async () => {
    setTransactionsLoading(true)
    try {
      const response: any = await accountApi.getTransactions({
        page: transactionsPagination.page,
        pageSize: transactionsPagination.pageSize,
      })
      setTransactions(response.list || [])
      setTransactionsPagination(response.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 0 })
    } catch (error) {
      console.error('获取资金记录失败:', error)
    } finally {
      setTransactionsLoading(false)
    }
  }, [transactionsPagination.page, transactionsPagination.pageSize])

  // 获取认购份额摘要
  const fetchSubscriptionSummary = useCallback(async () => {
    setHoldingsLoading(true)
    try {
      const response: any = await subscriptionApi.getActiveSubscriptionSummary()
      setSubscriptionSummary(response.data)
    } catch (error) {
      console.error('获取认购份额失败:', error)
    } finally {
      setHoldingsLoading(false)
    }
  }, [])

  // 取消认购
  const handleCancelSubscription = useCallback(async (id: string) => {
    try {
      await subscriptionApi.cancelSubscription(id)
      message.success('取消认购成功')
      fetchSubscriptions()
    } catch (error: any) {
      message.error(error.response?.data?.message || '取消认购失败')
    }
  }, [fetchSubscriptions])

  // 获取系统消息列表
  const fetchSystemMessages = useCallback(async () => {
    setMessagesLoading(true)
    try {
      const response: any = await systemMessageApi.getPublished({
        page: messagesPagination.page,
        pageSize: messagesPagination.pageSize,
      })
      setSystemMessages(response.data?.list || [])
      setMessagesPagination(response.data?.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 0 })
    } catch (error) {
      console.error('获取系统消息失败:', error)
    } finally {
      setMessagesLoading(false)
    }
  }, [messagesPagination.page, messagesPagination.pageSize])

  // Tab切换时加载数据
  useEffect(() => {
    if (bottomTab === 'subscriptions') {
      fetchSubscriptions()
    } else if (bottomTab === 'completed') {
      fetchCompletedSubscriptions()
    } else if (bottomTab === 'funds') {
      fetchTransactions()
    } else if (bottomTab === 'holdings') {
      fetchSubscriptionSummary()
    } else if (bottomTab === 'messages') {
      fetchSystemMessages()
    }
  }, [bottomTab, fetchSubscriptions, fetchCompletedSubscriptions, fetchTransactions, fetchSubscriptionSummary, fetchSystemMessages])

  // 添加通知
  const addNotification = useCallback((type: Notification['type'], data: any) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    let title = ''
    let content = ''
    
    switch (type) {
      case 'confirmed':
        title = '认购已确认'
        content = `认购订单${data.orderNo}已确认，${data.drugName} ${data.quantity}盒，金额 ¥${data.amount}`
        break
      case 'effective':
        title = '认购已生效'
        content = `认购订单${data.orderNo}已生效，${data.drugName} ${data.quantity}盒开始计收益`
        break
      case 'returned':
        title = '份额已退回'
        content = `认购订单${data.orderNo}份额已退回，${data.drugName} ${data.settledQuantity}盒`
        break
      case 'slow-sell-refund':
        title = '滞销退款'
        content = `认购订单${data.orderNo}触发滞销退款，${data.drugName} ${data.quantity}盒`
        break
      case 'cancelled':
        title = '认购已取消'
        content = `认购订单${data.orderNo}已取消`
        break
    }
    
    const newNotification: Notification = {
      id,
      type,
      title,
      content,
      timestamp: data.timestamp || new Date().toISOString(),
      read: false,
      data,
    }
    
    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, 10)
      return updated
    })
    setUnreadCount(prev => prev + 1)
  }, [])

  // 标记通知为已读
  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  // 标记所有通知为已读
  const markAllRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    )
    setUnreadCount(0)
  }, [])

  // 格式化通知时间
  const formatNotificationTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  // 格式化日期
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // 格式化金额
  const formatCurrency = (value: number) => {
    return `¥${Number(value || 0).toFixed(2)}`
  }

  // 计算倒计时天数
  const getCountdownDays = (deadline: string) => {
    if (!deadline) return null
    const days = dayjs(deadline).diff(dayjs(), 'day')
    return days
  }

  // WebSocket 连接 - 放在所有依赖函数之后
  const { subscribeTicker } = useWebSocket({
    onMarketTicker: (data) => {
      if (data?.tickers) {
        setMarketOverview((prev) => {
          return prev.map((item) => {
            const ticker = data.tickers.find((t: any) => t.drugId === item.drugId)
            if (ticker) {
              return {
                ...item,
                sellingPrice: ticker.sellingPrice,
                dailyReturn: ticker.dailyReturn,
                cumulativeReturn: ticker.cumulativeReturn,
                fundingHeat: ticker.fundingHeat,
              }
            }
            return item
          })
        })
      }
    },
    onFundingUpdate: (data) => {
      if (data) {
        // 资金更新时刷新认购列表
        if (bottomTab === 'subscriptions') {
          fetchSubscriptions()
        } else if (bottomTab === 'holdings') {
          fetchSubscriptionSummary()
        }
      }
    },
    onSettlementComplete: (data) => {
      if (data) {
        // 清算完成时刷新认购份额
        if (bottomTab === 'holdings') {
          fetchSubscriptionSummary()
        }
      }
    },
  })

  // WebSocket 认购通知监听
  useEffect(() => {
    const handleConfirmed = (data: any) => {
      console.log('认购确认通知:', data)
      addNotification('confirmed', data)
      if (bottomTab === 'subscriptions') {
        fetchSubscriptions()
      }
    }

    const handleEffective = (data: any) => {
      console.log('认购生效通知:', data)
      addNotification('effective', data)
      if (bottomTab === 'subscriptions') {
        fetchSubscriptions()
      }
    }

    const handleReturned = (data: any) => {
      console.log('份额退回通知:', data)
      addNotification('returned', data)
      if (bottomTab === 'subscriptions' || bottomTab === 'completed') {
        fetchSubscriptions()
        fetchCompletedSubscriptions()
      }
    }

    const handleSlowSellRefund = (data: any) => {
      console.log('滞销退款通知:', data)
      addNotification('slow-sell-refund', data)
      if (bottomTab === 'completed') {
        fetchCompletedSubscriptions()
      }
    }

    // 注册事件监听
    wsService.on('subscription:confirmed', handleConfirmed)
    wsService.on('subscription:effective', handleEffective)
    wsService.on('subscription:returned', handleReturned)
    wsService.on('subscription:slow-sell-refund', handleSlowSellRefund)

    return () => {
      wsService.off('subscription:confirmed', handleConfirmed)
      wsService.off('subscription:effective', handleEffective)
      wsService.off('subscription:returned', handleReturned)
      wsService.off('subscription:slow-sell-refund', handleSlowSellRefund)
    }
  }, [addNotification, bottomTab, fetchSubscriptions, fetchCompletedSubscriptions])

  // 渲染排序表头
  const renderSortHeader = (label: string, column: 'name' | 'price' | 'change') => {
    const isActive = sortBy === column
    return (
      <span
        className={`sort-header ${isActive ? 'active' : ''}`}
        onClick={() => handleSort(column)}
      >
        {label}
        {isActive && (
          <span className="sort-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    )
  }

  return (
    <div className="trading-terminal">
      {/* 主内容区域 - MT4布局 */}
      <div className="terminal-main">
        {/* 左侧药品面板 */}
        <aside className={`drug-panel ${isMobile ? 'mobile' : ''}`}>
          {/* Tab分组 */}
          <div className="market-tabs">
            <button
              className={`market-tab ${marketTab === 'all' ? 'active' : ''}`}
              onClick={() => setMarketTab('all')}
            >
              全部
            </button>
            <button
              className={`market-tab ${marketTab === 'favorites' ? 'active' : ''}`}
              onClick={() => setMarketTab('favorites')}
            >
              自选
            </button>
            <button
              className={`market-tab ${marketTab === 'gainers' ? 'active' : ''}`}
              onClick={() => setMarketTab('gainers')}
            >
              涨幅榜
            </button>
            <button
              className={`market-tab ${marketTab === 'losers' ? 'active' : ''}`}
              onClick={() => setMarketTab('losers')}
            >
              跌幅榜
            </button>
          </div>

          {/* 列表表头 */}
          <div className="drug-list-header">
            <div className="header-col name-col">
              {renderSortHeader('品种', 'name')}
            </div>
            <div className="header-col price-col">
              {renderSortHeader('最新价', 'price')}
            </div>
            <div className="header-col change-col">
              {renderSortHeader('涨跌幅', 'change')}
            </div>
          </div>

          {/* 药品列表 */}
          <div className="drug-list">
            {loadingOverview ? (
              <div className="drug-list-loading">
                <Skeleton active paragraph={{ rows: 8 }} />
              </div>
            ) : filteredDrugs.length === 0 ? (
              <div className="drug-list-empty">
                {marketTab === 'favorites' ? '暂无自选药品' : '暂无匹配药品'}
              </div>
            ) : (
              filteredDrugs.map((drug) => {
                const isSelected = drug.drugId === selectedDrugId
                const isPositive = Number(drug.dailyReturn || 0) >= 0
                const isFavorite = favorites.has(drug.drugId)
                return (
                  <div
                    key={drug.drugId}
                    className={`drug-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleDrugClick(drug.drugId)}
                  >
                    <span
                      className="favorite-star"
                      onClick={(e) => toggleFavorite(drug.drugId, e)}
                    >
                      {isFavorite ? (
                        <StarFilled style={{ color: '#F0B90B' }} />
                      ) : (
                        <StarOutlined style={{ color: '#848E9C' }} />
                      )}
                    </span>
                    <span className="drug-item-name" title={drug.drugName}>{drug.drugName}</span>
                    <span className="drug-item-price">
                      {Number(drug.sellingPrice || 0).toFixed(2)}
                    </span>
                    <span className={`drug-item-change ${isPositive ? 'up' : 'down'}`}>
                      {isPositive ? '+' : ''}
                      {Number(drug.dailyReturn || 0).toFixed(2)}%
                    </span>
                    {isSelected && <span className="drug-item-arrow">›</span>}
                  </div>
                )
              })
            )}
          </div>

          {/* 底部操作区 */}
          <div className="drug-panel-bottom">
            <span className="total-count">共 {filteredDrugs.length} 个品种</span>
          </div>
        </aside>

        {/* 中间主区域 */}
        <main className="terminal-content">
          {/* 行情滚动条和通知铃铛 */}
          <div className="ticker-bar-container">
            <TickerBar data={marketOverview} onItemClick={(drugId) => {
              setSelectedDrugId(drugId)
              setTradePanelHighlight(true)
              setTimeout(() => setTradePanelHighlight(false), 500)
            }} />
            {/* 通知铃铛 */}
            <div className="notification-bell-wrapper">
              <div 
                className="notification-bell" 
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <BellOutlined style={{ fontSize: 18 }} />
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </div>
              {/* 通知下拉列表 */}
              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    <span className="notification-title">通知</span>
                    {unreadCount > 0 && (
                      <span className="notification-mark-all" onClick={markAllRead}>
                        全部已读
                      </span>
                    )}
                  </div>
                  <div className="notification-list">
                    {notifications.length === 0 ? (
                      <div className="notification-empty">暂无通知</div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                          onClick={() => markNotificationRead(notification.id)}
                        >
                          <div className="notification-item-header">
                            <span className="notification-item-title">{notification.title}</span>
                            <span className="notification-item-time">
                              {formatNotificationTime(notification.timestamp)}
                            </span>
                          </div>
                          <div className="notification-item-content">{notification.content}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* 药品信息摘要条 - 币安风格 */}
          {selectedDrug && (
            <div className="drug-summary-bar">
              <div className="summary-left">
                <span className="summary-drug-name">{selectedDrug.drugName}</span>
                <span className="summary-drug-code">{selectedDrug.drugCode}</span>
              </div>
              <div className="summary-stats">
                <div className="stat-item">
                  <span className="stat-label">最新价</span>
                  <span className={`stat-value price ${Number(selectedDrug.dailyReturn || 0) >= 0 ? 'up' : 'down'}`}>
                    {Number(selectedDrug.sellingPrice || 0).toFixed(2)}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">24h涨跌</span>
                  <span className={`stat-value ${Number(selectedDrug.dailyReturn || 0) >= 0 ? 'up' : 'down'}`}>
                    {Number(selectedDrug.dailyReturn || 0) >= 0 ? '+' : ''}
                    {Number(selectedDrug.dailyReturn || 0).toFixed(2)}%
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">24h最高</span>
                  <span className="stat-value">
                    {Number(selectedDrug.sellingPrice || 0).toFixed(2)}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">24h最低</span>
                  <span className="stat-value">
                    {Number(selectedDrug.purchasePrice || 0).toFixed(2)}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">24h成交量</span>
                  <span className="stat-value">
                    {Number(selectedDrug.dailySalesQuantity || 0).toLocaleString()}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">24h成交额</span>
                  <span className="stat-value">
                    ¥{(Number(selectedDrug.dailySalesRevenue || 0) / 10000).toFixed(2)}万
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* K线图表区域 */}
          <div className="chart-area">
            <KLineChart
              data={kLineData}
              loading={loadingKLine}
              period={kLinePeriod}
              onPeriodChange={setKLinePeriod}
              drugName={selectedDrug?.drugName}
            />
          </div>

          {/* 底部区域 - OrderBook + Tab面板 */}
          <div className="bottom-area">
            {/* 左侧：OrderBook */}
            <div className="orderbook-section">
              <OrderBook data={depthData} loading={loadingDepth} />
            </div>

            {/* 右侧：Tab面板 */}
            <div className="bottom-tab-panel">
              {/* Tab栏 */}
              <div className="bottom-tabs">
                <button
                  className={`bottom-tab ${bottomTab === 'subscriptions' ? 'active' : ''}`}
                  onClick={() => setBottomTab('subscriptions')}
                >
                  我的认购
                </button>
                <button
                  className={`bottom-tab ${bottomTab === 'completed' ? 'active' : ''}`}
                  onClick={() => setBottomTab('completed')}
                >
                  已完成
                </button>
                <button
                  className={`bottom-tab ${bottomTab === 'funds' ? 'active' : ''}`}
                  onClick={() => setBottomTab('funds')}
                >
                  资金记录
                </button>
                <button
                  className={`bottom-tab ${bottomTab === 'holdings' ? 'active' : ''}`}
                  onClick={() => setBottomTab('holdings')}
                >
                  认购份额
                </button>
                <button
                  className={`bottom-tab ${bottomTab === 'messages' ? 'active' : ''}`}
                  onClick={() => setBottomTab('messages')}
                >
                  系统消息
                </button>
              </div>

              {/* Tab内容 */}
              <div className="tab-content">
                {/* Tab 1: 我的认购 */}
                {bottomTab === 'subscriptions' && (
                  <div className="tab-table">
                    <div className="table-header subscription-header">
                      <span className="col-time">确认时间</span>
                      <span className="col-drug">药品</span>
                      <span className="col-qty">数量</span>
                      <span className="col-amount">金额</span>
                      <span className="col-status">状态</span>
                      <span className="col-effective">生效时间</span>
                      <span className="col-action">操作</span>
                    </div>
                    {subscriptionsLoading ? (
                      <div className="empty-table">加载中...</div>
                    ) : subscriptions.length === 0 ? (
                      <div className="empty-table">暂无认购记录</div>
                    ) : (
                      <div className="table-body">
                        {subscriptions.map(sub => {
                          const statusConfig = subscriptionStatusMap[sub.status] || { label: sub.status, color: '#8B949E' }
                          return (
                            <div key={sub.id} className="table-row subscription-row">
                              <span className="col-time">{formatDate(sub.confirmedAt)}</span>
                              <span className="col-drug" title={sub.drugName}>{sub.drugName}</span>
                              <span className="col-qty">{sub.quantity}盒</span>
                              <span className="col-amount">{formatCurrency(sub.amount)}</span>
                              <span className="col-status">
                                <Tag style={{ 
                                  background: `${statusConfig.color}20`, 
                                  borderColor: statusConfig.color, 
                                  color: statusConfig.color,
                                  fontSize: 11,
                                  margin: 0
                                }}>
                                  {statusConfig.label}
                                </Tag>
                              </span>
                              <span className="col-effective">
                                {sub.effectiveAt ? formatDate(sub.effectiveAt) : '-'}
                              </span>
                              <span className="col-action">
                                {sub.status === 'confirmed' && (
                                  <button
                                    className="cancel-btn"
                                    onClick={() => handleCancelSubscription(sub.id)}
                                  >
                                    取消
                                  </button>
                                )}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {/* 分页 */}
                    {subscriptionsPagination.totalPages > 1 && (
                      <div className="tab-pagination">
                        <button
                          className="page-btn"
                          disabled={subscriptionsPagination.page <= 1}
                          onClick={() => setSubscriptionsPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        >
                          上一页
                        </button>
                        <span className="page-info">
                          {subscriptionsPagination.page} / {subscriptionsPagination.totalPages}
                        </span>
                        <button
                          className="page-btn"
                          disabled={subscriptionsPagination.page >= subscriptionsPagination.totalPages}
                          onClick={() => setSubscriptionsPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        >
                          下一页
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: 已完成 */}
                {bottomTab === 'completed' && (
                  <div className="tab-table">
                    <div className="table-header subscription-header">
                      <span className="col-time">确认时间</span>
                      <span className="col-drug">药品</span>
                      <span className="col-qty">数量</span>
                      <span className="col-amount">金额</span>
                      <span className="col-status">状态</span>
                      <span className="col-returned">退回时间</span>
                    </div>
                    {completedLoading ? (
                      <div className="empty-table">加载中...</div>
                    ) : completedSubscriptions.length === 0 ? (
                      <div className="empty-table">暂无已完成记录</div>
                    ) : (
                      <div className="table-body">
                        {completedSubscriptions.map(sub => {
                          const statusConfig = subscriptionStatusMap[sub.status] || { label: sub.status, color: '#8B949E' }
                          return (
                            <div key={sub.id} className="table-row subscription-row">
                              <span className="col-time">{formatDate(sub.confirmedAt)}</span>
                              <span className="col-drug" title={sub.drugName}>{sub.drugName}</span>
                              <span className="col-qty">{sub.quantity}盒</span>
                              <span className="col-amount">{formatCurrency(sub.amount)}</span>
                              <span className="col-status">
                                <Tag style={{ 
                                  background: `${statusConfig.color}20`, 
                                  borderColor: statusConfig.color, 
                                  color: statusConfig.color,
                                  fontSize: 11,
                                  margin: 0
                                }}>
                                  {statusConfig.label}
                                </Tag>
                              </span>
                              <span className="col-returned">
                                {sub.slowSellingDeadline ? formatDate(sub.slowSellingDeadline) : '-'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {/* 分页 */}
                    {completedPagination.totalPages > 1 && (
                      <div className="tab-pagination">
                        <button
                          className="page-btn"
                          disabled={completedPagination.page <= 1}
                          onClick={() => setCompletedPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        >
                          上一页
                        </button>
                        <span className="page-info">
                          {completedPagination.page} / {completedPagination.totalPages}
                        </span>
                        <button
                          className="page-btn"
                          disabled={completedPagination.page >= completedPagination.totalPages}
                          onClick={() => setCompletedPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        >
                          下一页
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: 资金记录 */}
                {bottomTab === 'funds' && (
                  <div className="tab-table">
                    <div className="table-header transaction-header">
                      <span className="col-time">时间</span>
                      <span className="col-type">类型</span>
                      <span className="col-amount">金额</span>
                      <span className="col-before">变动前余额</span>
                      <span className="col-after">变动后余额</span>
                      <span className="col-desc">说明</span>
                    </div>
                    {transactionsLoading ? (
                      <div className="empty-table">加载中...</div>
                    ) : transactions.length === 0 ? (
                      <div className="empty-table">暂无资金记录</div>
                    ) : (
                      <div className="table-body">
                        {transactions.map(tx => {
                          const config = transactionTypeMap[tx.type] || { label: tx.type, color: '#8B949E' }
                          const isPositive = ['RECHARGE', 'PRINCIPAL_RETURN', 'PROFIT_SHARE', 'SLOW_SELL_REFUND', 'recharge', 'principal_return', 'profit_share', 'interest'].includes(tx.type)
                          return (
                            <div key={tx.id} className="table-row transaction-row">
                              <span className="col-time">{formatDate(tx.createdAt)}</span>
                              <span className="col-type">
                                <span
                                  className="transaction-type-tag"
                                  style={{ background: `${config.color}20`, color: config.color, border: `1px solid ${config.color}40` }}
                                >
                                  {config.label}
                                </span>
                              </span>
                              <span className={`col-amount ${isPositive ? 'positive' : 'negative'}`}>
                                {isPositive ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                              </span>
                              <span className="col-before">{formatCurrency(tx.balanceBefore)}</span>
                              <span className="col-after">{formatCurrency(tx.balanceAfter)}</span>
                              <span className="col-desc" title={tx.description}>{tx.description}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {/* 分页 */}
                    {transactionsPagination.totalPages > 1 && (
                      <div className="tab-pagination">
                        <button
                          className="page-btn"
                          disabled={transactionsPagination.page <= 1}
                          onClick={() => setTransactionsPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        >
                          上一页
                        </button>
                        <span className="page-info">
                          {transactionsPagination.page} / {transactionsPagination.totalPages}
                        </span>
                        <button
                          className="page-btn"
                          disabled={transactionsPagination.page >= transactionsPagination.totalPages}
                          onClick={() => setTransactionsPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        >
                          下一页
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 4: 认购份额 */}
                {bottomTab === 'holdings' && (
                  <div className="tab-table">
                    {holdingsLoading ? (
                      <div className="empty-table">加载中...</div>
                    ) : !subscriptionSummary ? (
                      <div className="tab-placeholder">
                        <p>暂无认购份额</p>
                      </div>
                    ) : (
                      <>
                        {/* 摘要统计 */}
                        <div className="holdings-summary" style={{ 
                          display: 'flex', 
                          gap: 24, 
                          padding: '12px 16px', 
                          borderBottom: '1px solid #30363D',
                          background: '#0D1117'
                        }}>
                          <div>
                            <span style={{ color: '#8B949E', fontSize: 12 }}>总认购数量</span>
                            <div style={{ color: '#1890FF', fontSize: 18, fontWeight: 600, fontFamily: 'monospace' }}>
                              {subscriptionSummary.totalQuantity || 0} 盒
                            </div>
                          </div>
                          <div>
                            <span style={{ color: '#8B949E', fontSize: 12 }}>已退回数量</span>
                            <div style={{ color: '#cf1322', fontSize: 18, fontWeight: 600, fontFamily: 'monospace' }}>
                              {subscriptionSummary.totalSettledQuantity || 0} 盒
                            </div>
                          </div>
                          <div>
                            <span style={{ color: '#8B949E', fontSize: 12 }}>剩余份额</span>
                            <div style={{ color: '#FAAD14', fontSize: 18, fontWeight: 600, fontFamily: 'monospace' }}>
                              {(subscriptionSummary.totalQuantity || 0) - (subscriptionSummary.totalSettledQuantity || 0)} 盒
                            </div>
                          </div>
                          <div>
                            <span style={{ color: '#8B949E', fontSize: 12 }}>未结清金额</span>
                            <div style={{ color: '#E6EDF3', fontSize: 18, fontWeight: 600, fontFamily: 'monospace' }}>
                              ¥{Number(subscriptionSummary.totalUnsettledAmount || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        {/* 详细列表 */}
                        <div className="table-header holding-header">
                          <span className="col-drug">药品</span>
                          <span className="col-qty">认购数量</span>
                          <span className="col-settled">已退回</span>
                          <span className="col-remaining">剩余份额</span>
                          <span className="col-deadline">滞销截止</span>
                          <span className="col-countdown">倒计时</span>
                        </div>
                        <div className="table-body">
                          {(subscriptionSummary.activeSubscriptions || []).length === 0 ? (
                            <div className="empty-table">暂无有效认购</div>
                          ) : (
                            (subscriptionSummary.activeSubscriptions || []).map((sub: Subscription) => {
                              const countdown = getCountdownDays(sub.slowSellingDeadline)
                              const countdownColor = countdown === null ? '#8B949E' : countdown <= 7 ? '#00b96b' : countdown <= 30 ? '#FAAD14' : '#cf1322'
                              const remaining = sub.quantity - (sub.settledQuantity || 0)
                              const progress = sub.quantity > 0 ? ((sub.settledQuantity || 0) / sub.quantity) * 100 : 0
                              return (
                                <div key={sub.id} className="table-row holding-row">
                                  <span className="col-drug" title={sub.drugName}>{sub.drugName}</span>
                                  <span className="col-qty">{sub.quantity}盒</span>
                                  <span className="col-settled">{sub.settledQuantity || 0}盒</span>
                                  <span className="col-remaining">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span>{remaining}盒</span>
                                      <div style={{ 
                                        width: 60, 
                                        height: 6, 
                                        background: '#21262D', 
                                        borderRadius: 3,
                                        overflow: 'hidden'
                                      }}>
                                        <div style={{
                                          width: `${progress}%`,
                                          height: '100%',
                                          background: '#cf1322',
                                          borderRadius: 3,
                                        }} />
                                      </div>
                                    </div>
                                  </span>
                                  <span className="col-deadline">
                                    {sub.slowSellingDeadline ? dayjs(sub.slowSellingDeadline).format('MM-DD') : '-'}
                                  </span>
                                  <span className="col-countdown" style={{ color: countdownColor }}>
                                    {countdown === null ? '-' : `剩${countdown}天`}
                                  </span>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Tab 5: 系统消息 */}
                {bottomTab === 'messages' && (
                  <div className="system-messages-container">
                    {messagesLoading ? (
                      <div className="empty-table">加载中...</div>
                    ) : systemMessages.length === 0 ? (
                      <div className="empty-table">暂无系统消息</div>
                    ) : (
                      <div className="system-messages-list">
                        {systemMessages.map((msg) => {
                          const isExpanded = expandedMessageId === msg.id
                          const typeConfig = {
                            announcement: { label: '公告', color: '#D4A017' },
                            notification: { label: '通知', color: '#1890FF' },
                            maintenance: { label: '维护', color: '#FA8C16' },
                          }
                          const typeInfo = typeConfig[msg.type] || typeConfig.notification
                          return (
                            <div 
                              key={msg.id} 
                              className={`system-message-item ${isExpanded ? 'expanded' : ''}`}
                              onClick={() => setExpandedMessageId(isExpanded ? null : msg.id)}
                            >
                              <div className="system-message-header">
                                <span 
                                  className="message-type-badge"
                                  style={{ backgroundColor: `${typeInfo.color}20`, color: typeInfo.color, borderColor: `${typeInfo.color}40` }}
                                >
                                  {typeInfo.label}
                                </span>
                                <span className="message-title">{msg.title}</span>
                                <span className="message-time">
                                  {msg.publishedAt ? formatDate(msg.publishedAt) : formatDate(msg.createdAt)}
                                </span>
                              </div>
                              {isExpanded && (
                                <div className="system-message-content">
                                  {msg.content}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {/* 分页 */}
                    {messagesPagination.totalPages > 1 && (
                      <div className="tab-pagination">
                        <button
                          className="page-btn"
                          disabled={messagesPagination.page <= 1}
                          onClick={() => setMessagesPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        >
                          上一页
                        </button>
                        <span className="page-info">
                          {messagesPagination.page} / {messagesPagination.totalPages}
                        </span>
                        <button
                          className="page-btn"
                          disabled={messagesPagination.page >= messagesPagination.totalPages}
                          onClick={() => setMessagesPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        >
                          下一页
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* 右侧交易面板 */}
        <aside className={`trade-panel-container ${tradePanelHighlight ? 'highlight' : ''}`}>
          <TradePanel drug={selectedDrug || null} onOrderSuccess={handleOrderSuccess} />
        </aside>
      </div>

      {/* 响应式浮动交易按钮 */}
      <button
        className="trade-float-btn"
        onClick={() => setShowTradeDrawer(true)}
      >
        <ShoppingCartOutlined /> 交易
      </button>

      {/* 响应式交易抽屉 */}
      <Drawer
        open={showTradeDrawer}
        onClose={() => setShowTradeDrawer(false)}
        placement="right"
        width={320}
        closable={false}
        styles={{
          body: { padding: 0, background: '#161B22' },
          wrapper: { background: 'rgba(0, 0, 0, 0.5)' },
        }}
      >
        <TradePanel drug={selectedDrug || null} onOrderSuccess={handleOrderSuccess} />
      </Drawer>
    </div>
  )
}

export default Dashboard
