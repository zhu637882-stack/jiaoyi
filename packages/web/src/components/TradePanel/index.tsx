import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  InputNumber,
  Button,
  message,
  Modal,
  Typography,
  Slider,
  Spin,
  Space,
} from 'antd'
import {
  ShoppingCartOutlined,
  CheckCircleOutlined,
  AlipayCircleOutlined,
  WechatOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import { QRCodeSVG } from 'qrcode.react'
import { subscriptionApi, paymentApi } from '../../services/api'
import './style.css'

const { Text, Title } = Typography

interface TradePanelProps {
  drug: {
    drugId: string
    drugName: string
    drugCode: string
    purchasePrice: number
    sellingPrice: number
    dailyReturn: number
    cumulativeReturn: number
  } | null
  onOrderSuccess?: () => void
}

interface SubscriptionSummary {
  totalQuantity: number
  totalProfit: number
}

const TradePanel: React.FC<TradePanelProps> = ({ drug, onOrderSuccess }) => {
  const navigate = useNavigate()
  const [quantity, setQuantity] = useState<number>(1)
  const [maxQuantity, setMaxQuantity] = useState<number>(999)
  const [sliderValue, setSliderValue] = useState<number>(0)
  const [confirmModalVisible, setConfirmModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [subscriptionSummary, setSubscriptionSummary] = useState<SubscriptionSummary | null>(null)
  const [loadingSubscription, setLoadingSubscription] = useState(false)

  // 成功动画 state
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // 支付流程 state
  const [paymentStep, setPaymentStep] = useState<'channel' | 'paying' | 'success' | 'timeout'>('channel')
  const [paymentChannel, setPaymentChannel] = useState<'alipay' | 'wechat'>('alipay')
  const [paymentQrCode, setPaymentQrCode] = useState<string>('')
  const [paymentOutTradeNo, setPaymentOutTradeNo] = useState<string>('')
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [paymentMockMode, setPaymentMockMode] = useState(false)
  const [paymentActive, setPaymentActive] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  // 获取当前药品认购概要
  const fetchSubscriptionSummary = useCallback(async (drugId: string) => {
    try {
      setLoadingSubscription(true)
      const response = await subscriptionApi.getActiveSubscriptionSummary()
      if (response.success && response.data) {
        const activeSubs = response.data.activeSubscriptions || []
        // 筛选当前药品的认购
        const drugSubs = activeSubs.filter((sub: any) => String(sub.drugId) === drugId)
        const totalQuantity = drugSubs.reduce((sum: number, sub: any) => sum + (sub.quantity || 0), 0)
        const totalProfit = drugSubs.reduce((sum: number, sub: any) => sum + (sub.totalProfit || 0), 0)
        setSubscriptionSummary({ totalQuantity, totalProfit })
      } else {
        setSubscriptionSummary(null)
      }
    } catch (error) {
      console.error('获取认购概要失败:', error)
      setSubscriptionSummary(null)
    } finally {
      setLoadingSubscription(false)
    }
  }, [])

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  // 重置支付状态
  const resetPaymentState = useCallback(() => {
    stopPolling()
    setPaymentStep('channel')
    setPaymentQrCode('')
    setPaymentOutTradeNo('')
    setPaymentAmount(0)
    setPaymentMockMode(false)
    setPaymentActive(false)
  }, [stopPolling])

  // 查询支付状态
  const checkPaymentStatus = useCallback(async (tradeNo: string, channel: 'alipay' | 'wechat') => {
    try {
      const result = await (channel === 'alipay'
        ? paymentApi.queryAlipayOrder(tradeNo)
        : paymentApi.queryWechatOrder(tradeNo))

      if (result.status === 'paid') {
        stopPolling()
        setPaymentStep('success')
        message.success('支付成功，认购完成！')
        fetchSubscriptionSummary(drug!.drugId)
        onOrderSuccess?.()
        setSuccessMessage('认购成功')
        setShowSuccess(true)
        setTimeout(() => setShowSuccess(false), 1500)
        return
      }

      // 检查超时
      const elapsed = Date.now() - startTimeRef.current
      if (elapsed > 5 * 60 * 1000) {
        stopPolling()
        setPaymentStep('timeout')
        message.warning('支付超时，请重新支付')
      }
    } catch (error) {
      console.error('Check payment status error:', error)
    }
  }, [stopPolling, drug, fetchSubscriptionSummary, onOrderSuccess])

  // 开始轮询
  const startPolling = useCallback((tradeNo: string, channel: 'alipay' | 'wechat') => {
    startTimeRef.current = Date.now()
    pollingRef.current = setInterval(() => {
      checkPaymentStatus(tradeNo, channel)
    }, 3000)
  }, [checkPaymentStatus])

  // 当药品变化时加载数据
  useEffect(() => {
    if (drug?.drugId) {
      fetchSubscriptionSummary(drug.drugId)
      setQuantity(1)
      setSliderValue(0)
    }
  }, [drug?.drugId, fetchSubscriptionSummary])

  // 计算最大可认购数量（不依赖余额，由药品剩余数量决定）
  useEffect(() => {
    if (drug) {
      setMaxQuantity(9999)
    } else {
      setMaxQuantity(0)
    }
  }, [drug])

  // 计算认购金额
  const estimatedAmount = useMemo(() => {
    if (!drug) return 0
    return Number(Number(quantity * drug.purchasePrice || 0).toFixed(2))
  }, [quantity, drug])

  // 滑块变化处理
  const handleSliderChange = (value: number) => {
    setSliderValue(value)
    if (maxQuantity > 0) {
      const qty = Math.max(1, Math.floor(maxQuantity * (value / 100)))
      setQuantity(qty)
    }
  }

  // 数量变化
  const handleQuantityChange = (value: number | null) => {
    const qty = value || 0
    setQuantity(Math.max(0, qty))
    // 更新滑块值
    if (maxQuantity > 0) {
      const percentage = Math.min(100, Math.round((qty / maxQuantity) * 100))
      setSliderValue(percentage)
    }
  }

  // 提交认购
  const handleSubmit = () => {
    if (!drug) {
      message.error('请先选择药品')
      return
    }
    if (quantity < 1) {
      message.error('最少认购1盒')
      return
    }
    setConfirmModalVisible(true)
  }

  // 确认购买后，发起认购直付
  const handleConfirmOrder = async () => {
    if (!drug) return
    setConfirmModalVisible(false)
    setPaymentActive(true)
    setPaymentStep('channel')
  }

  // 选择支付方式并发起支付
  const handlePayWithChannel = async (channel: 'alipay' | 'wechat') => {
    if (!drug) return
    setPaymentChannel(channel)
    setSubmitting(true)
    try {
      const response = await paymentApi.createSubscriptionPayment({
        drugId: drug.drugId,
        quantity,
        channel,
      })
      const data = response as any
      const outTradeNo = data.outTradeNo
      const qrCode = data.qrCode || data.codeUrl || ''
      setPaymentOutTradeNo(outTradeNo)
      setPaymentQrCode(qrCode)
      setPaymentAmount(estimatedAmount)
      setPaymentMockMode(!!data.mockMode)
      setPaymentStep('paying')
      startPolling(outTradeNo, channel)
    } catch (error: any) {
      const errMsg = error.response?.data?.message
      message.error(Array.isArray(errMsg) ? errMsg.join('; ') : (errMsg || '创建支付订单失败'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!drug) {
    return (
      <div className="trade-panel-empty">
        <div className="empty-icon">📊</div>
        <div className="empty-text">请从左侧选择药品</div>
      </div>
    )
  }

  const canSubmit = drug && quantity >= 1

  return (
    <div className="trade-panel">
      {/* 标题 */}
      <div className="trade-header">
        <div className="trade-title">认购 {drug.drugName}</div>
      </div>

      {/* 表单区域 */}
      <div className="panel-section form-section">
        {/* 价格显示 */}
        <div className="form-item">
          <div className="form-label">进货价格</div>
          <div className="price-display">
            <span className="price-value">¥{drug.purchasePrice.toFixed(2)}</span>
          </div>
        </div>

        {/* 数量输入框 */}
        <div className="form-item">
          <div className="form-label">认购数量（盒）</div>
          <Space.Compact>
            <InputNumber
              min={1}
              value={quantity}
              onChange={handleQuantityChange}
              className="quantity-input"
              precision={0}
              style={{ width: '100%' }}
            />
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 11px',
              background: '#21262D',
              border: '1px solid #30363D',
              borderLeft: 'none',
              borderRadius: '0 6px 6px 0',
              color: '#8B949E',
              fontSize: 14,
              whiteSpace: 'nowrap',
            }}>盒</span>
          </Space.Compact>
        </div>

        {/* 百分比滑块 */}
        <div className="slider-section">
          <Slider
            marks={{ 0: '', 25: '', 50: '', 75: '', 100: '' }}
            step={25}
            value={sliderValue}
            onChange={handleSliderChange}
            tooltip={{ open: false }}
          />
        </div>

        {/* 认购金额显示 */}
        <div className="trade-amount-section">
          <div className="trade-amount-label">认购金额</div>
          <div className="trade-amount-value">¥{Number(estimatedAmount || 0).toFixed(2)}</div>
        </div>

        {/* 提交按钮 */}
        <Button
          type="primary"
          size="large"
          block
          icon={<ShoppingCartOutlined />}
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="submit-btn buy-btn"
        >
          <span className="btn-text-long">
            认购 {drug.drugName}
          </span>
          <span className="btn-text-short" style={{ display: 'none' }}>
            认购
          </span>
        </Button>
      </div>

      {/* 我的认购概要 */}
      <div className="panel-section holding-section">
        <div className="section-title">我的认购</div>
        {loadingSubscription ? (
          <div className="holding-loading"><Spin size="small" /></div>
        ) : subscriptionSummary ? (
          <div className="holding-info">
            <div className="holding-row">
              <span className="holding-label">认购数量</span>
              <span className="holding-value">{subscriptionSummary.totalQuantity} 盒</span>
            </div>
            <div className="holding-row">
              <span className="holding-label">累计收益</span>
              <span className={`holding-value ${subscriptionSummary.totalProfit >= 0 ? 'profit' : 'loss'}`}>
                {subscriptionSummary.totalProfit >= 0 ? '+' : ''}¥{Number(subscriptionSummary.totalProfit || 0).toFixed(2)}
              </span>
            </div>
          </div>
        ) : (
          <div className="holding-empty">暂无认购</div>
        )}
        <div 
          className="view-holdings-link"
          onClick={() => navigate('/portfolio')}
        >
          查看完整认购 &gt;
        </div>
      </div>

      {/* 确认弹窗 */}
      <Modal
        open={confirmModalVisible}
        onCancel={() => setConfirmModalVisible(false)}
        footer={null}
        width={360}
        closable={false}
        className="trade-confirm-modal buy-mode"
        styles={{
          content: {
            background: '#1E2329',
            border: '1px solid #2B3139',
            borderRadius: 4,
            padding: 0,
          },
          body: {
            padding: 0,
          },
        }}
      >
        <div className="confirm-modal-content">
          <div className="confirm-header">
            <div className="confirm-icon">
              <ShoppingCartOutlined />
            </div>
            <Title level={4} className="confirm-title">
              确认认购
            </Title>
          </div>

          <div className="confirm-details">
            <div className="confirm-row">
              <Text className="confirm-label">药品</Text>
              <Text className="confirm-value">{drug.drugName}</Text>
            </div>
            <div className="confirm-row">
              <Text className="confirm-label">数量</Text>
              <Text className="confirm-value">{quantity} 盒</Text>
            </div>
            <div className="confirm-row">
              <Text className="confirm-label">金额</Text>
              <Text className="confirm-amount">¥{Number(estimatedAmount || 0).toFixed(2)}</Text>
            </div>
          </div>

          <div className="confirm-actions">
            <Button
              className="cancel-btn"
              onClick={() => setConfirmModalVisible(false)}
            >
              取消
            </Button>
            <Button
              type="primary"
              className="confirm-btn buy-confirm"
              onClick={handleConfirmOrder}
            >
              去支付
            </Button>
          </div>
        </div>
      </Modal>

      {/* 支付弹窗 */}
      <Modal
        open={paymentActive}
        onCancel={() => {
          stopPolling()
          resetPaymentState()
        }}
        footer={null}
        width={420}
        closable={true}
        title={null}
        styles={{
          content: {
            background: '#161B22',
            border: '1px solid #30363D',
            borderRadius: 12,
          },
        }}
      >
        {/* 选择支付方式 */}
        {paymentStep === 'channel' && !paymentQrCode && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#E6EDF3', marginBottom: 8 }}>
              选择支付方式
            </div>
            <div style={{ color: '#8B949E', marginBottom: 24 }}>
              认购 {drug?.drugName} {quantity}盒 · ¥{Number(estimatedAmount || 0).toFixed(2)}
            </div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <Button
                size="large"
                icon={<AlipayCircleOutlined />}
                onClick={() => handlePayWithChannel('alipay')}
                loading={submitting}
                style={{ width: 160, height: 48, borderColor: '#1890FF', color: '#1890FF' }}
              >
                支付宝支付
              </Button>
              <Button
                size="large"
                icon={<WechatOutlined />}
                onClick={() => handlePayWithChannel('wechat')}
                loading={submitting}
                style={{ width: 160, height: 48, borderColor: '#52C41A', color: '#52C41A' }}
              >
                微信支付
              </Button>
            </div>
          </div>
        )}

        {/* 支付中 - 二维码 */}
        {paymentStep === 'paying' && paymentQrCode && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <div style={{ marginBottom: 12 }}>
              <Text style={{ color: '#8B949E', fontSize: 14 }}>认购金额</Text>
              <div style={{
                fontSize: 36, fontWeight: 700, color: '#E6EDF3',
                fontFamily: "'JetBrains Mono', 'DIN', monospace",
              }}>
                ¥{Number(paymentAmount || 0).toFixed(2)}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              {paymentChannel === 'alipay' ? (
                <>
                  <AlipayCircleOutlined style={{ color: '#1890FF', fontSize: 28 }} />
                  <Text style={{ color: '#1890FF', fontSize: 18, fontWeight: 500, marginLeft: 8 }}>支付宝扫码支付</Text>
                </>
              ) : (
                <>
                  <WechatOutlined style={{ color: '#52C41A', fontSize: 28 }} />
                  <Text style={{ color: '#52C41A', fontSize: 18, fontWeight: 500, marginLeft: 8 }}>微信扫码支付</Text>
                </>
              )}
            </div>
            <div style={{
              display: 'inline-block', padding: 16, background: '#fff',
              borderRadius: 8, marginBottom: 12,
            }}>
              <QRCodeSVG value={paymentQrCode} size={200} />
            </div>
            <div style={{ color: '#8B949E', fontSize: 13 }}>
              请使用{paymentChannel === 'alipay' ? '支付宝' : '微信'}扫描二维码完成支付
            </div>
            <div style={{ color: '#8B949E', fontSize: 12, marginTop: 8 }}>
              <Spin size="small" /> 等待支付中...
            </div>
            {paymentMockMode && (
              <Button
                type="primary"
                size="small"
                style={{ marginTop: 12, background: '#722ED1', borderColor: '#722ED1' }}
                onClick={async () => {
                  try {
                    await paymentApi.confirmMockPayment(paymentOutTradeNo)
                    stopPolling()
                    setPaymentStep('success')
                    message.success('Mock支付成功，认购完成！')
                    fetchSubscriptionSummary(drug!.drugId)
                    onOrderSuccess?.()
                    setSuccessMessage('认购成功')
                    setShowSuccess(true)
                    setTimeout(() => setShowSuccess(false), 1500)
                  } catch (e: any) {
                    message.error('Mock确认失败')
                  }
                }}
              >
                模拟支付完成
              </Button>
            )}
          </div>
        )}

        {/* 支付成功 */}
        {paymentStep === 'success' && (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52C41A', marginBottom: 24 }} />
            <div style={{ fontSize: 24, fontWeight: 600, color: '#E6EDF3', marginBottom: 8 }}>
              支付成功
            </div>
            <Text style={{ color: '#8B949E' }}>¥{Number(paymentAmount || 0).toFixed(2)} 认购成功，T+1生效</Text>
          </div>
        )}

        {/* 支付超时 */}
        {paymentStep === 'timeout' && (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <CloseCircleOutlined style={{ fontSize: 64, color: '#FF4D4F', marginBottom: 24 }} />
            <div style={{ fontSize: 24, fontWeight: 600, color: '#E6EDF3', marginBottom: 8 }}>
              支付超时
            </div>
            <Text style={{ color: '#8B949E', display: 'block', marginBottom: 24 }}>请重新发起支付</Text>
            <Button
              type="primary"
              onClick={() => resetPaymentState()}
              style={{ background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)', border: 'none' }}
            >
              重新支付
            </Button>
          </div>
        )}
      </Modal>

      {/* 成功动画覆盖层 */}
      {showSuccess && (
        <div className="success-overlay">
          <div className="success-content">
            <CheckCircleOutlined className="success-icon" />
            <div className="success-text">{successMessage}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TradePanel
