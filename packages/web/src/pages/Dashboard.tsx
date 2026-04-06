import { useEffect, useState, useCallback, useMemo } from 'react'
import { Skeleton, Drawer } from 'antd'
import {
  ShoppingCartOutlined,
  StarOutlined,
  StarFilled,
} from '@ant-design/icons'
import { marketApi } from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'
import KLineChart, { KLineData } from '../components/KLineChart'
import TickerBar from '../components/TickerBar'
import OrderBook from '../components/OrderBook'
import TradePanel from '../components/TradePanel'
import './Dashboard.css'

// 类型定义
interface MarketOverviewItem {
  drugId: string
  drugName: string
  drugCode: string
  purchasePrice: number
  sellingPrice: number
  dailySalesQuantity: number
  dailySalesRevenue: number
  averageSellingPrice: number
  dailyReturn: number
  cumulativeReturn: number
  totalFundingAmount: number
  fundingHeat: number
  queueDepth: number
  snapshotDate: string
}

interface MarketStats {
  totalDrugs: number
  totalFundingAmount: number
  totalSalesRevenue: number
  totalSettlementCount: number
  activeFunderCount: number
}

interface DepthData {
  ranges: {
    min: number
    max: number
    label: string
    count: number
    amount: number
  }[]
  totalAmount: number
  totalCount: number
}

interface ActivityItem {
  id: string
  type: 'funding' | 'settlement'
  time: string
  userName: string
  drugName: string
  amount?: number
  quantity?: number
  profit?: number
}


// MT4风格统一交易界面
const Dashboard = () => {

  // 状态管理
  const [marketOverview, setMarketOverview] = useState<MarketOverviewItem[]>([])
  const [, setMarketStats] = useState<MarketStats | null>(null)
  const [kLineData, setKLineData] = useState<KLineData[]>([])
  const [depthData, setDepthData] = useState<DepthData | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [selectedDrugId, setSelectedDrugId] = useState<string>('')
  const [kLinePeriod, setKLinePeriod] = useState<'15m' | '1h' | '4h' | '1d' | '1w' | '1mo' | '7d' | '30d' | '90d' | 'all'>('1d')

  // 左侧药品面板状态
  const [marketTab, setMarketTab] = useState<'all' | 'favorites' | 'gainers' | 'losers'>('all')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // 底部Tab状态
  const [bottomTab, setBottomTab] = useState<'orders' | 'history' | 'funds' | 'holdings'>('orders')

  // 加载状态
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [, setLoadingStats] = useState(true)
  const [loadingKLine, setLoadingKLine] = useState(true)
  const [loadingDepth, setLoadingDepth] = useState(true)
  const [, setLoadingActivities] = useState(true)

  // 响应式状态
  const [isMobile, setIsMobile] = useState(false)
  const [showTradeDrawer, setShowTradeDrawer] = useState(false)

  // TradePanel 高亮动画状态
  const [tradePanelHighlight, setTradePanelHighlight] = useState(false)

  // WebSocket 连接
  const { subscribeTicker } = useWebSocket({
    onMarketTicker: (data) => {
      if (data?.tickers) {
        setMarketOverview((prev) => {
          return prev.map((item) => {
            const ticker = data.tickers.find((t: any) => t.drugId === item.drugId)
            if (ticker) {
              return {
                ...item,
                sellingPrice: ticker.sellingPrice,
                dailyReturn: ticker.dailyReturn,
                cumulativeReturn: ticker.cumulativeReturn,
                fundingHeat: ticker.fundingHeat,
              }
            }
            return item
          })
        })
      }
    },
    onFundingUpdate: (data) => {
      if (data) {
        const newActivity: ActivityItem = {
          id: Date.now().toString(),
          type: 'funding',
          time: new Date().toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          userName: data.userName || '用户',
          drugName: data.drugName || '未知药品',
          amount: data.amount,
          quantity: data.quantity,
        }
        setActivities((prev) => [newActivity, ...prev].slice(0, 20))
      }
    },
    onSettlementComplete: (data) => {
      if (data) {
        const newActivity: ActivityItem = {
          id: Date.now().toString(),
          type: 'settlement',
          time: new Date().toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          userName: data.userName || '系统',
          drugName: data.drugName || '未知药品',
          profit: data.profit,
        }
        setActivities((prev) => [newActivity, ...prev].slice(0, 20))
      }
    },
  })

  // 响应式检测
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 获取市场总览
  const fetchMarketOverview = useCallback(async () => {
    try {
      setLoadingOverview(true)
      const res: any = await marketApi.getMarketOverview()
      if (res.success) {
        setMarketOverview(res.data)
        // 默认选择第一个药品
        if (res.data.length > 0 && !selectedDrugId) {
          setSelectedDrugId(res.data[0].drugId)
        }
      }
    } catch (error) {
      console.error('获取市场总览失败:', error)
    } finally {
      setLoadingOverview(false)
    }
  }, [selectedDrugId])

  // 获取平台统计
  const fetchMarketStats = useCallback(async () => {
    try {
      setLoadingStats(true)
      const res: any = await marketApi.getMarketStats()
      if (res.success) {
        setMarketStats(res.data)
      }
    } catch (error) {
      console.error('获取平台统计失败:', error)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  // 获取K线数据
  const fetchKLineData = useCallback(async (drugId: string, period: string) => {
    if (!drugId) return
    try {
      setLoadingKLine(true)
      const res: any = await marketApi.getDrugKLine(drugId, period as any)
      if (res.success) {
        setKLineData(res.data)
      }
    } catch (error) {
      console.error('获取K线数据失败:', error)
    } finally {
      setLoadingKLine(false)
    }
  }, [])

  // 获取深度数据
  const fetchDepthData = useCallback(async (drugId: string) => {
    if (!drugId) return
    try {
      setLoadingDepth(true)
      const res: any = await marketApi.getDrugDepth(drugId)
      if (res.success) {
        setDepthData(res.data)
      }
    } catch (error) {
      console.error('获取深度数据失败:', error)
    } finally {
      setLoadingDepth(false)
    }
  }, [])

  // 从localStorage加载收藏
  useEffect(() => {
    const savedFavorites = localStorage.getItem('drugFavorites')
    if (savedFavorites) {
      try {
        setFavorites(new Set(JSON.parse(savedFavorites)))
      } catch (e) {
        console.error('解析收藏数据失败:', e)
      }
    }
  }, [])

  // 保存收藏到localStorage
  const toggleFavorite = useCallback((drugId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFavorites(prev => {
      const newFavorites = new Set(prev)
      if (newFavorites.has(drugId)) {
        newFavorites.delete(drugId)
      } else {
        newFavorites.add(drugId)
      }
      localStorage.setItem('drugFavorites', JSON.stringify([...newFavorites]))
      return newFavorites
    })
  }, [])

  // 处理排序点击
  const handleSort = useCallback((column: 'name' | 'price' | 'change') => {
    setSortBy(prev => {
      if (prev === column) {
        setSortOrder(order => order === 'asc' ? 'desc' : 'asc')
        return prev
      }
      setSortOrder('asc')
      return column
    })
  }, [])

  // 初始加载
  useEffect(() => {
    fetchMarketOverview()
    fetchMarketStats()
    subscribeTicker()

    // 模拟活动数据
    setTimeout(() => {
      setActivities([
        {
          id: '1',
          type: 'funding',
          time: '14:32:15',
          userName: '张**',
          drugName: '阿莫西林胶囊',
          amount: 50000,
          quantity: 100,
        },
        {
          id: '2',
          type: 'settlement',
          time: '14:28:42',
          userName: '李**',
          drugName: '头孢克肟片',
          profit: 1250.5,
        },
        {
          id: '3',
          type: 'funding',
          time: '14:25:08',
          userName: '王**',
          drugName: '布洛芬缓释片',
          amount: 30000,
          quantity: 60,
        },
        {
          id: '4',
          type: 'funding',
          time: '14:18:33',
          userName: '陈**',
          drugName: '阿莫西林胶囊',
          amount: 80000,
          quantity: 160,
        },
        {
          id: '5',
          type: 'settlement',
          time: '14:15:21',
          userName: '刘**',
          drugName: '维生素C片',
          profit: 890.25,
        },
      ])
      setLoadingActivities(false)
    }, 1000)
  }, [])

  // 当选择药品变化时加载数据
  useEffect(() => {
    if (selectedDrugId) {
      fetchKLineData(selectedDrugId, kLinePeriod)
      fetchDepthData(selectedDrugId)
    }
  }, [selectedDrugId, kLinePeriod, fetchKLineData, fetchDepthData])

  // 搜索过滤、Tab过滤和排序
  const filteredDrugs = useMemo(() => {
    let result = marketOverview

    // Tab过滤
    switch (marketTab) {
      case 'favorites':
        result = result.filter(drug => favorites.has(drug.drugId))
        break
      case 'gainers':
        result = [...result].sort((a, b) => (b.dailyReturn || 0) - (a.dailyReturn || 0))
        break
      case 'losers':
        result = [...result].sort((a, b) => (a.dailyReturn || 0) - (b.dailyReturn || 0))
        break
    }

    // 排序
    if (marketTab !== 'gainers' && marketTab !== 'losers') {
      result = [...result].sort((a, b) => {
        let comparison = 0
        switch (sortBy) {
          case 'name':
            comparison = a.drugName.localeCompare(b.drugName)
            break
          case 'price':
            comparison = (a.sellingPrice || 0) - (b.sellingPrice || 0)
            break
          case 'change':
            comparison = (a.dailyReturn || 0) - (b.dailyReturn || 0)
            break
        }
        return sortOrder === 'asc' ? comparison : -comparison
      })
    }

    return result
  }, [marketOverview, marketTab, favorites, sortBy, sortOrder])

  // 当前选中药品
  const selectedDrug = useMemo(() => {
    return marketOverview.find((drug) => drug.drugId === selectedDrugId)
  }, [marketOverview, selectedDrugId])

  // 处理药品点击
  const handleDrugClick = (drugId: string) => {
    setSelectedDrugId(drugId)
    setTradePanelHighlight(true)
    setTimeout(() => setTradePanelHighlight(false), 500)
    if (isMobile) {
      // 移动端自动滚动到主区域
    }
  }

  // 刷新数据回调
  const handleOrderSuccess = useCallback(() => {
    fetchDepthData(selectedDrugId)
  }, [selectedDrugId, fetchDepthData])

  // 渲染排序表头
  const renderSortHeader = (label: string, column: 'name' | 'price' | 'change') => {
    const isActive = sortBy === column
    return (
      <span
        className={`sort-header ${isActive ? 'active' : ''}`}
        onClick={() => handleSort(column)}
      >
        {label}
        {isActive && (
          <span className="sort-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    )
  }

  return (
    <div className="trading-terminal">
      {/* 主内容区域 - MT4布局 */}
      <div className="terminal-main">
        {/* 左侧药品面板 */}
        <aside className={`drug-panel ${isMobile ? 'mobile' : ''}`}>
          {/* Tab分组 */}
          <div className="market-tabs">
            <button
              className={`market-tab ${marketTab === 'all' ? 'active' : ''}`}
              onClick={() => setMarketTab('all')}
            >
              全部
            </button>
            <button
              className={`market-tab ${marketTab === 'favorites' ? 'active' : ''}`}
              onClick={() => setMarketTab('favorites')}
            >
              自选
            </button>
            <button
              className={`market-tab ${marketTab === 'gainers' ? 'active' : ''}`}
              onClick={() => setMarketTab('gainers')}
            >
              涨幅榜
            </button>
            <button
              className={`market-tab ${marketTab === 'losers' ? 'active' : ''}`}
              onClick={() => setMarketTab('losers')}
            >
              跌幅榜
            </button>
          </div>

          {/* 列表表头 */}
          <div className="drug-list-header">
            <div className="header-col name-col">
              {renderSortHeader('品种', 'name')}
            </div>
            <div className="header-col price-col">
              {renderSortHeader('最新价', 'price')}
            </div>
            <div className="header-col change-col">
              {renderSortHeader('涨跌幅', 'change')}
            </div>
          </div>

          {/* 药品列表 */}
          <div className="drug-list">
            {loadingOverview ? (
              <div className="drug-list-loading">
                <Skeleton active paragraph={{ rows: 8 }} />
              </div>
            ) : filteredDrugs.length === 0 ? (
              <div className="drug-list-empty">
                {marketTab === 'favorites' ? '暂无自选药品' : '暂无匹配药品'}
              </div>
            ) : (
              filteredDrugs.map((drug) => {
                const isSelected = drug.drugId === selectedDrugId
                const isPositive = Number(drug.dailyReturn || 0) >= 0
                const isFavorite = favorites.has(drug.drugId)
                return (
                  <div
                    key={drug.drugId}
                    className={`drug-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleDrugClick(drug.drugId)}
                  >
                    <span
                      className="favorite-star"
                      onClick={(e) => toggleFavorite(drug.drugId, e)}
                    >
                      {isFavorite ? (
                        <StarFilled style={{ color: '#F0B90B' }} />
                      ) : (
                        <StarOutlined style={{ color: '#848E9C' }} />
                      )}
                    </span>
                    <span className="drug-item-name" title={drug.drugName}>{drug.drugName}</span>
                    <span className="drug-item-price">
                      {Number(drug.sellingPrice || 0).toFixed(2)}
                    </span>
                    <span className={`drug-item-change ${isPositive ? 'up' : 'down'}`}>
                      {isPositive ? '+' : ''}
                      {Number(drug.dailyReturn || 0).toFixed(2)}%
                    </span>
                    {isSelected && <span className="drug-item-arrow">›</span>}
                  </div>
                )
              })
            )}
          </div>

          {/* 底部操作区 */}
          <div className="drug-panel-bottom">
            <span className="total-count">共 {filteredDrugs.length} 个品种</span>
          </div>
        </aside>

        {/* 中间主区域 */}
        <main className="terminal-content">
          {/* 行情滚动条 */}
          <TickerBar data={marketOverview} onItemClick={(drugId) => {
            setSelectedDrugId(drugId)
            setTradePanelHighlight(true)
            setTimeout(() => setTradePanelHighlight(false), 500)
          }} />
          {/* 药品信息摘要条 - 币安风格 */}
          {selectedDrug && (
            <div className="drug-summary-bar">
              <div className="summary-left">
                <span className="summary-drug-name">{selectedDrug.drugName}</span>
                <span className="summary-drug-code">{selectedDrug.drugCode}</span>
              </div>
              <div className="summary-stats">
                <div className="stat-item">
                  <span className="stat-label">最新价</span>
                  <span className={`stat-value price ${Number(selectedDrug.dailyReturn || 0) >= 0 ? 'up' : 'down'}`}>
                    {Number(selectedDrug.sellingPrice || 0).toFixed(2)}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">24h涨跌</span>
                  <span className={`stat-value ${Number(selectedDrug.dailyReturn || 0) >= 0 ? 'up' : 'down'}`}>
                    {Number(selectedDrug.dailyReturn || 0) >= 0 ? '+' : ''}
                    {Number(selectedDrug.dailyReturn || 0).toFixed(2)}%
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">24h最高</span>
                  <span className="stat-value">
                    {Number(selectedDrug.sellingPrice || 0).toFixed(2)}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">24h最低</span>
                  <span className="stat-value">
                    {Number(selectedDrug.purchasePrice || 0).toFixed(2)}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">24h成交量</span>
                  <span className="stat-value">
                    {Number(selectedDrug.dailySalesQuantity || 0).toLocaleString()}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">24h成交额</span>
                  <span className="stat-value">
                    ¥{(Number(selectedDrug.dailySalesRevenue || 0) / 10000).toFixed(2)}万
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* K线图表区域 */}
          <div className="chart-area">
            <KLineChart
              data={kLineData}
              loading={loadingKLine}
              period={kLinePeriod}
              onPeriodChange={setKLinePeriod}
              drugName={selectedDrug?.drugName}
            />
          </div>

          {/* 底部区域 - OrderBook + Tab面板 */}
          <div className="bottom-area">
            {/* 左侧：OrderBook */}
            <div className="orderbook-section">
              <OrderBook data={depthData} loading={loadingDepth} />
            </div>

            {/* 右侧：Tab面板 */}
            <div className="bottom-tab-panel">
              {/* Tab栏 */}
              <div className="bottom-tabs">
                <button
                  className={`bottom-tab ${bottomTab === 'orders' ? 'active' : ''}`}
                  onClick={() => setBottomTab('orders')}
                >
                  当前委托
                </button>
                <button
                  className={`bottom-tab ${bottomTab === 'history' ? 'active' : ''}`}
                  onClick={() => setBottomTab('history')}
                >
                  历史委托
                </button>
                <button
                  className={`bottom-tab ${bottomTab === 'funds' ? 'active' : ''}`}
                  onClick={() => setBottomTab('funds')}
                >
                  资金记录
                </button>
                <button
                  className={`bottom-tab ${bottomTab === 'holdings' ? 'active' : ''}`}
                  onClick={() => setBottomTab('holdings')}
                >
                  持仓
                </button>
              </div>

              {/* Tab内容 */}
              <div className="tab-content">
                {bottomTab === 'orders' && (
                  <div className="tab-table">
                    <div className="table-header">
                      <span>时间</span>
                      <span>品种</span>
                      <span>数量</span>
                      <span>金额</span>
                      <span>状态</span>
                    </div>
                    {activities.filter(a => a.type === 'funding').length === 0 ? (
                      <div className="empty-table">暂无当前委托</div>
                    ) : (
                      <div className="table-body">
                        {activities
                          .filter(a => a.type === 'funding')
                          .map(activity => (
                            <div key={activity.id} className="table-row">
                              <span>{activity.time}</span>
                              <span>{activity.drugName}</span>
                              <span>{activity.quantity}</span>
                              <span>¥{Number(activity.amount || 0).toLocaleString()}</span>
                              <span className="status-pending">进行中</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {bottomTab === 'history' && (
                  <div className="tab-table">
                    <div className="table-header">
                      <span>时间</span>
                      <span>品种</span>
                      <span>类型</span>
                      <span>收益</span>
                      <span>状态</span>
                    </div>
                    {activities.filter(a => a.type === 'settlement').length === 0 ? (
                      <div className="empty-table">暂无历史委托</div>
                    ) : (
                      <div className="table-body">
                        {activities
                          .filter(a => a.type === 'settlement')
                          .map(activity => (
                            <div key={activity.id} className="table-row">
                              <span>{activity.time}</span>
                              <span>{activity.drugName}</span>
                              <span>清算</span>
                              <span className="profit">+¥{Number(activity.profit || 0).toFixed(2)}</span>
                              <span className="status-completed">已完成</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {bottomTab === 'funds' && (
                  <div className="tab-table">
                    <div className="table-header">
                      <span>时间</span>
                      <span>类型</span>
                      <span>金额</span>
                      <span>余额</span>
                      <span>备注</span>
                    </div>
                    <div className="empty-table">暂无资金记录</div>
                  </div>
                )}

                {bottomTab === 'holdings' && (
                  <div className="tab-placeholder">
                    <p>请前往持仓页面查看</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* 右侧交易面板 */}
        <aside className={`trade-panel-container ${tradePanelHighlight ? 'highlight' : ''}`}>
          <TradePanel drug={selectedDrug || null} onOrderSuccess={handleOrderSuccess} />
        </aside>
      </div>

      {/* 响应式浮动交易按钮 */}
      <button
        className="trade-float-btn"
        onClick={() => setShowTradeDrawer(true)}
      >
        <ShoppingCartOutlined /> 交易
      </button>

      {/* 响应式交易抽屉 */}
      <Drawer
        open={showTradeDrawer}
        onClose={() => setShowTradeDrawer(false)}
        placement="right"
        width={320}
        closable={false}
        styles={{
          body: { padding: 0, background: '#161B22' },
          wrapper: { background: 'rgba(0, 0, 0, 0.5)' },
        }}
      >
        <TradePanel drug={selectedDrug || null} onOrderSuccess={handleOrderSuccess} />
      </Drawer>
    </div>
  )
}

export default Dashboard
