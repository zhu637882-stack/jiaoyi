import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  InputNumber,
  Button,
  message,
  Modal,
  Typography,
  Slider,
  Spin,
} from 'antd'
import {
  ShoppingCartOutlined,
} from '@ant-design/icons'
import { fundingApi, accountApi } from '../../services/api'
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

interface HoldingSummary {
  totalQuantity: number
  totalProfit: number
}

const TradePanel: React.FC<TradePanelProps> = ({ drug, onOrderSuccess }) => {
  const navigate = useNavigate()
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy')
  const [quantity, setQuantity] = useState<number>(1)
  const [balance, setBalance] = useState<number>(0)
  const [maxQuantity, setMaxQuantity] = useState<number>(0)
  const [sliderValue, setSliderValue] = useState<number>(0)
  const [confirmModalVisible, setConfirmModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [holdingSummary, setHoldingSummary] = useState<HoldingSummary | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [loadingHolding, setLoadingHolding] = useState(false)

  // 获取余额
  const fetchBalance = useCallback(async () => {
    try {
      setLoadingBalance(true)
      const response = await accountApi.getBalance()
      setBalance(response.availableBalance || 0)
    } catch (error) {
      console.error('获取余额失败:', error)
    } finally {
      setLoadingBalance(false)
    }
  }, [])

  // 获取当前药品持仓概要
  const fetchHoldingSummary = useCallback(async (drugId: string) => {
    try {
      setLoadingHolding(true)
      const response = await fundingApi.getDrugHoldings(drugId)
      if (response.success && response.data && response.data.length > 0) {
        const holdings = response.data
        const totalQuantity = holdings.reduce((sum: number, h: any) => sum + (h.quantity || 0), 0)
        const totalProfit = holdings.reduce((sum: number, h: any) => sum + (h.totalProfit || 0) + (h.totalInterest || 0), 0)
        setHoldingSummary({ totalQuantity, totalProfit })
      } else {
        setHoldingSummary(null)
      }
    } catch (error) {
      console.error('获取持仓概要失败:', error)
      setHoldingSummary(null)
    } finally {
      setLoadingHolding(false)
    }
  }, [])

  // 当药品变化时加载数据
  useEffect(() => {
    fetchBalance()
    if (drug?.drugId) {
      fetchHoldingSummary(drug.drugId)
      setQuantity(1)
      setSliderValue(0)
    }
  }, [drug?.drugId, fetchBalance, fetchHoldingSummary])

  // 计算最大可垫资数量（买入时）
  useEffect(() => {
    if (drug && balance && tradeMode === 'buy') {
      const maxByBalance = Math.floor(balance / drug.purchasePrice)
      setMaxQuantity(maxByBalance)
    } else if (tradeMode === 'sell' && holdingSummary) {
      setMaxQuantity(holdingSummary.totalQuantity)
    } else {
      setMaxQuantity(0)
    }
  }, [drug, balance, tradeMode, holdingSummary])

  // 计算交易额
  const estimatedAmount = useMemo(() => {
    if (!drug) return 0
    const price = tradeMode === 'buy' ? drug.purchasePrice : drug.sellingPrice
    return Number(Number(quantity * price || 0).toFixed(2))
  }, [quantity, drug, tradeMode])

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

  // Tab 切换
  const handleTabChange = (mode: 'buy' | 'sell') => {
    setTradeMode(mode)
    setQuantity(1)
    setSliderValue(0)
  }

  // 提交订单
  const handleSubmit = () => {
    if (!drug) {
      message.error('请先选择药品')
      return
    }
    if (quantity < 1) {
      message.error(`最少${tradeMode === 'buy' ? '垫资' : '卖出'}1盒`)
      return
    }
    if (tradeMode === 'buy' && estimatedAmount > balance) {
      message.error('可用余额不足')
      return
    }
    if (tradeMode === 'sell' && holdingSummary && quantity > holdingSummary.totalQuantity) {
      message.error('可卖出数量不足')
      return
    }
    setConfirmModalVisible(true)
  }

  const handleConfirmOrder = async () => {
    if (!drug) return

    // 卖出功能暂未完成
    if (tradeMode === 'sell') {
      message.info('解套功能开发中')
      setConfirmModalVisible(false)
      return
    }

    setSubmitting(true)
    try {
      const response = await fundingApi.createFundingOrder({
        drugId: drug.drugId,
        quantity,
      })
      if (response.success) {
        message.success('垫资订单创建成功')
        setConfirmModalVisible(false)
        setQuantity(1)
        setSliderValue(0)
        fetchBalance()
        fetchHoldingSummary(drug.drugId)
        onOrderSuccess?.()
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建订单失败')
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

  const isBuy = tradeMode === 'buy'
  const canSubmit = maxQuantity > 0 && quantity >= 1 && 
    (tradeMode === 'buy' ? estimatedAmount <= balance : (holdingSummary ? quantity <= holdingSummary.totalQuantity : false))

  return (
    <div className={`trade-panel ${isBuy ? '' : 'sell-mode'}`}>
      {/* Tab 切换 */}
      <div className="trade-tabs">
        <div
          className={`trade-tab ${isBuy ? 'active' : ''}`}
          onClick={() => handleTabChange('buy')}
        >
          垫资
        </div>
        <div
          className={`trade-tab ${!isBuy ? 'active' : ''}`}
          onClick={() => handleTabChange('sell')}
        >
          解套
        </div>
      </div>

      {/* 表单区域 */}
      <div className="panel-section form-section">
        {/* 价格输入框 */}
        <div className="form-item">
          <div className="form-label">价格</div>
          <InputNumber
            value={isBuy ? drug.purchasePrice : drug.sellingPrice}
            disabled
            className="price-input"
            precision={2}
            addonAfter="CNY"
          />
        </div>

        {/* 数量输入框 */}
        <div className="form-item">
          <div className="form-label">数量（盒）</div>
          <InputNumber
            min={0}
            max={maxQuantity}
            value={quantity}
            onChange={handleQuantityChange}
            className="quantity-input"
            precision={0}
            addonAfter="盒"
            disabled={maxQuantity <= 0}
          />
        </div>

        {/* 可用余额/可卖数量 */}
        <div className="available-balance">
          {isBuy ? (
            <>
              <span className="available-label">可用</span>
              <span className="available-value">
                {loadingBalance ? <Spin size="small" /> : `¥${Number(balance || 0).toFixed(2)} CNY`}
              </span>
            </>
          ) : (
            <>
              <span className="available-label">可卖</span>
              <span className="available-value">
                {loadingHolding ? <Spin size="small" /> : `${holdingSummary?.totalQuantity || 0} 盒`}
              </span>
            </>
          )}
        </div>

        {/* 百分比滑块 */}
        <div className="slider-section">
          <Slider
            marks={{ 0: '', 25: '', 50: '', 75: '', 100: '' }}
            step={25}
            value={sliderValue}
            onChange={handleSliderChange}
            tooltip={{ open: false }}
            disabled={maxQuantity <= 0}
          />
        </div>

        {/* 交易额显示 */}
        <div className="trade-amount-section">
          <div className="trade-amount-label">交易额</div>
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
          className={`submit-btn ${isBuy ? 'buy-btn' : 'sell-btn'}`}
        >
          <span className="btn-text-long">
            {isBuy ? `垫资买入 ${drug.drugName}` : `解套卖出 ${drug.drugName}`}
          </span>
          <span className="btn-text-short" style={{ display: 'none' }}>
            {isBuy ? '垫资买入' : '解套卖出'}
          </span>
        </Button>

        {/* 无持仓提示 */}
        {!isBuy && !holdingSummary && (
          <div className="error-tip">暂无可解套持仓</div>
        )}
        {maxQuantity <= 0 && isBuy && (
          <div className="error-tip">余额不足</div>
        )}
      </div>

      {/* 我的持仓概要 */}
      <div className="panel-section holding-section">
        <div className="section-title">我的持仓</div>
        {loadingHolding ? (
          <div className="holding-loading"><Spin size="small" /></div>
        ) : holdingSummary ? (
          <div className="holding-info">
            <div className="holding-row">
              <span className="holding-label">持仓数量</span>
              <span className="holding-value">{holdingSummary.totalQuantity} 盒</span>
            </div>
            <div className="holding-row">
              <span className="holding-label">累计收益</span>
              <span className={`holding-value ${holdingSummary.totalProfit >= 0 ? 'profit' : 'loss'}`}>
                {holdingSummary.totalProfit >= 0 ? '+' : ''}¥{Number(holdingSummary.totalProfit || 0).toFixed(2)}
              </span>
            </div>
          </div>
        ) : (
          <div className="holding-empty">暂无持仓</div>
        )}
        <div 
          className="view-holdings-link"
          onClick={() => navigate('/portfolio')}
        >
          查看完整持仓 &gt;
        </div>
      </div>

      {/* 确认弹窗 */}
      <Modal
        open={confirmModalVisible}
        onCancel={() => setConfirmModalVisible(false)}
        footer={null}
        width={360}
        closable={false}
        className={`trade-confirm-modal ${isBuy ? 'buy-mode' : 'sell-mode'}`}
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
              {isBuy ? '确认垫资' : '确认解套'}
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
              className={`confirm-btn ${isBuy ? 'buy-confirm' : 'sell-confirm'}`}
              loading={submitting}
              onClick={handleConfirmOrder}
            >
              确认
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default TradePanel
