import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PullToRefresh } from 'antd-mobile'
import { marketApi, drugApi } from '../services/api'
import { wsService } from '../services/websocket'
import './Home.css'

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
  subscribedQuantity: number
  fundingHeat?: number
  dailyReturn?: number
  cumulativeReturn?: number
  actualSellingPrice?: number
  actualPriceUpdatedAt?: string
  operationFeeRate?: number
  slowSellingDays?: number
  batchNo?: string
}

const HOME_PAGE_SIZE = 20

/* ============================================
   状态显示配置
   ============================================ */
const getStatusConfig = (status: string): { label: string; className: string } => {
  switch (status) {
    case 'selling':
      return { label: '发行中', className: 'status-selling' }
    case 'funding':
      return { label: '发行中', className: 'status-funding' }
    case 'stopped':
      return { label: '停止', className: 'status-stopped' }
    case 'cancelled':
      return { label: '取消', className: 'status-cancelled' }
    case 'completed':
      return { label: '已完成', className: 'status-stopped' }
    case 'pending':
    default:
      return { label: '待发行', className: 'status-stopped' }
  }
}

/* ============================================
   格式化工具
   ============================================ */
const formatVolume = (value: number): string => {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  return value.toFixed(0)
}

/* ============================================
   Home - 币安风格行情首页
   ============================================ */
const Home: React.FC = () => {
  const navigate = useNavigate()
  const [drugs, setDrugs] = useState<DrugItem[]>([])
  const [hotDrugs, setHotDrugs] = useState<DrugItem[]>([])
  const [marketStats, setMarketStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  // 分页状态
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadingMoreRef = useRef(false)
  const listBottomRef = useRef<HTMLDivElement>(null)

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
    subscribedQuantity: Number(d.subscribedQuantity) || 0,
    fundingHeat: Number(d.fundingHeat) || 0,
    dailyReturn: Number(d.dailyReturn) || 0,
    cumulativeReturn: Number(d.cumulativeReturn) || 0,
    actualSellingPrice: d.actualSellingPrice != null ? Number(d.actualSellingPrice) : undefined,
    actualPriceUpdatedAt: d.actualPriceUpdatedAt || undefined,
    operationFeeRate: d.operationFeeRate != null ? Number(d.operationFeeRate) : undefined,
    slowSellingDays: d.slowSellingDays != null ? Number(d.slowSellingDays) : undefined,
    batchNo: d.batchNo || undefined,
  })

  /* ---------- 数据加载 ---------- */
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [overviewRes, drugsRes] = await Promise.all([
        marketApi.getMarketOverview() as any,
        drugApi.getDrugs({ keyword: keyword || undefined, page: 1, pageSize: HOME_PAGE_SIZE }) as any,
      ])
      const drugsData = drugsRes?.data?.items || drugsRes?.data || drugsRes?.list || drugsRes || []
      const arr = Array.isArray(drugsData) ? drugsData : (drugsData?.items ? drugsData.items : [])
      const mapped = arr.map(mapDrugItem)
      const totalCount = drugsRes?.data?.total || 0
      setDrugs(mapped)
      setTotal(totalCount)
      setPage(1)
      setHasMore(mapped.length < totalCount)

      try {
        const hotRes = await marketApi.getHotList(5) as any
        const hotData = hotRes?.data || hotRes?.list || hotRes || []
        const hotArr = Array.isArray(hotData) ? hotData : []
        setHotDrugs(hotArr.map((d: any) => ({
          id: d.id || d.drugId,
          name: d.name || d.drugName,
          code: d.code || '',
          purchasePrice: Number(d.purchasePrice) || 0,
          sellingPrice: Number(d.sellingPrice || d.price) || 0,
          change: Number(d.change || d.dailyReturn) || 0,
          changePercent: Number(d.changePercent || d.dailyReturnRate) || 0,
          status: d.status || 'active',
          remainingQuantity: Number(d.remainingQuantity) || 0,
          totalQuantity: Number(d.totalQuantity) || 0,
          subscribedQuantity: Number(d.subscribedQuantity) || 0,
        })))
      } catch {}

      try {
        const statsRes = await marketApi.getMarketStats() as any
        setMarketStats(statsRes?.data || statsRes)
      } catch {}
    } catch (e) {
      console.error('Load market data error:', e)
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
      const drugsRes = await drugApi.getDrugs({ keyword: keyword || undefined, page: nextPage, pageSize: HOME_PAGE_SIZE }) as any
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
      try { if (isMounted) await loadData() } catch (e) { console.error('Home init error:', e) }
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

  /* ---------- 分类标签配置 ---------- */
  const tabs = [
    { key: 'all', label: '全部' },
    { key: 'hot', label: '热门' },
    { key: 'gainers', label: '涨幅榜' },
    { key: 'losers', label: '跌幅榜' },
  ]

  /* ---------- 筛选排序 ---------- */
  const filteredDrugs = useMemo(() => {
    let result: DrugItem[]
    switch (activeTab) {
      case 'hot':
        result = hotDrugs
        break
      case 'gainers':
        result = [...drugs].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))
        break
      case 'losers':
        result = [...drugs].sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))
        break
      default:
        result = drugs
    }
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      result = result.filter(d =>
        d.name.toLowerCase().includes(kw) || d.code.toLowerCase().includes(kw)
      )
    }
    return result
  }, [activeTab, drugs, hotDrugs, keyword])

  /* ---------- 渲染 ---------- */
  return (
    <div className="mobile-home">
      {/* ===== 顶部搜索栏 + 用户头像 ===== */}
      <div className="home-header">
        <div className="home-search-row">
          <div className="home-search-box">
            <svg className="home-search-icon" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="home-search-input"
              placeholder="搜索药品名称/代码"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
            {keyword && (
              <span className="home-search-clear" onClick={() => setKeyword('')}>
                <svg width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </span>
            )}
          </div>
          <div className="home-avatar-btn" onClick={() => navigate('/m/profile')}>
            <svg width="22" height="22" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>
      </div>

      {/* ===== 分类标签 ===== */}
      <div className="home-tabs">
        {tabs.map(tab => (
          <div
            key={tab.key}
            className={`home-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {/* ===== 行情列表 ===== */}
      <PullToRefresh onRefresh={loadData}>
        <div className="market-list">
          {/* 品种跑马灯 */}
          {drugs.length > 0 && (
            <div className="ticker-marquee">
              <div className="ticker-track">
                {[...drugs, ...drugs].map((drug, index) => {
                  const isUp = (drug.changePercent || 0) >= 0
                  return (
                    <div
                      key={`${drug.id}-${index}`}
                      className="ticker-card"
                      onClick={() => navigate(`/m/trade/${drug.id}`)}
                    >
                      <span className="ticker-name">{drug.name}</span>
                      <span className="ticker-price">¥{drug.sellingPrice.toFixed(2)}</span>
                      <span className={`ticker-change ${isUp ? 'up' : 'down'}`}>
                        {isUp ? '+' : ''}{(drug.changePercent || 0).toFixed(2)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 列表头 */}
          <div className="market-list-header">
            <span className="col-name">名称</span>
            <span className="col-status">发行量</span>
            <span className="col-purchase">采购价</span>
            <span className="col-price">最新价</span>
          </div>

          {/* 骨架屏加载 */}
          {loading ? (
            <div className="market-skeleton">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="skeleton-row">
                  <div className="skeleton-row-left">
                    <div className="skeleton-bar" style={{ width: '56px', height: '14px' }} />
                    <div className="skeleton-bar" style={{ width: '32px', height: '10px' }} />
                  </div>
                  <div className="skeleton-bar" style={{ width: '52px', height: '20px' }} />
                  <div className="skeleton-row-right">
                    <div className="skeleton-bar" style={{ width: '60px', height: '14px' }} />
                    <div className="skeleton-bar" style={{ width: '48px', height: '18px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* 行情列表项 */
            filteredDrugs.map((drug, index) => {
              const isUp = (drug.changePercent || 0) >= 0
              return (
                <div
                  key={drug.id}
                  className="market-row"
                  onClick={() => navigate(`/m/trade/${drug.id}`)}
                  style={{ animationDelay: `${index * 0.03}s` }}
                >
                  <div className="market-row-info">
                    <span className="market-row-name">{drug.name}</span>
                    <span className="market-row-code">{drug.code}</span>
                    {(drug.operationFeeRate != null || drug.slowSellingDays != null || drug.batchNo) && (
                      <span className="market-row-extra">
                        {drug.operationFeeRate != null && `费率${(drug.operationFeeRate * 100).toFixed(0)}%`}
                        {drug.operationFeeRate != null && (drug.slowSellingDays != null || drug.batchNo) ? ' | ' : ''}
                        {drug.slowSellingDays != null && `滞销${drug.slowSellingDays}天`}
                        {drug.slowSellingDays != null && drug.batchNo ? ' | ' : ''}
                        {drug.batchNo && `批次${drug.batchNo}`}
                      </span>
                    )}
                  </div>
                  <div className="market-row-quantity-col">
                    <span className="market-row-quantity">{formatVolume(drug.totalQuantity)}</span>
                    <span className={`market-row-status ${getStatusConfig(drug.status).className}`}>
                      {getStatusConfig(drug.status).label}
                    </span>
                  </div>
                  <div className="market-row-purchase-col">
                    <span className="market-row-purchase">¥{drug.purchasePrice.toFixed(2)}</span>
                  </div>
                  <div className="market-row-price-col">
                    <span className="market-row-price">¥{drug.sellingPrice.toFixed(2)}</span>
                    <span className={`market-row-change ${isUp ? 'up' : 'down'}`}>
                      {isUp ? '+' : ''}{(drug.changePercent || 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
              )
            })
          )}

          {/* 空状态 */}
          {!loading && filteredDrugs.length === 0 && (
            <div className="market-empty">
              <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="26" stroke="var(--color-border-medium)" strokeWidth="1.5" fill="none" />
                <path d="M22 28h20M22 36h14" stroke="var(--color-border-medium)" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="44" cy="44" r="9" fill="var(--color-primary-bg)" />
                <path d="M41 44h6M44 41v6" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div className="empty-text">暂无行情数据</div>
              <div className="empty-hint">下拉刷新试试</div>
            </div>
          )}

          {/* 上拉加载更多指示器 + 查看全部 */}
          {!loading && filteredDrugs.length > 0 && activeTab === 'all' && !keyword.trim() && (
            <div className="market-load-more" ref={listBottomRef}>
              {loadingMore ? (
                <div className="market-load-more-loading">
                  <span className="market-load-spinner" />
                  <span>加载中...</span>
                </div>
              ) : !hasMore ? (
                <div className="market-load-more-done">已加载全部 {total} 个品种</div>
              ) : null}
            </div>
          )}

          {/* 查看全部品种入口 */}
          {!loading && total > 0 && activeTab === 'all' && !keyword.trim() && (
            <div className="market-view-all" onClick={() => navigate('/m/trade')}>
              <span>查看全部 {total} 个品种</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          )}
        </div>
      </PullToRefresh>
    </div>
  )
}

export default Home
