import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { PullToRefresh } from 'antd-mobile'
import { marketApi, drugApi } from '../services/api'
import { systemMessageApi } from '../services/api'
import type { SystemMessage } from '../types'
import { wsService } from '../services/websocket'
import logoImg from '../assets/avatar-logo.png'
import './Home.css'

interface DrugItem {
  id: string | number
  name: string
  code: string
  spec?: string
  manufacturer?: string
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
  dailySalesQuantity?: number
}

const HOME_PAGE_SIZE = 20

/* ============================================
   实时交易动态模拟数据
   ============================================ */
const MOCK_USERS = ['刘**', '王*', '张**', '李*', '陈**', '赵*', '孙**', '周*', '吴**', '黄*', '林**', '郑*', '马**', '何*', '罗**']
const TIME_LABELS = [
  '刚刚', '3分钟前', '5分钟前', '8分钟前', '12分钟前',
  '18分钟前', '25分钟前', '半小时前', '45分钟前',
  '1小时前', '1.5小时前', '2小时前',
]

interface MockTrade {
  id: number
  user: string
  queueNo: number
  qty: number
  time: string
}

const getDynamicTradeStats = () => {
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  const elapsedMinutes = h * 60 + m

  let prevTrades: number
  let targetTrades: number
  let prevQueue: number
  let targetQueue: number
  let periodStartMinutes: number
  let periodEndMinutes: number

  if (h >= 6 && h < 12) {
    // 上午：从昨天结转基数开始，新增90笔
    prevTrades = 210
    targetTrades = 300
    prevQueue = 6
    targetQueue = 12
    periodStartMinutes = 6 * 60
    periodEndMinutes = 12 * 60
  } else if (h >= 12 && h < 18) {
    // 中午：累计继续增长
    prevTrades = 300
    targetTrades = 350
    prevQueue = 12
    targetQueue = 8
    periodStartMinutes = 12 * 60
    periodEndMinutes = 18 * 60
  } else if (h >= 18 && h < 24) {
    // 晚上：高峰时段
    prevTrades = 350
    targetTrades = 420
    prevQueue = 8
    targetQueue = 15
    periodStartMinutes = 18 * 60
    periodEndMinutes = 24 * 60
  } else {
    // 凌晨：保持前一天累积的高数值，缓慢增加
    prevTrades = 420
    targetTrades = 438
    prevQueue = 5
    targetQueue = 3
    periodStartMinutes = 0
    periodEndMinutes = 6 * 60
  }

  const periodDuration = periodEndMinutes - periodStartMinutes
  const elapsedInPeriod = elapsedMinutes - periodStartMinutes
  const progress = Math.max(0, Math.min(1, elapsedInPeriod / periodDuration))

  const tradeRange = targetTrades - prevTrades
  const queueRange = targetQueue - prevQueue

  const currentTrades = prevTrades + tradeRange * progress
  const currentQueue = prevQueue + queueRange * progress

  const randomTradeOffset = (Math.random() - 0.5) * 6
  const randomQueueOffset = (Math.random() - 0.5) * 2

  return {
    todayCount: Math.max(0, Math.round(currentTrades + randomTradeOffset)),
    queuingCount: Math.max(1, Math.round(currentQueue + randomQueueOffset)),
  }
}

const generateMockTrades = (count: number): MockTrade[] => {
  const stats = getDynamicTradeStats()
  const maxQueueNo = Math.max(stats.queuingCount + 8, 15)
  const trades: MockTrade[] = []
  for (let i = 0; i < count; i++) {
    const user = MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)]
    const timeIdx = Math.min(i, TIME_LABELS.length - 1)
    const queueNo = Math.max(1, maxQueueNo - i)
    const qty = Math.floor(Math.random() * 171) + 30
    trades.push({
      id: i,
      user,
      queueNo,
      qty,
      time: TIME_LABELS[timeIdx],
    })
  }
  return trades
}


/* ============================================
   格式化工具
   ============================================ */
const formatVolume = (value: number, unit?: string): string => {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万${unit || ''}`
  return `${value.toFixed(0)}${unit || ''}`
}

const formatMoney = (value: number): string => {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ============================================
   SVG 图标
   ============================================ */
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#848E9C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const BellIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

/* ============================================
   Home - 币安风格深色主题首页（6列数据卡片）
   ============================================ */
const Home: React.FC = () => {
  const [drugs, setDrugs] = useState<DrugItem[]>([])
  const [hotDrugs, setHotDrugs] = useState<DrugItem[]>([])
  const [marketStats, setMarketStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  // 系统消息
  const [messages, setMessages] = useState<SystemMessage[]>([])
  const [showMessages, setShowMessages] = useState(false)
  const [msgLoading, setMsgLoading] = useState(false)

  // 分页状态
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadingMoreRef = useRef(false)
  const listBottomRef = useRef<HTMLDivElement>(null)

  /* ---------- 实时交易动态模拟 ---------- */
  const [tradeList, setTradeList] = useState<MockTrade[]>(() => generateMockTrades(20))
  const [tick, setTick] = useState(0)

  const tradeStats = useMemo(() => {
    const base = getDynamicTradeStats()
    return { ...base, todayCount: base.todayCount + tick }
  }, [tick])

  // 跑马灯数据：重复两份实现无缝滚动
  const marqueeTrades = useMemo(() => [...tradeList, ...tradeList], [tradeList])

  /* ---------- 映射药品数据 ---------- */
  const mapDrugItem = (d: any): DrugItem => ({
    id: d.id,
    name: d.name,
    code: d.code,
    spec: d.spec || d.unit || '',
    manufacturer: d.manufacturer || d.factory || '',
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
    dailySalesQuantity: Number(d.dailySalesQuantity) || 0,
  })

  /* ---------- 数据加载 ---------- */
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [overviewRes, drugsRes] = await Promise.all([
        marketApi.getMarketOverview() as any,
        drugApi.getDrugs({ page: 1, pageSize: HOME_PAGE_SIZE }) as any,
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
          spec: d.spec || d.unit || '',
          manufacturer: d.manufacturer || d.factory || '',
          purchasePrice: Number(d.purchasePrice) || 0,
          sellingPrice: Number(d.sellingPrice || d.price) || 0,
          change: Number(d.change || d.dailyReturn) || 0,
          changePercent: Number(d.changePercent || d.dailyReturnRate) || 0,
          status: d.status || 'active',
          remainingQuantity: Number(d.remainingQuantity) || 0,
          totalQuantity: Number(d.totalQuantity) || 0,
          subscribedQuantity: Number(d.subscribedQuantity) || 0,
          dailySalesQuantity: Number(d.dailySalesQuantity) || 0,
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
  }, [])

  /* ---------- 加载更多 ---------- */
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const drugsRes = await drugApi.getDrugs({ page: nextPage, pageSize: HOME_PAGE_SIZE }) as any
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
  }, [page, hasMore, drugs.length])

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
          setHotDrugs(prev => prev.map(d => {
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
        result = [...drugs].sort((a, b) => {
          const ca = a.purchasePrice > 0 ? (a.sellingPrice - a.purchasePrice) / a.purchasePrice : 0
          const cb = b.purchasePrice > 0 ? (b.sellingPrice - b.purchasePrice) / b.purchasePrice : 0
          return cb - ca
        })
        break
      case 'losers':
        result = [...drugs].sort((a, b) => {
          const ca = a.purchasePrice > 0 ? (a.sellingPrice - a.purchasePrice) / a.purchasePrice : 0
          const cb = b.purchasePrice > 0 ? (b.sellingPrice - b.purchasePrice) / b.purchasePrice : 0
          return ca - cb
        })
        break
      default:
        result = drugs
    }
    return result
  }, [activeTab, drugs, hotDrugs])

  /* ---------- 涨幅计算 ---------- */
  const calcChange = (drug: DrugItem): number => {
    if (drug.purchasePrice > 0) {
      return (drug.sellingPrice - drug.purchasePrice) / drug.purchasePrice
    }
    return 0
  }

  /* ---------- 获取药品单位 ---------- */
  const getUnit = (drug: DrugItem): string => {
    if (drug.spec) {
      const match = drug.spec.match(/(盒|瓶|支|袋|罐|件|板)/)
      if (match) return match[1]
    }
    return '盒'
  }

  /* ---------- 系统消息 ---------- */
  const loadMessages = async () => {
    setMsgLoading(true)
    try {
      const res = await systemMessageApi.getPublished({ page: 1, pageSize: 50 }) as any
      const listData = res?.data?.list || res?.data?.items || res?.data || []
      setMessages(Array.isArray(listData) ? listData : [])
    } catch (e) {
      console.error('Load messages error:', e)
    } finally {
      setMsgLoading(false)
    }
  }

  const handleBellClick = async () => {
    setShowMessages(true)
    await loadMessages()
  }

  const handleCreateDefaultMsg = async () => {
    try {
      const createRes = await systemMessageApi.adminCreate({
        title: '欢迎使用零钱宝',
        content: '感谢您使用零钱宝平台！我们将持续为您提供优质的药品交易服务和及时的行情资讯。如有疑问，请随时联系客服。',
        type: 'announcement',
      }) as any
      const newMsg = createRes?.data?.data || createRes?.data
      if (newMsg?.id) {
        await systemMessageApi.adminPublish(newMsg.id) as any
      }
      await loadMessages()
    } catch (e) {
      console.error('Create default message error:', e)
    }
  }

  // 页面加载时预加载消息（用于铃铛红点）
  useEffect(() => {
    loadMessages()
  }, [])

  /* ---------- 实时交易动态60秒自动更新 ---------- */
  useEffect(() => {
    const interval = setInterval(() => {
      const addCount = Math.floor(Math.random() * 3) + 1
      setTick(prev => prev + addCount)
      setTradeList(prev => {
        const nextId = prev.length > 0 ? Math.max(...prev.map(t => t.id)) + 1 : 0
        const maxQueueNo = prev.length > 0 ? Math.max(...prev.map(t => t.queueNo)) + 1 : 1
        const user = MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)]
        const qty = Math.floor(Math.random() * 171) + 30
        const newTrade: MockTrade = {
          id: nextId,
          user,
          queueNo: maxQueueNo,
          qty,
          time: '刚刚',
        }
        const updated = [newTrade, ...prev.slice(0, 18)]
        return updated.map((t, i) => ({
          ...t,
          time: TIME_LABELS[Math.min(i, TIME_LABELS.length - 1)],
        }))
      })
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  /* ---------- 渲染 ---------- */
  return (
    <div className="home-page">
      {/* ===== 固定头部区域（sticky） ===== */}
      <div className="home-sticky-header">
        {/* ===== Header ===== */}
        <div className="home-header">
          <div className="home-header-left">
            <img src={logoImg} alt="零钱宝" className="home-header-logo" />
            <span className="home-header-brand">零钱宝</span>
          </div>
          <div className="home-header-notify" onClick={handleBellClick}>
            <BellIcon />
            {messages.length > 0 && <span className="home-header-notify-dot" />}
          </div>
        </div>

        {/* ===== 系统消息横向滚动条 ===== */}
        <div className="home-msg-ticker">
          <div className="home-msg-ticker-track">
            {messages.length > 0 ? (
              <>
                {messages.map((msg, idx) => (
                  <div key={msg.id || idx} className="home-msg-ticker-item" onClick={handleBellClick}>
                    <span className="home-msg-ticker-tag">
                      {msg.type === 'announcement' ? '公告' : msg.type === 'maintenance' ? '维护' : '通知'}
                    </span>
                    <span className="home-msg-ticker-text">{msg.title}</span>
                  </div>
                ))}
                {/* 重复一份实现无缝循环 */}
                {messages.map((msg, idx) => (
                  <div key={`dup-${msg.id || idx}`} className="home-msg-ticker-item" onClick={handleBellClick} aria-hidden>
                    <span className="home-msg-ticker-tag">
                      {msg.type === 'announcement' ? '公告' : msg.type === 'maintenance' ? '维护' : '通知'}
                    </span>
                    <span className="home-msg-ticker-text">{msg.title}</span>
                  </div>
                ))}
              </>
            ) : (
              <div className="home-msg-ticker-item home-msg-ticker-empty" onClick={handleBellClick}>
                <span className="home-msg-ticker-tag">消息</span>
                <span className="home-msg-ticker-text">暂无系统消息，点击查看</span>
              </div>
            )}
          </div>
        </div>

        {/* ===== 分类Tab ===== */}
        <div className="home-tabs">
          <div className="home-tab-group">
            {tabs.map(tab => (
              <div
                key={tab.key}
                className={`home-tab-item ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </div>
            ))}
          </div>
        </div>

        {/* ===== 实时交易动态 ===== */}
        <div className="home-trading-live">
          <div className="home-trading-stats">
            <div className="home-trading-stat-item">
              <span className="home-trading-stat-label">今日成交</span>
              <span className="home-trading-stat-value">{tradeStats.todayCount}</span>
              <span className="home-trading-stat-label">笔</span>
            </div>
            <div className="home-trading-stat-item">
              <span className="home-trading-stat-label">排队中</span>
              <span className="home-trading-stat-value">{tradeStats.queuingCount}</span>
              <span className="home-trading-stat-label">人</span>
            </div>
          </div>
          <div className="home-trading-marquee">
            <div className="home-trading-marquee-inner">
              {marqueeTrades.map((trade, idx) => (
                <div key={idx} className="home-trading-item">
                  <span className="home-trading-item-user">{trade.user}</span>
                  <span className="home-trading-item-action">刚刚进货排队</span>
                  <span className="home-trading-item-drug">{trade.queueNo}号</span>
                  <span className="home-trading-item-qty">{trade.qty}盒</span>
                  <span className="home-trading-item-time">{trade.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== 药品卡片列表 ===== */}
      <PullToRefresh onRefresh={loadData}>
        {loading ? (
          <div className="home-skeleton">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="home-skeleton-card">
                <div className="home-skeleton-row-top">
                  <div className="home-skeleton-bar" style={{ width: '100px' }} />
                  <div className="home-skeleton-bar" style={{ width: '30px' }} />
                </div>
                <div className="home-skeleton-divider" />
                <div className="home-skeleton-row-grid">
                  {[1,2,3,4,5,6].map(j => (
                    <div key={j} className="home-skeleton-col">
                      <div className="home-skeleton-bar" style={{ width: '28px', height: '10px' }} />
                      <div className="home-skeleton-bar" style={{ width: '36px', height: '14px' }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="home-drug-list">
            {filteredDrugs.map((drug) => {
              const change = calcChange(drug)
              const isUp = change >= 0
              const unit = getUnit(drug)
              const changeValue = drug.change || (change * 100)
              return (
                <div
                  key={drug.id}
                  className="home-drug-card"
                >
                  {/* 第一行：名称 + 单位 */}
                  <div className="home-drug-card-top">
                    <span className="home-drug-name">{drug.name}</span>
                    <span className="home-drug-unit">{unit}</span>
                  </div>

                  {/* 分割线 */}
                  <div className="home-drug-divider" />

                  {/* 标签行 */}
                  <div className="home-drug-grid home-drug-labels">
                    <span>需求量</span>
                    <span>采购价</span>
                    <span>销售价</span>
                    <span>买入量</span>
                    <span>销售量</span>
                    <span>涨幅</span>
                  </div>

                  {/* 数值行 */}
                  <div className="home-drug-grid home-drug-values">
                    <span>{formatVolume(drug.totalQuantity, unit)}</span>
                    <span>{drug.purchasePrice.toFixed(1)}元</span>
                    <span>{drug.sellingPrice.toFixed(1)}元</span>
                    <span>{formatVolume(drug.subscribedQuantity, unit)}</span>
                    <span>{formatVolume(drug.dailySalesQuantity || 0, unit)}</span>
                    <span className={`home-drug-change ${isUp ? 'up' : 'down'}`}>
                      {isUp ? '+' : ''}{changeValue.toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })}

            {/* 空状态 */}
            {!loading && filteredDrugs.length === 0 && (
              <div className="home-empty">
                <p className="home-empty-text">暂无行情数据</p>
                <p className="home-empty-hint">下拉刷新试试</p>
              </div>
            )}

            {/* 上拉加载更多 */}
            {!loading && filteredDrugs.length > 0 && activeTab === 'all' && (
              <div className="home-load-more" ref={listBottomRef}>
                {loadingMore ? (
                  <div className="home-load-more-loading">
                    <span className="home-load-spinner" />
                    <span>加载中...</span>
                  </div>
                ) : !hasMore ? (
                  <div className="home-load-more-done">已加载全部 {total} 个品种</div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </PullToRefresh>

      {/* ===== 系统消息弹窗 ===== */}
      {showMessages && (
        <div className="home-msg-overlay" onClick={() => setShowMessages(false)}>
          <div className="home-msg-popup" onClick={e => e.stopPropagation()}>
            <div className="home-msg-popup-header">
              <span className="home-msg-popup-title">系统消息</span>
              <button className="home-msg-popup-close" onClick={() => setShowMessages(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#848E9C" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="home-msg-popup-body">
              {msgLoading ? (
                <div className="home-msg-popup-loading">加载中...</div>
              ) : messages.length > 0 ? (
                <div className="home-msg-list">
                  {messages.map(msg => (
                    <div key={msg.id} className="home-msg-card">
                      <div className="home-msg-card-header">
                        <span className={`home-msg-card-tag home-msg-tag-${msg.type}`}>
                          {msg.type === 'announcement' ? '公告' : msg.type === 'maintenance' ? '维护' : '通知'}
                        </span>
                        <span className="home-msg-card-time">
                          {msg.publishedAt ? new Date(msg.publishedAt).toLocaleDateString('zh-CN') : ''}
                        </span>
                      </div>
                      <div className="home-msg-card-title">{msg.title}</div>
                      <div className="home-msg-card-content">{msg.content}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="home-msg-popup-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#848E9C" strokeWidth="1" strokeLinecap="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <p className="home-msg-popup-empty-text">暂无系统消息</p>
                  <button className="home-msg-create-btn" onClick={handleCreateDefaultMsg}>
                    创建欢迎消息
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home
