import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, Table, Typography, Button, DatePicker, Space, Row, Col, Statistic, Modal, Descriptions } from 'antd'
import './Settlement.css'
import { FileTextOutlined, DownloadOutlined, DollarOutlined, ArrowUpOutlined, ArrowDownOutlined, WalletOutlined } from '@ant-design/icons'
import { settlementApi } from '../services/api'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

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
      color: isPositive ? '#00D4AA' : isNegative ? '#FF4D4F' : '#8B949E',
      background: isPositive ? 'rgba(0,212,170,0.1)' : isNegative ? 'rgba(255,77,79,0.1)' : 'transparent',
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
const Sparkline = ({ data, color = '#1890FF', width = 60, height = 30 }: { data: number[], color?: string, width?: number, height?: number }) => {
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
  isProfit = false,
  loading = false
}: { 
  title: string
  value: number
  icon: React.ReactNode
  color: string
  prefix?: string
  sparklineData?: number[]
  isProfit?: boolean
  loading?: boolean
}) => {
  const displayValue = useCountUp(value)
  const displayColor = isProfit ? (value >= 0 ? '#00D4AA' : '#FF4D4F') : color
  const displayPrefix = isProfit ? (value >= 0 ? '+¥' : '¥') : prefix
  
  return (
    <Card
      className="settlement-stat-card"
      hoverable
    >
      <div style={{ position: 'relative' }}>
        <Statistic
          title={
            <Space>
              {icon}
              <Text style={{ color: '#8B949E', fontSize: 13 }}>{title}</Text>
            </Space>
          }
          value={displayValue}
          precision={2}
          valueStyle={{
            color: displayColor,
            fontFamily: "'JetBrains Mono', monospace",
          }}
          prefix={displayPrefix}
          loading={loading}
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

// 清算记录数据类型
interface MySettlement {
  id: string
  drugId: string
  drugName: string
  drugCode: string
  settlementDate: string
  totalSalesRevenue: number
  netProfit: number
  myPrincipalReturn: number
  myProfitShare: number
  myLossShare: number
  myNetIncome: number
}

// 统计数据类型
interface SettlementStats {
  totalPrincipalReturn: number
  totalProfitShare: number
  totalLossShare: number
  netProfit: number
  totalReturn: number
}

const Settlement = () => {
  const [settlements, setSettlements] = useState<MySettlement[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<SettlementStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [selectedSettlement, setSelectedSettlement] = useState<MySettlement | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // 响应式检测
  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < 768)
  }, [])

  // 生成模拟趋势数据（7天）
  const generateTrendData = useMemo(() => {
    const baseData: Record<string, number[]> = {
      principal: [5000, 5200, 5500, 5800, 6000, 6200, stats?.totalPrincipalReturn || 0],
      profit: [80, 120, 95, 150, 130, 180, stats?.totalProfitShare || 0],
      loss: [20, 15, 30, 10, 25, 18, stats?.totalLossShare || 0],
      net: [60, 105, 65, 140, 105, 162, stats?.netProfit || 0],
    }
    return baseData
  }, [stats])

  useEffect(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [checkMobile])

  // 获取我的清算记录
  const fetchSettlements = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await settlementApi.getMySettlements({ page: 1, pageSize: 100 })
      if (res.success) {
        setSettlements(res.data.list)
      }
    } catch (error) {
      console.error('获取清算记录失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 获取我的清算统计
  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res: any = await settlementApi.getMySettlementStats()
      if (res.success) {
        setStats(res.data)
      }
    } catch (error) {
      console.error('获取清算统计失败:', error)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettlements()
    fetchStats()
  }, [fetchSettlements, fetchStats])

  // 查看详情
  const handleViewDetail = (record: MySettlement) => {
    setSelectedSettlement(record)
    setIsDetailModalOpen(true)
  }

  const columns: ColumnsType<MySettlement> = [
    {
      title: '清算日期',
      dataIndex: 'settlementDate',
      key: 'settlementDate',
      render: (date: string) => (
        <Text style={{ color: '#E6EDF3', fontFamily: "'JetBrains Mono', monospace" }}>
          {dayjs(date).format('YYYY-MM-DD')}
        </Text>
      ),
    },
    {
      title: '药品',
      dataIndex: 'drugName',
      key: 'drugName',
      render: (text: string, record: MySettlement) => (
        <div>
          <Text style={{ color: '#E6EDF3', fontWeight: 600 }}>{text}</Text>
          <div>
            <Text style={{ color: '#6E7681', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
              {record.drugCode}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: '当日销售额',
      dataIndex: 'totalSalesRevenue',
      key: 'totalSalesRevenue',
      align: 'right',
      render: (value: number) => (
        <Text style={{ color: '#E6EDF3', fontFamily: "'JetBrains Mono', monospace" }}>
          ¥{Number(value || 0).toFixed(2)}
        </Text>
      ),
    },
    {
      title: '当日净利润',
      dataIndex: 'netProfit',
      key: 'netProfit',
      align: 'right',
      render: (value: number) => renderProfitCell(value),
    },
    {
      title: '我的分润',
      dataIndex: 'myProfitShare',
      key: 'myProfitShare',
      align: 'right',
      render: (value: number, record: MySettlement) => {
        // 当分润和亏损都为0时，显示 ¥0.00（无正负号）
        if (value === 0 && record.myLossShare === 0) {
          return (
            <span style={{
              color: '#8B949E',
              background: 'transparent',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 500,
              fontFamily: "'JetBrains Mono', 'DIN', monospace",
            }}>
              ¥0.00
            </span>
          )
        }
        const displayValue = value > 0 ? value : -record.myLossShare
        return renderProfitCell(displayValue)
      },
    },
    {
      title: '本金返还',
      dataIndex: 'myPrincipalReturn',
      key: 'myPrincipalReturn',
      align: 'right',
      render: (value: number) => (
        <Text style={{ color: '#1890FF', fontFamily: "'JetBrains Mono', monospace" }}>
          ¥{Number(value || 0).toFixed(2)}
        </Text>
      ),
    },
    {
      title: '我的净收益',
      dataIndex: 'myNetIncome',
      key: 'myNetIncome',
      align: 'right',
      render: (value: number) => renderProfitCell(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record: MySettlement) => (
        <Button 
          type="link" 
          icon={<FileTextOutlined />}
          onClick={() => handleViewDetail(record)}
          style={{ color: '#1890FF', padding: 0 }}
        >
          详情
        </Button>
      ),
    },
  ]

  return (
    <div className="settlement-page">
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <Title level={3} className="settlement-title" style={{ margin: 0 }}>
          清算记录
        </Title>
        <Text style={{ color: '#6E7681', fontSize: 14 }}>
          查看我的垫资清算明细和收益统计
        </Text>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="累计本金返还"
            value={stats?.totalPrincipalReturn || 0}
            icon={<WalletOutlined style={{ color: '#1890FF' }} />}
            color="#1890FF"
            sparklineData={generateTrendData.principal}
            loading={statsLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="累计分润"
            value={stats?.totalProfitShare || 0}
            icon={<ArrowUpOutlined style={{ color: '#00D4AA' }} />}
            color="#00D4AA"
            sparklineData={generateTrendData.profit}
            loading={statsLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="累计承担亏损"
            value={stats?.totalLossShare || 0}
            icon={<ArrowDownOutlined style={{ color: '#FF4D4F' }} />}
            color="#FF4D4F"
            sparklineData={generateTrendData.loss}
            loading={statsLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="净收益"
            value={stats?.netProfit || 0}
            icon={<DollarOutlined style={{ color: (stats?.netProfit || 0) >= 0 ? '#00D4AA' : '#FF4D4F' }} />}
            color="#00D4AA"
            isProfit
            sparklineData={generateTrendData.net}
            loading={statsLoading}
          />
        </Col>
      </Row>

      {/* 筛选栏 */}
      <Card 
        className="settlement-filter-bar"
        bodyStyle={{ padding: isMobile ? '12px 16px' : '16px' }}
      >
        <Space 
          className="settlement-filter-space"
          size={isMobile ? 'small' : 'middle'}
          style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 8 : 12 }}
        >
          <RangePicker 
            className="settlement-range-picker"
            defaultValue={[dayjs().subtract(30, 'day'), dayjs()]}
          />
          <Button 
            type="primary"
            className="settlement-query-btn"
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            查询
          </Button>
          <Button 
            icon={<DownloadOutlined />}
            className="settlement-export-btn"
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            导出
          </Button>
        </Space>
      </Card>

      {/* 清算记录表格 */}
      <Card className="settlement-table-card">
        <Table 
          className="settlement-table"
          columns={columns} 
          dataSource={settlements}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ 
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          rowClassName={() => 'settlement-table-row'}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        className="settlement-modal"
        title={
          <Text style={{ color: '#E6EDF3', fontSize: 18, fontWeight: 600 }}>
            清算详情
          </Text>
        }
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={null}
        width={600}
        styles={{
          header: { background: '#161B22', borderBottom: '1px solid #30363D', padding: '20px 24px' },
          body: { background: '#161B22', padding: '24px' },
          mask: { background: 'rgba(0, 0, 0, 0.7)' },
        }}
      >
        {selectedSettlement && (
          <Descriptions
            column={1}
            labelStyle={{ color: '#8B949E', width: 120 }}
            contentStyle={{ color: '#E6EDF3' }}
          >
            <Descriptions.Item label="药品名称">
              {selectedSettlement.drugName}
            </Descriptions.Item>
            <Descriptions.Item label="药品编码">
              <Text style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {selectedSettlement.drugCode}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="清算日期">
              {dayjs(selectedSettlement.settlementDate).format('YYYY-MM-DD')}
            </Descriptions.Item>
            <Descriptions.Item label="当日销售额">
              <Text style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                ¥{Number(selectedSettlement.totalSalesRevenue || 0).toFixed(2)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="当日净利润">
              <Text style={{
                color: selectedSettlement.netProfit >= 0 ? '#00D4AA' : '#FF4D4F',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
              }}>
                {selectedSettlement.netProfit >= 0 ? '+' : ''}¥{Number(selectedSettlement.netProfit || 0).toFixed(2)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="本金返还">
              <Text style={{ color: '#1890FF', fontFamily: "'JetBrains Mono', monospace" }}>
                ¥{Number(selectedSettlement.myPrincipalReturn || 0).toFixed(2)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="分润/亏损">
              {selectedSettlement.myProfitShare > 0 ? (
                <Text style={{ color: '#00D4AA', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                  +¥{Number(selectedSettlement.myProfitShare || 0).toFixed(2)}
                </Text>
              ) : selectedSettlement.myLossShare > 0 ? (
                <Text style={{ color: '#FF4D4F', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                  -¥{Number(selectedSettlement.myLossShare || 0).toFixed(2)}
                </Text>
              ) : (
                <Text style={{ color: '#8B949E' }}>¥0.00</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="我的净收益">
              <Text style={{
                color: selectedSettlement.myNetIncome >= 0 ? '#00D4AA' : '#FF4D4F',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                fontSize: 16,
              }}>
                {selectedSettlement.myNetIncome >= 0 ? '+' : ''}¥{Number(selectedSettlement.myNetIncome || 0).toFixed(2)}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

export default Settlement
