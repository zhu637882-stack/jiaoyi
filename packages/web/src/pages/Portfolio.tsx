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
} from '@ant-design/icons'
import { accountApi, fundingApi, paymentApi } from '../services/api'
import { QRCodeSVG } from 'qrcode.react'
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
      color: isPositive ? '#FF4D4F' : isNegative ? '#00D4AA' : '#848E9C',
      background: isPositive ? 'rgba(255,77,79,0.1)' : isNegative ? 'rgba(0,212,170,0.1)' : 'transparent',
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
      // easeOutCubic
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
  const displayColor = isProfit ? (value >= 0 ? '#FF4D4F' : '#00D4AA') : color
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
  recharge: { label: '充值', color: '#FF4D4F' },
  withdraw: { label: '提现', color: '#00D4AA' },
  funding: { label: '投资', color: '#F0B90B' },
  principal_return: { label: '本金返还', color: '#FF4D4F' },
  profit_share: { label: '收益分配', color: '#FF4D4F' },
  loss_share: { label: '亏损分摊', color: '#00D4AA' },
  interest: { label: '利息', color: '#F0B90B' },
  sell: { label: '卖出', color: '#00D4AA' },
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

interface FundingOrder {
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
  queuePosition: number
  fundedAt: string
  totalProfit: number
  totalInterest: number
}

interface FundingSummary {
  totalHoldingAmount: number
  totalUnsettledPrincipal: number
  holdingOrderCount: number
  todayEstimatedProfit: number
}

interface FundingStats {
  totalFundingCount: number
  totalFundingAmount: number
  totalProfit: number
  totalLoss: number
  totalInterest: number
  netProfit: number
  averageHoldingDays: number
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

  // 持仓相关状态
  const [fundingOrders, setFundingOrders] = useState<FundingOrder[]>([])
  const [fundingPagination, setFundingPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  })
  const [fundingStatus, setFundingStatus] = useState<string | undefined>(undefined)
  const [fundingLoading, setFundingLoading] = useState(false)
  const [fundingSummary, setFundingSummary] = useState<FundingSummary | null>(null)
  const [fundingStats, setFundingStats] = useState<FundingStats | null>(null)

  useEffect(() => {
    fetchBalance()
  }, [])

  useEffect(() => {
    if (transactionPagination.page && activeTab === 'transactions') {
      fetchTransactions()
    }
  }, [transactionPagination.page, transactionPagination.pageSize, transactionType, activeTab])

  useEffect(() => {
    // 组件挂载时获取持仓概览数据
    fetchFundingSummary()
    fetchFundingStats()
  }, [])

  useEffect(() => {
    if (activeTab === 'holdings') {
      fetchFundingOrders()
      fetchFundingSummary()
      fetchFundingStats()
    }
  }, [fundingPagination.page, fundingPagination.pageSize, fundingStatus, activeTab])

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
      setTransactionPagination(response.pagination)
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setTransactionLoading(false)
    }
  }

  // 模拟充值（保留作为测试用途）
  const handleRecharge = async (values: { amount: number }) => {
    try {
      await accountApi.recharge(values.amount, '账户充值')
      message.success('充值成功')
      setRechargeModalVisible(false)
      rechargeForm.resetFields()
      fetchBalance()
      fetchTransactions()
    } catch (error: any) {
      message.error(error.response?.data?.message || '充值失败')
    }
  }

  // 提现方法
  const handleWithdraw = async (values: { amount: number; password?: string }) => {
    const availableBalance = balance?.availableBalance || 0
    if (values.amount <= 0) {
      message.error('提现金额必须大于0')
      return
    }
    if (values.amount > availableBalance) {
      message.error('提现金额不能超过可用余额')
      return
    }
    // 金额 > 5000 时必须输入密码
    if (values.amount > 5000 && !values.password) {
      message.error('提现金额超过5000元，需要输入密码')
      return
    }
    setWithdrawLoading(true)
    try {
      await accountApi.withdraw(values.amount, '账户提现', values.password)
      message.success('提现成功')
      setWithdrawModalVisible(false)
      withdrawForm.resetFields()
      fetchBalance()
      fetchTransactions()
    } catch (error: any) {
      message.error(error.response?.data?.message || '提现失败')
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

  // 持仓相关方法
  const fetchFundingOrders = async () => {
    setFundingLoading(true)
    try {
      const response = await fundingApi.getFundingOrders({
        status: fundingStatus,
        page: fundingPagination.page,
        pageSize: fundingPagination.pageSize,
      })
      setFundingOrders(response.data?.list || [])
      setFundingPagination(response.data?.pagination)
    } catch (error) {
      console.error('Failed to fetch funding orders:', error)
    } finally {
      setFundingLoading(false)
    }
  }

  const fetchFundingSummary = async () => {
    try {
      const response = await fundingApi.getActiveFunding()
      setFundingSummary(response.data)
    } catch (error) {
      console.error('Failed to fetch funding summary:', error)
    }
  }

  const fetchFundingStats = async () => {
    try {
      const response = await fundingApi.getFundingStatistics()
      setFundingStats(response.data)
    } catch (error) {
      console.error('Failed to fetch funding stats:', error)
    }
  }

  // 格式化金额


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

  // 生成模拟趋势数据（7天）
  const generateTrendData = useMemo(() => {
    const baseData: Record<string, number[]> = {
      balance: [1200, 1350, 1280, 1420, 1380, 1500, balance?.availableBalance || 0],
      profit: [80, 120, 95, 150, 130, 180, balance?.totalProfit || 0],
      invested: [5000, 5200, 5500, 5800, 6000, 6200, balance?.totalInvested || 0],
      holding: [3000, 3200, 3500, 3800, 4000, 4200, fundingSummary?.totalHoldingAmount || 0],
    }
    return baseData
  }, [balance, fundingSummary])

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
          ['recharge', 'principal_return', 'profit_share', 'interest'].includes(record.type)
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

  // 持仓表格列
  const holdingColumns = [
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
      render: (text: string, record: FundingOrder) => (
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
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'center' as const,
      render: (text: number) => (
        <Text style={{ color: '#E6EDF3', fontFamily: 'monospace' }}>{text}盒</Text>
      ),
    },
    {
      title: '金额',
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
      title: '未结清本金',
      dataIndex: 'unsettledAmount',
      key: 'unsettledAmount',
      width: 120,
      align: 'right' as const,
      render: (text: number) => (
        <Text style={{ color: '#FAAD14', fontFamily: 'monospace' }}>
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
        const configs: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; text: string }> = {
          'holding': {
            color: '#00D4AA',
            bg: 'rgba(0,212,170,0.1)',
            border: '1px solid rgba(0,212,170,0.3)',
            icon: <span className="status-dot status-pulse" style={{ background: '#00D4AA', display: 'inline-block', width: 6, height: 6, borderRadius: '50%', marginRight: 6 }} />,
            text: '持仓中',
          },
          'partial_settled': {
            color: '#FAAD14',
            bg: 'rgba(250,173,20,0.1)',
            border: '1px solid rgba(250,173,20,0.3)',
            icon: <LoadingOutlined spin style={{ marginRight: 4 }} />,
            text: '部分结算',
          },
          'settled': {
            color: '#1890FF',
            bg: 'rgba(24,144,255,0.1)',
            border: '1px solid rgba(24,144,255,0.3)',
            icon: <CheckCircleOutlined style={{ marginRight: 4 }} />,
            text: '已结算',
          },
        }
        const config = configs[status] || { color: '#8B949E', bg: 'rgba(139,148,158,0.1)', border: '1px solid rgba(139,148,158,0.3)', icon: null, text: status }
        return (
          <Tag
            style={{
              background: config.bg,
              border: config.border,
              color: config.color,
              fontSize: 11,
              margin: 0,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {config.icon}
            {config.text}
          </Tag>
        )
      },
    },
    {
      title: '排队',
      dataIndex: 'queuePosition',
      key: 'queuePosition',
      width: 70,
      align: 'center' as const,
      render: (text: number) => (
        <Text style={{ color: '#1890FF', fontFamily: 'monospace' }}>#{text}</Text>
      ),
    },
    {
      title: '垫资时间',
      dataIndex: 'fundedAt',
      key: 'fundedAt',
      width: 140,
      render: (text: string) => (
        <Text style={{ color: '#8B949E', fontSize: 12 }}>
          {dayjs(text).format('MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      title: '累计收益',
      dataIndex: 'totalProfit',
      key: 'totalProfit',
      width: 120,
      align: 'right' as const,
      render: (text: number, record: FundingOrder) => {
        const total = Number(text) + Number(record.totalInterest || 0)
        return renderProfitCell(total)
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: FundingOrder) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/trade/${record.drugId}`)}
        >
          查看
        </Button>
      ),
    },
  ]

  // 渲染持仓概览卡片
  const renderHoldingOverview = () => (
    <Row gutter={[16, 12]} className="portfolio-overview-row">
      <Col xs={12} sm={12} md={12} lg={6}>
        <StatCard
          title="总持仓金额"
          value={fundingSummary?.totalHoldingAmount || 0}
          icon={<ShoppingOutlined style={{ color: '#1890FF' }} />}
          color="#1890FF"
          sparklineData={generateTrendData.holding}
        />
      </Col>

      <Col xs={12} sm={12} md={12} lg={6}>
        <StatCard
          title="未结清本金"
          value={fundingSummary?.totalUnsettledPrincipal || 0}
          icon={<LockOutlined style={{ color: '#FAAD14' }} />}
          color="#FAAD14"
        />
      </Col>

      <Col xs={12} sm={12} md={12} lg={6}>
        <StatCard
          title="累计收益"
          value={fundingStats?.netProfit || 0}
          icon={<WalletOutlined style={{ color: (fundingStats?.netProfit || 0) >= 0 ? '#00D4AA' : '#FF4D4F' }} />}
          color="#00D4AA"
          isProfit
          sparklineData={generateTrendData.profit}
        />
      </Col>

      <Col xs={12} sm={12} md={12} lg={6}>
        <StatCard
          title="今日预估收益"
          value={fundingSummary?.todayEstimatedProfit || 0}
          icon={<BarChartOutlined style={{ color: '#00D4AA' }} />}
          color="#00D4AA"
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
            icon={<DollarOutlined style={{ color: '#00D4AA' }} />}
            color="#00D4AA"
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
            icon={<WalletOutlined style={{ color: (balance?.totalProfit || 0) >= 0 ? '#00D4AA' : '#FF4D4F' }} />}
            color="#00D4AA"
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
                <span>持仓概览</span>
              </Space>
            ),
            children: (
              <>
                {renderHoldingOverview()}
                {/* 持仓统计卡片 */}
                <Row gutter={[16, 12]}>
                  <Col xs={12} sm={12} md={8} lg={8}>
                    <Card className="portfolio-stats-card">
                      <Text style={{ color: '#8B949E', fontSize: 13 }}>总垫资次数</Text>
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
                        <span>{fundingStats?.totalFundingCount || 0}</span>
                        <Text style={{ color: '#8B949E', fontSize: 14, fontWeight: 400 }}>笔</Text>
                      </div>
                    </Card>
                  </Col>
                  <Col xs={12} sm={12} md={8} lg={8}>
                    <Card className="portfolio-stats-card">
                      <Text style={{ color: '#8B949E', fontSize: 13 }}>总垫资金额</Text>
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
                        ¥{Number(fundingStats?.totalFundingAmount || 0).toFixed(2)}
                      </div>
                    </Card>
                  </Col>
                  <Col xs={12} sm={12} md={8} lg={8}>
                    <Card className="portfolio-stats-card">
                      <Text style={{ color: '#8B949E', fontSize: 13 }}>平均持仓天数</Text>
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
                        <span>{fundingStats?.averageHoldingDays || 0}</span>
                        <Text style={{ color: '#8B949E', fontSize: 14, fontWeight: 400 }}>天</Text>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </>
            ),
          },
          {
            key: 'holdings',
            label: (
              <Space>
                <ShoppingOutlined />
                <span>我的持仓</span>
              </Space>
            ),
            children: (
              <Card
                className="portfolio-table-card"
                title={
                  <Space>
                    <ShoppingOutlined style={{ color: '#1890FF' }} />
                    <Text style={{ color: '#E6EDF3', fontSize: 16, fontWeight: 500 }}>
                      持仓订单
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
                      value={fundingStatus}
                      onChange={(value) => {
                        setFundingStatus(value)
                        setFundingPagination({ ...fundingPagination, page: 1 })
                      }}
                      dropdownStyle={{ background: '#161B22', border: '1px solid #30363D' }}
                    >
                      <Option value="holding">持仓中</Option>
                      <Option value="partial_settled">部分结算</Option>
                      <Option value="settled">已结算</Option>
                    </Select>
                  </Space>
                }
                bodyStyle={{ padding: 0 }}
              >
                <Table
                  columns={holdingColumns}
                  dataSource={fundingOrders}
                  rowKey="id"
                  loading={fundingLoading}
                  pagination={false}
                  scroll={{ x: 'max-content', y: 'calc(100vh - 480px)' }}
                  sticky={true}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={<Text style={{ color: '#8B949E' }}>暂无持仓订单</Text>}
                        className="portfolio-empty"
                      />
                    ),
                  }}
                  className="portfolio-table"
                  rowClassName={() => 'portfolio-row'}
                />
                <div className="portfolio-pagination">
                  <Pagination
                    current={fundingPagination.page}
                    pageSize={fundingPagination.pageSize}
                    total={fundingPagination.total}
                    showSizeChanger
                    showQuickJumper
                    showTotal={(total) => `共 ${total} 条记录`}
                    onChange={(page, pageSize) => {
                      setFundingPagination({ ...fundingPagination, page, pageSize: pageSize || 10 })
                    }}
                    onShowSizeChange={(_, size) => {
                      setFundingPagination({ ...fundingPagination, page: 1, pageSize: size })
                    }}
                  />
                </div>
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
                      <Option value="recharge">充值</Option>
                      <Option value="withdraw">提现</Option>
                      <Option value="funding">投资</Option>
                      <Option value="principal_return">本金返还</Option>
                      <Option value="profit_share">收益分配</Option>
                      <Option value="loss_share">亏损分摊</Option>
                      <Option value="interest">利息</Option>
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
        ]}
      />

      {/* 充值弹窗 */}
      <Modal
        title={
          <Space>
            <PlusOutlined style={{ color: '#00D4AA' }} />
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
            <Form.Item style={{ marginBottom: 0, marginTop: 12 }}>
              <Button
                size="large"
                block
                onClick={() => {
                  rechargeForm.validateFields().then((values) => {
                    handleRecharge(values)
                  })
                }}
                style={{
                  background: 'transparent',
                  border: '1px dashed #30363D',
                  height: 44,
                  fontSize: 14,
                  color: '#8B949E',
                  transition: 'all 0.3s ease',
                }}
              >
                模拟充值（测试）
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
            <CloseCircleOutlined style={{ fontSize: 64, color: '#FF4D4F', marginBottom: 24 }} />
            <div style={{ fontSize: 24, fontWeight: 600, color: '#E6EDF3', marginBottom: 8 }}>
              支付超时
            </div>
            <Text style={{ color: '#8B949E', display: 'block', marginBottom: 24 }}>请重新发起支付</Text>
            <Button
              type="primary"
              onClick={() => resetPaymentState()}
              style={{
                background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
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
            <MinusOutlined style={{ color: '#FF4D4F' }} />
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
            <div style={{ fontSize: 24, fontWeight: 700, color: '#00D4AA', fontFamily: "'JetBrains Mono', 'DIN', monospace" }}>
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
            label={<Text style={{ color: '#8B949E' }}>密码 {withdrawForm.getFieldValue('amount') > 5000 ? <Text style={{ color: '#FF4D4F' }}>*</Text> : <Text style={{ color: '#848E9C', fontSize: 12 }}>(金额&gt;5000时必填)</Text>}</Text>}
            rules={
              withdrawForm.getFieldValue('amount') > 5000
                ? [{ required: true, message: '请输入密码' }]
                : []
            }
          >
            <Input.Password
              style={{
                width: '100%',
                background: '#0D1117',
                borderColor: '#30363D',
              }}
              placeholder={withdrawForm.getFieldValue('amount') > 5000 ? '请输入密码' : '金额超过5000元时需要输入密码'}
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
                background: 'linear-gradient(135deg, #FF4D4F 0%, #CF1322 100%)',
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
