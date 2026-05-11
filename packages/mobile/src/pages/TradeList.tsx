import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PullToRefresh } from 'antd-mobile'
import { drugApi, accountApi } from '../services/api'
import './TradeList.css'

// ============================================
// 类型定义
// ============================================

interface DrugItem {
  id: string | number
  name: string
  code: string
  spec?: string
  manufacturer?: string
  category?: string
  type?: string
  purchasePrice: number
  sellingPrice: number
  changePercent: number
  remainingQuantity: number
  totalQuantity: number
  imageUrl?: string
  image?: string
}

type CategoryTab = 'all' | 'otc' | 'prescription' | 'supplement'

interface BalanceData {
  availableBalance: number
  totalInvested: number
}

// ============================================
// 分类配置
// ============================================

const CATEGORY_TABS: { key: CategoryTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'otc', label: 'OTC' },
  { key: 'prescription', label: '处方药' },
  { key: 'supplement', label: '保健品' },
]

const CATEGORY_MAP: Record<string, CategoryTab> = {
  'otc': 'otc',
  'OTC': 'otc',
  'prescription': 'prescription',
  '处方药': 'prescription',
  'supplement': 'supplement',
  '保健品': 'supplement',
  'health_supplement': 'supplement',
}

const CATEGORY_LABEL: Record<CategoryTab, string> = {
  otc: 'OTC',
  prescription: '处方药',
  supplement: '保健品',
  all: '',
}

const CATEGORY_COLORS: Record<CategoryTab, { bg: string; color: string }> = {
  prescription: { bg: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' },
  otc: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981' },
  supplement: { bg: 'rgba(240, 185, 11, 0.15)', color: '#F0B90B' },
  all: { bg: 'transparent', color: 'transparent' },
}

// ============================================
// 工具函数
// ============================================

const formatPrice = (price: number): string => {
  return price.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const getDrugCategory = (drug: DrugItem): CategoryTab => {
  if (drug.category) return CATEGORY_MAP[drug.category] || 'otc'
  if (drug.type) return CATEGORY_MAP[drug.type] || 'otc'
  return 'otc'
}

// ============================================
// SVG 图标
// ============================================

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#848E9C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

// 处方药 - 听诊器图标（红色）
const PrescriptionIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="5" stroke="#EF4444" strokeWidth="1.5" fill="rgba(239,68,68,0.1)" />
    <path d="M12 13v4" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9 17h6" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="8" cy="7" r="1.5" fill="#EF4444" />
    <circle cx="16" cy="7" r="1.5" fill="#EF4444" />
  </svg>
)

// OTC - 胶囊图标（绿色）
const OtcIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <rect x="8" y="3" width="8" height="18" rx="4" stroke="#10B981" strokeWidth="1.5" fill="rgba(16,185,129,0.1)" />
    <line x1="8" y1="12" x2="16" y2="12" stroke="#10B981" strokeWidth="1.5" />
  </svg>
)

// 保健品 - 心形图标（黄色）
const SupplementIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path d="M12 21C12 21 3 14.5 3 8.5C3 5.5 5.5 3 8.5 3C10.3 3 11.8 3.9 12 5C12.2 3.9 13.7 3 15.5 3C18.5 3 21 5.5 21 8.5C21 14.5 12 21 12 21Z" stroke="#F0B90B" strokeWidth="1.5" fill="rgba(240,185,11,0.1)" />
  </svg>
)

// 药品图片占位图标
const DrugImagePlaceholder = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.5">
    <rect x="5" y="2" width="14" height="20" rx="7" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

// 药品图片组件 - 带懒加载和错误处理（缩略图优先，失败回退原图）
const DrugImage: React.FC<{ drug: DrugItem; categoryIcon: React.ReactNode }> = ({ drug, categoryIcon }) => {
  const [loaded, setLoaded] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [useFallback, setUseFallback] = React.useState(false)
  const imgRef = React.useRef<HTMLImageElement>(null)

  // 构建图片URL - 优先缩略图版本（300px），不存在则回退原图
  const buildImageUrls = (url: string | undefined) => {
    if (!url) return { thumb: '', original: '' }
    if (url.startsWith('http://') || url.startsWith('https://')) return { thumb: url, original: url }
    const path = url.startsWith('/') ? url : `/${url}`
    const thumb = path.replace(/(\.[^.]+)$/, '_thumb$1')
    return { thumb, original: path }
  }

  const { thumb: thumbSrc, original: originalSrc } = buildImageUrls(drug.imageUrl || drug.image)
  const src = useFallback ? originalSrc : thumbSrc

  // 检查图片是否已缓存加载
  React.useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalHeight > 0) {
      setLoaded(true)
    }
  }, [src])

  // 图片加载失败时：缩略图失败回退原图，原图失败显示占位图标
  const handleError = () => {
    if (!useFallback && thumbSrc !== originalSrc) {
      console.warn(`缩略图加载失败,回退原图: ${thumbSrc}`)
      setUseFallback(true)
      return
    }
    console.warn(`图片加载失败: ${src}`)
    setError(true)
  }

  if (!thumbSrc || error) {
    return (
      <div className="tl-drug-img-placeholder">
        {categoryIcon}
      </div>
    )
  }

  return (
    <>
      {!loaded && (
        <div className="tl-drug-img-placeholder tl-drug-img-loading">
          <DrugImagePlaceholder />
        </div>
      )}
      <img
        ref={imgRef}
        src={src}
        alt={drug.name}
        className={`tl-drug-img ${loaded ? 'tl-drug-img-loaded' : ''}`}
        onLoad={() => setLoaded(true)}
        onError={handleError}
        style={{ opacity: loaded ? 1 : 0 }}
      />
    </>
  )
}

// ============================================
// 主组件
// ============================================

const TradeList: React.FC = () => {
  const navigate = useNavigate()
  const [drugs, setDrugs] = useState<DrugItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<CategoryTab>('all')
  const [searchText, setSearchText] = useState('')
  const [balance, setBalance] = useState<BalanceData | null>(null)

  // 加载药品列表
  const loadDrugs = useCallback(async () => {
    try {
      setLoading(true)
      const res = await drugApi.getDrugs({ page: 1, pageSize: 100 }) as any
      const drugsData = res?.data?.items || res?.data || res?.list || res || []
      const arr = Array.isArray(drugsData) ? drugsData : (drugsData?.items ? drugsData.items : [])
      const mapped = arr.map((d: any): DrugItem => ({
        id: d.id,
        name: d.name || '未知药品',
        code: d.code || '',
        spec: d.spec || d.unit || '',
        manufacturer: d.manufacturer || d.factory || '',
        category: d.category || d.type || '',
        type: d.type || d.category || '',
        imageUrl: d.imageUrl || d.image || '',
        purchasePrice: Number(d.purchasePrice) || 0,
        sellingPrice: Number(d.sellingPrice) || 0,
        changePercent: Number(d.changePercent || d.dailyReturnRate) || 0,
        remainingQuantity: Number(d.remainingQuantity) || 0,
        totalQuantity: Number(d.totalQuantity) || 0,
      }))
      setDrugs(mapped)
    } catch (e) {
      console.error('Load drugs error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // 加载账户余额
  const loadBalance = useCallback(async () => {
    try {
      const res = await accountApi.getBalance() as any
      const data = res?.data || res
      setBalance({
        availableBalance: Number(data?.availableBalance ?? 0),
        totalInvested: Number(data?.totalInvested ?? 0),
      })
    } catch (e) {
      console.error('Load balance error:', e)
    }
  }, [])

  // 初始加载
  useEffect(() => {
    let isMounted = true
    const init = async () => {
      try {
        if (isMounted) await loadDrugs()
        if (isMounted) await loadBalance()
      } catch (e) {
        console.error('TradeList init error:', e)
      }
    }
    init()
    return () => { isMounted = false }
  }, [loadDrugs, loadBalance])

  // 分类计数
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryTab, number> = { all: 0, otc: 0, prescription: 0, supplement: 0 }
    drugs.forEach(d => {
      counts.all++
      const cat = getDrugCategory(d)
      counts[cat] = (counts[cat] || 0) + 1
    })
    return counts
  }, [drugs])

  // 筛选后的药品
  const filteredDrugs = useMemo(() => {
    let result = drugs
    if (activeTab !== 'all') {
      result = result.filter(d => getDrugCategory(d) === activeTab)
    }
    if (searchText.trim()) {
      const kw = searchText.trim().toLowerCase()
      result = result.filter(d => d.name.toLowerCase().includes(kw))
    }
    return result
  }, [drugs, activeTab, searchText])

  // 最低利润率
  const minProfitRate = useMemo(() => {
    if (filteredDrugs.length === 0) return 0
    let minRate = Infinity
    filteredDrugs.forEach(d => {
      if (d.purchasePrice > 0) {
        const rate = ((d.sellingPrice - d.purchasePrice) / d.purchasePrice) * 100
        if (rate < minRate) minRate = rate
      }
    })
    return minRate === Infinity ? 0 : minRate
  }, [filteredDrugs])

  // 额度数据
  const quotaTotal = balance ? balance.availableBalance + balance.totalInvested : 50000
  const quotaUsed = balance?.totalInvested || 0
  const quotaPercent = quotaTotal > 0 ? Math.min((quotaUsed / quotaTotal) * 100, 100) : 0

  // 获取分类图标
  const getCategoryIcon = (cat: CategoryTab) => {
    switch (cat) {
      case 'prescription': return <PrescriptionIcon />
      case 'otc': return <OtcIcon />
      case 'supplement': return <SupplementIcon />
      default: return <OtcIcon />
    }
  }

  // 利润率计算
  const calcProfitRate = (drug: DrugItem): number => {
    if (drug.purchasePrice > 0) {
      return ((drug.sellingPrice - drug.purchasePrice) / drug.purchasePrice) * 100
    }
    return 0
  }

  return (
    <div className="tl-page">
      {/* ===== 固定头部区域 ===== */}
      <div className="tl-sticky-header">
        {/* ===== 顶部导航栏 ===== */}
        <div className="tl-nav">
          <div className="tl-nav-title">垫资进货</div>

        </div>

        {/* ===== 额度卡片 ===== */}
        <div className="tl-quota-card">
          <div className="tl-quota-body">
            <div className="tl-quota-main">
              <div className="tl-quota-label">今日可垫资额度</div>
              <div className="tl-quota-amount">¥{formatPrice(quotaTotal - quotaUsed)}</div>
            </div>
            <div className="tl-quota-side">
              <div className="tl-quota-label">已用额度</div>
              <div className="tl-quota-used-value">¥{formatPrice(quotaUsed)}</div>
              <div className="tl-quota-progress-track">
                <div
                  className="tl-quota-progress-fill"
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ===== 分类 Tab 栏 ===== */}
        <div className="tl-category-tabs">
          {CATEGORY_TABS.map(tab => {
            const isActive = activeTab === tab.key
            const count = categoryCounts[tab.key] || 0
            return (
              <div
                key={tab.key}
                className={`tl-category-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="tl-category-tab-label">{tab.label}</span>
                {tab.key !== 'all' && count > 0 && (
                  <span className="tl-category-tab-badge">{count}</span>
                )}
                {isActive && <div className="tl-category-tab-line" />}
              </div>
            )
          })}
        </div>

        {/* ===== 统计行 ===== */}
        <div className="tl-stats-row">
          <span className="tl-stats-total">共 {filteredDrugs.length} 种药品</span>
          <span className="tl-stats-profit">最低利润率 +{minProfitRate.toFixed(0)}%</span>
        </div>
      </div>

      {/* ===== 搜索栏 ===== */}
      {searchText !== '' && (
        <div className="tl-search-bar">
          <SearchIcon />
          <input
            type="text"
            className="tl-search-input"
            placeholder="搜索药品名称"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {/* ===== 药品卡片列表 ===== */}
      <PullToRefresh onRefresh={loadDrugs}>
        <div className="tl-drug-list">
          {loading ? (
            <div className="tl-skeleton-wrap">
              {[1, 2, 3].map(i => (
                <div key={i} className="tl-skeleton-card">
                  <div className="tl-skeleton-img" />
                  <div className="tl-skeleton-body">
                    <div className="tl-skeleton-line" style={{ width: '60%' }} />
                    <div className="tl-skeleton-line" style={{ width: '80%' }} />
                    <div className="tl-skeleton-line" style={{ width: '50%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {filteredDrugs.map((drug, index) => {
                const cat = getDrugCategory(drug)
                const profitRate = calcProfitRate(drug)
                const catStyle = CATEGORY_COLORS[cat]
                return (
                  <div
                    key={drug.id}
                    className="tl-drug-card list-item-enter"
                    style={{ animationDelay: `${index * 0.04}s` }}
                    onClick={() => navigate(`/m/trade/${drug.id}`)}
                  >
                    {/* 左侧产品图片 */}
                    <div className="tl-drug-icon">
                      <DrugImage 
                        drug={drug} 
                        categoryIcon={getCategoryIcon(cat)} 
                      />
                    </div>

                    {/* 右侧信息 */}
                    <div className="tl-drug-info">
                      {/* 行1: 分类标签 + 药品名称 */}
                      <div className="tl-drug-name-row">
                        <span
                          className="tl-drug-category-badge"
                          style={{ backgroundColor: catStyle.bg, color: catStyle.color }}
                        >
                          {CATEGORY_LABEL[cat]}
                        </span>
                        <span className="tl-drug-name">{drug.name}</span>
                      </div>

                      {/* 行2: 规格 | 厂家 */}
                      <div className="tl-drug-spec-row">
                        {drug.spec && <span>{drug.spec}</span>}
                        {drug.spec && drug.manufacturer && <span className="tl-drug-spec-divider">|</span>}
                        {drug.manufacturer && <span>{drug.manufacturer}</span>}
                      </div>

                      {/* 行3: 价格 + 涨幅 + 原价 */}
                      <div className="tl-drug-price-row">
                        <span className="tl-drug-price">¥{formatPrice(drug.sellingPrice)}</span>
                        {profitRate > 0 && (
                          <span className="tl-drug-profit-badge">+{profitRate.toFixed(0)}%</span>
                        )}
                        {drug.purchasePrice > 0 && drug.purchasePrice < drug.sellingPrice && (
                          <span className="tl-drug-original-price">¥{formatPrice(drug.purchasePrice)}</span>
                        )}
                      </div>

                      {/* 行4: 剩余库存 + 进货按钮 */}
                      <div className="tl-drug-action-row">
                        <span className="tl-drug-stock">剩余 {drug.remainingQuantity} 盒</span>
                        <button
                          className="tl-drug-buy-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/m/trade/${drug.id}`)
                          }}
                        >
                          立即进货
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* 空状态 */}
              {filteredDrugs.length === 0 && (
                <div className="tl-empty">
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <rect x="12" y="20" width="40" height="32" rx="4" stroke="#5E6673" strokeWidth="2"/>
                    <circle cx="24" cy="12" r="6" stroke="#5E6673" strokeWidth="2"/>
                    <circle cx="40" cy="12" r="6" stroke="#5E6673" strokeWidth="2"/>
                    <line x1="24" y1="18" x2="24" y2="20" stroke="#5E6673" strokeWidth="2"/>
                    <line x1="40" y1="18" x2="40" y2="20" stroke="#5E6673" strokeWidth="2"/>
                  </svg>
                  <p className="tl-empty-text">暂无药品数据</p>
                </div>
              )}
            </>
          )}
        </div>
      </PullToRefresh>
    </div>
  )
}

export default TradeList
