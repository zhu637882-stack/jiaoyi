import React, { useState, useEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
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
  manufacturer?: string
  specification?: string
}

interface DrugCardProps {
  drug: DrugItem
  index?: number
  onClick: (id: string | number) => void
  onSubscribe?: (id: string | number) => void
  onShare?: (drug: DrugItem) => void
  showVolume?: boolean
}

// ============================================
// 辅助函数
// ============================================

const formatPrice = (price: number | undefined): string => {
  if (price === undefined || price === null) return '0.00'
  return price.toFixed(2)
}

const formatChangePercent = (percent: number | undefined): string => {
  if (percent === undefined || percent === null) return '0.00'
  return Math.abs(percent).toFixed(2)
}

// ============================================
// 状态标签组件
// ============================================

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusConfig: Record<string, { label: string; className: string }> = {
    funding: { label: '募', className: 'status-funding' },
    selling: { label: '售', className: 'status-selling' },
    active: { label: '交', className: 'status-active' },
    paused: { label: '停', className: 'status-paused' },
    completed: { label: '完', className: 'status-completed' },
  }
  const config = statusConfig[status] || { label: status?.charAt(0) || '?', className: 'status-default' }
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
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setFlashClass(direction === 'up' ? 'flash-up' : 'flash-down')
    timeoutRef.current = setTimeout(() => setFlashClass(''), 500)
  }, [])

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [])

  return { flashClass, triggerFlash }
}

// ============================================
// 长按浮动菜单组件
// ============================================

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onDetail: () => void
  onSubscribe: () => void
  onShare: () => void
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onDetail, onSubscribe, onShare }) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      let adjustedX = x, adjustedY = y
      if (x + rect.width > vw - 8) adjustedX = vw - rect.width - 8
      if (y + rect.height > vh - 8) adjustedY = y - rect.height
      if (adjustedX < 8) adjustedX = 8
      if (adjustedY < 8) adjustedY = 8
      setPos({ x: adjustedX, y: adjustedY })
    }
  }, [x, y])

  return ReactDOM.createPortal(
    <>
      <div className="drug-context-menu-overlay" onClick={onClose} onTouchEnd={onClose} />
      <div ref={menuRef} className="drug-context-menu" style={{ left: pos.x, top: pos.y }}>
        <button className="context-menu-item" onClick={onDetail}>
          <span className="menu-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="2"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" stroke="currentColor" strokeWidth="2"/></svg>
          </span>
          查看详情
        </button>
        <button className="context-menu-item primary" onClick={onSubscribe}>
          <span className="menu-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </span>
          立即认购
        </button>
        <button className="context-menu-item" onClick={onShare}>
          <span className="menu-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
          分享
        </button>
      </div>
    </>,
    document.body
  )
}

// ============================================
// DrugCard 组件 - CryptoListItem 风格
// ============================================

const DrugCard: React.FC<DrugCardProps> = ({
  drug,
  index = 0,
  onClick,
  onSubscribe,
  onShare,
}) => {
  const isUp = (drug.changePercent || 0) >= 0
  const { flashClass, triggerFlash } = usePriceFlash()
  const prevPriceRef = useRef(drug.sellingPrice)

  // 长按菜单状态
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const longPressTriggeredRef = useRef(false)
  const touchMoveRef = useRef(false)

  const handleLongPressStart = useCallback((e: React.TouchEvent) => {
    touchMoveRef.current = false
    longPressTriggeredRef.current = false
    const touch = e.touches[0]
    const tx = touch.clientX, ty = touch.clientY
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      if (!touchMoveRef.current) setContextMenu({ x: tx, y: ty })
    }, 500)
  }, [])

  const handleLongPressMove = useCallback(() => {
    touchMoveRef.current = true
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null }
  }, [])

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null }
  }, [])

  const handleCardClick = useCallback(() => {
    if (longPressTriggeredRef.current) { longPressTriggeredRef.current = false; return }
    onClick(drug.id)
  }, [drug.id, onClick])

  useEffect(() => {
    return () => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current) }
  }, [])

  // 监听价格变化
  useEffect(() => {
    const currentPrice = drug.sellingPrice
    const prevPrice = prevPriceRef.current
    if (currentPrice !== prevPrice && prevPrice !== undefined) {
      triggerFlash(currentPrice > prevPrice ? 'up' : 'down')
    }
    prevPriceRef.current = currentPrice
  }, [drug.sellingPrice, triggerFlash])

  // 药品名首字母
  const initial = drug.name.charAt(0)

  // 规格/厂家描述
  const specText = drug.specification || drug.code || ''

  return (
    <>
      <div
        className={`drug-card ${flashClass}`}
        onClick={handleCardClick}
        onTouchStart={handleLongPressStart}
        onTouchMove={handleLongPressMove}
        onTouchEnd={handleLongPressEnd}
        onTouchCancel={handleLongPressEnd}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(drug.id) }}
      >
        {/* 左：圆形首字母 */}
        <div className="drug-card-avatar">
          {initial}
        </div>

        {/* 中：名称 + 规格 */}
        <div className="drug-card-info">
          <div className="drug-card-name">
            {drug.name}
            <StatusBadge status={drug.status} />
          </div>
          <div className="drug-card-spec">{specText}</div>
        </div>

        {/* 右：价格 + 涨跌badge */}
        <div className="drug-card-right">
          <div className={`drug-card-price ${isUp ? 'up' : 'down'}`}>
            <span className="price-flip">
              <span key={drug.sellingPrice} className="price-flip-enter">¥{formatPrice(drug.sellingPrice)}</span>
            </span>
          </div>
          <span className={`drug-card-change-badge ${isUp ? 'up' : 'down'}`}>
            {isUp ? '+' : '-'}{formatChangePercent(drug.changePercent)}%
          </span>
        </div>
      </div>

      {/* 长按浮动菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onDetail={() => { setContextMenu(null); onClick(drug.id) }}
          onSubscribe={() => { setContextMenu(null); onSubscribe ? onSubscribe(drug.id) : onClick(drug.id) }}
          onShare={() => { setContextMenu(null); onShare ? onShare(drug) : undefined }}
        />
      )}
    </>
  )
}

export default DrugCard
