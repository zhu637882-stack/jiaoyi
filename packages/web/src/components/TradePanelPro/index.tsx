import { useState, useEffect, useMemo } from 'react'
import { Button, InputNumber, Space, message } from 'antd'
import { ShoppingCartOutlined, RiseOutlined, FallOutlined, ClockCircleOutlined, FireOutlined, TeamOutlined } from '@ant-design/icons'
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

const TradePanelPro: React.FC<TradePanelProProps> = ({ drug }) => {
  const [quantity, setQuantity] = useState<number>(1)
  const [tradeRecords, setTradeRecords] = useState<TradeRecord[]>([])

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

  const handleSubmit = () => {
    if (!drug) return
    if (quantity < 1) {
      message.error('最少认购1盒')
      return
    }
    message.success(`认购 ${drug.drugName} ${quantity}盒 成功！`)
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
          <span className="remaining">剩余 {Math.max(0, (drug.totalQuantity || 0) - (drug.subscribedQuantity || 0))}盒</span>
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
          onClick={handleSubmit}
          className="submit-btn-pro"

        >
          立即认购 {drug.drugName}
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
          <span>30% 合伙收益</span>
        </div>
      </div>
    </div>
  )
}

export default TradePanelPro
