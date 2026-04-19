import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import './Trade.css'
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
  Select,
} from 'antd'
import {
  ShoppingCartOutlined,
  WalletOutlined,
  LineChartOutlined,
  HistoryOutlined,
  NumberOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { drugApi, subscriptionApi, accountApi } from '../services/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select

// 认购状态映射
const subscriptionStatusMap: Record<string, { label: string; color: string }> = {
  confirmed: { label: '待生效', color: '#1890FF' },
  effective: { label: '认购中', color: '#cf1322' },
  partial_returned: { label: '部分退回', color: '#FAAD14' },
  returned: { label: '已退回', color: '#8B949E' },
  cancelled: { label: '已取消', color: '#00b96b' },
  slow_selling_refund: { label: '滞销退款', color: '#722ED1' },
}

interface DrugInfo {
  id: string
  name: string
  code: string
  purchasePrice: number
  sellingPrice: number
  totalQuantity: number
  subscribedQuantity: number
  remainingQuantity: number
  operationFeeRate: number
  slowSellingDays: number
}

interface SubscriptionItem {
  id: string
  orderNo: string
  drugId: string
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

const Trade = () => {
  const { drugId } = useParams<{ drugId: string }>()
  const navigate = useNavigate()

  const [form] = Form.useForm()

  // 状态
  const [drugInfo, setDrugInfo] = useState<DrugInfo | null>(null)
  const [balance, setBalance] = useState<number>(0)
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([])
  const [quantity, setQuantity] = useState<number>(1)
  const [confirmModalVisible, setConfirmModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeRatio, setActiveRatio] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [selectedDrugId, setSelectedDrugId] = useState<string>(drugId || '')
  const [drugList, setDrugList] = useState<DrugInfo[]>([])

  // 响应式检测
  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < 768)
  }, [])

  useEffect(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [checkMobile])

  // 计算预计金额
  const estimatedAmount = useMemo(() => {
    if (!drugInfo) return 0
    return Number(Number(quantity * drugInfo.purchasePrice || 0).toFixed(2))
  }, [quantity, drugInfo])

  const maxQuantity = useMemo(() => {
    if (!drugInfo || !balance) return 0
    const maxByBalance = Math.floor(balance / drugInfo.purchasePrice)
    const maxByDrug = drugInfo.remainingQuantity
    return Math.min(maxByBalance, maxByDrug)
  }, [drugInfo, balance])

  // 加载数据
  useEffect(() => {
    fetchDrugList()
    fetchBalance()
  }, [])

  useEffect(() => {
    if (selectedDrugId) {
      fetchDrugInfo()
      fetchSubscriptions()
    }
  }, [selectedDrugId])

  const fetchDrugList = async () => {
    try {
      const response = await drugApi.getDrugs({ page: 1, pageSize: 100 })
      if (response.success) {
        setDrugList(response.data.items || [])
        if (!selectedDrugId && response.data.items?.length > 0) {
          setSelectedDrugId(String(response.data.items[0].id))
        }
      }
    } catch (error) {
      console.error('获取药品列表失败:', error)
    }
  }

  const fetchDrugInfo = async () => {
    try {
      const response = await drugApi.getDrugById(selectedDrugId)
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

  const fetchSubscriptions = async () => {
    if (!selectedDrugId) return
    try {
      const response = await subscriptionApi.getMySubscriptions({
        page: 1,
        limit: 100,
      })
      if (response.success) {
        // 筛选当前药品的认购
        const drugSubscriptions = (response.data?.list || []).filter(
          (item: SubscriptionItem) => String(item.drugId) === selectedDrugId
        )
        setSubscriptions(drugSubscriptions)
      }
    } catch (error) {
      console.error('获取认购列表失败:', error)
    }
  }

  // 快捷比例按钮
  const handleRatioClick = (ratio: number) => {
    if (!drugInfo || maxQuantity <= 0) return
    const qty = Math.max(1, Math.floor(maxQuantity * ratio))
    setQuantity(qty)
    setActiveRatio(ratio)
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

  // 药品选择变化
  const handleDrugChange = (value: string) => {
    setSelectedDrugId(value)
    navigate(`/trade/${value}`)
  }

  // 提交订单
  const handleSubmit = () => {
    if (quantity < 1) {
      message.error('最少认购1盒')
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
      // 守卫：确保 drugId 是合法 UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!selectedDrugId || !uuidRegex.test(selectedDrugId)) {
        message.error(`药品ID格式错误(${selectedDrugId || '空'}), 请重新选择药品`)
        setSubmitting(false)
        return
      }
      console.log('[DEBUG] 认购提交:', { drugId: selectedDrugId, drugIdType: typeof selectedDrugId, quantity })
      const response = await subscriptionApi.createSubscription({
        drugId: selectedDrugId,
        quantity,
      })
      if (response.success) {
        message.success('认购成功，T+1生效')
        setConfirmModalVisible(false)
        // 重置表单
        setQuantity(1)
        form.resetFields()
        setActiveRatio(null)
        // 刷新数据
        fetchBalance()
        fetchDrugInfo()
        fetchSubscriptions()
      }
    } catch (error: any) {
      console.error('[DEBUG] 认购失败:', error.response?.data)
      const errMsg = error.response?.data?.message
      message.error(Array.isArray(errMsg) ? errMsg.join('; ') : (errMsg || '认购失败'))
    } finally {
      setSubmitting(false)
    }
  }

  // 认购进度图配置
  const progressChartOption = useMemo(() => {
    if (!drugInfo) {
      return {
        backgroundColor: 'transparent',
        grid: { left: 60, right: 20, top: 20, bottom: 30 },
        xAxis: { type: 'category', data: [], axisLine: { lineStyle: { color: '#30363D' } } },
        yAxis: { type: 'value', axisLine: { lineStyle: { color: '#30363D' } } },
        series: [],
      }
    }

    const data = [
      { name: '已认购', value: drugInfo.subscribedQuantity, color: '#1890FF' },
      { name: '剩余', value: drugInfo.remainingQuantity, color: '#cf1322' },
    ]

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#161B22',
        borderColor: '#30363D',
        textStyle: { color: '#E6EDF3' },
        formatter: (params: any) => {
          return `
            <div style="padding: 8px;">
              <div style="color: #E6EDF3; font-size: 14px;">${params.name}</div>
              <div style="color: ${params.color}; font-size: 16px; margin-top: 4px; font-weight: 600;">
                ${Number(params.value || 0).toLocaleString()} 盒
              </div>
            </div>
          `
        },
      },
      series: [
        {
          name: '认购进度',
          type: 'pie',
          radius: ['50%', '70%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#161B22',
            borderWidth: 2,
          },
          label: {
            show: true,
            color: '#E6EDF3',
            formatter: '{b}\n{c}盒',
          },
          labelLine: {
            lineStyle: {
              color: '#8B949E',
            },
          },
          data: data.map((d) => ({
            name: d.name,
            value: d.value,
            itemStyle: { color: d.color },
          })),
        },
      ],
    }
  }, [drugInfo])

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
      title: '已退回',
      dataIndex: 'settledQuantity',
      key: 'settledQuantity',
      width: 80,
      align: 'center' as const,
      render: (text: number) => (
        <Text style={{ color: '#cf1322', fontFamily: 'monospace' }}>
          {text || 0}盒
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
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
      title: '确认时间',
      dataIndex: 'confirmedAt',
      key: 'confirmedAt',
      width: 150,
      render: (text: string) => (
        <Text style={{ color: '#8B949E', fontSize: 12 }}>
          {text ? dayjs(text).format('MM-DD HH:mm') : '-'}
        </Text>
      ),
    },
    {
      title: '生效时间',
      dataIndex: 'effectiveAt',
      key: 'effectiveAt',
      width: 150,
      render: (text: string) => (
        <Text style={{ color: '#8B949E', fontSize: 12 }}>
          {text ? dayjs(text).format('MM-DD HH:mm') : '-'}
        </Text>
      ),
    },
    {
      title: '滞销截止',
      dataIndex: 'slowSellingDeadline',
      key: 'slowSellingDeadline',
      width: 150,
      render: (text: string) => {
        if (!text) return <Text style={{ color: '#8B949E', fontSize: 12 }}>-</Text>
        const days = dayjs(text).diff(dayjs(), 'day')
        const color = days <= 7 ? '#00b96b' : days <= 30 ? '#FAAD14' : '#8B949E'
        return (
          <Text style={{ color, fontSize: 12 }}>
            {dayjs(text).format('MM-DD')} (剩{days}天)
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
      render: (text: number, record: SubscriptionItem) => {
        const netProfit = Number(text || 0) - Number(record.totalLoss || 0)
        return (
          <Text
            style={{
              color: netProfit >= 0 ? '#00b96b' : '#cf1322',
              fontFamily: 'monospace',
              fontWeight: 600,
            }}
          >
            {netProfit >= 0 ? '+' : ''}¥{Number(netProfit || 0).toFixed(2)}
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
      {/* 返回导航条 */}
      <div style={{
        padding: '12px 24px',
        background: '#0D1117',
        borderBottom: '1px solid #21262D',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        margin: '-12px -12px 16px -12px',
      }}>
        <span 
          onClick={() => navigate('/')} 
          style={{
            color: '#F0B90B',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          ← 返回交易终端
        </span>
        <span style={{ color: '#848E9C', fontSize: '13px' }}>
          药品认购页
        </span>
      </div>

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
          <Text style={{ color: '#cf1322', fontFamily: "'JetBrains Mono', 'DIN', monospace", fontWeight: 600 }}>
            +¥{Number(profitMargin || 0).toFixed(2)}
          </Text>
        </div>
        <Divider type="vertical" style={{ background: '#30363D', height: 20, margin: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#8B949E', fontSize: 12 }}>运营费率</Text>
          <Text style={{ color: '#E6EDF3', fontFamily: "'JetBrains Mono', 'DIN', monospace", fontWeight: 500 }}>
            {Number((drugInfo.operationFeeRate || 0) * 100).toFixed(2)}%
          </Text>
        </div>
        <Tag
          style={{
            background: drugInfo.remainingQuantity > 0 ? 'rgba(0, 212, 170, 0.15)' : 'rgba(255, 77, 79, 0.15)',
            border: `1px solid ${drugInfo.remainingQuantity > 0 ? '#cf1322' : '#00b96b'}`,
            color: drugInfo.remainingQuantity > 0 ? '#cf1322' : '#00b96b',
            margin: 0,
          }}
        >
          {drugInfo.remainingQuantity > 0 ? '可认购' : '已售罄'}
        </Tag>
      </div>

      {/* 两列布局 - 小屏幕上下排列 */}
      <Row gutter={[16, 16]}>
        {/* 左侧信息面板 - 药品信息和认购进度图 */}
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
                {/* 药品选择 */}
                <div style={{ marginBottom: 20 }}>
                  <Text style={{ color: '#8B949E', fontSize: 12, display: 'block', marginBottom: 8 }}>选择药品</Text>
                  <Select
                    value={selectedDrugId}
                    onChange={handleDrugChange}
                    style={{ width: '100%' }}
                    placeholder="请选择药品"
                    dropdownStyle={{ background: '#161B22', border: '1px solid #30363D' }}
                  >
                    {drugList.map((drug) => (
                      <Option key={drug.id} value={String(drug.id)}>
                        {drug.name} (¥{drug.purchasePrice})
                      </Option>
                    ))}
                  </Select>
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
                    <Text style={{ color: '#8B949E', fontSize: 12 }}>单盒毛利</Text>
                    <Text style={{ color: '#cf1322', fontFamily: 'monospace', fontWeight: 600 }}>
                      +¥{Number(profitMargin || 0).toFixed(2)} ({Number(profitMarginPercent || 0).toFixed(1)}%)
                    </Text>
                  </div>
                </div>

                <Divider style={{ borderColor: '#30363D', margin: '16px 0' }} />

                {/* 运营费用 */}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div
                    style={{
                      display: 'inline-block',
                      background: 'linear-gradient(135deg, rgba(24, 144, 255, 0.15) 0%, rgba(24, 144, 255, 0.05) 100%)',
                      border: '1px solid rgba(24, 144, 255, 0.3)',
                      borderRadius: '12px',
                      padding: '16px 32px',
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: '#8B949E', fontSize: 12, display: 'block', marginBottom: 4 }}>运营费用比例</Text>
                    <div
                      style={{
                        fontSize: 32,
                        fontWeight: 700,
                        color: '#1890FF',
                        fontFamily: "'JetBrains Mono', 'DIN', monospace",
                      }}
                    >
                      {Number((drugInfo.operationFeeRate || 0) * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* 认购进度 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: '#8B949E', fontSize: 12 }}>认购进度</Text>
                    <Text style={{ color: '#E6EDF3', fontSize: 12 }}>
                      {Number(drugInfo.subscribedQuantity || 0).toLocaleString()} / {Number(drugInfo.totalQuantity || 0).toLocaleString()} 盒
                    </Text>
                  </div>
                  <Progress
                    percent={Math.round((drugInfo.subscribedQuantity / drugInfo.totalQuantity) * 100)}
                    strokeColor={{ from: '#1890FF', to: '#cf1322' }}
                    trailColor="#21262D"
                    strokeWidth={8}
                    showInfo={false}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={{ color: '#8B949E', fontSize: 11 }}>
                      已认购: {Number(drugInfo.subscribedQuantity || 0).toLocaleString()}盒
                    </Text>
                    <Text style={{ color: '#cf1322', fontSize: 11 }}>
                      剩余: {Number(drugInfo.remainingQuantity || 0).toLocaleString()}盒
                    </Text>
                  </div>
                </div>
              </Card>
            </Col>

            {/* 认购进度图卡片 */}
            <Col xs={24} lg={16}>
              <Card
                title={
                  <Space>
                    <LineChartOutlined style={{ color: '#1890FF' }} />
                    <Text style={{ color: '#E6EDF3' }}>认购分布</Text>
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
                <ReactECharts
                  option={progressChartOption}
                  style={{ height: isMobile ? 260 : 320, width: '100%' }}
                  theme="dark"
                />

                {/* 统计 */}
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
                      总数量
                    </Text>
                    <Text
                      style={{
                        color: '#E6EDF3',
                        fontSize: 20,
                        fontWeight: 600,
                        fontFamily: 'monospace',
                      }}
                    >
                      {Number(drugInfo.totalQuantity || 0).toLocaleString()}
                    </Text>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Text style={{ color: '#8B949E', fontSize: 12, display: 'block' }}>
                      已认购
                    </Text>
                    <Text
                      style={{
                        color: '#1890FF',
                        fontSize: 20,
                        fontWeight: 600,
                        fontFamily: 'monospace',
                      }}
                    >
                      {Number(drugInfo.subscribedQuantity || 0).toLocaleString()}
                    </Text>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Text style={{ color: '#8B949E', fontSize: 12, display: 'block' }}>
                      滞销保障
                    </Text>
                    <Text
                      style={{
                        color: '#cf1322',
                        fontSize: 20,
                        fontWeight: 600,
                        fontFamily: 'monospace',
                      }}
                    >
                      {drugInfo.slowSellingDays}天
                    </Text>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </Col>

        {/* 右侧认购面板 */}
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
                药品认购
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
                <WalletOutlined style={{ color: '#cf1322' }} />
                <Text style={{ color: '#8B949E' }}>可用余额</Text>
              </Space>
              <Text
                style={{
                  color: '#cf1322',
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', 'DIN', monospace",
                }}
              >
                ¥{Number(balance || 0).toFixed(2)}
              </Text>
            </div>

            {/* 剩余可认购 */}
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
                <HistoryOutlined style={{ color: '#1890FF' }} />
                <Text style={{ color: '#8B949E' }}>剩余可认购</Text>
              </Space>
              <Text
                style={{
                  color: '#1890FF',
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', 'DIN', monospace",
                }}
              >
                {Number(drugInfo.remainingQuantity || 0).toLocaleString()} 盒
              </Text>
            </div>

            <Form form={form} layout="vertical">
              {/* 数量输入 */}
              <Form.Item
                label={<Text style={{ color: '#8B949E' }}>认购数量（盒）</Text>}
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
                  <Text style={{ color: '#8B949E' }}>认购金额</Text>
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
                  <Text style={{ color: '#8B949E' }}>预计单盒毛利</Text>
                  <Text
                    style={{
                      color: '#cf1322',
                      fontFamily: "'JetBrains Mono', 'DIN', monospace",
                    }}
                  >
                    +¥{Number(profitMargin || 0).toFixed(2)}
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
                确认认购
              </Button>

              {maxQuantity <= 0 && (
                <Text
                  style={{
                    color: '#00b96b',
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

      {/* 底部面板 - 我的认购 */}
      <Card
        title={
          <Space>
            <HistoryOutlined style={{ color: '#1890FF' }} />
            <Text style={{ color: '#E6EDF3' }}>我的认购</Text>
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
            columns={subscriptionColumns}
            dataSource={subscriptions}
            rowKey="id"
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: '暂无认购记录' }}
            style={{
              background: 'transparent',
              minWidth: isMobile ? 1000 : 'auto',
            }}
            rowClassName={() => 'subscription-row'}
          />
        </div>
        {/* 认购摘要统计 */}
        {subscriptions.length > 0 && (
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
              <Text style={{ color: '#8B949E', fontSize: 12, display: 'block', marginBottom: 4 }}>总认购金额</Text>
              <Text
                style={{
                  color: '#E6EDF3',
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', 'DIN', monospace",
                }}
              >
                ¥{Number(subscriptions.reduce((sum, s) => sum + (s.amount || 0), 0) || 0).toFixed(2)}
              </Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text style={{ color: '#8B949E', fontSize: 12, display: 'block', marginBottom: 4 }}>总认购数量</Text>
              <Text
                style={{
                  color: '#1890FF',
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', 'DIN', monospace",
                }}
              >
                {subscriptions.reduce((sum, s) => sum + (s.quantity || 0), 0)} 盒
              </Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text style={{ color: '#8B949E', fontSize: 12, display: 'block', marginBottom: 4 }}>累计净收益</Text>
              <Text
                style={{
                  color: (() => {
                    const total = subscriptions.reduce((sum, s) => sum + Number(s.totalProfit || 0) - Number(s.totalLoss || 0), 0)
                    return total >= 0 ? '#cf1322' : '#00b96b'
                  })(),
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', 'DIN', monospace",
                }}
              >
                {(() => {
                  const total = subscriptions.reduce((sum, s) => sum + Number(s.totalProfit || 0) - Number(s.totalLoss || 0), 0)
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
              确认认购
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
        .subscription-row:hover td {
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
        .ant-table-tbody > tr:nth-child(odd) > td {
          background: transparent !important;
        }
        .ant-table-tbody > tr:nth-child(even) > td {
          background: rgba(33, 38, 45, 0.4) !important;
        }
        .ant-table-tbody > tr:hover > td {
          background: #21262D !important;
        }
        .ant-table-tbody > tr:nth-child(even):hover > td {
          background: #21262D !important;
        }
        .ant-btn-primary:hover {
          box-shadow: 0 4px 12px rgba(24, 144, 255, 0.4);
          transform: translateY(-1px);
        }
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
        .ant-table-wrapper {
          overflow: visible;
        }
        @media (max-width: 768px) {
          .ant-card-body {
            padding: 16px !important;
          }
        }
        .ant-select-selector {
          background: #0D1117 !important;
          border-color: #30363D !important;
          color: #E6EDF3 !important;
        }
        .ant-select:hover .ant-select-selector {
          border-color: #1890FF !important;
        }
      `}</style>
    </div>
  )
}

export default Trade
