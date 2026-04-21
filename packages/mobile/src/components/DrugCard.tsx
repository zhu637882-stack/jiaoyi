import React, { useState, useEffect, useRef, useCallback } from 'react'
import './DrugCard.css'

// ============================================
// 类型定义
// ============================================

export interface DrugItem {
  id: string | number
  name: string
  code: string
  purchasePrice: number
  sellingPrice: number
  change?: number
  changePercent?: number
  status: string
  remainingQuantity?: number
  totalQuantity?: number
  fundingHeat?: number
  dailyReturn?: number
  cumulativeReturn?: number
}

interface DrugCardProps {
  drug: DrugItem
  index?: number
  onClick: (id: string | number) => void
  showVolume?: boolean
}

// ============================================
// 辅助函数
// ============================================

/**
 * 格式化价格，保留2位小数
 */
const formatPrice = (price: number | undefined): string => {
  if (price === undefined || price === null) return '0.00'
  return price.toFixed(2)
}

/**
 * 格式化涨跌幅，保留2位小数
 */
const formatChangePercent = (percent: number | undefined): string => {
  if (percent === undefined || percent === null) return '0.00'
  return Math.abs(percent).toFixed(2)
}

/**
 * 格式化涨跌额，保留2位小数
 */
const formatChange = (change: number | undefined): string => {
  if (change === undefined || change === null) return '0.00'
  return Math.abs(change).toFixed(2)
}

// ============================================
// 热度图标组件
// ============================================

const HeatIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path 
      d="M5 1C5 1 8 4 8 6C8 7.66 6.66 9 5 9C3.34 9 2 7.66 2 6C2 4 5 1 5 1Z" 
      fill="#F6465D" 
      opacity="0.9"
    />
    <path 
      d="M5 2.5C5 2.5 7 4.5 7 6C7 7.1 6.1 8 5 8" 
      stroke="#FF6B7A" 
      strokeWidth="0.5"
      strokeLinecap="round"
      opacity="0.6"
    />
  </svg>
)

// ============================================
// 状态标签组件
// ============================================

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusConfig: Record<string, { label: string; className: string }> = {
    funding: { label: '募资中', className: 'status-funding' },
    selling: { label: '销售中', className: 'status-selling' },
    active: { label: '交易中', className: 'status-active' },
    paused: { label: '暂停', className: 'status-paused' },
    completed: { label: '已完成', className: 'status-completed' },
  }

  const config = statusConfig[status] || { label: status, className: 'status-default' }

  return <span className={`drug-card-status ${config.className}`}>{config.label}</span>
}

// ============================================
// 价格闪烁效果 Hook
// ============================================

interface UsePriceFlashReturn {
  flashClass: string
  triggerFlash: (direction: 'up' | 'down') => void
}

const usePriceFlash = (): UsePriceFlashReturn => {
  const [flashClass, setFlashClass] = useState('')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const triggerFlash = useCallback((direction: 'up' | 'down') => {
    // 清除之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // 设置闪烁类
    setFlashClass(direction === 'up' ? 'flash-up' : 'flash-down')

    // 500ms后清除
    timeoutRef.current = setTimeout(() => {
      setFlashClass('')
    }, 500)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { flashClass, triggerFlash }
}

// ============================================
// DrugCard 组件
// ============================================

const DrugCard: React.FC<DrugCardProps> = ({ 
  drug, 
  index = 0, 
  onClick,
  showVolume = false 
}) => {
  const isUp = (drug.changePercent || 0) >= 0
  const { flashClass, triggerFlash } = usePriceFlash()
  const prevPriceRef = useRef(drug.sellingPrice)

  // 监听价格变化，触发闪烁动画
  useEffect(() => {
    const currentPrice = drug.sellingPrice
    const prevPrice = prevPriceRef.current

    if (currentPrice !== prevPrice && prevPrice !== undefined) {
      if (currentPrice > prevPrice) {
        triggerFlash('up')
      } else if (currentPrice < prevPrice) {
        triggerFlash('down')
      }
    }

    prevPriceRef.current = currentPrice
  }, [drug.sellingPrice, triggerFlash])

  // 计算进度条宽度
  const progressPercent = drug.totalQuantity && drug.totalQuantity > 0
    ? Math.min(100, ((drug.totalQuantity - (drug.remainingQuantity || 0)) / drug.totalQuantity) * 100)
    : 0

  return (
    <div
      className={`drug-card card-press ${flashClass}`}
      onClick={() => onClick(drug.id)}
      style={{ animationDelay: `${index * 0.05}s` }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick(drug.id)
        }
      }}
    >
      {/* 左侧：药品信息 */}
      <div className="drug-card-left">
        <div className="drug-card-name-row">
          <span className="drug-card-name">{drug.name}</span>
          <StatusBadge status={drug.status} />
        </div>
        <div className="drug-card-meta">
          <span className="drug-card-code">{drug.code}</span>
          {drug.fundingHeat !== undefined && drug.fundingHeat > 0 && (
            <span className="drug-card-heat">
              <HeatIcon />
              <span className="heat-value">{drug.fundingHeat}</span>
            </span>
          )}
        </div>
        
        {/* 进度条（可选） */}
        {showVolume && drug.totalQuantity && drug.totalQuantity > 0 && (
          <div className="drug-card-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="progress-text">
              已售 {progressPercent.toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* 中间：价格信息 */}
      <div className="drug-card-center">
        <div className={`drug-card-price ${isUp ? 'up' : 'down'}`}>
          <span className="price-symbol">¥</span>
          <span className="price-value">{formatPrice(drug.sellingPrice)}</span>
        </div>
        <div className="drug-card-info">
          <span className="info-label">进</span>
          <span className="info-value">¥{formatPrice(drug.purchasePrice)}</span>
        </div>
      </div>

      {/* 右侧：涨跌幅 */}
      <div className={`drug-card-right ${isUp ? 'up' : 'down'}`}>
        <div className="drug-card-change-percent">
          <span className="change-icon">{isUp ? '↑' : '↓'}</span>
          <span className="change-value">{formatChangePercent(drug.changePercent)}%</span>
        </div>
        <div className="drug-card-change">
          <span className="change-symbol">{isUp ? '+' : '-'}</span>
          <span className="change-value">{formatChange(drug.change)}</span>
        </div>
      </div>
    </div>
  )
}

export default DrugCard
