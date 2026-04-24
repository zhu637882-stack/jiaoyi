import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PullToRefresh, SearchBar, Toast } from 'antd-mobile'
import { marketApi, drugApi, subscriptionApi } from '../services/api'
import { wsService } from '../services/websocket'
import VirtualList from '../components/VirtualList'
import './TradeList.css'

interface DrugItem {
  id: string | number
  name: string
  code: string
  purchasePrice: number
  sellingPrice: number
  change: number
  changePercent: number
  status: string
  remainingQuantity: number
  totalQuantity: number
  actualSellingPrice?: number
  actualPriceUpdatedAt?: string
  operationFeeRate?: number
  slowSellingDays?: number
  batchNo?: string
}

type CategoryTab = 'all' | 'hot' | 'gain' | 'loss'

const PAGE_SIZE = 20

/* ============================================
   格式化工具
   ============================================ */
const formatPrice = (price: number): string => {
  return price.toFixed(2)
}

/* ============================================
   TradeList - 交易页（卡片风格产品列表）
   ============================================ */
const TradeList: React.FC = () => {
  const navigate = useNavigate()
  const [drugs, setDrugs] = useState<DrugItem[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [activeTab, setActiveTab] = useState<CategoryTab>('all')

  // 分页状态
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exporting, setExporting] = useState(false)
  const loadingMoreRef = useRef(false)
  const listBottomRef = useRef<HTMLDivElement>(null)

  const tabs = [
    { key: 'all', label: '全部' },
    { key: 'hot', label: '热门' },
    { key: 'gain', label: '涨幅榜' },
    { key: 'loss', label: '跌幅榜' },
  ] as const

  /* ---------- 映射药品数据 ---------- */
  const mapDrugItem = (d: any): DrugItem => ({
    id: d.id,
    name: d.name,
    code: d.code,
    purchasePrice: Number(d.purchasePrice) || 0,
    sellingPrice: Number(d.sellingPrice) || 0,
    change: Number(d.change || d.dailyReturn) || 0,
    changePercent: Number(d.changePercent || d.dailyReturnRate) || 0,
    status: d.status,
    remainingQuantity: Number(d.remainingQuantity) || 0,
    totalQuantity: Number(d.totalQuantity) || 0,
    actualSellingPrice: d.actualSellingPrice != null ? Number(d.actualSellingPrice) : undefined,
    actualPriceUpdatedAt: d.actualPriceUpdatedAt || undefined,
    operationFeeRate: d.operationFeeRate != null ? Number(d.operationFeeRate) : undefined,
    slowSellingDays: d.slowSellingDays != null ? Number(d.slowSellingDays) : undefined,
    batchNo: d.batchNo || undefined,
  })

  /* ---------- 初始加载 ---------- */
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const drugsRes = await drugApi.getDrugs({ keyword: keyword || undefined, page: 1, pageSize: PAGE_SIZE }) as any
      const drugsData = drugsRes?.data?.items || drugsRes?.data || drugsRes?.list || drugsRes || []
      const arr = Array.isArray(drugsData) ? drugsData : (drugsData?.items ? drugsData.items : [])
      const mapped = arr.map(mapDrugItem)
      const totalCount = drugsRes?.data?.total || 0
      setDrugs(mapped)
      setTotal(totalCount)
      setPage(1)
      setHasMore(mapped.length < totalCount)
    } catch (e) {
      console.error('Load trade list error:', e)
    } finally {
      setLoading(false)
    }
  }, [keyword])

  /* ---------- 加载更多 ---------- */
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const drugsRes = await drugApi.getDrugs({ keyword: keyword || undefined, page: nextPage, pageSize: PAGE_SIZE }) as any
      const drugsData = drugsRes?.data?.items || drugsRes?.data || drugsRes?.list || drugsRes || []
      const arr = Array.isArray(drugsData) ? drugsData : (drugsData?.items ? drugsData.items : [])
      const mapped = arr.map(mapDrugItem)
      const totalCount = drugsRes?.data?.total || 0
      setDrugs(prev => [...prev, ...mapped])
      setPage(nextPage)
      setTotal(totalCount)
      setHasMore(drugs.length + mapped.length < totalCount)
    } catch (e) {
      console.error('Load more error:', e)
    } finally {
      setLoadingMore(false)
      loadingMoreRef.current = false
    }
  }, [page, hasMore, keyword, drugs.length])

  /* ---------- IntersectionObserver 上拉加载 ---------- */
  useEffect(() => {
    const bottomEl = listBottomRef.current
    if (!bottomEl) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMoreRef.current && !loading) {
          loadMore()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(bottomEl)
    return () => observer.disconnect()
  }, [hasMore, loadMore, loading])

  /* ---------- WebSocket 行情推送 ---------- */
  useEffect(() => {
    let isMounted = true

    const init = async () => {
      try { if (isMounted) await loadData() } catch (e) { console.error('TradeList init error:', e) }
    }
    init()

    try {
      wsService.connect()
      wsService.subscribeTicker()
      wsService.on('market:ticker', (data: any) => {
        if (isMounted && data) {
          setDrugs(prev => prev.map(d => {
            if (!d?.id) return d
            const tickerItem = Array.isArray(data)
              ? data.find((t: any) => String(t?.drugId) === String(d.id))
              : null
            if (tickerItem) {
              return {
                ...d,
                sellingPrice: tickerItem?.price || d?.sellingPrice,
                change: tickerItem?.change ?? d?.change,
                changePercent: tickerItem?.changePercent ?? d?.changePercent,
              }
            }
            return d
          }))
        }
      })
    } catch (e) {
      console.error('WebSocket error:', e)
    }

    return () => {
      isMounted = false
      try { wsService.unsubscribeTicker() } catch (e) { console.error('WS unsubscribe error:', e) }
    }
  }, [loadData])

  /* ---------- 筛选 ---------- */
  const filteredDrugs = useMemo(() => {
    let result = drugs

    // 分类筛选
    switch (activeTab) {
      case 'hot':
        result = result.slice(0, 5)
        break
      case 'gain':
        result = [...result].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))
        break
      case 'loss':
        result = [...result].sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))
        break
      default:
        break
    }

    // 关键词搜索
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      result = result.filter(d =>
        d.name.toLowerCase().includes(kw) || d.code.toLowerCase().includes(kw)
      )
    }

    return result
  }, [drugs, keyword, activeTab])

  /* ---------- 卡片交互处理 ---------- */
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    // 计算旋转角度（±15度范围）
    const rotateX = ((y - centerY) / centerY) * -15
    const rotateY = ((x - centerX) / centerX) * 15
    
    card.style.setProperty('--rotateX', `${rotateX}deg`)
    card.style.setProperty('--rotateY', `${rotateY}deg`)
    card.classList.add('is-3d')
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget
    card.classList.remove('is-3d')
    card.style.setProperty('--rotateX', '0deg')
    card.style.setProperty('--rotateY', '0deg')
  }

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>, drugId: string | number) => {
    const card = e.currentTarget
    
    // 添加点击动画类
    card.classList.add('clicked')
    
    // 创建波纹效果
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const ripple = document.createElement('span')
    ripple.className = 'ripple'
    const size = Math.max(rect.width, rect.height)
    ripple.style.width = ripple.style.height = `${size}px`
    ripple.style.left = `${x - size / 2}px`
    ripple.style.top = `${y - size / 2}px`
    
    card.appendChild(ripple)
    
    // 动画结束后跳转
    setTimeout(() => {
      navigate(`/m/trade/${drugId}`)
    }, 500)
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const card = e.currentTarget
    card.classList.add('touch-active')
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const card = e.currentTarget
    card.classList.remove('touch-active')
  }

  /* ---------- 导出交易记录 ---------- */
  const handleExport = useCallback(async () => {
    if (exporting) return
    setExporting(true)
    try {
      const blob = await subscriptionApi.exportCsv()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const now = new Date()
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      a.href = url
      a.download = `零钱保_交易记录_${dateStr}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export error:', e)
      Toast.show({ content: '导出失败，请稍后重试', icon: 'fail' })
    } finally {
      setExporting(false)
    }
  }, [exporting])

  /* ---------- 渲染卡片 ---------- */
  const renderDrugCard = (drug: DrugItem, index: number) => {
    const isUp = (drug.changePercent || 0) >= 0
    const changePercent = drug.changePercent || 0

    return (
      <div
        key={drug.id}
        className="trade-card"
        onClick={(e) => handleCardClick(e, drug.id)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ animationDelay: `${index * 0.06}s` }}
      >
        {/* 第一行：品种名称 */}
        <div className="trade-card-row1">
          <span className="trade-card-name">{drug.name}</span>
        </div>

        {/* 第二行：规格代码（左）+ 徽章/价格/涨跌幅（右） */}
        <div className="trade-card-row2">
          <span className="trade-card-code">{drug.code}</span>
          <div className="trade-card-row2-right">
            <span className="trade-card-badge">实时更新</span>
            <span className="trade-card-price">
              <span className="trade-price-flip">
                <span key={drug.sellingPrice} className="trade-price-flip-enter">¥{formatPrice(drug.sellingPrice)}</span>
              </span>
            </span>
            <span className={`trade-card-change ${isUp ? 'up' : 'down'}`}>
              {isUp ? '+' : ''}{changePercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* 第三行：运营费率/滞销天数/批次号 */}
        <div className="trade-card-row3">
          {drug.operationFeeRate != null && (
            <span>运营费率: {Number(drug.operationFeeRate).toFixed(0)}%</span>
          )}
          {drug.slowSellingDays != null && (
            <span>滞销保障期: {drug.slowSellingDays}天</span>
          )}
          {drug.batchNo && (
            <span>批次: {drug.batchNo}</span>
          )}
        </div>
      </div>
    )
  }

  /* ---------- 渲染 ---------- */
  return (
    <div className="trade-list-page">
      {/* ===== 顶部标题栏 + 搜索 ===== */}
      <div className="trade-list-header">
        <div className="trade-list-title-row">
          <h1 className="trade-list-title">交易</h1>
          <button
            className={`trade-export-btn ${exporting ? 'loading' : ''}`}
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <span className="trade-export-spinner" />
            ) : (
              <svg className="trade-export-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v8M7 9L4 6M7 9l3-3M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            <span>{exporting ? '导出中' : '导出'}</span>
          </button>
        </div>
        <div className="trade-search-wrapper">
          <SearchBar
            placeholder="搜索产品名称/代码"
            value={keyword}
            onChange={setKeyword}
            className="trade-search-bar"
          />
        </div>
        {/* ===== 分类标签栏 ===== */}
        <div className="trade-category-tabs">
          {tabs.map(tab => (
            <div
              key={tab.key}
              className={`trade-tab-item ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key as CategoryTab)}
            >
              {tab.label}
            </div>
          ))}
        </div>
        {/* 总数提示 */}
        {!loading && total > 0 && activeTab === 'all' && !keyword.trim() && (
          <div className="trade-total-hint">共 {total} 个品种</div>
        )}
      </div>

      {/* ===== 产品卡片列表 ===== */}
      <PullToRefresh onRefresh={loadData}>
        <div className="trade-card-list">
          {/* 骨架屏加载 */}
          {loading ? (
            <div className="trade-skeleton">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="trade-skeleton-card">
                  <div className="trade-skeleton-left">
                    <div className="trade-skeleton-bar" style={{ width: '80px', height: '18px' }} />
                    <div className="trade-skeleton-bar" style={{ width: '50px', height: '12px' }} />
                  </div>
                  <div className="trade-skeleton-right">
                    <div className="trade-skeleton-bar" style={{ width: '70px', height: '20px' }} />
                    <div className="trade-skeleton-bar" style={{ width: '60px', height: '24px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* 产品卡片 — 虚拟滚动 */
            <VirtualList
              items={filteredDrugs}
              itemHeight={148}
              overscan={4}
              keyExtractor={(drug) => String(drug.id)}
              className="trade-virtual-list"
              renderItem={(drug, index) => renderDrugCard(drug, index)}
            />
          )}

          {/* 空状态 */}
          {!loading && filteredDrugs.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <circle cx="35" cy="35" r="18" stroke="#5E6673" strokeWidth="2"/>
                  <line x1="48" y1="48" x2="62" y2="62" stroke="#5E6673" strokeWidth="3" strokeLinecap="round"/>
                  <text x="35" y="40" textAnchor="middle" fill="#F0B90B" fontSize="18" fontWeight="bold">?</text>
                </svg>
              </div>
              <p className="empty-state-text">{keyword.trim() ? '未找到相关产品' : '暂无产品'}</p>
              <p className="empty-state-hint">{keyword.trim() ? '换个关键词试试' : '下拉刷新试试'}</p>
            </div>
          )}

          {/* 上拉加载更多指示器 */}
          {!loading && filteredDrugs.length > 0 && activeTab === 'all' && !keyword.trim() && (
            <div className="trade-load-more" ref={listBottomRef}>
              {loadingMore ? (
                <div className="trade-load-more-loading">
                  <span className="trade-load-spinner" />
                  <span>加载中...</span>
                </div>
              ) : !hasMore ? (
                <div className="trade-load-more-done">已加载全部 {total} 个品种</div>
              ) : null}
            </div>
          )}
        </div>
      </PullToRefresh>
    </div>
  )
}

export default TradeList
