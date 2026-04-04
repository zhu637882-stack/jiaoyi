import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  InputNumber,
  Form,
  Divider,
  Table,
  Tag,
  Modal,
  message,
  Spin,
  Progress,
  Space,
} from 'antd'
import {
  ShoppingCartOutlined,
  WalletOutlined,
  LineChartOutlined,
  HistoryOutlined,
  NumberOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import { drugApi, fundingApi, accountApi } from '../services/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography

// 订单状态映射
const orderStatusMap: Record<string, { label: string; color: string }> = {
  holding: { label: '持仓中', color: '#1890FF' },
  partial_settled: { label: '部分结算', color: '#FAAD14' },
  settled: { label: '已结算', color: '#00D4AA' },
  pending: { label: '待处理', color: '#8B949E' },
}

interface DrugInfo {
  id: string
  name: string
  code: string
  purchasePrice: number
  sellingPrice: number
  totalQuantity: number
  fundedQuantity: number
  remainingQuantity: number
  annualRate: number
  fundingProgress: number
  totalFundingAmount: number
}

interface QueueItem {
  queuePosition: number
  quantity: number
  amount: number
  status: string
  cumulativeAmount: number
}

interface HoldingOrder {
  id: string
  orderNo: string
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

const Trade = () => {
  const { drugId } = useParams<{ drugId: string }>()

  const [form] = Form.useForm()

  // 状态
  const [,] = useState(false)
  const [drugInfo, setDrugInfo] = useState<DrugInfo | null>(null)
  const [balance, setBalance] = useState<number>(0)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [holdings, setHoldings] = useState<HoldingOrder[]>([])
  const [quantity, setQuantity] = useState<number>(1)
  const [confirmModalVisible, setConfirmModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeRatio, setActiveRatio] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  // 响应式检测
  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < 768)
  }, [])

  useEffect(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [checkMobile])

  // 计算预计金额和收益
  const estimatedAmount = useMemo(() => {
    if (!drugInfo) return 0
    return Number(Number(quantity * drugInfo.purchasePrice || 0).toFixed(2))
  }, [quantity, drugInfo])

  const estimatedDailyProfit = useMemo(() => {
    if (!drugInfo) return 0
    return Number(Number((estimatedAmount * drugInfo.annualRate) / 100 / 360 || 0).toFixed(2))
  }, [estimatedAmount, drugInfo])

  const maxQuantity = useMemo(() => {
    if (!drugInfo || !balance) return 0
    const maxByBalance = Math.floor(balance / drugInfo.purchasePrice)
    const maxByDrug = drugInfo.remainingQuantity
    return Math.min(maxByBalance, maxByDrug)
  }, [drugInfo, balance])

  // 加载数据
  useEffect(() => {
    if (drugId) {
      fetchDrugInfo()
      fetchQueue()
      fetchHoldings()
    }
    fetchBalance()
  }, [drugId])

  const fetchDrugInfo = async () => {
    try {
      const response = await drugApi.getDrugById(drugId!)
      if (response.success) {
        setDrugInfo(response.data)
      }
    } catch (error) {
      message.error('获取药品信息失败')
    }
  }

  const fetchBalance = async () => {
    try {
      const response = await accountApi.getBalance()
      setBalance(response.availableBalance || 0)
    } catch (error) {
      console.error('获取余额失败:', error)
    }
  }

  const fetchQueue = async () => {
    try {
      const response = await fundingApi.getFundingQueue(drugId!)
      if (response.success) {
        setQueue(response.data.queue || [])
      }
    } catch (error) {
      console.error('获取排队队列失败:', error)
    }
  }

  const fetchHoldings = async () => {
    try {
      const response = await fundingApi.getDrugHoldings(drugId!)
      if (response.success) {
        setHoldings(response.data || [])
      }
    } catch (error) {
      console.error('获取持仓失败:', error)
    }
  }

  // 快捷比例按钮
  const handleRatioClick = (ratio: number) => {
    if (!drugInfo || maxQuantity <= 0) return
    const qty = Math.max(1, Math.floor(maxQuantity * ratio))
    setQuantity(qty)
    setActiveRatio(ratio)
    setActiveAmount(null)
    form.setFieldsValue({ quantity: qty })
  }

  // 快捷金额按钮
  const [activeAmount, setActiveAmount] = useState<number | 'all' | null>(null)

  const handleAmountClick = (amount: number | 'all') => {
    if (!drugInfo || maxQuantity <= 0) return
    let qty: number
    if (amount === 'all') {
      qty = maxQuantity
      setActiveAmount('all')
    } else {
      qty = Math.max(1, Math.floor(amount / drugInfo.purchasePrice))
      // 确保不超过最大数量
      qty = Math.min(qty, maxQuantity)
      setActiveAmount(amount)
    }
    setQuantity(qty)
    setActiveRatio(null)
    form.setFieldsValue({ quantity: qty })
  }

  // 数量变化
  const handleQuantityChange = (value: number | null) => {
    const qty = value || 1
    setQuantity(Math.max(1, qty))
    setActiveRatio(null)
    setActiveAmount(null)
  }

  // 提交订单
  const handleSubmit = () => {
    if (quantity < 1) {
      message.error('最少垫资1盒')
      return
    }
    if (estimatedAmount > balance) {
      message.error('可用余额不足')
      return
    }
    setConfirmModalVisible(true)
  }

  const handleConfirmOrder = async () => {
    setSubmitting(true)
    try {
      const response = await fundingApi.createFundingOrder({
        drugId: drugId!,
        quantity,
      })
      if (response.success) {
        message.success('垫资订单创建成功')
        setConfirmModalVisible(false)
        // 重置表单
        setQuantity(1)
        form.resetFields()
        setActiveRatio(null)
        // 刷新数据
        fetchBalance()
        fetchDrugInfo()
        fetchQueue()
        fetchHoldings()
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建订单失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 深度图配置
  const depthChartOption = useMemo(() => {
    if (!queue.length) {
      return {
        backgroundColor: 'transparent',
        grid: { left: 60, right: 20, top: 20, bottom: 30 },
        xAxis: { type: 'category', data: [], axisLine: { lineStyle: { color: '#30363D' } } },
        yAxis: { type: 'value', axisLine: { lineStyle: { color: '#30363D' } } },
        series: [],
      }
    }

    const data = queue.slice(0, 20).map((item) => ({
      position: item.queuePosition,
      amount: item.amount,
      cumulative: item.cumulativeAmount,
    }))

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#161B22',
        borderColor: '#30363D',
        textStyle: { color: '#E6EDF3' },
        formatter: (params: any) => {
          const item = data[params[0].dataIndex]
          return `
            <div style="padding: 8px;">
              <div style="color: #8B949E; font-size: 12px;">排队序号: #${item.position}</div>
              <div style="color: #E6EDF3; font-size: 14px; margin-top: 4px;">
                金额: <span style="color: #1890FF;">¥${Number(item.amount || 0).toFixed(2)}</span>
              </div>
              <div style="color: #8B949E; font-size: 12px; margin-top: 4px;">
                累计: ¥${Number(item.cumulative || 0).toFixed(2)}
              </div>
            </div>
          `
        },
      },
      grid: {
        left: 60,
        right: 20,
        top: 20,
        bottom: 30,
      },
      xAxis: {
        type: 'category',
        data: data.map((d) => `#${d.position}`),
        axisLine: { lineStyle: { color: '#30363D' } },
        axisLabel: { color: '#8B949E', fontSize: 10 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#21262D' } },
        axisLabel: {
          color: '#8B949E',
          fontSize: 10,
          formatter: (value: number) => `¥${Number((value / 1000) || 0).toFixed(0)}k`,
        },
      },
      series: [
        {
          name: '垫资金额',
          type: 'bar',
          data: data.map((d) => d.amount),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#1890FF' },
              { offset: 1, color: '#096DD9' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
          barWidth: '60%',
        },
      ],
    }
  }, [queue])

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
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'center' as const,
      render: (text: number) => (
        <Text style={{ color: '#E6EDF3', fontFamily: 'monospace' }}>
          {text}盒
        </Text>
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
      title: '未结清',
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
        const config = orderStatusMap[status] || { label: status, color: '#8B949E' }
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
      title: '排队',
      dataIndex: 'queuePosition',
      key: 'queuePosition',
      width: 70,
      align: 'center' as const,
      render: (text: number) => (
        <Text style={{ color: '#1890FF', fontFamily: 'monospace' }}>
          #{text}
        </Text>
      ),
    },
    {
      title: '垫资时间',
      dataIndex: 'fundedAt',
      key: 'fundedAt',
      width: 150,
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
      render: (text: number, record: HoldingOrder) => {
        const total = Number(text) + Number(record.totalInterest || 0)
        return (
          <Text
            style={{
              color: total >= 0 ? '#00D4AA' : '#FF4D4F',
              fontFamily: 'monospace',
              fontWeight: 600,
            }}
          >
            {total >= 0 ? '+' : ''}¥{Number(total || 0).toFixed(2)}
          </Text>
        )
      },
    },
    {
      title: '浮动盈亏',
      key: 'floatingPnL',
      width: 120,
      align: 'right' as const,
      render: (_: unknown, record: HoldingOrder) => {
        // 浮动盈亏 = (当前售价 - 采购价) * 未结算数量
        const unsettledQty = record.quantity - (record.settledQuantity || 0)
        const floatingPnL = profitMargin * unsettledQty
        const isPositive = floatingPnL >= 0
        return (
          <Text
            style={{
              color: isPositive ? '#00D4AA' : '#FF4D4F',
              fontFamily: "'JetBrains Mono', 'DIN', monospace",
              fontWeight: 600,
            }}
          >
            {isPositive ? '+' : ''}¥{Number(floatingPnL || 0).toFixed(2)}
          </Text>
        )
      },
    },
  ]

  if (!drugInfo) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  const profitMargin = drugInfo.sellingPrice - drugInfo.purchasePrice
  const profitMarginPercent = (profitMargin / drugInfo.purchasePrice) * 100

  return (
    <div style={{ padding: 12 }}>
      {/* 药品信息摘要条 */}
      <div
        style={{
          background: '#161B22',
          border: '1px solid #30363D',
          borderRadius: '8px',
          padding: '12px 20px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#E6EDF3', fontWeight: 600, fontSize: 15 }}>{drugInfo.name}</Text>
          <Text style={{ color: '#8B949E', fontSize: 12, fontFamily: "'JetBrains Mono', 'DIN', monospace" }}>
            | {drugInfo.code}
          </Text>
        </div>
        <Divider type="vertical" style={{ background: '#30363D', height: 20, margin: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#8B949E', fontSize: 12 }}>采购价</Text>
          <Text style={{ color: '#E6EDF3', fontFamily: "'JetBrains Mono', 'DIN', monospace", fontWeight: 500 }}>
            ¥{Number(drugInfo.purchasePrice || 0).toFixed(2)}
          </Text>
        </div>
        <Divider type="vertical" style={{ background: '#30363D', height: 20, margin: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#8B949E', fontSize: 12 }}>售价</Text>
          <Text style={{ color: '#E6EDF3', fontFamily: "'JetBrains Mono', 'DIN', monospace", fontWeight: 500 }}>
            ¥{Number(drugInfo.sellingPrice || 0).toFixed(2)}
          </Text>
        </div>
        <Divider type="vertical" style={{ background: '#30363D', height: 20, margin: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#8B949E', fontSize: 12 }}>毛利</Text>
          <Text style={{ color: '#00D4AA', fontFamily: "'JetBrains Mono', 'DIN', monospace", fontWeight: 600 }}>
            +¥{Number(profitMargin || 0).toFixed(2)}
          </Text>
        </div>
        <Divider type="vertical" style={{ background: '#30363D', height: 20, margin: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#8B949E', fontSize: 12 }}>年化</Text>
          <Text style={{ color: '#00D4AA', fontFamily: "'JetBrains Mono', 'DIN', monospace", fontWeight: 600 }}>
            {Number(drugInfo.annualRate || 0).toFixed(2)}%
          </Text>
        </div>
        <Divider type="vertical" style={{ background: '#30363D', height: 20, margin: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#8B949E', fontSize: 12 }}>日收益</Text>
          <Text style={{ color: '#00D4AA', fontFamily: "'JetBrains Mono', 'DIN', monospace", fontWeight: 600 }}>
            +{Number((drugInfo.annualRate || 0) / 360 || 0).toFixed(4)}%
          </Text>
        </div>
        <Divider type="vertical" style={{ background: '#30363D', height: 20, margin: 0 }} />
        <Tag
          style={{
            background: drugInfo.remainingQuantity > 0 ? 'rgba(0, 212, 170, 0.15)' : 'rgba(255, 77, 79, 0.15)',
            border: `1px solid ${drugInfo.remainingQuantity > 0 ? '#00D4AA' : '#FF4D4F'}`,
            color: drugInfo.remainingQuantity > 0 ? '#00D4AA' : '#FF4D4F',
            margin: 0,
          }}
        >
          {drugInfo.remainingQuantity > 0 ? '可垫资' : '已售罄'}
        </Tag>
      </div>

      {/* 两列布局 - 小屏幕上下排列 */}
      <Row gutter={[16, 16]}>
        {/* 左侧信息面板 - 药品信息和深度图 */}
        <Col xs={24} lg={14}>
          <Row gutter={[16, 16]}>
            {/* 药品信息卡片 */}
            <Col xs={24} lg={8}>
              <Card
                style={{
                  background: '#161B22',
                  border: '1px solid #30363D',
                  borderRadius: '8px',
                  height: '100%',
                }}
                bodyStyle={{ padding: 20 }}
              >
                {/* 药品名称 */}
                <div style={{ marginBottom: 20 }}>
                  <Text style={{ color: '#8B949E', fontSize: 12 }}>药品名称</Text>
                  <Title level={4} style={{ color: '#E6EDF3', margin: '4px 0 0' }}>
                    {drugInfo.name}
                  </Title>
                  <Text style={{ color: '#8B949E', fontSize: 12, fontFamily: 'monospace' }}>
                    {drugInfo.code}
                  </Text>
                </div>

                <Divider style={{ borderColor: '#30363D', margin: '16px 0' }} />

                {/* 价格信息 */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: '#8B949E', fontSize: 12 }}>采购价（成本）</Text>
                    <Text style={{ color: '#E6EDF3', fontFamily: 'monospace' }}>
                      ¥{Number(drugInfo.purchasePrice || 0).toFixed(2)}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: '#8B949E', fontSize: 12 }}>售价（市场价）</Text>
                    <Text style={{ color: '#E6EDF3', fontFamily: 'monospace' }}>
                      ¥{Number(drugInfo.sellingPrice || 0).toFixed(2)}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#8B949E', fontSize: 12 }}>毛利</Text>
                    <Text style={{ color: '#00D4AA', fontFamily: 'monospace', fontWeight: 600 }}>
                      +¥{Number(profitMargin || 0).toFixed(2)} ({Number(profitMarginPercent || 0).toFixed(1)}%)
                    </Text>
                  </div>
                </div>

                <Divider style={{ borderColor: '#30363D', margin: '16px 0' }} />

                {/* 年化收益率 */}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div
                    style={{
                      display: 'inline-block',
                      background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.15) 0%, rgba(0, 212, 170, 0.05) 100%)',
                      border: '1px solid rgba(0, 212, 170, 0.3)',
                      borderRadius: '12px',
                      padding: '16px 32px',
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: '#8B949E', fontSize: 12, display: 'block', marginBottom: 4 }}>年化收益率</Text>
                    <div
                      style={{
                        fontSize: 40,
                        fontWeight: 700,
                        color: '#00D4AA',
                        fontFamily: "'JetBrains Mono', 'DIN', monospace",
                        textShadow: '0 0 24px rgba(0, 212, 170, 0.4)',
                        background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      {Number(drugInfo.annualRate || 0).toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* 垫资进度 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: '#8B949E', fontSize: 12 }}>垫资进度</Text>
                    <Text style={{ color: '#E6EDF3', fontSize: 12 }}>
                      {drugInfo.fundedQuantity.toLocaleString()} / {drugInfo.totalQuantity.toLocaleString()} 盒
                    </Text>
                  </div>
                  <Progress
                    percent={drugInfo.fundingProgress}
                    strokeColor={{ from: '#1890FF', to: '#00D4AA' }}
                    trailColor="#21262D"
                    strokeWidth={8}
                    showInfo={false}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={{ color: '#8B949E', fontSize: 11 }}>
                      已垫: ¥{Number((drugInfo.totalFundingAmount / 10000) || 0).toFixed(2)}万
                    </Text>
                    <Text style={{ color: '#00D4AA', fontSize: 11 }}>
                      剩余: {drugInfo.remainingQuantity.toLocaleString()}盒
                    </Text>
                  </div>
                </div>
              </Card>
            </Col>

            {/* 深度图卡片 */}
            <Col xs={24} lg={16}>
              <Card
                title={
                  <Space>
                    <LineChartOutlined style={{ color: '#1890FF' }} />
                    <Text style={{ color: '#E6EDF3' }}>垫资深度图</Text>
                  </Space>
                }
                style={{
                  background: '#161B22',
                  border: '1px solid #30363D',
                  borderRadius: '8px',
                  height: '100%',
                }}
                bodyStyle={{ padding: 16 }}
              >
                {queue.length > 0 ? (
                  <ReactECharts
                    option={depthChartOption}
                    style={{ height: isMobile ? 260 : 320, width: '100%' }}
                    theme="dark"
                  />
                ) : (
                  <div
                    style={{
                      height: isMobile ? 260 : 320,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                    }}
                  >
                    <LineChartOutlined style={{ fontSize: 48, color: '#30363D', marginBottom: 16 }} />
                    <Text style={{ color: '#8B949E' }}>暂无排队数据</Text>
                  </div>
                )}

                {/* 队列统计 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    padding: '16px 0 0',
                    borderTop: '1px solid #30363D',
                    marginTop: 16,
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <Text style={{ color: '#8B949E', fontSize: 12, display: 'block' }}>
                      排队笔数
                    </Text>
                    <Text
                      style={{
                        color: '#E6EDF3',
                        fontSize: 20,
                        fontWeight: 600,
                        fontFamily: 'monospace',
                      }}
                    >
                      {queue.length}
                    </Text>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Text style={{ color: '#8B949E', fontSize: 12, display: 'block' }}>
                      排队总金额
                    </Text>
                    <Text
                      style={{
                        color: '#1890FF',
                        fontSize: 20,
                        fontWeight: 600,
                        fontFamily: 'monospace',
                      }}
                    >
                      ¥{Number(queue[queue.length - 1]?.cumulativeAmount || 0).toFixed(0)}
                    </Text>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Text style={{ color: '#8B949E', fontSize: 12, display: 'block' }}>
                      平均单笔
                    </Text>
                    <Text
                      style={{
                        color: '#E6EDF3',
                        fontSize: 20,
                        fontWeight: 600,
                        fontFamily: 'monospace',
                      }}
                    >
                      ¥
                      {queue.length
                        ? Number((queue.reduce((sum, q) => sum + q.amount, 0) / queue.length) || 0).toFixed(0)
                        : 0}
                    </Text>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </Col>

        {/* 右侧交易面板 */}
        <Col xs={24} lg={10}>
          <Card
            style={{
              background: '#161B22',
              border: '1px solid #30363D',
              borderRadius: '8px',
              height: '100%',
            }}
            bodyStyle={{ padding: 20 }}
          >
            {/* 标题 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 20,
                paddingBottom: 16,
                borderBottom: '1px solid #30363D',
              }}
            >
              <div
                style={{
                  width: 4,
                  height: 20,
                  background: 'linear-gradient(180deg, #1890FF 0%, #096DD9 100%)',
                  borderRadius: 2,
                }}
              />
              <Title level={5} style={{ color: '#E6EDF3', margin: 0 }}>
                垫资买入
              </Title>
            </div>

            {/* 可用余额 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#0D1117',
                borderRadius: 8,
                marginBottom: 20,
                border: '1px solid #30363D',
              }}
            >
              <Space>
                <WalletOutlined style={{ color: '#00D4AA' }} />
                <Text style={{ color: '#8B949E' }}>可用余额</Text>
              </Space>
              <Text
                style={{
                  color: '#00D4AA',
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', 'DIN', monospace",
                }}
              >
                ¥{Number(balance || 0).toFixed(2)}
              </Text>
            </div>

            <Form form={form} layout="vertical">
              {/* 数量输入 */}
              <Form.Item
                label={<Text style={{ color: '#8B949E' }}>垫资数量（盒）</Text>}
                style={{ marginBottom: 12 }}
              >
                <InputNumber
                  min={1}
                  max={maxQuantity}
                  value={quantity}
                  onChange={handleQuantityChange}
                  style={{
                    width: '100%',
                    background: '#0D1117',
                    borderColor: '#30363D',
                  }}
                  size="large"
                  precision={0}
                  addonBefore={<NumberOutlined style={{ color: '#8B949E' }} />}
                  disabled={maxQuantity <= 0}
                />
              </Form.Item>

              {/* 快捷金额按钮 */}
              <div style={{ marginBottom: 12 }}>
                <Text style={{ color: '#8B949E', fontSize: 12, display: 'block', marginBottom: 8 }}>快捷金额</Text>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[1000, 5000, 10000, 50000].map((amount) => (
                    <Button
                      key={amount}
                      size="small"
                      onClick={() => handleAmountClick(amount)}
                      style={{
                        background: activeAmount === amount ? '#1890FF' : '#21262D',
                        border: '1px solid',
                        borderColor: activeAmount === amount ? '#1890FF' : '#30363D',
                        color: activeAmount === amount ? '#fff' : '#8B949E',
                        fontFamily: "'JetBrains Mono', 'DIN', monospace",
                        fontSize: 12,
                      }}
                      disabled={maxQuantity <= 0}
                    >
                      ¥{Number(amount / 1000 || 0).toFixed(0)}K
                    </Button>
                  ))}
                  <Button
                    size="small"
                    onClick={() => handleAmountClick('all')}
                    style={{
                      background: activeAmount === 'all' ? '#1890FF' : '#21262D',
                      border: '1px solid',
                      borderColor: activeAmount === 'all' ? '#1890FF' : '#30363D',
                      color: activeAmount === 'all' ? '#fff' : '#8B949E',
                      fontSize: 12,
                    }}
                    disabled={maxQuantity <= 0}
                  >
                    全部
                  </Button>
                </div>
              </div>

              {/* 快捷比例按钮 */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[0.25, 0.5, 0.75, 1].map((ratio) => (
                  <Button
                    key={ratio}
                    onClick={() => handleRatioClick(ratio)}
                    style={{
                      flex: 1,
                      background: activeRatio === ratio ? '#1890FF' : '#0D1117',
                      borderColor: activeRatio === ratio ? '#1890FF' : '#30363D',
                      color: activeRatio === ratio ? '#fff' : '#8B949E',
                    }}
                    disabled={maxQuantity <= 0}
                  >
                    {ratio === 1 ? '全部' : `${Number(ratio * 100 || 0).toFixed(0)}%`}
                  </Button>
                ))}
              </div>

              {/* 预计信息 */}
              <div
                style={{
                  background: '#0D1117',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 20,
                  border: '1px solid #30363D',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ color: '#8B949E' }}>预计金额</Text>
                  <Text
                    style={{
                      color: '#E6EDF3',
                      fontSize: 16,
                      fontWeight: 600,
                      fontFamily: "'JetBrains Mono', 'DIN', monospace",
                    }}
                  >
                    ¥{Number(estimatedAmount || 0).toFixed(2)}
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#8B949E' }}>预计日收益（参考）</Text>
                  <Text
                    style={{
                      color: '#00D4AA',
                      fontFamily: "'JetBrains Mono', 'DIN', monospace",
                    }}
                  >
                    +¥{Number(estimatedDailyProfit || 0).toFixed(2)}
                  </Text>
                </div>
              </div>

              {/* 确认按钮 */}
              <Button
                type="primary"
                size="large"
                block
                icon={<ShoppingCartOutlined />}
                onClick={handleSubmit}
                disabled={maxQuantity <= 0 || quantity < 1 || estimatedAmount > balance}
                style={{
                  height: 48,
                  fontSize: 16,
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #1890FF 0%, #096DD9 100%)',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(24, 144, 255, 0.4)',
                }}
              >
                确认垫资
              </Button>

              {maxQuantity <= 0 && (
                <Text
                  style={{
                    color: '#FF4D4F',
                    fontSize: 12,
                    display: 'block',
                    textAlign: 'center',
                    marginTop: 8,
                  }}
                >
                  余额不足或药品已售罄
                </Text>
              )}
            </Form>
          </Card>
        </Col>
      </Row>

      {/* 底部面板 - 我的持仓 */}
      <Card
        title={
          <Space>
            <HistoryOutlined style={{ color: '#1890FF' }} />
            <Text style={{ color: '#E6EDF3' }}>我的持仓</Text>
          </Space>
        }
        style={{
          background: '#161B22',
          border: '1px solid #30363D',
          borderRadius: '8px',
          marginTop: 16,
        }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ overflowX: 'auto' }}>
          <Table
            columns={holdingColumns}
            dataSource={holdings}
            rowKey="id"
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: '暂无持仓' }}
            style={{
              background: 'transparent',
              minWidth: isMobile ? 800 : 'auto',
            }}
            rowClassName={() => 'holding-row'}
          />
        </div>
        {/* 持仓摘要统计 */}
        {holdings.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 32,
              padding: '16px 24px',
              borderTop: '1px solid #30363D',
              background: '#0D1117',
              borderRadius: '0 0 12px 12px',
            }}
          >
            <div style={{ textAlign: 'right' }}>
              <Text style={{ color: '#8B949E', fontSize: 12, display: 'block', marginBottom: 4 }}>总持仓金额</Text>
              <Text
                style={{
                  color: '#E6EDF3',
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', 'DIN', monospace",
                }}
              >
                ¥{Number(holdings.reduce((sum, h) => sum + (h.amount || 0), 0) || 0).toFixed(2)}
              </Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text style={{ color: '#8B949E', fontSize: 12, display: 'block', marginBottom: 4 }}>总累计收益</Text>
              <Text
                style={{
                  color: (() => {
                    const total = holdings.reduce((sum, h) => sum + Number(h.totalProfit || 0) + Number(h.totalInterest || 0), 0)
                    return total >= 0 ? '#00D4AA' : '#FF4D4F'
                  })(),
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', 'DIN', monospace",
                }}
              >
                {(() => {
                  const total = holdings.reduce((sum, h) => sum + Number(h.totalProfit || 0) + Number(h.totalInterest || 0), 0)
                  return `${total >= 0 ? '+' : ''}¥${Number(total || 0).toFixed(2)}`
                })()}
              </Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text style={{ color: '#8B949E', fontSize: 12, display: 'block', marginBottom: 4 }}>总浮动盈亏</Text>
              <Text
                style={{
                  color: (() => {
                    const total = holdings.reduce((sum, h) => {
                      const unsettledQty = h.quantity - (h.settledQuantity || 0)
                      return sum + profitMargin * unsettledQty
                    }, 0)
                    return total >= 0 ? '#00D4AA' : '#FF4D4F'
                  })(),
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', 'DIN', monospace",
                }}
              >
                {(() => {
                  const total = holdings.reduce((sum, h) => {
                    const unsettledQty = h.quantity - (h.settledQuantity || 0)
                    return sum + profitMargin * unsettledQty
                  }, 0)
                  return `${total >= 0 ? '+' : ''}¥${Number(total || 0).toFixed(2)}`
                })()}
              </Text>
            </div>
          </div>
        )}
      </Card>

      {/* 确认弹窗 */}
      <Modal
        open={confirmModalVisible}
        onCancel={() => setConfirmModalVisible(false)}
        footer={null}
        width={400}
        closable={false}
        styles={{
          content: {
            background: '#161B22',
            border: '1px solid #30363D',
            borderRadius: 12,
            padding: 0,
          },
          body: {
            padding: 0,
          },
        }}
      >
        <div style={{ padding: '24px 24px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1890FF20 0%, #096DD920 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                border: '2px solid #1890FF',
              }}
            >
              <ShoppingCartOutlined style={{ fontSize: 28, color: '#1890FF' }} />
            </div>
            <Title level={4} style={{ color: '#E6EDF3', margin: 0 }}>
              确认垫资
            </Title>
          </div>

          <div
            style={{
              background: '#0D1117',
              borderRadius: 8,
              padding: 16,
              marginBottom: 24,
              border: '1px solid #30363D',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <Text style={{ color: '#8B949E' }}>药品</Text>
              <Text style={{ color: '#E6EDF3' }}>{drugInfo?.name}</Text>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <Text style={{ color: '#8B949E' }}>数量</Text>
              <Text style={{ color: '#E6EDF3', fontFamily: 'monospace' }}>
                {quantity} 盒
              </Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text style={{ color: '#8B949E' }}>金额</Text>
              <Text
                style={{
                  color: '#1890FF',
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', 'DIN', monospace",
                }}
              >
                ¥{Number(estimatedAmount || 0).toFixed(2)}
              </Text>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Button
              style={{
                flex: 1,
                height: 44,
                background: '#0D1117',
                borderColor: '#30363D',
                color: '#8B949E',
              }}
              onClick={() => setConfirmModalVisible(false)}
            >
              取消
            </Button>
            <Button
              type="primary"
              style={{
                flex: 1,
                height: 44,
                background: 'linear-gradient(135deg, #1890FF 0%, #096DD9 100%)',
                border: 'none',
              }}
              loading={submitting}
              onClick={handleConfirmOrder}
            >
              确认
            </Button>
          </div>
        </div>
      </Modal>

      {/* 全局样式 */}
      <style>{`
        .holding-row:hover td {
          background: #21262D !important;
          transition: background 0.2s ease;
        }
        .ant-table-thead > tr > th {
          background: #0D1117 !important;
          border-bottom: 1px solid #30363D !important;
          color: #8B949E !important;
          font-weight: 600;
          position: sticky;
          top: 0;
          z-index: 10;
          backdrop-filter: blur(8px);
        }
        .ant-table-tbody > tr > td {
          border-bottom: 1px solid #21262D !important;
          background: transparent !important;
          transition: background 0.2s ease;
        }
        /* 斑马纹 - 奇偶行不同背景 */
        .ant-table-tbody > tr:nth-child(odd) > td {
          background: transparent !important;
        }
        .ant-table-tbody > tr:nth-child(even) > td {
          background: rgba(33, 38, 45, 0.4) !important;
        }
        /* Hover 效果 */
        .ant-table-tbody > tr:hover > td {
          background: #21262D !important;
        }
        .ant-table-tbody > tr:nth-child(even):hover > td {
          background: #21262D !important;
        }
        /* 按钮效果 */
        .ant-btn-primary:hover {
          box-shadow: 0 4px 12px rgba(24, 144, 255, 0.4);
          transform: translateY(-1px);
        }
        /* 输入框样式 */
        .ant-input-number-input {
          background: #0D1117 !important;
          color: #E6EDF3 !important;
        }
        .ant-input-number {
          background: #0D1117 !important;
          border-color: #30363D !important;
        }
        .ant-input-number:hover {
          border-color: #1890FF !important;
        }
        .ant-input-number-focused {
          border-color: #1890FF !important;
          box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2) !important;
        }
        /* 表格容器 */
        .ant-table-wrapper {
          overflow: visible;
        }
        @media (max-width: 768px) {
          .ant-card-body {
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  )
}

export default Trade
