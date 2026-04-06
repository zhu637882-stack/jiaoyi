import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiseOutlined, FallOutlined } from '@ant-design/icons'
import './style.css'

interface TickerItem {
  drugId: string
  drugName: string
  drugCode: string
  sellingPrice: number
  dailyReturn: number
  cumulativeReturn: number
}

interface TickerBarProps {
  data: TickerItem[]
  loading?: boolean
  onItemClick?: (drugId: string) => void
}

interface PriceFlashState {
  [key: string]: 'up' | 'down' | null
}

const TickerBar = ({ data, loading = false, onItemClick }: TickerBarProps) => {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)
  const prevPricesRef = useRef<Map<string, number>>(new Map())
  const [flashStates, setFlashStates] = useState<PriceFlashState>({})

  // 检测价格变化并触发闪烁动画
  useEffect(() => {
    const newFlashStates: PriceFlashState = {}
    
    data.forEach(item => {
      const prevPrice = prevPricesRef.current.get(item.drugId)
      if (prevPrice !== undefined && prevPrice !== item.sellingPrice) {
        newFlashStates[item.drugId] = item.sellingPrice > prevPrice ? 'up' : 'down'
        
        // 动画结束后清除状态
        setTimeout(() => {
          setFlashStates(prev => ({
            ...prev,
            [item.drugId]: null
          }))
        }, 600)
      }
      prevPricesRef.current.set(item.drugId, item.sellingPrice)
    })
    
    if (Object.keys(newFlashStates).length > 0) {
      setFlashStates(prev => ({ ...prev, ...newFlashStates }))
    }
  }, [data])

  // 复制数据以实现无缝循环
  const duplicatedData = [...data, ...data]

  const handleItemClick = (drugId: string) => {
    if (onItemClick) {
      onItemClick(drugId)
    } else {
      navigate(`/trade/${drugId}`)
    }
  }

  const formatReturn = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${Number(value || 0).toFixed(2)}%`
  }

  if (loading || data.length === 0) {
    return (
      <div className="ticker-bar">
        <div className="ticker-content">
          <div className="ticker-item">
            <span className="ticker-name">加载中...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="ticker-bar"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div 
        ref={containerRef}
        className={`ticker-track ${isPaused ? 'paused' : ''}`}
        style={{
          animationDuration: `${Math.max(data.length * 3, 20)}s`,
        }}
      >
        {duplicatedData.map((item, index) => {
          const isPositive = item.dailyReturn >= 0
          const flashState = flashStates[item.drugId]
          return (
            <div
              key={`${item.drugId}-${index}`}
              className="ticker-item"
              onClick={() => handleItemClick(item.drugId)}
            >
              <span className="ticker-name">{item.drugName}</span>
              <span 
                className={`ticker-price ${flashState === 'up' ? 'price-flash-up' : flashState === 'down' ? 'price-flash-down' : ''}`}
              >
                ¥{Number(item.sellingPrice || 0).toFixed(2)}
              </span>
              <span
                className={`ticker-change ${isPositive ? 'up' : 'down'}`}
              >
                {isPositive ? <RiseOutlined /> : <FallOutlined />}
                {formatReturn(item.dailyReturn)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TickerBar
