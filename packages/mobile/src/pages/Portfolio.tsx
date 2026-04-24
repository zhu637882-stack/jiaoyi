import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PullToRefresh, Tabs, Popup, Toast, Modal, Dialog } from 'antd-mobile'
import { subscriptionApi, accountApi, yieldApi, paymentApi } from '../services/api'
import { isWechatBrowser } from '../utils/browser'
import { ensureWechatOpenId, getStoredOpenId, redirectToWechatAuth } from '../utils/wechat-auth'
import { useCountUp, formatCountUpValue } from '../hooks/useCountUp'
import { createChart, AreaSeries, LineSeries, IChartApi, ISeriesApi, LineStyle } from 'lightweight-charts'
import './Portfolio.css'

// 认购记录类型
interface SubItem {
  id: string
  orderNo: string
  drugId: string
  drugName: string
  drugCode: string
  quantity: number
  amount: number
  unsettledAmount: number
  settledQuantity: number
  status: string
  auditStatus?: string
  totalProfit: number
  totalLoss: number
  confirmedAt: string
  effectiveAt: string
  slowSellingDeadline: string
  createdAt: string
}

// 交易记录类型
interface Transaction {
  id: string
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  createdAt: string
}

// 出金记录类型
interface WithdrawOrderItem {
  id: string
  orderNo: string
  amount: number
  balanceBefore: number
  status: string
  bankInfo: string
  description: string
  rejectReason: string
  createdAt: string
  approvedAt: string
}

// 认购状态映射
const subscriptionStatusMap: Record<string, { label: string; color: string }> = {
  confirmed: { label: '待生效', color: '#1890FF' },
  effective: { label: '认购中', color: '#F6465D' },
  return_pending: { label: '退回审核', color: '#FAAD14' },
  partial_returned: { label: '部分退回', color: '#FAAD14' },
  returned: { label: '已退回', color: '#848E9C' },
  cancelled: { label: '已取消', color: '#0ECB81' },
  slow_selling_refund: { label: '滞销退款', color: '#722ED1' },
  settled: { label: '已结算', color: '#52C41A' },
}

// 获取认购状态显示（优先判断审核状态）
const getSubscriptionStatusDisplay = (sub: SubItem) => {
  if (sub.auditStatus === 'pending') {
    return { label: '待审核', color: '#FAAD14' }
  }
  return subscriptionStatusMap[sub.status] || { label: sub.status, color: '#848E9C' }
}

// 出金状态映射
const withdrawStatusMap: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: '出金中', color: '#F0B90B', bgColor: 'rgba(240, 185, 11, 0.15)' },
  approved: { label: '已出金', color: '#0ECB81', bgColor: 'rgba(14, 203, 129, 0.15)' },
  rejected: { label: '已驳回', color: '#F6465D', bgColor: 'rgba(246, 70, 93, 0.15)' },
}

// 交易类型映射
const transactionTypeMap: Record<string, { label: string; color: string }> = {
  RECHARGE: { label: '充值', color: '#0ECB81' },
  WITHDRAW: { label: '提现', color: '#F6465D' },
  SUBSCRIPTION: { label: '认购冻结', color: '#1890FF' },
  PRINCIPAL_RETURN: { label: '份额退回', color: '#F6465D' },
  PROFIT_SHARE: { label: '收益分成', color: '#F6465D' },
  LOSS_SHARE: { label: '亏损承担', color: '#0ECB81' },
  SLOW_SELL_REFUND: { label: '滞销退款', color: '#722ED1' },
  recharge: { label: '充值', color: '#0ECB81' },
  withdraw: { label: '提现', color: '#F6465D' },
  funding: { label: '认购冻结', color: '#1890FF' },
  principal_return: { label: '份额退回', color: '#F6465D' },
  profit_share: { label: '收益分成', color: '#F6465D' },
  loss_share: { label: '亏损承担', color: '#0ECB81' },
  interest: { label: '利息', color: '#F0B90B' },
  sell: { label: '卖出', color: '#F6465D' },
}

// CountUp数字展示组件
const CountUpValue = ({ target, prefix = '¥', className = '' }: { target: number; prefix?: string; className?: string }) => {
  // 防御性处理：确保 target 是有效数字
  const safeTarget = Number.isFinite(target) ? target : 0
  const animatedValue = useCountUp(safeTarget)
  // 如果动画值无效，回退到目标值
  const displayValue = Number.isFinite(animatedValue) ? animatedValue : safeTarget
  return (
    <span className={className}>
      {prefix}{formatCountUpValue(displayValue)}
    </span>
  )
}

// 资产变化数据点类型
interface AssetChangePoint {
  date: string
  value: number
}

// Lightweight Charts 资产变化图组件
const AssetChangeChart = ({ data, loading }: { data: AssetChangePoint[]; loading: boolean }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)

  useEffect(() => {
    if (!chartContainerRef.current || data.length < 2) return

    // 创建图表
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#1E2329' },
        textColor: '#848E9C',
      },
      grid: {
        vertLines: { color: '#2B2F36' },
        horzLines: { color: '#2B2F36' },
      },
      rightPriceScale: {
        borderColor: '#2B2F36',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: '#2B2F36',
        timeVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        vertLine: {
          color: '#848E9C',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#848E9C',
        },
        horzLine: {
          color: '#848E9C',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#848E9C',
        },
      },
      handleScroll: {
        vertTouchDrag: false,
      },
      handleScale: false,
    })

    chartRef.current = chart

    // 资产变化曲线使用黄色主题
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#F0B90B',
      topColor: 'rgba(240, 185, 11, 0.4)',
      bottomColor: 'rgba(240, 185, 11, 0.05)',
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
    })

    seriesRef.current = areaSeries

    // 格式化数据
    const chartData = data.map((item, index) => ({
      time: index as unknown as string,
      value: Number(item.value || 0),
    }))

    areaSeries.setData(chartData)
    chart.timeScale().fitContent()

    // 响应式处理
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const { width, height } = chartContainerRef.current.getBoundingClientRect()
        chartRef.current.applyOptions({ width, height })
      }
    }

    const resizeObserver = new ResizeObserver(handleResize)
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current)
    }

    return () => {
      resizeObserver.disconnect()
      chart.remove()
    }
  }, [data])

  if (loading) {
    return (
      <div className="yield-chart-loading">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (data.length < 2) {
    return (
      <div className="yield-chart-empty">
        <svg className="empty-icon" viewBox="0 0 64 64" fill="none" style={{ width: 48, height: 48, marginBottom: 12 }}>
          <rect x="8" y="12" width="48" height="40" rx="4" stroke="#848E9C" strokeWidth="2"/>
          <path d="M16 40L24 32L32 36L40 24L48 30" stroke="#848E9C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="16" cy="20" r="3" fill="#848E9C"/>
        </svg>
        <span>暂无资产数据</span>
        <span style={{ fontSize: 12, color: '#5E6673', marginTop: 4 }}>充值或认购后将显示资产变化</span>
      </div>
    )
  }

  return (
    <div ref={chartContainerRef} style={{ width: '100%', height: '100%', minHeight: 200 }} />
  )
}

// 简易SVG资产变化曲线组件（用于概览小图）
const AssetChangeSVG = ({ data }: { data: AssetChangePoint[] }) => {
  const width = 320
  const height = 120
  const padding = { top: 10, right: 10, bottom: 20, left: 50 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const values = data.map((d: AssetChangePoint) => Number(d.value || 0))
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const range = max - min || 1

  const points = values.map((v: number, i: number) => {
    const x = padding.left + (i / Math.max(values.length - 1, 1)) * chartW
    const y = padding.top + chartH - ((v - min) / range) * chartH
    return `${x},${y}`
  }).join(' ')

  const areaPoints = values.map((v: number, i: number) => {
    const x = padding.left + (i / Math.max(values.length - 1, 1)) * chartW
    const y = padding.top + chartH - ((v - min) / range) * chartH
    return `${x},${y}`
  })
  const areaPath = `M${padding.left},${padding.top + chartH} ` +
    areaPoints.map((p: string) => `L${p}`).join(' ') +
    ` L${padding.left + chartW},${padding.top + chartH} Z`

  const yLabels = [max, (max + min) / 2, min]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="yield-svg-chart">
      <defs>
        <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0B90B" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#F0B90B" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#yieldGradient)" />
      <polyline points={points} fill="none" stroke="#F0B90B" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {yLabels.map((v: number, i: number) => {
        const y = padding.top + (i / 2) * chartH
        return (
          <text key={i} x={padding.left - 4} y={y + 4} textAnchor="end" fill="#848E9C" fontSize="9" fontFamily="monospace">
            ¥{Number(v).toFixed(0)}
          </text>
        )
      })}
      {values.length > 0 && (
        <circle
          cx={padding.left + chartW}
          cy={padding.top + chartH - ((values[values.length - 1] - min) / range) * chartH}
          r={3}
          fill="#F0B90B"
        />
      )}
    </svg>
  )
}

// 统计卡片组件
const StatCard = ({ 
  title, 
  value, 
  prefix = '¥', 
  isProfit = false,
  delay = 0 
}: { 
  title: string
  value: number
  prefix?: string
  isProfit?: boolean
  delay?: number
}) => {
  const displayColor = isProfit ? (value >= 0 ? '#F6465D' : '#0ECB81') : '#EAECEF'
  const displayPrefix = isProfit ? (value >= 0 ? '+¥' : '-¥') : prefix
  
  return (
    <div className="portfolio-overview-card" style={{ animationDelay: `${delay}ms` }}>
      <span className="overview-card-title">{title}</span>
      <span className="overview-card-value" style={{ color: displayColor }}>
        <CountUpValue target={Math.abs(value)} prefix={displayPrefix} />
      </span>
    </div>
  )
}

// 错误边界组件
class PortfolioErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Portfolio Error Boundary caught:', error, errorInfo)
  }
  
  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error ? this.state.error.message : '未知错误，请稍后重试'
      return (
        <div style={{ 
          padding: 40, 
          textAlign: 'center', 
          color: '#EAECEF',
          background: '#0B0E11',
          minHeight: '100vh'
        }}>
          <h2 style={{ color: '#F6465D', marginBottom: 16 }}>页面加载出错</h2>
          <p style={{ color: '#848E9C', marginBottom: 24 }}>
            {errorMessage}
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: '#F0B90B',
              border: 'none',
              borderRadius: 8,
              color: '#181A20',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            刷新页面
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const PortfolioContent: React.FC = () => {
  const navigate = useNavigate()
  
  // 账户数据
  const [balance, setBalance] = useState<any>(null)
  const [subscriptionSummary, setSubscriptionSummary] = useState<any>(null)
  
  // Tab状态
  const [activeTab, setActiveTab] = useState('overview')
  
  // 加载状态
  const [loading, setLoading] = useState(true)
  
  // 认购相关
  const [subscriptions, setSubscriptions] = useState<SubItem[]>([])
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | undefined>(undefined)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  
  // 交易流水相关
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionLoading, setTransactionLoading] = useState(false)
  
  // 出金记录相关
  const [withdrawOrders, setWithdrawOrders] = useState<WithdrawOrderItem[]>([])
  const [withdrawOrdersLoading, setWithdrawOrdersLoading] = useState(false)
  
  // 资产变化相关
  const [assetChangeData, setAssetChangeData] = useState<AssetChangePoint[]>([])
  const [assetLoading, setAssetLoading] = useState(false)
  
  // 提现弹窗
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [bankInfo, setBankInfo] = useState('')
  
  // 充值弹窗
  const [showRecharge, setShowRecharge] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [payChannel, setPayChannel] = useState<'wechat'>('wechat')
  const [payLoading, setPayLoading] = useState(false)

  // 退回确认弹窗
  const [showReturnConfirm, setShowReturnConfirm] = useState(false)
  const [returnLoading, setReturnLoading] = useState(false)
  const [selectedSubForReturn, setSelectedSubForReturn] = useState<SubItem | null>(null)

  // 加载基础数据
  const loadData = async () => {
    try {
      const [balanceRes, summaryRes] = await Promise.all([
        accountApi.getBalance() as any,
        subscriptionApi.getActiveSubscriptionSummary() as any,
      ])
      setBalance(balanceRes?.data || balanceRes)
      setSubscriptionSummary(summaryRes?.data || summaryRes)
    } catch (e) {
      console.error('Load portfolio error:', e)
    } finally {
      setLoading(false)
    }
  }

  // 加载认购列表
  const loadSubscriptions = async () => {
    setSubscriptionLoading(true)
    try {
      const params: any = { page: 1, limit: 50 }
      if (subscriptionStatus) {
        if (subscriptionStatus.startsWith('audit:')) {
          params.auditStatus = subscriptionStatus.replace('audit:', '')
        } else {
          params.status = subscriptionStatus
        }
      }
      const res = await subscriptionApi.getMySubscriptions(params) as any
      const listData = res?.data?.list || res?.list || res?.data || []
      setSubscriptions(Array.isArray(listData) ? listData : [])
    } catch (e) {
      console.error('Load subscriptions error:', e)
    } finally {
      setSubscriptionLoading(false)
    }
  }

  // 加载交易流水
  const loadTransactions = async () => {
    setTransactionLoading(true)
    try {
      const res = await accountApi.getTransactions({ page: 1, pageSize: 50 }) as any
      const listData = res?.list || res?.data?.list || []
      setTransactions(Array.isArray(listData) ? listData : [])
    } catch (e) {
      console.error('Load transactions error:', e)
    } finally {
      setTransactionLoading(false)
    }
  }

  // 加载出金记录
  const loadWithdrawOrders = async () => {
    setWithdrawOrdersLoading(true)
    try {
      const res = await accountApi.getMyWithdrawOrders({ page: 1, limit: 50 }) as any
      const data = res?.data?.list || res?.list || res?.data || []
      setWithdrawOrders(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Load withdraw orders error:', e)
    } finally {
      setWithdrawOrdersLoading(false)
    }
  }

  // 加载资产变化数据
  const loadAssetData = async () => {
    setAssetLoading(true)
    try {
      // 获取交易记录
      const txRes = await accountApi.getTransactions({ page: 1, pageSize: 100 }) as any
      const transactions = txRes?.list || txRes?.data?.list || []
      
      if (!Array.isArray(transactions) || transactions.length === 0) {
        setAssetChangeData([])
        return
      }

      // 按日期聚合计算资产净值
      const dailyMap = new Map<string, number>()
      
      // 先按时间排序（从早到晚）
      const sortedTx = [...transactions].sort((a: Transaction, b: Transaction) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      
      // 计算每日资产变化
      let runningBalance = 0
      sortedTx.forEach((tx: Transaction) => {
        const date = tx.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0]
        // 根据交易类型计算余额变化
        const amount = Number(tx.amount || 0)
        const type = tx.type?.toUpperCase?.() || tx.type || ''
        
        // 入账类型
        const incomeTypes = ['RECHARGE', 'PRINCIPAL_RETURN', 'PROFIT_SHARE', 'SLOW_SELL_REFUND', 'recharge', 'principal_return', 'profit_share', 'interest']
        // 出账类型
        const expenseTypes = ['WITHDRAW', 'SUBSCRIPTION', 'WITHDRAWAL', 'withdraw', 'funding']
        
        if (incomeTypes.includes(type)) {
          runningBalance += amount
        } else if (expenseTypes.includes(type)) {
          runningBalance -= amount
        }
        
        // 记录该日期的资产净值
        dailyMap.set(date, runningBalance)
      })

      // 转换为图表数据格式
      const chartData: AssetChangePoint[] = []
      const sortedDates = Array.from(dailyMap.keys()).sort()
      
      // 填充所有日期（包括没有交易的日期，使用上一天的值）
      if (sortedDates.length > 0) {
        let lastValue = 0
        const startDate = new Date(sortedDates[0])
        const endDate = new Date()
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0]
          if (dailyMap.has(dateStr)) {
            lastValue = dailyMap.get(dateStr) || 0
          }
          chartData.push({
            date: dateStr,
            value: lastValue
          })
        }
      }
      
      setAssetChangeData(chartData)
    } catch (e) {
      console.error('Load asset data error:', e)
    } finally {
      setAssetLoading(false)
    }
  }

  useEffect(() => {
    // 微信浏览器中从URL提取openId（OAuth回调后被动接收）
    if (isWechatBrowser()) {
      ensureWechatOpenId()
    }

    let isMounted = true
    
    const init = async () => {
      try {
        if (isMounted) await loadData()
        if (isMounted) await loadAssetData()
      } catch (e) {
        console.error('Portfolio init error:', e)
      }
    }
    
    init()
    
    return () => {
      isMounted = false
    }
  }, [])



  // Tab切换时加载对应数据
  useEffect(() => {
    let isMounted = true
    
    const loadTabData = async () => {
      try {
        if (activeTab === 'subscriptions') {
          if (isMounted) await loadSubscriptions()
        } else if (activeTab === 'transactions') {
          if (isMounted) await loadTransactions()
        } else if (activeTab === 'withdrawOrders') {
          if (isMounted) await loadWithdrawOrders()
        } else if (activeTab === 'yieldCurve') {
          if (isMounted) await loadAssetData()
        }
      } catch (e) {
        console.error('Tab data load error:', e)
      }
    }
    
    loadTabData()
    
    return () => {
      isMounted = false
    }
  }, [activeTab, subscriptionStatus])

  // 处理提现
  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount)
    const availableBalance = Number(balance?.availableBalance || balance?.balance || 0)
    
    if (!amount || amount <= 0) {
      Toast.show({ content: '请输入提现金额', icon: 'fail' })
      return
    }
    if (amount > availableBalance) {
      Toast.show({ content: '提现金额不能超过可用余额', icon: 'fail' })
      return
    }
    if (amount < 1) {
      Toast.show({ content: '最小提现金额为1元', icon: 'fail' })
      return
    }
    
    setWithdrawLoading(true)
    try {
      await accountApi.withdraw(amount, '账户提现', undefined, bankInfo || undefined)
      Toast.show({ content: '提现申请已提交，预计T+1到账', icon: 'success' })
      setShowWithdraw(false)
      setWithdrawAmount('')
      setBankInfo('')
      const balanceRes = await accountApi.getBalance() as any
      setBalance(balanceRes?.data || balanceRes)
    } catch (e: any) {
      const errorMsg = e?.response?.data?.message || e?.message || '提现失败，请重试'
      Toast.show({ content: Array.isArray(errorMsg) ? errorMsg.join('; ') : errorMsg, icon: 'fail' })
    } finally {
      setWithdrawLoading(false)
    }
  }

  // 处理充值
  const handleRecharge = async () => {
    const amount = Number(rechargeAmount)
    if (!amount || amount <= 0) {
      Toast.show({ content: '请输入有效金额', icon: 'fail' })
      return
    }
    setPayLoading(true)
    try {
      if (payChannel === 'wechat') {
        if (isWechatBrowser()) {
          // 微信浏览器内 → 检查openId，无则跳转OAuth
          const openId = getStoredOpenId()
          if (!openId) {
            Toast.show({ content: '正在获取微信授权...', icon: 'loading' })
            redirectToWechatAuth()
            return
          }
          // 微信浏览器内 → JSAPI支付
          const res = await paymentApi.createWechatJsapiOrder(amount, openId) as any
          const payData = res?.data || res

          if (payData?.timeStamp && payData?.paySign) {
            // JSAPI支付：调用WeixinJSBridge
            if ((window as any).WeixinJSBridge) {
              ;(window as any).WeixinJSBridge.invoke('getBrandWCPayRequest', {
                appId: payData.appId,
                timeStamp: payData.timeStamp,
                nonceStr: payData.nonceStr,
                package: payData.package,
                signType: payData.signType,
                paySign: payData.paySign,
              }, (res: any) => {
                if (res.err_msg === 'get_brand_wcpay_request:ok') {
                  Dialog.alert({
                    title: '充值成功',
                    content: '资金已即时到账，可在账户中查看可用余额。',
                    confirmText: '我知道了',
                  })
                  loadData()
                }
              })
            }
          } else if (payData?.mwebUrl) {
            // H5支付降级：跳转支付URL
            window.location.href = payData.mwebUrl
          } else if (payData?.codeUrl) {
            // 兜底：二维码
            window.open(payData.codeUrl, '_blank')
          }
        } else {
          // 非微信浏览器 → 保持原有逻辑（NATIVE二维码）
          const res = await paymentApi.createWechatOrder(amount) as any
          const payData = res?.data || res
          if (payData?.qrUrl || payData?.payUrl || payData?.qrCode) {
            const payUrl = payData.qrUrl || payData.payUrl || payData.qrCode
            window.open(payUrl, '_blank')
            Toast.show({ content: '请在新窗口完成支付', icon: 'success' })
          }
        }
      }
      setShowRecharge(false)
      setRechargeAmount('')
    } catch (e) {
      console.error('Recharge error:', e)
    } finally {
      setPayLoading(false)
    }
  }

  // 检查是否满足T+1条件
  const canReturnAfterT1 = (createdAt: string) => {
    const created = new Date(createdAt).getTime()
    const now = new Date().getTime()
    const oneDay = 24 * 60 * 60 * 1000
    return now - created >= oneDay
  }

  // 打开退回确认弹窗
  const openReturnConfirm = (sub: SubItem) => {
    if (!canReturnAfterT1(sub.createdAt)) {
      Toast.show({ content: 'T+1后可退回', icon: 'fail' })
      return
    }
    setSelectedSubForReturn(sub)
    setShowReturnConfirm(true)
  }

  // 关闭退回确认弹窗
  const closeReturnConfirm = () => {
    setShowReturnConfirm(false)
    setSelectedSubForReturn(null)
    setReturnLoading(false)
  }

  // 确认退回认购
  const handleConfirmReturn = async () => {
    if (!selectedSubForReturn) return
    
    setReturnLoading(true)
    try {
      const res: any = await subscriptionApi.requestReturn(selectedSubForReturn.id)
      if (res.success) {
        Toast.show({ content: '退回申请已提交，将在T+1内处理', icon: 'success' })
        closeReturnConfirm()
        loadSubscriptions()
        loadData()
      }
    } catch (e: any) {
      const errMsg = e?.response?.data?.message || '退回申请失败'
      Toast.show({ content: Array.isArray(errMsg) ? errMsg.join('; ') : errMsg, icon: 'fail' })
    } finally {
      setReturnLoading(false)
    }
  }

  // 格式化日期
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  // 格式化日期时间
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  // 计算倒计时天数
  const getCountdownDays = (deadline: string) => {
    if (!deadline) return null
    const end = new Date(deadline)
    const now = new Date()
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  // 判断是否为入账
  const isIncome = (type: string) => {
    return ['RECHARGE', 'PRINCIPAL_RETURN', 'PROFIT_SHARE', 'SLOW_SELL_REFUND', 'recharge', 'principal_return', 'profit_share', 'interest'].includes(type)
  }

  // 渲染账户概览
  const renderAccountOverview = () => (
    <div className="portfolio-account-overview">
      <div className="overview-main-card">
        <div className="overview-main-header">
          <span className="overview-main-label">可用余额</span>
          <div className="overview-actions">
            <button className="btn-recharge" onClick={() => setShowRecharge(true)}>
              <span>+</span> 充值
            </button>
            <button className="btn-withdraw-outline" onClick={() => setShowWithdraw(true)}>
              <span>−</span> 提现
            </button>
          </div>
        </div>
        <div className="overview-main-value">
          <CountUpValue 
            target={Number((balance?.availableBalance ?? balance?.balance) || 0)} 
            prefix="¥"
          />
        </div>
        <div className="overview-sub-stats">
          <div className="sub-stat-item">
            <span className="sub-stat-label">冻结金额</span>
            <span className="sub-stat-value">
              <CountUpValue target={Number((balance?.frozenBalance ?? balance?.frozenAmount) || 0)} />
            </span>
          </div>
          <div className="sub-stat-item">
            <span className="sub-stat-label">累计收益</span>
            <span className={`sub-stat-value ${Number(balance?.totalProfit || 0) >= 0 ? 'profit' : 'loss'}`}>
              <CountUpValue target={Number(balance?.totalProfit || 0)} prefix={Number(balance?.totalProfit || 0) >= 0 ? '+' : ''} />
            </span>
          </div>
          <div className="sub-stat-item">
            <span className="sub-stat-label">累计投资</span>
            <span className="sub-stat-value">
              <CountUpValue target={Number(balance?.totalInvested || 0)} />
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  // 渲染认购概览
  const renderSubscriptionOverview = () => (
    <div className="portfolio-overview-grid">
      <StatCard 
        title="总认购金额" 
        value={subscriptionSummary?.totalAmount || 0} 
        delay={0}
      />
      <StatCard 
        title="未结清金额" 
        value={subscriptionSummary?.totalUnsettledAmount || 0} 
        delay={80}
      />
      <StatCard 
        title="累计净收益" 
        value={(subscriptionSummary?.totalProfit || 0) - (subscriptionSummary?.totalLoss || 0)}
        isProfit
        delay={160}
      />
      <StatCard 
        title="有效认购数" 
        value={subscriptionSummary?.activeOrderCount || 0} 
        prefix=""
        delay={240}
      />
      <div className="portfolio-yield-chart-card" style={{ animationDelay: '320ms' }}>
        <div className="yield-chart-header">
          <span className="yield-chart-title">资产变化</span>
          {assetChangeData.length >= 2 && (
            <span className="yield-chart-total">
              当前 ¥{Number(assetChangeData[assetChangeData.length - 1]?.value || 0).toFixed(2)}
            </span>
          )}
        </div>
        {assetLoading ? (
          <div className="yield-chart-loading">
            <div className="loading-spinner"></div>
          </div>
        ) : assetChangeData.length < 2 ? (
          <div className="yield-chart-empty">数据不足，暂无趋势</div>
        ) : (
          <AssetChangeSVG data={assetChangeData} />
        )}
      </div>
    </div>
  )

  // 渲染认购列表
  const renderSubscriptionList = () => (
    <div className="portfolio-list-content">
      {/* 状态筛选 */}
      <div className="portfolio-filter-bar">
        <select 
          className="portfolio-filter-select"
          value={subscriptionStatus || ''}
          onChange={(e) => setSubscriptionStatus(e.target.value || undefined)}
        >
          <option value="">全部状态</option>
          <option value="audit:pending">待审核</option>
          <option value="confirmed">待生效</option>
          <option value="effective">认购中</option>
          <option value="return_pending">退回审核中</option>
          <option value="partial_returned">部分退回</option>
          <option value="returned">已退回</option>
          <option value="cancelled">已取消</option>
          <option value="slow_selling_refund">滞销退款</option>
          <option value="settled">已结算</option>
        </select>
      </div>

      {subscriptionLoading ? (
        <div className="portfolio-loading">
          <div className="loading-spinner"></div>
          <span>加载中...</span>
        </div>
      ) : (
        <>
          {subscriptions.map((sub, index) => {
            const st = getSubscriptionStatusDisplay(sub)
            const countdownDays = getCountdownDays(sub.slowSellingDeadline)
            return (
              <div 
                className="portfolio-subscription-card" 
                key={sub.id}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="sub-card-header">
                  <span className="sub-drug-name">{sub.drugName}</span>
                  <span className="sub-status" style={{ color: st.color, backgroundColor: `${st.color}15` }}>
                    {st.label}
                  </span>
                </div>
                <div className="sub-card-body">
                  <div className="sub-info-row">
                    <div className="sub-info-item">
                      <span className="info-label">认购数量</span>
                      <span className="info-value">{sub.quantity} 盒</span>
                    </div>
                    <div className="sub-info-item">
                      <span className="info-label">已退回</span>
                      <span className="info-value" style={{ color: '#F6465D' }}>
                        {sub.settledQuantity || 0} 盒
                      </span>
                    </div>
                    <div className="sub-info-item">
                      <span className="info-label">剩余</span>
                      <span className="info-value" style={{ color: '#FAAD14' }}>
                        {sub.quantity - (sub.settledQuantity || 0)} 盒
                      </span>
                    </div>
                  </div>
                  <div className="sub-info-row">
                    <div className="sub-info-item">
                      <span className="info-label">认购金额</span>
                      <span className="info-value">¥{Number(sub.amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="sub-info-item">
                      <span className="info-label">累计收益</span>
                      <span className={`info-value ${(sub.totalProfit - sub.totalLoss) >= 0 ? 'profit' : 'loss'}`}>
                        ¥{Number(sub.totalProfit - sub.totalLoss || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="sub-info-item">
                      <span className="info-label">倒计时</span>
                      <span className="info-value" style={{ 
                        color: countdownDays === null ? '#848E9C' : countdownDays <= 7 ? '#0ECB81' : countdownDays <= 30 ? '#FAAD14' : '#F6465D'
                      }}>
                        {countdownDays === null ? '-' : `剩${countdownDays}天`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="sub-card-footer">
                  <span className="sub-order-no">{sub.orderNo}</span>
                  <span className="sub-date">{formatDate(sub.confirmedAt || sub.createdAt)}</span>
                </div>
                {(sub.status === 'effective' || sub.status === 'partial_returned') && (
                  <button 
                    className={`sub-return-btn ${!canReturnAfterT1(sub.createdAt) ? 'disabled' : ''}`}
                    onClick={() => openReturnConfirm(sub)}
                    disabled={!canReturnAfterT1(sub.createdAt)}
                    title={!canReturnAfterT1(sub.createdAt) ? 'T+1后可退回' : '申请退回'}
                  >
                    {!canReturnAfterT1(sub.createdAt) ? 'T+1后可退回' : '申请退回'}
                  </button>
                )}
              </div>
            )
          })}
          {subscriptions.length === 0 && (
            <div className="portfolio-empty">
              <svg className="empty-icon" viewBox="0 0 64 64" fill="none">
                <rect x="12" y="8" width="40" height="48" rx="4" stroke="#848E9C" strokeWidth="2"/>
                <line x1="20" y1="20" x2="44" y2="20" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
                <line x1="20" y1="28" x2="44" y2="28" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
                <line x1="20" y1="36" x2="36" y2="36" stroke="#848E9C" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>暂无认购记录</span>
            </div>
          )}
        </>
      )}
    </div>
  )

  // 渲染资产变化曲线
  const renderYieldCurve = () => (
    <div className="portfolio-yield-content">
      {/* 资产汇总卡片 */}
      <div className="yield-summary-grid">
        <div className="yield-summary-card">
          <span className="yield-summary-label">当前总资产</span>
          <span className="yield-summary-value" style={{ color: '#F0B90B' }}>
            ¥{Number(assetChangeData[assetChangeData.length - 1]?.value || Number(balance?.availableBalance || balance?.balance || 0)).toFixed(2)}
          </span>
        </div>
        <div className="yield-summary-card">
          <span className="yield-summary-label">初始资产</span>
          <span className="yield-summary-value" style={{ color: '#848E9C' }}>
            ¥{Number(assetChangeData[0]?.value || 0).toFixed(2)}
          </span>
        </div>
        <div className="yield-summary-card">
          <span className="yield-summary-label">资产增长</span>
          <span className="yield-summary-value" style={{ 
            color: (assetChangeData[assetChangeData.length - 1]?.value || 0) >= (assetChangeData[0]?.value || 0) ? '#F6465D' : '#0ECB81' 
          }}>
            ¥{Number((assetChangeData[assetChangeData.length - 1]?.value || 0) - (assetChangeData[0]?.value || 0)).toFixed(2)}
          </span>
        </div>
        <div className="yield-summary-card">
          <span className="yield-summary-label">统计天数</span>
          <span className="yield-summary-value" style={{ color: '#1890FF' }}>
            {assetChangeData.length || 0} 天
          </span>
        </div>
      </div>
      
      {/* 资产变化趋势图 - 使用 lightweight-charts */}
      <div className="portfolio-yield-chart-card large" style={{ minHeight: 320 }}>
        <div className="yield-chart-header">
          <span className="yield-chart-title">资产变化趋势</span>
          {assetChangeData.length >= 2 && (
            <span className="yield-chart-subtitle">
              近{Number(assetChangeData.length || 0)}天资产变化
            </span>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 240 }}>
          <AssetChangeChart data={assetChangeData} loading={assetLoading} />
        </div>
      </div>
    </div>
  )

  // 渲染资金流水（简版预览，完整明细请跳转Transactions页面）
  const renderTransactions = () => (
    <div className="portfolio-list-content">
      {transactionLoading ? (
        <div className="portfolio-loading">
          <div className="loading-spinner"></div>
          <span>加载中...</span>
        </div>
      ) : (
        <>
          {transactions.map((tx, index) => {
            const config = transactionTypeMap[tx.type] || { label: tx.type, color: '#848E9C' }
            const income = isIncome(tx.type)
            return (
              <div
                className="portfolio-transaction-card"
                key={tx.id}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="tx-type-tag" style={{ backgroundColor: `${config.color}15`, color: config.color }}>
                  {config.label}
                </div>
                <div className="tx-info">
                  <span className="tx-desc">{tx.description || '-'}</span>
                  <span className="tx-time">{formatDateTime(tx.createdAt)}</span>
                </div>
                <div className="tx-amount">
                  <span className={`tx-amount-value ${income ? 'income' : 'expense'}`}>
                    {income ? '+' : '-'}¥{Number(Math.abs(tx.amount) || 0).toFixed(2)}
                  </span>
                  <span className="tx-balance">余额: ¥{Number(tx.balanceAfter || 0).toFixed(2)}</span>
                </div>
              </div>
            )
          })}
          {transactions.length === 0 && (
            <div className="portfolio-empty">
              <svg className="empty-icon" viewBox="0 0 64 64" fill="none">
                <rect x="8" y="16" width="48" height="40" rx="4" stroke="#848E9C" strokeWidth="2"/>
                <path d="M8 24L32 38L56 24" stroke="#848E9C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="32" cy="28" r="6" stroke="#848E9C" strokeWidth="2"/>
              </svg>
              <span>暂无交易记录</span>
            </div>
          )}
          {/* 查看完整明细跳转 */}
          <div
            className="portfolio-view-all-link"
            onClick={() => navigate('/transactions')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 0',
              color: '#F0B90B',
              fontSize: 14,
              cursor: 'pointer',
              gap: 4,
            }}
          >
            <span>查看完整明细</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 6l6 6-6 6" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </>
      )}
    </div>
  )

  // 渲染出金记录
  const renderWithdrawOrders = () => (
    <div className="portfolio-list-content">
      {withdrawOrdersLoading ? (
        <div className="portfolio-loading">
          <div className="loading-spinner"></div>
          <span>加载中...</span>
        </div>
      ) : (
        <>
          {withdrawOrders.map((order, index) => {
            const st = withdrawStatusMap[order.status] || { label: order.status, color: '#848E9C', bgColor: 'rgba(132, 142, 156, 0.15)' }
            return (
              <div 
                className="portfolio-withdraw-card" 
                key={order.id}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="withdraw-card-header">
                  <span className="withdraw-title">出金申请</span>
                  <span className="withdraw-status" style={{ color: st.color, backgroundColor: st.bgColor }}>
                    {st.label}
                  </span>
                </div>
                <div className="withdraw-card-body">
                  <div className="withdraw-info-row">
                    <div className="withdraw-info-item">
                      <span className="info-label">出金金额</span>
                      <span className="info-value withdraw-amount">¥{Number(order.amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="withdraw-info-item">
                      <span className="info-label">变动前余额</span>
                      <span className="info-value">¥{Number(order.balanceBefore || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="withdraw-card-footer">
                  <span className="withdraw-order-no">{order.orderNo}</span>
                  <div className="withdraw-dates">
                    <span>申请: {formatDateTime(order.createdAt)}</span>
                    {order.approvedAt && (
                      <span>到账: {formatDateTime(order.approvedAt)}</span>
                    )}
                  </div>
                </div>
                {order.rejectReason && (
                  <div className="withdraw-reject-reason">
                    驳回原因：{order.rejectReason}
                  </div>
                )}
              </div>
            )
          })}
          {withdrawOrders.length === 0 && (
            <div className="portfolio-empty">
              <svg className="empty-icon" viewBox="0 0 64 64" fill="none">
                <rect x="8" y="16" width="48" height="40" rx="4" stroke="#848E9C" strokeWidth="2"/>
                <path d="M8 24L32 38L56 24" stroke="#848E9C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="32" cy="28" r="6" stroke="#848E9C" strokeWidth="2"/>
              </svg>
              <span>暂无出金记录</span>
            </div>
          )}
        </>
      )}
    </div>
  )

  return (
    <div className="mobile-portfolio">
      {/* 页面标题 */}
      <div className="mobile-portfolio-header">
        <h1 className="mobile-portfolio-title">我的账户</h1>
      </div>

      {/* 账户概览 */}
      {renderAccountOverview()}

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        className="portfolio-tabs"
        style={{ 
          '--active-line-color': '#F0B90B', 
          '--active-title-color': '#F0B90B', 
          '--title-color': '#848E9C',
        } as any}
      >
        <Tabs.Tab title="认购概览" key="overview" />
        <Tabs.Tab title="我的认购" key="subscriptions" />
        <Tabs.Tab title="收益曲线" key="yieldCurve" />
        <Tabs.Tab title="资金流水" key="transactions" />
        <Tabs.Tab title="出金记录" key="withdrawOrders" />
      </Tabs>

      {/* Tab内容 */}
      <PullToRefresh onRefresh={async () => {
        await loadData()
        if (activeTab === 'subscriptions') await loadSubscriptions()
        if (activeTab === 'transactions') await loadTransactions()
        if (activeTab === 'withdrawOrders') await loadWithdrawOrders()
        if (activeTab === 'yieldCurve') await loadAssetData()
      }}>
        <div className="mobile-portfolio-content">
          {activeTab === 'overview' && renderSubscriptionOverview()}
          {activeTab === 'subscriptions' && renderSubscriptionList()}
          {activeTab === 'yieldCurve' && renderYieldCurve()}
          {activeTab === 'transactions' && renderTransactions()}
          {activeTab === 'withdrawOrders' && renderWithdrawOrders()}
        </div>
      </PullToRefresh>

      {/* 提现弹窗 */}
      <Popup
        visible={showWithdraw}
        onMaskClick={() => setShowWithdraw(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '45vh', background: 'var(--color-bg-secondary)' }}
      >
        <div className="mobile-withdraw-popup">
          <div className="withdraw-header">
            <span>账户提现</span>
            <span className="withdraw-close" onClick={() => setShowWithdraw(false)}>✕</span>
          </div>
          
          <div className="withdraw-balance-info">
            <span className="withdraw-balance-label">当前可用余额</span>
            <span className="withdraw-balance-value">
              ¥{Number((balance?.availableBalance ?? balance?.balance) || 0).toFixed(2)}
            </span>
          </div>
          
          <div className="withdraw-input-section">
            <label className="withdraw-input-label">提现金额</label>
            <div className="withdraw-input-wrapper">
              <span className="withdraw-currency">¥</span>
              <input
                type="number"
                placeholder="请输入提现金额"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                className="withdraw-input"
                min="1"
                step="0.01"
              />
            </div>
            {withdrawAmount && Number(withdrawAmount) > Number((balance?.availableBalance ?? balance?.balance) || 0) && (
              <span className="withdraw-error">提现金额超过可用余额</span>
            )}
          </div>
          
          <div className="withdraw-input-section">
            <label className="withdraw-input-label">银行卡信息 <span className="withdraw-optional">(选填)</span></label>
            <input
              type="text"
              placeholder="请输入银行卡号或开户行信息"
              value={bankInfo}
              onChange={e => setBankInfo(e.target.value)}
              className="withdraw-bank-input"
            />
          </div>
          
          <div className="withdraw-tips">
            <span className="withdraw-tip-icon">ⓘ</span>
            <span className="withdraw-tip-text">提现申请提交后，管理员将在T+1日确认到账</span>
          </div>
          
          <button
            className="btn-confirm-withdraw"
            disabled={withdrawLoading || !withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > Number((balance?.availableBalance ?? balance?.balance) || 0)}
            onClick={handleWithdraw}
          >
            {withdrawLoading ? '提交中...' : '确认提现'}
          </button>
        </div>
      </Popup>

      {/* 退回确认弹窗 */}
      <Popup
        visible={showReturnConfirm}
        onMaskClick={closeReturnConfirm}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '40vh', background: 'var(--color-bg-secondary)' }}
      >
        <div className="mobile-return-popup">
          <div className="return-header">
            <span>确认退回</span>
            <span className="return-close" onClick={closeReturnConfirm}>✕</span>
          </div>
          
          {selectedSubForReturn && (
            <div className="return-info">
              <div className="return-info-item">
                <span className="return-info-label">药品名称</span>
                <span className="return-info-value">{selectedSubForReturn.drugName}</span>
              </div>
              <div className="return-info-item">
                <span className="return-info-label">认购数量</span>
                <span className="return-info-value">{selectedSubForReturn.quantity} 盒</span>
              </div>
              <div className="return-info-item">
                <span className="return-info-label">退回金额</span>
                <span className="return-info-value amount">¥{Number(selectedSubForReturn.amount || 0).toFixed(2)}</span>
              </div>
            </div>
          )}
          
          <div className="return-tips">
            <span className="return-tip-icon">ⓘ</span>
            <span className="return-tip-text">退回申请将在T+1内处理，资金将直接返还至您的账户余额</span>
          </div>
          
          <div className="return-actions">
            <button
              className="btn-cancel-return"
              onClick={closeReturnConfirm}
              disabled={returnLoading}
            >
              取消
            </button>
            <button
              className="btn-confirm-return"
              onClick={handleConfirmReturn}
              disabled={returnLoading}
            >
              {returnLoading ? '提交中...' : '确认退回'}
            </button>
          </div>
        </div>
      </Popup>

      {/* 充值弹窗 */}
      <Popup
        visible={showRecharge}
        onMaskClick={() => setShowRecharge(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '50vh', background: 'var(--color-bg-secondary)' }}
      >
        <div className="mobile-recharge-popup">
          <div className="recharge-header">
            <span>账户充值</span>
            <span className="recharge-close" onClick={() => setShowRecharge(false)}>✕</span>
          </div>
          
          <div className="recharge-amounts">
            {[100, 500, 1000, 5000].map(amt => (
              <div
                key={amt}
                className={`recharge-amount-btn ${rechargeAmount === String(amt) ? 'active' : ''}`}
                onClick={() => setRechargeAmount(String(amt))}
              >
                ¥{amt}
              </div>
            ))}
          </div>
          
          <div className="recharge-input-section">
            <label className="recharge-input-label">自定义金额</label>
            <div className="recharge-input-wrapper">
              <span className="recharge-currency">¥</span>
              <input
                type="number"
                placeholder="输入充值金额"
                value={rechargeAmount}
                onChange={e => setRechargeAmount(e.target.value)}
                className="recharge-input"
                min="0.01"
                step="0.01"
              />
            </div>
          </div>
          
          <div className="recharge-channels">
            <div
              className={`recharge-channel ${payChannel === 'wechat' ? 'active' : ''}`}
              onClick={() => setPayChannel('wechat')}
            >
              <span className="channel-icon wechat">微</span>
              <span>微信支付</span>
            </div>
          </div>
          
          <button
            className="btn-confirm-recharge"
            disabled={payLoading || !rechargeAmount || Number(rechargeAmount) <= 0}
            onClick={handleRecharge}
          >
            {payLoading ? '处理中...' : '确认充值'}
          </button>
        </div>
      </Popup>
    </div>
  )
}

// 导出带错误边界的组件
const Portfolio: React.FC = () => {
  return (
    <PortfolioErrorBoundary>
      <PortfolioContent />
    </PortfolioErrorBoundary>
  )
}

export default Portfolio
