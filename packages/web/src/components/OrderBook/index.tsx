import { useMemo, useRef, useEffect, useState } from 'react'
import './style.css'

interface DepthRange {
  min: number
  max: number
  label: string
  count: number
  amount: number
}

interface DepthData {
  ranges: DepthRange[]
  totalAmount: number
  totalCount: number
}

interface OrderBookProps {
  data: DepthData | null
  loading?: boolean
  currentPrice?: number
  priceChange?: number
}

// 涨跌箭头图标
const TrendIcon = ({ isUp }: { isUp: boolean }) => (
  <svg 
    width="12" 
    height="12" 
    viewBox="0 0 12 12" 
    fill="none" 
    style={{ transform: isUp ? 'rotate(0deg)' : 'rotate(180deg)' }}
  >
    <path 
      d="M6 2L10 8H2L6 2Z" 
      fill="currentColor"
    />
  </svg>
)

const OrderBook = ({ 
  data, 
  loading = false, 
  currentPrice = 0,
  priceChange = 0 
}: OrderBookProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleRows, setVisibleRows] = useState(8)

  // 分割买卖盘数据
  const { asks, bids } = useMemo(() => {
    if (!data?.ranges?.length) return { asks: [], bids: [] }
    
    const ranges = data.ranges
    const midIndex = Math.ceil(ranges.length / 2)
    
    // 卖盘：后半部分，价格从高到低排列
    const asksData = ranges.slice(midIndex).reverse().map((range, index) => ({
      ...range,
      index,
      price: range.min // 使用最低价作为代表价格
    }))
    
    // 买盘：前半部分，价格从高到低排列
    const bidsData = ranges.slice(0, midIndex).reverse().map((range, index) => ({
      ...range,
      index,
      price: range.max // 使用最高价作为代表价格
    }))
    
    return { asks: asksData, bids: bidsData }
  }, [data])

  // 计算买卖盘各自的最大数量用于柱状背景百分比
  const maxAskCount = useMemo(() => {
    if (!asks.length) return 0
    return Math.max(...asks.map(r => r.count))
  }, [asks])

  const maxBidCount = useMemo(() => {
    if (!bids.length) return 0
    return Math.max(...bids.map(r => r.count))
  }, [bids])

  // 计算卖盘累计金额（从上到下累计）
  const processedAsks = useMemo(() => {
    if (!asks.length) return []
    let cumulative = 0
    return asks.map(item => {
      cumulative += item.amount
      return {
        ...item,
        cumulative,
        percentage: maxAskCount > 0 ? (item.count / maxAskCount) * 100 : 0
      }
    })
  }, [asks, maxAskCount])

  // 计算买盘累计金额（从上到下累计）
  const processedBids = useMemo(() => {
    if (!bids.length) return []
    let cumulative = 0
    return bids.map(item => {
      cumulative += item.amount
      return {
        ...item,
        cumulative,
        percentage: maxBidCount > 0 ? (item.count / maxBidCount) * 100 : 0
      }
    })
  }, [bids, maxBidCount])

  // 根据容器高度动态计算可见行数
  useEffect(() => {
    const calculateVisibleRows = () => {
      if (containerRef.current) {
        const containerHeight = containerRef.current.clientHeight
        const statsHeight = 36 // 统计头部高度
        const headerHeight = 28 // 表头高度
        const priceAreaHeight = 32 // 中间最新价区域高度
        const rowHeight = 22 // 每行高度（更紧凑）
        const availableHeight = containerHeight - statsHeight - headerHeight - priceAreaHeight
        const halfRows = Math.floor(availableHeight / 2 / rowHeight)
        setVisibleRows(Math.max(4, Math.min(12, halfRows)))
      }
    }

    calculateVisibleRows()
    window.addEventListener('resize', calculateVisibleRows)
    
    return () => {
      window.removeEventListener('resize', calculateVisibleRows)
    }
  }, [])

  const formatAmount = (amount: number) => {
    if (amount >= 100000000) {
      return `¥${Number((amount / 100000000) || 0).toFixed(2)}亿`
    } else if (amount >= 10000) {
      return `¥${Number((amount / 10000) || 0).toFixed(2)}万`
    }
    return `¥${Number(amount || 0).toFixed(2)}`
  }

  const formatCount = (count: number) => {
    if (count >= 10000) {
      return `${(count / 10000).toFixed(1)}万`
    }
    return count.toString()
  }

  const formatPrice = (price: number) => {
    return `¥${price.toFixed(2)}`
  }

  const isPriceUp = priceChange >= 0

  // 加载中状态
  if (loading) {
    return (
      <div className="orderbook-container">
        <div className="orderbook-loading">
          <div className="loading-spinner" />
          <span>加载深度数据...</span>
        </div>
      </div>
    )
  }

  // 无数据状态
  if (!data || !data.ranges?.length) {
    return (
      <div className="orderbook-container">
        <div className="orderbook-loading">
          <span>暂无数据</span>
        </div>
      </div>
    )
  }

  const displayAsks = processedAsks.slice(0, visibleRows)
  const displayBids = processedBids.slice(0, visibleRows)

  return (
    <div className="orderbook-container" ref={containerRef}>
      {/* 统计头部 - 简洁行内显示 */}
      <div className="orderbook-stats">
        <span className="stat-label">排队总额</span>
        <span className="stat-value highlight">{formatAmount(data.totalAmount)}</span>
        <span className="stat-divider">|</span>
        <span className="stat-label">总单数</span>
        <span className="stat-value">{data.totalCount}</span>
      </div>

      {/* 深度列表 */}
      <div className="orderbook-list-wrapper">
        {/* 表头 */}
        <div className="orderbook-header">
          <span className="orderbook-col price">价格(CNY)</span>
          <span className="orderbook-col amount">数量(盒)</span>
          <span className="orderbook-col cumulative">累计</span>
        </div>

        {/* 卖盘 - 红色 */}
        <div className="orderbook-body asks">
          {displayAsks.map((item) => (
            <div 
              key={`ask-${item.label}`} 
              className="orderbook-row ask-row"
            >
              {/* 柱状背景 - 从右向左 */}
              <div 
                className="orderbook-row-bg ask-bg"
                style={{
                  background: `linear-gradient(to left, rgba(246, 70, 93, 0.15) ${item.percentage}%, transparent ${item.percentage}%)`
                }}
              />
              
              <span className="orderbook-col price font-mono ask-price">
                {formatPrice(item.price)}
              </span>
              <span className="orderbook-col amount font-mono">
                {formatCount(item.count)}
              </span>
              <span className="orderbook-col cumulative font-mono">
                {formatAmount(item.cumulative)}
              </span>
            </div>
          ))}
        </div>

        {/* 最新价中间区域 */}
        <div className="orderbook-current-price">
          <span className={`current-price-value ${isPriceUp ? 'up' : 'down'}`}>
            {formatPrice(currentPrice)}
          </span>
          <span className={`price-change ${isPriceUp ? 'up' : 'down'}`}>
            <TrendIcon isUp={isPriceUp} />
            {isPriceUp ? '+' : ''}{priceChange.toFixed(2)}%
          </span>
        </div>

        {/* 买盘 - 绿色 */}
        <div className="orderbook-body bids">
          {displayBids.map((item) => (
            <div 
              key={`bid-${item.label}`} 
              className="orderbook-row bid-row"
            >
              {/* 柱状背景 - 从右向左 */}
              <div 
                className="orderbook-row-bg bid-bg"
                style={{
                  background: `linear-gradient(to left, rgba(14, 203, 129, 0.15) ${item.percentage}%, transparent ${item.percentage}%)`
                }}
              />
              
              <span className="orderbook-col price font-mono bid-price">
                {formatPrice(item.price)}
              </span>
              <span className="orderbook-col amount font-mono">
                {formatCount(item.count)}
              </span>
              <span className="orderbook-col cumulative font-mono">
                {formatAmount(item.cumulative)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default OrderBook
