import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import './Portfolio.css'
import {
  Card,
  Table,
  Typography,
  Tag,
  Statistic,
  Row,
  Col,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Pagination,
  Space,
  Select,
  Tabs,
  Empty,
  Radio,
  Spin,
  Progress,
} from 'antd'
import {
  WalletOutlined,
  PlusOutlined,
  MinusOutlined,
  TransactionOutlined,
  DollarOutlined,
  LockOutlined,
  ShoppingOutlined,
  EyeOutlined,
  BarChartOutlined,
  AlipayCircleOutlined,
  WechatOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  LineChartOutlined,
} from '@ant-design/icons'
import { accountApi, subscriptionApi, paymentApi, yieldApi } from '../services/api'
import { QRCodeSVG } from 'qrcode.react'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select

// 格式化金额
const formatCurrency = (value: number) => {
  return `¥${Number(value || 0).toFixed(2)}`
}

// 收益列条件格式化渲染组件
const renderProfitCell = (value: number) => {
  const isPositive = value > 0
  const isNegative = value < 0
  return (
    <span style={{
      color: isPositive ? '#00b96b' : isNegative ? '#cf1322' : '#848E9C',
      background: isPositive ? 'rgba(0,185,107,0.1)' : isNegative ? 'rgba(207,19,34,0.1)' : 'transparent',
      padding: '2px 8px',
      borderRadius: '4px',
      fontWeight: 500,
      fontFamily: "'JetBrains Mono', 'DIN', monospace",
    }}>
      {isPositive ? '+' : ''}{formatCurrency(value)}
    </span>
  )
}

// Sparkline 组件
const Sparkline = ({ data, color = '#F0B90B', width = 60, height = 30 }: { data: number[], color?: string, width?: number, height?: number }) => {
  if (!data || data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} style={{ marginLeft: 'auto', opacity: 0.6 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

// CountUp Hook
const useCountUp = (target: number, duration = 800) => {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    if (target === 0) { setCurrent(0); return }
    const startTime = Date.now()
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(target * eased)
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [target, duration])
  return current
}

// 统计卡片组件（带 CountUp 和 Sparkline）
const StatCard = ({ 
  title, 
  value, 
  icon, 
  color, 
  prefix = '¥', 
  sparklineData, 
  isProfit = false 
}: { 
  title: string
  value: number
  icon: React.ReactNode
  color: string
  prefix?: string
  sparklineData?: number[]
  isProfit?: boolean
}) => {
  const displayValue = useCountUp(value)
  const displayColor = isProfit ? (value >= 0 ? '#00b96b' : '#cf1322') : color
  const displayPrefix = isProfit ? (value >= 0 ? '+¥' : '¥') : prefix
  
  return (
    <Card
      className="portfolio-stat-card"
      bodyStyle={{ padding: 16 }}
      hoverable
    >
      <div style={{ position: 'relative' }}>
        <Statistic
          title={
            <Space>
              {icon}
              <Text style={{ color: '#848E9C', fontSize: 13 }}>{title}</Text>
            </Space>
          }
          value={displayValue}
          precision={2}
          valueStyle={{
            color: displayColor,
            fontSize: 24,
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', 'DIN', monospace",
          }}
          prefix={displayPrefix}
        />
        {sparklineData && sparklineData.length >= 2 && (
          <div style={{ position: 'absolute', right: 0, bottom: 0 }}>
            <Sparkline data={sparklineData} color={displayColor} />
          </div>
        )}
      </div>
    </Card>
  )
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
  return_pending: { label: '退回审核中', color: '#FAAD14' },
  partial_returned: { label: '部分退回', color: '#FAAD14' },
  returned: { label: '已退回', color: '#8B949E' },
  cancelled: { label: '已取消', color: '#00b96b' },
  slow_selling_refund: { label: '滞销退款', color: '#722ED1' },
}

interface BalanceData {
  availableBalance: number
  frozenBalance: number
  totalProfit: number
  totalInvested: number
  stats?: {
    totalRecharge: number
    totalFunding: number
  }
}

interface Transaction {
  id: string
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  createdAt: string
}

interface PaginationData {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface SubscriptionOrder {
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
  confirmedAt: string
  effectiveAt: string
  slowSellingDeadline: string
  totalProfit: number
  totalLoss: number
}

// 出金状态映射
const withdrawStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '出金中', color: '#FAAD14' },
  approved: { label: '已出金', color: '#00b96b' },
  rejected: { label: '已驳回', color: '#F5222D' },
}

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

interface SubscriptionSummary {
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

const Portfolio = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')


  // 账户相关状态
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionPagination, setTransactionPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  })
  const [transactionType, setTransactionType] = useState<string | undefined>(undefined)
  const [transactionLoading, setTransactionLoading] = useState(false)
  const [rechargeModalVisible, setRechargeModalVisible] = useState(false)
  const [rechargeForm] = Form.useForm()

  // 提现相关状态
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [withdrawForm] = Form.useForm()

  // 出金订单列表状态
  const [withdrawOrders, setWithdrawOrders] = useState<WithdrawOrderItem[]>([])
  const [withdrawOrdersLoading, setWithdrawOrdersLoading] = useState(false)
  const [withdrawOrdersPagination, setWithdrawOrdersPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  })

  // 支付相关状态
  const [paymentStep, setPaymentStep] = useState<'input' | 'paying' | 'success' | 'timeout'>('input')
  const [paymentChannel, setPaymentChannel] = useState<'alipay' | 'wechat'>('alipay')
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [qrCode, setQrCode] = useState<string>('')
  const [outTradeNo, setOutTradeNo] = useState<string>('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [mockMode, setMockMode] = useState(false)
  const [confirmMockLoading, setConfirmMockLoading] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  // 认购相关状态
  const [subscriptions, setSubscriptions] = useState<SubscriptionOrder[]>([])
  const [subscriptionPagination, setSubscriptionPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  })
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | undefined>(undefined)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const [subscriptionSummary, setSubscriptionSummary] = useState<SubscriptionSummary | null>(null)

  // 收益曲线相关状态
  const [yieldCurveData, setYieldCurveData] = useState<any[]>([])
  const [yieldSummary, setYieldSummary] = useState<any>(null)
  const [yieldLoading, setYieldLoading] = useState(false)

  useEffect(() => {
    fetchBalance()
  }, [])

  useEffect(() => {
    if (transactionPagination.page && activeTab === 'transactions') {
      fetchTransactions()
    }
  }, [transactionPagination.page, transactionPagination.pageSize, transactionType, activeTab])

  useEffect(() => {
    // 组件挂载时获取认购概览数据
    fetchSubscriptionSummary()
  }, [])

  useEffect(() => {
    if (activeTab === 'subscriptions') {
      fetchSubscriptions()
      fetchSubscriptionSummary()
    }

    if (activeTab === 'yieldCurve') {
      fetchYieldData()
    }
  }, [subscriptionPagination.page, subscriptionPagination.pageSize, subscriptionStatus, activeTab])

  useEffect(() => {
    if (activeTab === 'withdrawOrders') {
      fetchWithdrawOrders()
    }
  }, [withdrawOrdersPagination.page, withdrawOrdersPagination.pageSize, activeTab])

  // 账户相关方法
  const fetchBalance = async () => {
    try {
      const response = await accountApi.getBalance()
      setBalance(response)
    } catch (error) {
      console.error('Failed to fetch balance:', error)
    }
  }

  const fetchTransactions = async () => {
    setTransactionLoading(true)
    try {
      const response = await accountApi.getTransactions({
        type: transactionType,
        page: transactionPagination.page,
        pageSize: transactionPagination.pageSize,
      })
      setTransactions(response.list || [])
      const pagination = response.pagination
      if (pagination) {
        setTransactionPagination({
          page: pagination.page || 1,
          pageSize: pagination.pageSize || 10,
          total: pagination.total || 0,
          totalPages: pagination.totalPages || 0,
        })
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setTransactionLoading(false)
    }
  }

  // 获取出金订单列表
  const fetchWithdrawOrders = async () => {
    setWithdrawOrdersLoading(true)
    try {
      const response = await accountApi.getMyWithdrawOrders({
        page: withdrawOrdersPagination.page,
        limit: withdrawOrdersPagination.pageSize,
      })
      setWithdrawOrders(response.list || [])
      const pagination = response.pagination
      if (pagination) {
        setWithdrawOrdersPagination({
          page: pagination.page || 1,
          pageSize: pagination.limit || pagination.pageSize || 10,
          total: pagination.total || 0,
          totalPages: pagination.totalPages || 0,
        })
      }
    } catch (error) {
      console.error('Failed to fetch withdraw orders:', error)
    } finally {
      setWithdrawOrdersLoading(false)
    }
  }

  // 提现方法（T+1申请制）
  const handleWithdraw = async (values: { amount: number; password?: string; bankInfo?: string }) => {
    const availableBalance = balance?.availableBalance || 0
    if (values.amount <= 0) {
      message.error('提现金额必须大于0')
      return
    }
    if (values.amount > availableBalance) {
      message.error('提现金额不能超过可用余额')
      return
    }
    setWithdrawLoading(true)
    try {
      await accountApi.withdraw(values.amount, '账户提现', values.password, values.bankInfo)
      message.success('提现申请已提交，预计T+1到账，请等待管理员确认')
      setWithdrawModalVisible(false)
      withdrawForm.resetFields()
      fetchBalance()
      fetchTransactions()
      if (activeTab === 'withdrawOrders') {
        fetchWithdrawOrders()
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message
      message.error(Array.isArray(errMsg) ? errMsg.join('; ') : (errMsg || '提现失败'))
    } finally {
      setWithdrawLoading(false)
    }
  }

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  // 查询支付状态
  const checkPaymentStatus = useCallback(async (tradeNo: string, channel: 'alipay' | 'wechat') => {
    try {
      const result = await (channel === 'alipay'
        ? paymentApi.queryAlipayOrder(tradeNo)
        : paymentApi.queryWechatOrder(tradeNo))

      if (result.status === 'paid') {
        stopPolling()
        setPaymentStep('success')
        message.success('支付成功！')
        // 刷新余额
        fetchBalance()
        fetchTransactions()
        // 3秒后关闭弹窗
        setTimeout(() => {
          setRechargeModalVisible(false)
          resetPaymentState()
        }, 2000)
        return
      }

      // 检查是否超时（5分钟）
      const elapsed = Date.now() - startTimeRef.current
      if (elapsed > 5 * 60 * 1000) {
        stopPolling()
        setPaymentStep('timeout')
        message.warning('支付超时，请重新支付')
      }
    } catch (error) {
      console.error('Check payment status error:', error)
    }
  }, [stopPolling, fetchBalance, fetchTransactions])

  // 开始轮询
  const startPolling = useCallback((tradeNo: string, channel: 'alipay' | 'wechat') => {
    startTimeRef.current = Date.now()
    pollingRef.current = setInterval(() => {
      checkPaymentStatus(tradeNo, channel)
    }, 3000)
  }, [checkPaymentStatus])

  // 重置支付状态
  const resetPaymentState = useCallback(() => {
    setPaymentStep('input')
    setQrCode('')
    setOutTradeNo('')
    setPaymentAmount(0)
    setPaymentLoading(false)
    setMockMode(false)
    setConfirmMockLoading(false)
    stopPolling()
  }, [stopPolling])

  // 创建支付订单
  const handleCreatePayment = async () => {
    try {
      const values = await rechargeForm.validateFields()
      setPaymentLoading(true)
      setPaymentAmount(values.amount)

      let result: { outTradeNo: string; qrCode?: string; codeUrl?: string; mockMode?: boolean }
      if (paymentChannel === 'alipay') {
        result = await paymentApi.createAlipayOrder(values.amount)
        setQrCode(result.qrCode || '')
      } else {
        result = await paymentApi.createWechatOrder(values.amount)
        setQrCode(result.codeUrl || '')
      }

      setOutTradeNo(result.outTradeNo)
      setMockMode(result.mockMode || false)
      setPaymentStep('paying')
      startPolling(result.outTradeNo, paymentChannel)
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建支付订单失败')
    } finally {
      setPaymentLoading(false)
    }
  }

  // Mock模式确认支付
  const handleConfirmMockPayment = async () => {
    if (!outTradeNo) return
    setConfirmMockLoading(true)
    try {
      await paymentApi.confirmMockPayment(outTradeNo)
      message.success('模拟支付成功！')
    } catch (error: any) {
      message.error(error.response?.data?.message || '确认支付失败')
    } finally {
      setConfirmMockLoading(false)
    }
  }

  // 关闭弹窗时清理
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  // 认购相关方法
  const fetchSubscriptions = async () => {
    setSubscriptionLoading(true)
    try {
      const response = await subscriptionApi.getMySubscriptions({
        status: subscriptionStatus,
        page: subscriptionPagination.page,
        limit: subscriptionPagination.pageSize,
      })
      setSubscriptions(response.data?.list || [])
      const pagination = response.data?.pagination
      if (pagination) {
        setSubscriptionPagination({
          page: pagination.page || 1,
          pageSize: pagination.pageSize || pagination.limit || 10,
          total: pagination.total || 0,
          totalPages: pagination.totalPages || 0,
        })
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error)
    } finally {
      setSubscriptionLoading(false)
    }
  }

  const fetchSubscriptionSummary = async () => {
    try {
      const response = await subscriptionApi.getActiveSubscriptionSummary()
      setSubscriptionSummary(response.data)
    } catch (error) {
      console.error('Failed to fetch subscription summary:', error)
    }
  }

  // 申请退回认购
  const handleRequestReturn = async (orderId: string) => {
    try {
      const res: any = await subscriptionApi.requestReturn(orderId)
      if (res.success) {
        message.success('退回申请已提交，等待管理员核准')
        fetchSubscriptions()
        fetchSubscriptionSummary()
        fetchBalance()
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message
      message.error(Array.isArray(errMsg) ? errMsg.join('; ') : (errMsg || '退回申请失败'))
    }
  }

  // 获取收益曲线数据
  const fetchYieldData = async () => {
    setYieldLoading(true)
    try {
      const [curveRes, summaryRes]: any[] = await Promise.all([
        yieldApi.getMyYieldCurve({ startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD') }),
        yieldApi.getMyYieldSummary(),
      ])
      if (curveRes.success) setYieldCurveData(curveRes.data || [])
      if (summaryRes.success) setYieldSummary(summaryRes.data || null)
    } catch (error) {
      console.error('Failed to fetch yield data:', error)
    } finally {
      setYieldLoading(false)
    }
  }

  // 格式化日期
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // 计算倒计时天数
  const getCountdownDays = (deadline: string) => {
    if (!deadline) return null
    return dayjs(deadline).diff(dayjs(), 'day')
  }

  // 生成模拟趋势数据（7天）
  const generateTrendData = useMemo(() => {
    const baseData: Record<string, number[]> = {
      balance: [1200, 1350, 1280, 1420, 1380, 1500, balance?.availableBalance || 0],
      profit: [80, 120, 95, 150, 130, 180, balance?.totalProfit || 0],
      invested: [5000, 5200, 5500, 5800, 6000, 6200, balance?.totalInvested || 0],
      holding: [3000, 3200, 3500, 3800, 4000, 4200, subscriptionSummary?.totalUnsettledAmount || 0],
    }
    return baseData
  }, [balance, subscriptionSummary])

  // 资金流水表格列
  const transactionColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (text: string) => (
        <Text style={{ color: '#8B949E', fontSize: 13 }}>{formatDate(text)}</Text>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => {
        const config = transactionTypeMap[type] || { label: type, color: '#8B949E' }
        return (
          <Tag
            style={{
              background: `${config.color}20`,
              borderColor: config.color,
              color: config.color,
              fontSize: 12,
            }}
          >
            {config.label}
          </Tag>
        )
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      align: 'right' as const,
      render: (amount: number, record: Transaction) => {
        const isPositive =
          ['RECHARGE', 'PRINCIPAL_RETURN', 'PROFIT_SHARE', 'SLOW_SELL_REFUND', 'recharge', 'principal_return', 'profit_share', 'interest'].includes(record.type)
        const displayAmount = isPositive ? Math.abs(Number(amount || 0)) : -Math.abs(Number(amount || 0))
        return renderProfitCell(displayAmount)
      },
    },
    {
      title: '变动前余额',
      dataIndex: 'balanceBefore',
      key: 'balanceBefore',
      width: 140,
      align: 'right' as const,
      render: (amount: number) => (
        <Text
          style={{
            color: '#E6EDF3',
            fontFamily: "'JetBrains Mono', 'DIN', monospace",
            fontSize: 13,
          }}
        >
          ¥{Number(amount || 0).toFixed(2)}
        </Text>
      ),
    },
    {
      title: '变动后余额',
      dataIndex: 'balanceAfter',
      key: 'balanceAfter',
      width: 140,
      align: 'right' as const,
      render: (amount: number) => (
        <Text
          style={{
            color: '#E6EDF3',
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', 'DIN', monospace",
            fontSize: 13,
          }}
        >
          ¥{Number(amount || 0).toFixed(2)}
        </Text>
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => (
        <Text style={{ color: '#E6EDF3', fontSize: 13 }}>{text}</Text>
      ),
    },
  ]

  // 认购表格列
  const subscriptionColumns = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 140,
      render: (text: string) => (
        <Text style={{ color: '#8B949E', fontFamily: 'monospace', fontSize: 12 }}>
          {text}
        </Text>
      ),
    },
    {
      title: '药品',
      dataIndex: 'drugName',
      key: 'drugName',
      render: (text: string, record: SubscriptionOrder) => (
        <div>
          <Text style={{ color: '#E6EDF3' }}>{text}</Text>
          <br />
          <Text style={{ color: '#8B949E', fontSize: 11, fontFamily: 'monospace' }}>
            {record.drugCode}
          </Text>
        </div>
      ),
    },
    {
      title: '认购数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 90,
      align: 'center' as const,
      render: (text: number) => (
        <Text style={{ color: '#E6EDF3', fontFamily: 'monospace' }}>{text}盒</Text>
      ),
    },
    {
      title: '已退回',
      dataIndex: 'settledQuantity',
      key: 'settledQuantity',
      width: 80,
      align: 'center' as const,
      render: (text: number, record: SubscriptionOrder) => {
        const progress = record.quantity > 0 ? ((text || 0) / record.quantity) * 100 : 0
        return (
          <div>
            <Text style={{ color: '#cf1322', fontFamily: 'monospace' }}>{text || 0}盒</Text>
            <Progress 
              percent={progress} 
              size="small" 
              strokeColor="#cf1322" 
              trailColor="#21262D"
              showInfo={false}
              style={{ marginTop: 4, marginBottom: 0 }}
            />
          </div>
        )
      },
    },
    {
      title: '剩余份额',
      dataIndex: 'remaining',
      key: 'remaining',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: SubscriptionOrder) => (
        <Text style={{ color: '#FAAD14', fontFamily: 'monospace' }}>
          {record.quantity - (record.settledQuantity || 0)}盒
        </Text>
      ),
    },
    {
      title: '认购金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right' as const,
      render: (text: number) => (
        <Text style={{ color: '#E6EDF3', fontFamily: 'monospace' }}>
          ¥{Number(text || 0).toFixed(2)}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center' as const,
      render: (status: string) => {
        const config = subscriptionStatusMap[status] || { label: status, color: '#8B949E' }
        return (
          <Tag
            style={{
              background: `${config.color}20`,
              borderColor: config.color,
              color: config.color,
              fontSize: 11,
              margin: 0,
            }}
          >
            {config.label}
          </Tag>
        )
      },
    },
    {
      title: '滞销截止',
      dataIndex: 'slowSellingDeadline',
      key: 'slowSellingDeadline',
      width: 120,
      render: (text: string) => {
        if (!text) return <Text style={{ color: '#8B949E', fontSize: 12 }}>-</Text>
        const days = getCountdownDays(text)
        const color = days === null ? '#8B949E' : days <= 7 ? '#00b96b' : days <= 30 ? '#FAAD14' : '#cf1322'
        return (
          <Text style={{ color, fontSize: 12 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {dayjs(text).format('MM-DD')}
          </Text>
        )
      },
    },
    {
      title: '倒计时',
      dataIndex: 'countdown',
      key: 'countdown',
      width: 90,
      align: 'center' as const,
      render: (_: any, record: SubscriptionOrder) => {
        const days = getCountdownDays(record.slowSellingDeadline)
        const color = days === null ? '#8B949E' : days <= 7 ? '#00b96b' : days <= 30 ? '#FAAD14' : '#cf1322'
        return (
          <Text style={{ color, fontSize: 12, fontWeight: 500 }}>
            {days === null ? '-' : `剩${days}天`}
          </Text>
        )
      },
    },
    {
      title: '累计收益',
      dataIndex: 'totalProfit',
      key: 'totalProfit',
      width: 120,
      align: 'right' as const,
      render: (text: number, record: SubscriptionOrder) => {
        const netProfit = Number(text || 0) - Number(record.totalLoss || 0)
        return renderProfitCell(netProfit)
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: SubscriptionOrder) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/trade/${record.drugId}`)}
          >
            查看
          </Button>
          {(record.status === 'effective' || record.status === 'partial_returned') && (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => handleRequestReturn(record.id)}
            >
              退回
            </Button>
          )}
        </Space>
      ),
    },
  ]

  // 渲染认购概览卡片
  const renderSubscriptionOverview = () => (
    <Row gutter={[16, 12]} className="portfolio-overview-row">
      <Col xs={12} sm={12} md={12} lg={6}>
        <StatCard
          title="总认购金额"
          value={subscriptionSummary?.totalAmount || 0}
          icon={<ShoppingOutlined style={{ color: '#1890FF' }} />}
          color="#1890FF"
          sparklineData={generateTrendData.holding}
        />
      </Col>

      <Col xs={12} sm={12} md={12} lg={6}>
        <StatCard
          title="未结清金额"
          value={subscriptionSummary?.totalUnsettledAmount || 0}
          icon={<LockOutlined style={{ color: '#FAAD14' }} />}
          color="#FAAD14"
        />
      </Col>

      <Col xs={12} sm={12} md={12} lg={6}>
        <StatCard
          title="累计净收益"
          value={Number(subscriptionSummary?.totalProfit || 0) - Number(subscriptionSummary?.totalLoss || 0)}
          icon={<WalletOutlined style={{ color: 
            (Number(subscriptionSummary?.totalProfit || 0) - Number(subscriptionSummary?.totalLoss || 0)) >= 0 ? '#cf1322' : '#00b96b' 
          }} />}
          color="#cf1322"
          isProfit
          sparklineData={generateTrendData.profit}
        />
      </Col>

      <Col xs={12} sm={12} md={12} lg={6}>
        <StatCard
          title="有效认购数"
          value={subscriptionSummary?.activeOrderCount || 0}
          icon={<BarChartOutlined style={{ color: '#722ED1' }} />}
          color="#722ED1"
          prefix=""
        />
      </Col>
    </Row>
  )

  return (
    <div className="portfolio-page">
      {/* 页面标题 */}
      <Title level={3} className="portfolio-title">
        我的账户
      </Title>

      {/* 账户概览卡片 */}
      <Row gutter={[16, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={12} md={12} lg={6}>
          <StatCard
            title="可用余额"
            value={balance?.availableBalance || 0}
            icon={<DollarOutlined style={{ color: '#cf1322' }} />}
            color="#cf1322"
            sparklineData={generateTrendData.balance}
          />
        </Col>

        <Col xs={12} sm={12} md={12} lg={6}>
          <StatCard
            title="冻结金额"
            value={balance?.frozenBalance || 0}
            icon={<LockOutlined style={{ color: '#FAAD14' }} />}
            color="#FAAD14"
          />
        </Col>

        <Col xs={12} sm={12} md={12} lg={6}>
          <StatCard
            title="累计收益"
            value={balance?.totalProfit || 0}
            icon={<WalletOutlined style={{ color: (balance?.totalProfit || 0) >= 0 ? '#cf1322' : '#00b96b' }} />}
            color="#cf1322"
            isProfit
            sparklineData={generateTrendData.profit}
          />
        </Col>

        <Col xs={12} sm={12} md={12} lg={6}>
          <StatCard
            title="累计投资"
            value={balance?.totalInvested || 0}
            icon={<TransactionOutlined style={{ color: '#1890FF' }} />}
            color="#1890FF"
            sparklineData={generateTrendData.invested}
          />
        </Col>
      </Row>

      {/* 操作栏 */}
      <Card
        className="portfolio-action-bar"
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Row justify="space-between" align="middle">
          <Col>
            <Space size={12}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setRechargeModalVisible(true)}
                className="portfolio-recharge-btn"
              >
                充值
              </Button>
              <Button
                icon={<MinusOutlined />}
                onClick={() => setWithdrawModalVisible(true)}
                className="portfolio-withdraw-btn"
              >
                提现
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Tabs 内容 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        className="portfolio-tabs"
        items={[
          {
            key: 'overview',
            label: (
              <Space>
                <BarChartOutlined />
                <span>认购概览</span>
              </Space>
            ),
            children: (
              <>
                {renderSubscriptionOverview()}
                {/* 认购统计卡片 */}
                <Row gutter={[16, 12]}>
                  <Col xs={12} sm={12} md={8} lg={8}>
                    <Card className="portfolio-stats-card">
                      <Text style={{ color: '#8B949E', fontSize: 13 }}>总认购次数</Text>
                      <div
                        className="text-value"
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 4,
                          fontSize: 28,
                          fontWeight: 700,
                          color: '#E6EDF3',
                          fontFamily: "'JetBrains Mono', 'DIN', monospace",
                          marginTop: 8,
                        }}
                      >
                        <span>{subscriptionSummary?.totalOrderCount || 0}</span>
                        <Text style={{ color: '#8B949E', fontSize: 14, fontWeight: 400 }}>笔</Text>
                      </div>
                    </Card>
                  </Col>
                  <Col xs={12} sm={12} md={8} lg={8}>
                    <Card className="portfolio-stats-card">
                      <Text style={{ color: '#8B949E', fontSize: 13 }}>总认购数量</Text>
                      <div
                        className="text-value"
                        style={{
                          fontSize: 28,
                          fontWeight: 700,
                          color: '#1890FF',
                          fontFamily: "'JetBrains Mono', 'DIN', monospace",
                          marginTop: 8,
                        }}
                      >
                        {subscriptionSummary?.totalQuantity || 0}
                        <Text style={{ color: '#8B949E', fontSize: 14, fontWeight: 400, marginLeft: 4 }}>盒</Text>
                      </div>
                    </Card>
                  </Col>
                  <Col xs={12} sm={12} md={8} lg={8}>
                    <Card className="portfolio-stats-card">
                      <Text style={{ color: '#8B949E', fontSize: 13 }}>已退回数量</Text>
                      <div
                        className="text-value"
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 4,
                          fontSize: 28,
                          fontWeight: 700,
                          color: '#cf1322',
                          fontFamily: "'JetBrains Mono', 'DIN', monospace",
                          marginTop: 8,
                        }}
                      >
                        <span>{subscriptionSummary?.totalSettledQuantity || 0}</span>
                        <Text style={{ color: '#8B949E', fontSize: 14, fontWeight: 400 }}>盒</Text>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </>
            ),
          },
          {
            key: 'subscriptions',
            label: (
              <Space>
                <ShoppingOutlined />
                <span>我的认购</span>
              </Space>
            ),
            children: (
              <Card
                className="portfolio-table-card"
                title={
                  <Space>
                    <ShoppingOutlined style={{ color: '#1890FF' }} />
                    <Text style={{ color: '#E6EDF3', fontSize: 16, fontWeight: 500 }}>
                      认购份额详情
                    </Text>
                  </Space>
                }
                extra={
                  <Space>
                    <Text style={{ color: '#8B949E' }}>状态筛选：</Text>
                    <Select
                      placeholder="全部状态"
                      allowClear
                      className="portfolio-select"
                      style={{ width: 120 }}
                      value={subscriptionStatus}
                      onChange={(value) => {
                        setSubscriptionStatus(value)
                        setSubscriptionPagination({ ...subscriptionPagination, page: 1 })
                      }}
                      dropdownStyle={{ background: '#161B22', border: '1px solid #30363D' }}
                    >
                      <Option value="confirmed">待生效</Option>
                      <Option value="effective">认购中</Option>
                      <Option value="return_pending">退回审核中</Option>
                      <Option value="partial_returned">部分退回</Option>
                      <Option value="returned">已退回</Option>
                      <Option value="cancelled">已取消</Option>
                      <Option value="slow_selling_refund">滞销退款</Option>
                    </Select>
                  </Space>
                }
                bodyStyle={{ padding: 0 }}
              >
                <Table
                  columns={subscriptionColumns}
                  dataSource={subscriptions}
                  rowKey="id"
                  loading={subscriptionLoading}
                  pagination={false}
                  scroll={{ x: 'max-content', y: 'calc(100vh - 480px)' }}
                  sticky={true}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={<Text style={{ color: '#8B949E' }}>暂无认购记录</Text>}
                        className="portfolio-empty"
                      />
                    ),
                  }}
                  className="portfolio-table"
                  rowClassName={() => 'portfolio-row'}
                />
                <div className="portfolio-pagination">
                  <Pagination
                    current={subscriptionPagination.page}
                    pageSize={subscriptionPagination.pageSize}
                    total={subscriptionPagination.total}
                    showSizeChanger
                    showQuickJumper
                    showTotal={(total) => `共 ${total} 条记录`}
                    onChange={(page, pageSize) => {
                      setSubscriptionPagination({ ...subscriptionPagination, page, pageSize: pageSize || 10 })
                    }}
                    onShowSizeChange={(_, size) => {
                      setSubscriptionPagination({ ...subscriptionPagination, page: 1, pageSize: size })
                    }}
                  />
                </div>
              </Card>
            ),
          },
          {
            key: 'yieldCurve',
            label: (
              <Space>
                <LineChartOutlined />
                <span>收益曲线</span>
              </Space>
            ),
            children: (
              <Card style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 8 }}>
                {/* 收益汇总 */}
                {yieldSummary && (
                  <Row gutter={[16, 12]} style={{ marginBottom: 24 }}>
                    <Col xs={12} sm={12} md={6} lg={6}>
                      <Card className="portfolio-stat-card" bodyStyle={{ padding: 16 }}>
                        <Statistic
                          title={<Text style={{ color: '#8B949E', fontSize: 13 }}>累计合伙收益(5%)</Text>}
                          value={yieldSummary.totalBaseYield || 0}
                          precision={2}
                          prefix="¥"
                          valueStyle={{ color: '#1890FF', fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={12} md={6} lg={6}>
                      <Card className="portfolio-stat-card" bodyStyle={{ padding: 16 }}>
                        <Statistic
                          title={<Text style={{ color: '#8B949E', fontSize: 13 }}>累计合伙收益</Text>}
                          value={yieldSummary.totalSubsidy || 0}
                          precision={2}
                          prefix="¥"
                          valueStyle={{ color: '#F0B90B', fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={12} md={6} lg={6}>
                      <Card className="portfolio-stat-card" bodyStyle={{ padding: 16 }}>
                        <Statistic
                          title={<Text style={{ color: '#8B949E', fontSize: 13 }}>累计总收益</Text>}
                          value={yieldSummary.totalYield || 0}
                          precision={2}
                          prefix="¥"
                          valueStyle={{ color: '#00b96b', fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={12} md={6} lg={6}>
                      <Card className="portfolio-stat-card" bodyStyle={{ padding: 16 }}>
                        <Statistic
                          title={<Text style={{ color: '#8B949E', fontSize: 13 }}>今日收益</Text>}
                          value={yieldSummary.todayTotalYield || 0}
                          precision={2}
                          prefix="¥"
                          valueStyle={{ color: '#cf1322', fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}
                        />
                      </Card>
                    </Col>
                  </Row>
                )}

                {/* 收益曲线图 */}
                <ReactECharts
                  option={{
                    backgroundColor: 'transparent',
                    tooltip: {
                      trigger: 'axis',
                      backgroundColor: '#161B22',
                      borderColor: '#30363D',
                      textStyle: { color: '#E6EDF3' },
                      formatter: (params: any) => {
                        let html = `<div style="padding: 4px 0"><b>${params[0].axisValue}</b></div>`
                        params.forEach((p: any) => {
                          html += `<div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0">
                            <span>${p.marker} ${p.seriesName}</span>
                            <span style="font-weight:600">¥${Number(p.value).toFixed(2)}</span>
                          </div>`
                        })
                        return html
                      },
                    },
                    legend: {
                      data: ['补贴金', '合伙收益', '累计收益'],
                      textStyle: { color: '#8B949E' },
                      top: 0,
                    },
                    grid: { left: 60, right: 20, top: 40, bottom: 30 },
                    xAxis: {
                      type: 'category',
                      data: yieldCurveData.map((d: any) => d.date),
                      axisLine: { lineStyle: { color: '#30363D' } },
                      axisLabel: { color: '#8B949E', fontSize: 11 },
                    },
                    yAxis: [
                      {
                        type: 'value',
                        name: '日收益(¥)',
                        axisLine: { lineStyle: { color: '#30363D' } },
                        axisLabel: { color: '#8B949E', fontSize: 11 },
                        splitLine: { lineStyle: { color: '#21262D' } },
                      },
                      {
                        type: 'value',
                        name: '累计(¥)',
                        axisLine: { lineStyle: { color: '#30363D' } },
                        axisLabel: { color: '#8B949E', fontSize: 11 },
                        splitLine: { show: false },
                      },
                    ],
                    series: [
                      {
                        name: '补贴金',
                        type: 'bar',
                        data: yieldCurveData.map((d: any) => d.baseYield),
                        itemStyle: { color: '#1890FF', borderRadius: [2, 2, 0, 0] },
                        barWidth: '20%',
                      },
                      {
                        name: '合伙收益',
                        type: 'bar',
                        data: yieldCurveData.map((d: any) => d.subsidy),
                        itemStyle: { color: '#F0B90B', borderRadius: [2, 2, 0, 0] },
                        barWidth: '20%',
                      },
                      {
                        name: '累计收益',
                        type: 'line',
                        yAxisIndex: 1,
                        data: yieldCurveData.map((d: any) => d.cumulativeYield),
                        smooth: true,
                        lineStyle: { color: '#00b96b', width: 2 },
                        itemStyle: { color: '#00b96b' },
                        areaStyle: {
                          color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                              { offset: 0, color: 'rgba(0, 185, 107, 0.3)' },
                              { offset: 1, color: 'rgba(0, 185, 107, 0.02)' },
                            ],
                          },
                        },
                      },
                    ],
                  }}
                  style={{ height: 400 }}
                  theme="dark"
                  showLoading={yieldLoading}
                />

                {yieldCurveData.length === 0 && !yieldLoading && (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Text style={{ color: '#8B949E', fontSize: 14 }}>
                      暂无收益数据，请联系管理员生成日收益记录
                    </Text>
                  </div>
                )}
              </Card>
            ),
          },
          {
            key: 'transactions',
            label: (
              <Space>
                <TransactionOutlined />
                <span>资金流水</span>
              </Space>
            ),
            children: (
              <Card
                className="portfolio-table-card"
                title={
                  <Space>
                    <TransactionOutlined style={{ color: '#1890FF' }} />
                    <Text style={{ color: '#E6EDF3', fontSize: 16, fontWeight: 500 }}>
                      资金流水
                    </Text>
                  </Space>
                }
                extra={
                  <Space>
                    <Text style={{ color: '#8B949E' }}>交易类型：</Text>
                    <Select
                      placeholder="全部类型"
                      allowClear
                      className="portfolio-select"
                      style={{ width: 140 }}
                      value={transactionType}
                      onChange={(value) => {
                        setTransactionType(value)
                        setTransactionPagination({ ...transactionPagination, page: 1 })
                      }}
                      dropdownStyle={{ background: '#161B22', border: '1px solid #30363D' }}
                    >
                      <Option value="RECHARGE">充值</Option>
                      <Option value="WITHDRAW">提现</Option>
                      <Option value="SUBSCRIPTION">认购冻结</Option>
                      <Option value="PRINCIPAL_RETURN">份额退回</Option>
                      <Option value="PROFIT_SHARE">收益分成</Option>
                      <Option value="LOSS_SHARE">亏损承担</Option>
                      <Option value="SLOW_SELL_REFUND">滞销退款</Option>
                    </Select>
                  </Space>
                }
                bodyStyle={{ padding: 0 }}
              >
                <Table
                  columns={transactionColumns}
                  dataSource={transactions}
                  rowKey="id"
                  loading={transactionLoading}
                  pagination={false}
                  scroll={{ x: 'max-content', y: 'calc(100vh - 480px)' }}
                  sticky={true}
                  className="portfolio-table"
                  rowClassName={() => 'portfolio-row'}
                />
                <div className="portfolio-pagination">
                  <Pagination
                    current={transactionPagination.page}
                    pageSize={transactionPagination.pageSize}
                    total={transactionPagination.total}
                    showSizeChanger
                    showQuickJumper
                    showTotal={(total) => `共 ${total} 条记录`}
                    onChange={(page, pageSize) => {
                      setTransactionPagination({ ...transactionPagination, page, pageSize: pageSize || 10 })
                    }}
                    onShowSizeChange={(_, size) => {
                      setTransactionPagination({ ...transactionPagination, page: 1, pageSize: size })
                    }}
                  />
                </div>
              </Card>
            ),
          },
          {
            key: 'withdrawOrders',
            label: (
              <Space>
                <MinusOutlined />
                <span>出金记录</span>
              </Space>
            ),
            children: (
              <Card
                className="portfolio-table-card"
                title={
                  <Space>
                    <MinusOutlined style={{ color: '#FAAD14' }} />
                    <Text style={{ color: '#E6EDF3', fontSize: 16, fontWeight: 500 }}>
                      出金记录（T+1到账）
                    </Text>
                  </Space>
                }
                extra={
                  <Text style={{ color: '#8B949E', fontSize: 12 }}>
                    提现申请提交后，管理员将在T+1日确认到账
                  </Text>
                }
                bodyStyle={{ padding: 0 }}
              >
                <Table
                  columns={[
                    {
                      title: '订单号',
                      dataIndex: 'orderNo',
                      key: 'orderNo',
                      width: 180,
                      render: (text: string) => (
                        <Text style={{ color: '#58A6FF', fontFamily: 'monospace', fontSize: 12 }}>
                          {text}
                        </Text>
                      ),
                    },
                    {
                      title: '出金金额',
                      dataIndex: 'amount',
                      key: 'amount',
                      width: 140,
                      align: 'right' as const,
                      render: (amount: number) => (
                        <Text style={{
                          color: '#00b96b',
                          fontFamily: "'JetBrains Mono', 'DIN', monospace",
                          fontWeight: 600,
                          fontSize: 14,
                        }}>
                          ¥{Number(amount || 0).toFixed(2)}
                        </Text>
                      ),
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      width: 120,
                      align: 'center' as const,
                      render: (status: string) => {
                        const config = withdrawStatusMap[status] || { label: status, color: '#8B949E' }
                        return (
                          <Tag
                            style={{
                              background: `${config.color}20`,
                              borderColor: config.color,
                              color: config.color,
                              fontSize: 12,
                            }}
                          >
                            {status === 'pending' && <ClockCircleOutlined style={{ marginRight: 4 }} />}
                            {status === 'approved' && <CheckCircleOutlined style={{ marginRight: 4 }} />}
                            {status === 'rejected' && <CloseCircleOutlined style={{ marginRight: 4 }} />}
                            {config.label}
                          </Tag>
                        )
                      },
                    },
                    {
                      title: '申请时间',
                      dataIndex: 'createdAt',
                      key: 'createdAt',
                      width: 160,
                      render: (text: string) => (
                        <Text style={{ color: '#8B949E', fontSize: 13 }}>{formatDate(text)}</Text>
                      ),
                    },
                    {
                      title: '到账时间',
                      dataIndex: 'approvedAt',
                      key: 'approvedAt',
                      width: 160,
                      render: (text: string) => (
                        <Text style={{ color: text ? '#00b96b' : '#484F58', fontSize: 13 }}>
                          {text ? formatDate(text) : '待确认'}
                        </Text>
                      ),
                    },
                    {
                      title: '说明',
                      dataIndex: 'description',
                      key: 'description',
                      render: (text: string, record: WithdrawOrderItem) => (
                        <div>
                          <Text style={{ color: '#E6EDF3', fontSize: 13 }}>{text || '-'}</Text>
                          {record.rejectReason && (
                            <div>
                              <Text style={{ color: '#F5222D', fontSize: 12 }}>
                                驳回原因：{record.rejectReason}
                              </Text>
                            </div>
                          )}
                        </div>
                      ),
                    },
                  ]}
                  dataSource={withdrawOrders}
                  rowKey="id"
                  loading={withdrawOrdersLoading}
                  pagination={false}
                  scroll={{ x: 'max-content', y: 'calc(100vh - 480px)' }}
                  sticky={true}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={<Text style={{ color: '#8B949E' }}>暂无出金记录</Text>}
                        className="portfolio-empty"
                      />
                    ),
                  }}
                  className="portfolio-table"
                  rowClassName={() => 'portfolio-row'}
                />
                <div className="portfolio-pagination">
                  <Pagination
                    current={withdrawOrdersPagination.page}
                    pageSize={withdrawOrdersPagination.pageSize}
                    total={withdrawOrdersPagination.total}
                    showSizeChanger
                    showQuickJumper
                    showTotal={(total) => `共 ${total} 条记录`}
                    onChange={(page, pageSize) => {
                      setWithdrawOrdersPagination({ ...withdrawOrdersPagination, page, pageSize: pageSize || 10 })
                    }}
                    onShowSizeChange={(_, size) => {
                      setWithdrawOrdersPagination({ ...withdrawOrdersPagination, page: 1, pageSize: size })
                    }}
                  />
                </div>
              </Card>
            ),
          },
        ]}
      />

      {/* 充值弹窗 */}
      <Modal
        title={
          <Space>
            <PlusOutlined style={{ color: '#cf1322' }} />
            <Text style={{ color: '#E6EDF3' }}>账户充值</Text>
          </Space>
        }
        open={rechargeModalVisible}
        onCancel={() => {
          stopPolling()
          setRechargeModalVisible(false)
          rechargeForm.resetFields()
          resetPaymentState()
        }}
        footer={null}
        width={paymentStep === 'input' ? 400 : 480}
        styles={{
          content: {
            background: '#161B22',
            border: '1px solid #30363D',
            borderRadius: 12,
          },
        }}
      >
        {/* 输入金额步骤 */}
        {paymentStep === 'input' && (
          <Form
            form={rechargeForm}
            onFinish={handleCreatePayment}
            layout="vertical"
            style={{ marginTop: 24 }}
          >
            <Form.Item
              name="amount"
              label={<Text style={{ color: '#8B949E' }}>充值金额</Text>}
              rules={[{ required: true, message: '请输入充值金额' }, { type: 'number', min: 0.01, message: '金额必须大于0' }]}
            >
              <InputNumber
                style={{
                  width: '100%',
                  background: '#0D1117',
                  borderColor: '#30363D',
                }}
                placeholder="请输入充值金额"
                precision={2}
                min={0.01}
                step={100}
                size="large"
                prefix="¥"
              />
            </Form.Item>

            <Form.Item label={<Text style={{ color: '#8B949E' }}>支付方式</Text>}>
              <Radio.Group
                value={paymentChannel}
                onChange={(e) => setPaymentChannel(e.target.value)}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <Radio
                    value="alipay"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: paymentChannel === 'alipay' ? 'rgba(24, 144, 255, 0.1)' : '#0D1117',
                      border: `1px solid ${paymentChannel === 'alipay' ? '#1890FF' : '#30363D'}`,
                      borderRadius: 8,
                    }}
                  >
                    <Space>
                      <AlipayCircleOutlined style={{ color: '#1890FF', fontSize: 24 }} />
                      <span style={{ color: '#E6EDF3', fontSize: 15 }}>支付宝</span>
                    </Space>
                  </Radio>
                  <Radio
                    value="wechat"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: paymentChannel === 'wechat' ? 'rgba(82, 196, 26, 0.1)' : '#0D1117',
                      border: `1px solid ${paymentChannel === 'wechat' ? '#52C41A' : '#30363D'}`,
                      borderRadius: 8,
                    }}
                  >
                    <Space>
                      <WechatOutlined style={{ color: '#52C41A', fontSize: 24 }} />
                      <span style={{ color: '#E6EDF3', fontSize: 15 }}>微信支付</span>
                    </Space>
                  </Radio>
                </Space>
              </Radio.Group>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 32 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={paymentLoading}
                style={{
                  background: paymentChannel === 'alipay'
                    ? 'linear-gradient(135deg, #1890FF 0%, #096DD9 100%)'
                    : 'linear-gradient(135deg, #52C41A 0%, #389E0D 100%)',
                  border: 'none',
                  height: 44,
                  fontSize: 16,
                  fontWeight: 500,
                  boxShadow: paymentChannel === 'alipay'
                    ? '0 4px 12px rgba(24, 144, 255, 0.3)'
                    : '0 4px 12px rgba(82, 196, 26, 0.3)',
                  transition: 'all 0.3s ease',
                }}
              >
                确认充值
              </Button>
            </Form.Item>
          </Form>
        )}

        {/* 支付中步骤 */}
        {paymentStep === 'paying' && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            {/* 金额显示 */}
            <div style={{ marginBottom: 20 }}>
              <Text style={{ color: '#8B949E', fontSize: 14 }}>充值金额</Text>
              <div style={{
                fontSize: 36,
                fontWeight: 700,
                color: '#E6EDF3',
                fontFamily: "'JetBrains Mono', 'DIN', monospace",
              }}>
                ¥{Number(paymentAmount || 0).toFixed(2)}
              </div>
            </div>

            {/* 支付方式图标 */}
            <div style={{ marginBottom: 16 }}>
              <Space>
                {paymentChannel === 'alipay' ? (
                  <>
                    <AlipayCircleOutlined style={{ color: '#1890FF', fontSize: 28 }} />
                    <Text style={{ color: '#1890FF', fontSize: 18, fontWeight: 500 }}>支付宝扫码支付</Text>
                  </>
                ) : (
                  <>
                    <WechatOutlined style={{ color: '#52C41A', fontSize: 28 }} />
                    <Text style={{ color: '#52C41A', fontSize: 18, fontWeight: 500 }}>微信扫码支付</Text>
                  </>
                )}
              </Space>
            </div>

            {/* 二维码区域 */}
            <div
              style={{
                display: 'inline-block',
                padding: 16,
                background: '#fff',
                borderRadius: 12,
                marginBottom: 20,
              }}
            >
              <QRCodeSVG
                value={qrCode}
                size={200}
                level="H"
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>

            {/* 等待提示 */}
            <div>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 16, color: paymentChannel === 'alipay' ? '#1890FF' : '#52C41A' }} spin />} />
              <Text style={{ color: '#8B949E', marginLeft: 8 }}>等待支付中...</Text>
            </div>

            {/* Mock模式：模拟支付完成按钮 */}
            {mockMode && (
              <div style={{ marginTop: 16 }}>
                <Button
                  type="primary"
                  size="large"
                  loading={confirmMockLoading}
                  onClick={handleConfirmMockPayment}
                  style={{
                    background: 'linear-gradient(135deg, #F0B90B 0%, #D4A00A 100%)',
                    border: 'none',
                    height: 44,
                    fontSize: 16,
                    fontWeight: 500,
                    boxShadow: '0 4px 12px rgba(240, 185, 11, 0.3)',
                  }}
                >
                  模拟支付完成（测试）
                </Button>
              </div>
            )}

            {/* 订单号 */}
            <div style={{ marginTop: 16 }}>
              <Text style={{ color: '#484F58', fontSize: 12 }}>订单号: {outTradeNo}</Text>
            </div>
          </div>
        )}

        {/* 支付成功步骤 */}
        {paymentStep === 'success' && (
          <div style={{ marginTop: 48, marginBottom: 48, textAlign: 'center' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52C41A', marginBottom: 24 }} />
            <div style={{ fontSize: 24, fontWeight: 600, color: '#E6EDF3', marginBottom: 8 }}>
              支付成功
            </div>
            <Text style={{ color: '#8B949E' }}>¥{Number(paymentAmount || 0).toFixed(2)} 已充值到您的账户</Text>
          </div>
        )}

        {/* 支付超时步骤 */}
        {paymentStep === 'timeout' && (
          <div style={{ marginTop: 48, marginBottom: 48, textAlign: 'center' }}>
            <CloseCircleOutlined style={{ fontSize: 64, color: '#00b96b', marginBottom: 24 }} />
            <div style={{ fontSize: 24, fontWeight: 600, color: '#E6EDF3', marginBottom: 8 }}>
              支付超时
            </div>
            <Text style={{ color: '#8B949E', display: 'block', marginBottom: 24 }}>请重新发起支付</Text>
            <Button
              type="primary"
              onClick={() => resetPaymentState()}
              style={{
                background: 'linear-gradient(135deg, #cf1322 0%, #ff4d4f 100%)',
                border: 'none',
              }}
            >
              重新支付
            </Button>
          </div>
        )}
      </Modal>

      {/* 提现弹窗 */}
      <Modal
        title={
          <Space>
            <MinusOutlined style={{ color: '#00b96b' }} />
            <Text style={{ color: '#E6EDF3' }}>账户提现</Text>
          </Space>
        }
        open={withdrawModalVisible}
        onCancel={() => {
          setWithdrawModalVisible(false)
          withdrawForm.resetFields()
        }}
        footer={null}
        width={400}
        styles={{
          content: {
            background: '#161B22',
            border: '1px solid #30363D',
            borderRadius: 12,
          },
        }}
      >
        <Form
          form={withdrawForm}
          onFinish={handleWithdraw}
          layout="vertical"
          style={{ marginTop: 24 }}
        >
          <div style={{ marginBottom: 16, padding: '12px 16px', background: '#0D1117', borderRadius: 8, border: '1px solid #30363D' }}>
            <Text style={{ color: '#8B949E', fontSize: 13 }}>当前可用余额</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#cf1322', fontFamily: "'JetBrains Mono', 'DIN', monospace" }}>
              ¥{Number(balance?.availableBalance || 0).toFixed(2)}
            </div>
          </div>

          <Form.Item
            name="amount"
            label={<Text style={{ color: '#8B949E' }}>提现金额</Text>}
            rules={[
              { required: true, message: '请输入提现金额' },
              { type: 'number', min: 0.01, message: '金额必须大于0' },
            ]}
          >
            <InputNumber
              style={{
                width: '100%',
                background: '#0D1117',
                borderColor: '#30363D',
              }}
              placeholder="请输入提现金额"
              precision={2}
              min={0.01}
              max={balance?.availableBalance || 0}
              step={100}
              size="large"
              prefix="¥"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<Text style={{ color: '#8B949E' }}>密码 <Text style={{ color: '#848E9C', fontSize: 12 }}>(选填)</Text></Text>}
            rules={[]}
          >
            <Input.Password
              style={{
                width: '100%',
                background: '#0D1117',
                borderColor: '#30363D',
              }}
              placeholder="可选，输入密码以提高安全性"
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 32 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={withdrawLoading}
              style={{
                background: 'linear-gradient(135deg, #00b96b 0%, #00d4aa 100%)',
                border: 'none',
                height: 44,
                fontSize: 16,
                fontWeight: 500,
                boxShadow: '0 4px 12px rgba(255, 77, 79, 0.3)',
                transition: 'all 0.3s ease',
              }}
            >
              确认提现
            </Button>
          </Form.Item>
        </Form>
      </Modal>

    </div>
  )
}

export default Portfolio
