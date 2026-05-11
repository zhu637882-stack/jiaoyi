import { useState, useEffect, useMemo } from 'react'
import { Button, InputNumber, Space, Modal, message } from 'antd'
import { ShoppingCartOutlined, RiseOutlined, FallOutlined, ClockCircleOutlined, FireOutlined, TeamOutlined, WalletOutlined } from '@ant-design/icons'
import { subscriptionApi, accountApi, paymentApi } from '../../services/api'
import './style.css'

interface TradePanelProProps {
  drug: {
    drugId: string
    drugName: string
    drugCode: string
    purchasePrice: number
    sellingPrice: number
    actualSellingPrice?: number
    dailyReturn: number
    cumulativeReturn: number
    totalQuantity?: number
    subscribedQuantity?: number
  } | null
  onOrderSuccess?: () => void
}

// 模拟实时成交记录
interface TradeRecord {
  id: string
  time: string
  price: number
  quantity: number
  type: 'buy' | 'sell'
}

// 模拟生成成交记录
const generateTradeRecords = (basePrice: number): TradeRecord[] => {
  const records: TradeRecord[] = []
  const now = new Date()
  
  for (let i = 0; i < 20; i++) {
    const time = new Date(now.getTime() - i * 60000)
    records.push({
      id: `trade-${i}`,
      time: time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      price: basePrice * (1 + (Math.random() - 0.5) * 0.02),
      quantity: Math.floor(Math.random() * 50) + 10,
      type: Math.random() > 0.4 ? 'buy' : 'sell'
    })
  }
  
  return records
}

const TradePanelPro: React.FC<TradePanelProProps> = ({ drug, onOrderSuccess }) => {
  const [quantity, setQuantity] = useState<number>(1)
  const [tradeRecords, setTradeRecords] = useState<TradeRecord[]>([])

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false)
  const [modalQuantity, setModalQuantity] = useState<number>(1)
  const [payChannel, setPayChannel] = useState<'balance' | 'wechat' | 'alipay'>('balance')
  const [balance, setBalance] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)

  // 生成成交记录
  useEffect(() => {
    if (drug) {
      const price = drug.actualSellingPrice || drug.sellingPrice
      setTradeRecords(generateTradeRecords(price))
      
      // 模拟实时更新
      const interval = setInterval(() => {
        setTradeRecords(prev => {
          const newRecord: TradeRecord = {
            id: `trade-${Date.now()}`,
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            price: price * (1 + (Math.random() - 0.5) * 0.01),
            quantity: Math.floor(Math.random() * 30) + 5,
            type: Math.random() > 0.45 ? 'buy' : 'sell'
          }
          return [newRecord, ...prev.slice(0, 19)]
        })
      }, 3000)
      
      return () => clearInterval(interval)
    }
  }, [drug])

  // 获取余额
  const fetchBalance = async () => {
    try {
      const res = await accountApi.getBalance() as { availableBalance?: number }
      setBalance(res.availableBalance || 0)
    } catch (e) {
      console.error('获取余额失败', e)
    }
  }

  // 打开弹窗
  const handleOpenModal = () => {
    if (!drug) return
    setModalQuantity(1)
    setPayChannel('balance')
    fetchBalance()
    setModalVisible(true)
  }

  // 计算预估收益
  const estimatedProfit = useMemo(() => {
    if (!drug) return 0
    const price = drug.actualSellingPrice || drug.sellingPrice
    const profitPerBox = (price - drug.purchasePrice) * 0.3 + drug.purchasePrice * 0.05 / 365
    return profitPerBox * quantity
  }, [drug, quantity])

  // 计算收益率
  const returnRate = useMemo(() => {
    if (!drug) return 0
    const price = drug.actualSellingPrice || drug.sellingPrice
    return ((price - drug.purchasePrice) / drug.purchasePrice * 0.3 + 0.05 / 365) * 100
  }, [drug])

  // 弹窗中的认购金额
  const modalAmount = useMemo(() => {
    if (!drug) return 0
    return modalQuantity * drug.purchasePrice
  }, [drug, modalQuantity])

  // 确认认购
  const handleConfirmOrder = async () => {
    if (!drug) return
    if (modalQuantity < 1) {
      message.error('最少认购1盒')
      return
    }
    if (payChannel === 'balance' && modalAmount > balance) {
      message.error(`余额不足，需要 ¥${modalAmount.toFixed(2)}，当前余额 ¥${balance.toFixed(2)}`)
      return
    }

    setSubmitting(true)
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!drug.drugId || !uuidRegex.test(drug.drugId)) {
        message.error(`药品ID格式错误，请重新选择药品`)
        return
      }

      if (payChannel === 'balance') {
        const response = await subscriptionApi.createSubscription({
          drugId: drug.drugId,
          quantity: modalQuantity,
        }) as { success: boolean }
        if (response.success) {
          message.success('认购成功，T+1生效')
          setModalVisible(false)
          setModalQuantity(1)
          onOrderSuccess?.()
        }
      } else if (payChannel === 'wechat') {
        // 微信支付：创建支付订单（PC端NATIVE二维码）
        const res = await (paymentApi as any).createSubscriptionPayment({
          drugId: drug.drugId,
          quantity: modalQuantity,
          channel: 'wechat',
        }) as any
        const payData = res?.data || res
        if (payData?.qrCode) {
          window.open(payData.qrCode, '_blank')
          message.info('请在新窗口完成微信扫码支付')
        } else if (payData?.codeUrl) {
          message.info('请使用微信扫码支付')
        } else {
          message.success('订单已创建，请完成支付')
        }
        setModalVisible(false)
        setModalQuantity(1)
        onOrderSuccess?.()
      } else if (payChannel === 'alipay') {
        // 支付宝支付
        const res = await (paymentApi as any).createSubscriptionPayment({
          drugId: drug.drugId,
          quantity: modalQuantity,
          channel: 'alipay',
        }) as any
        const payData = res?.data || res
        if (payData?.payUrl) {
          window.open(payData.payUrl, '_blank')
          message.info('请在新窗口完成支付宝支付')
        } else {
          message.success('订单已创建，请完成支付')
        }
        setModalVisible(false)
        setModalQuantity(1)
        onOrderSuccess?.()
      }
    } catch (e: any) {
      const errMsg = e?.response?.data?.message || e?.message || '认购失败，请重试'
      message.error(Array.isArray(errMsg) ? errMsg.join('; ') : String(errMsg))
    } finally {
      setSubmitting(false)
    }
  }

  if (!drug) {
    return (
      <div className="trade-panel-pro-empty">
        <div className="empty-icon">📊</div>
        <div className="empty-text">请从左侧选择药品</div>
        <div className="empty-subtext">选择药品后查看详细交易信息</div>
      </div>
    )
  }

  const effectivePrice = drug.actualSellingPrice || drug.sellingPrice
  const amount = quantity * drug.purchasePrice
  const progress = drug.totalQuantity ? (drug.subscribedQuantity || 0) / drug.totalQuantity * 100 : 0
  const remainingQuantity = Math.max(0, (drug.totalQuantity || 0) - (drug.subscribedQuantity || 0))

  return (
    <div className="trade-panel-pro">
      {/* 头部 - 药品名称和收益率 */}
      <div className="trade-header-pro">
        <div className="trade-header-main">
          <div className="drug-name">{drug.drugName}</div>
          <div className="drug-code">{drug.drugCode}</div>
        </div>
        <div className="return-badge">
          <RiseOutlined />
          <span>+{returnRate.toFixed(2)}%</span>
        </div>
      </div>

      {/* 价格信息卡片 */}
      <div className="price-cards">
        <div className="price-card">
          <div className="price-card-label">进价</div>
          <div className="price-card-value">¥{drug.purchasePrice.toFixed(2)}</div>
        </div>
        <div className="price-card highlight">
          <div className="price-card-label">{drug.actualSellingPrice ? '实际成交' : '估价'}</div>
          <div className="price-card-value up">¥{effectivePrice.toFixed(2)}</div>
        </div>
        <div className="price-card">
          <div className="price-card-label">价差收益</div>
          <div className="price-card-value up">+{((effectivePrice - drug.purchasePrice) / drug.purchasePrice * 100).toFixed(1)}%</div>
        </div>
      </div>

      {/* 认购进度 */}
      <div className="progress-section">
        <div className="progress-header">
          <span className="progress-label">
            <FireOutlined /> 认购热度
          </span>
          <span className="progress-value">{progress.toFixed(1)}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <div className="progress-stats">
          <span>{drug.subscribedQuantity || 0}盒 / {drug.totalQuantity || 0}盒</span>
          <span className="remaining">剩余 {remainingQuantity}盒</span>
        </div>
      </div>

      {/* 认购表单 */}
      <div className="trade-form">
        <div className="form-item">
          <label className="form-label">
            <TeamOutlined /> 认购数量（盒）
          </label>
          <Space.Compact className="quantity-input-group">
            <InputNumber
              min={1}
              max={9999}
              value={quantity}
              onChange={(val) => setQuantity(val || 1)}
              className="quantity-input"
              precision={0}
            />
            <span className="quantity-unit">盒</span>
          </Space.Compact>
        </div>

        <div className="amount-preview">
          <div className="preview-row">
            <span>认购金额</span>
            <span className="amount-value">¥{amount.toFixed(2)}</span>
          </div>
          <div className="preview-row highlight">
            <span>预估日收益</span>
            <span className="profit-value">+¥{estimatedProfit.toFixed(2)}</span>
          </div>
        </div>

        <Button
          type="primary"
          size="large"
          block
          icon={<ShoppingCartOutlined />}
          onClick={handleOpenModal}
          className="submit-btn-pro"
          disabled={remainingQuantity <= 0}
        >
          {remainingQuantity <= 0 ? '已售罄' : '立即认购'}
        </Button>
      </div>

      {/* 实时成交记录 */}
      <div className="trade-records-section">
        <div className="section-header">
          <ClockCircleOutlined />
          <span>实时成交</span>
          <span className="live-indicator">
            <span className="live-dot" />
            LIVE
          </span>
        </div>
        <div className="trade-records-list">
          <div className="records-header">
            <span>时间</span>
            <span>价格</span>
            <span>数量</span>
          </div>
          <div className="records-body">
            {tradeRecords.map((record, index) => (
              <div 
                key={record.id} 
                className={`record-row ${record.type} ${index === 0 ? 'new' : ''}`}
              >
                <span className="record-time">{record.time}</span>
                <span className={`record-price ${record.type}`}>
                  {record.type === 'buy' ? <RiseOutlined /> : <FallOutlined />}
                  ¥{record.price.toFixed(2)}
                </span>
                <span className="record-quantity">{record.quantity}盒</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部提示 */}
      <div className="trade-footer-info">
        <div className="info-item">
          <span className="dot green" />
          <span>T+1 生效</span>
        </div>
        <div className="info-item">
          <span className="dot blue" />
          <span>5% 年化补贴</span>
        </div>
        <div className="info-item">
          <span className="dot orange" />
          <span>合伙收益：(零售价-进价-运营费)/10</span>
        </div>
      </div>

      {/* 认购弹窗 */}
      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={420}
        closable={false}
        styles={{
          content: {
            background: '#161B22',
            border: '1px solid #30363D',
            borderRadius: 12,
            padding: 0,
          },
          body: { padding: 0 },
        }}
      >
        <div style={{ padding: '24px' }}>
          {/* 弹窗标题 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #30363D' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 4, height: 20, background: 'linear-gradient(180deg, #F0B90B 0%, #D48B06 100%)', borderRadius: 2 }} />
              <span style={{ color: '#E6EDF3', fontSize: 16, fontWeight: 600 }}>认购</span>
            </div>
            <span
              style={{ color: '#8B949E', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
              onClick={() => setModalVisible(false)}
            >✕</span>
          </div>

          {/* 药品信息 */}
          <div style={{ background: '#0D1117', borderRadius: 8, padding: '12px 16px', marginBottom: 16, border: '1px solid #30363D' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#8B949E', fontSize: 13 }}>药品</span>
              <span style={{ color: '#E6EDF3', fontSize: 13, fontWeight: 600 }}>{drug.drugName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#8B949E', fontSize: 13 }}>单价</span>
              <span style={{ color: '#E6EDF3', fontSize: 13, fontFamily: 'monospace' }}>¥{drug.purchasePrice.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#8B949E', fontSize: 13 }}>剩余可购</span>
              <span style={{ color: remainingQuantity > 0 ? '#F0B90B' : '#F6465D', fontSize: 13, fontWeight: 600 }}>{remainingQuantity} 盒</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#8B949E', fontSize: 13 }}>
                <WalletOutlined style={{ marginRight: 4 }} />可用余额
              </span>
              <span style={{ color: '#F0B90B', fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>¥{balance.toFixed(2)}</span>
            </div>
          </div>

          {/* 数量输入 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#8B949E', fontSize: 12, marginBottom: 8 }}>认购数量（盒）</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                style={{ width: 36, height: 36, background: '#21262D', border: '1px solid #30363D', borderRadius: 6, color: '#E6EDF3', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setModalQuantity(q => Math.max(1, q - 1))}
              >−</button>
              <InputNumber
                min={1}
                max={remainingQuantity || 9999}
                value={modalQuantity}
                onChange={(val) => setModalQuantity(val || 1)}
                precision={0}
                style={{ flex: 1, background: '#0D1117', borderColor: '#30363D', color: '#E6EDF3' }}
                size="large"
              />
              <button
                style={{ width: 36, height: 36, background: '#21262D', border: '1px solid #30363D', borderRadius: 6, color: '#E6EDF3', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setModalQuantity(q => Math.min(remainingQuantity || 9999, q + 1))}
              >+</button>
            </div>
          </div>

          {/* 合计金额 */}
          <div style={{ background: '#0D1117', borderRadius: 8, padding: '12px 16px', marginBottom: 16, border: '1px solid #30363D' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#8B949E' }}>认购金额</span>
              <span style={{ color: '#F0B90B', fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>¥{modalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* 支付方式 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#8B949E', fontSize: 12, marginBottom: 8 }}>支付方式</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { key: 'balance', label: '余额支付', icon: '💰' },
                { key: 'wechat', label: '微信支付', icon: '💚' },
                { key: 'alipay', label: '支付宝', icon: '💙' },
              ].map(ch => (
                <div
                  key={ch.key}
                  onClick={() => setPayChannel(ch.key as any)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    background: payChannel === ch.key ? 'rgba(240,185,11,0.15)' : '#0D1117',
                    border: `1px solid ${payChannel === ch.key ? '#F0B90B' : '#30363D'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{ch.icon}</div>
                  <div style={{ color: payChannel === ch.key ? '#F0B90B' : '#8B949E', fontSize: 12, fontWeight: payChannel === ch.key ? 600 : 400 }}>{ch.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <Button
              style={{ flex: 1, height: 44, background: '#0D1117', borderColor: '#30363D', color: '#8B949E' }}
              onClick={() => setModalVisible(false)}
            >
              取消
            </Button>
            <Button
              type="primary"
              style={{ flex: 2, height: 44, background: 'linear-gradient(135deg, #F0B90B 0%, #D48B06 100%)', border: 'none', color: '#181A20', fontWeight: 700 }}
              loading={submitting}
              onClick={handleConfirmOrder}
              icon={<ShoppingCartOutlined />}
            >
              确认认购
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default TradePanelPro
