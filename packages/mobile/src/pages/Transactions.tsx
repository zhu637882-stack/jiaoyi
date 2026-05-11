import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PullToRefresh, InfiniteScroll } from 'antd-mobile'
import { accountApi } from '../services/api'
import './Transactions.css'

// ============ 类型定义 ============
interface Transaction {
  id: string
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  createdAt: string
}

// ============ 交易类型配置 ============
const TRANSACTION_CONFIG: Record<string, { label: string; color: string; icon: string; group: string }> = {
  // 大写枚举类型
  RECHARGE: { label: '充值', color: 'var(--color-down)', icon: 'plus', group: 'income' },
  WITHDRAW: { label: '提现', color: 'var(--color-up)', icon: 'minus', group: 'expense' },
  SUBSCRIPTION: { label: '进货', color: 'var(--color-accent)', icon: 'cart', group: 'expense' },
  PRINCIPAL_RETURN: { label: '退回', color: 'var(--color-brand-light)', icon: 'return', group: 'income' },
  PROFIT_SHARE: { label: '收益', color: 'var(--color-down)', icon: 'trend', group: 'income' },
  LOSS_SHARE: { label: '亏损', color: 'var(--color-up)', icon: 'down', group: 'expense' },
  SLOW_SELL_REFUND: { label: '滞销退款', color: '#7c4dff', icon: 'refund', group: 'subsidy' },
  SETTLEMENT: { label: '清算', color: 'var(--color-accent)', icon: 'settle', group: 'expense' },
  // 兼容旧小写类型
  recharge: { label: '充值', color: 'var(--color-down)', icon: 'plus', group: 'income' },
  withdraw: { label: '提现', color: 'var(--color-up)', icon: 'minus', group: 'expense' },
  funding: { label: '进货冻结', color: 'var(--color-accent)', icon: 'cart', group: 'expense' },
  principal_return: { label: '退回', color: 'var(--color-brand-light)', icon: 'return', group: 'income' },
  profit_share: { label: '收益', color: 'var(--color-down)', icon: 'trend', group: 'income' },
  loss_share: { label: '亏损', color: 'var(--color-up)', icon: 'down', group: 'expense' },
  interest: { label: '补贴', color: '#7c4dff', icon: 'refund', group: 'subsidy' },
  sell: { label: '卖出', color: 'var(--color-accent)', icon: 'settle', group: 'income' },
  // 体验金相关
  trial_bonus_grant: { label: '体验金发放', color: '#F0B90B', icon: '🎁', group: 'subsidy' },
  trial_bonus_activate: { label: '体验金激活', color: '#F0B90B', icon: '✨', group: 'income' },
  trial_bonus_expire: { label: '体验金过期', color: '#848E9C', icon: '⏰', group: 'expense' },
  trial_bonus_use: { label: '体验金使用', color: '#848E9C', icon: '💳', group: 'expense' },
  trial_bonus_return: { label: '体验金返回', color: '#10B981', icon: '↩️', group: 'income' },
  // 其他缺失类型
  invitation_reward: { label: '邀请奖励', color: '#F0B90B', icon: '👥', group: 'subsidy' },
  slow_sell_subsidy: { label: '滞销补贴', color: '#10B981', icon: '💰', group: 'subsidy' },
  return_profit: { label: '退回利润', color: '#10B981', icon: '📈', group: 'income' },
  yield: { label: '每日收益', color: '#10B981', icon: '🌱', group: 'subsidy' },
  admin_adjust: { label: '系统调整', color: '#848E9C', icon: '⚙️', group: 'income' },
}

// 默认兜底配置
const DEFAULT_CONFIG = { label: '其他', color: 'var(--color-text-secondary)', icon: 'dot', group: 'expense' }

// 判断是否为入账
const isIncome = (type: string) => {
  const config = TRANSACTION_CONFIG[type] || DEFAULT_CONFIG
  return config.group === 'income' || config.group === 'subsidy'
}

// 判断 icon 是否为 emoji
const isEmoji = (icon: string) => {
  // emoji 字符通常超出基本 ASCII 范围
  return /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/u.test(icon)
    || [...icon].some(c => c.codePointAt(0)! > 0x1F000)
}

// ============ SVG 图标组件 ============
const TypeIcon = ({ type, config }: { type: string; config: typeof DEFAULT_CONFIG }) => {
  const stroke = config.color

  // emoji 图标直接渲染文字
  if (isEmoji(config.icon)) {
    return (
      <div className="tx-type-icon" style={{ color: stroke }}>
        <span className="tx-type-emoji">{config.icon}</span>
      </div>
    )
  }

  return (
    <div className="tx-type-icon" style={{ color: stroke }}>
      {config.icon === 'cart' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      )}
      {config.icon === 'settle' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 10h20" />
        </svg>
      )}
      {config.icon === 'trend' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
        </svg>
      )}
      {config.icon === 'return' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      )}
      {config.icon === 'plus' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}
      {config.icon === 'minus' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}
      {config.icon === 'down' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
        </svg>
      )}
      {config.icon === 'refund' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      )}
      {config.icon === 'dot' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
        </svg>
      )}
    </div>
  )
}

// ============ 分类 Tab 配置 ============
const TAB_LIST = [
  { key: 'all', label: '全部' },
  { key: 'income', label: '收入' },
  { key: 'expense', label: '支出' },
  { key: 'subsidy', label: '补贴' },
]

const PAGE_SIZE = 20

// ============ 主组件 ============
const Transactions: React.FC = () => {
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)

  // 加载数据（分页）
  const loadData = async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (pageNum === 1) setLoading(true)
      const txRes = await accountApi.getTransactions({ page: pageNum, pageSize: PAGE_SIZE }) as any
      const listData = txRes?.list || txRes?.data?.list || []
      const paginationData = txRes?.pagination || txRes?.data?.pagination
      const newTotal = paginationData?.total ?? 0
      const newPage = paginationData?.page ?? pageNum
      const totalPages = paginationData?.totalPages ?? Math.ceil(newTotal / PAGE_SIZE)

      setTotal(newTotal)

      if (append) {
        setTransactions(prev => [...prev, ...(Array.isArray(listData) ? listData : [])])
      } else {
        setTransactions(Array.isArray(listData) ? listData : [])
      }

      setPage(newPage)
      setHasMore(newPage < totalPages)
    } catch (e) {
      console.error('Load transactions error:', e)
    } finally {
      setLoading(false)
    }
  }

  // 初始加载
  useEffect(() => {
    let isMounted = true
    const init = async () => {
      try { if (isMounted) await loadData(1, false) } catch (e) { console.error('Transactions init error:', e) }
    }
    init()
    return () => { isMounted = false }
  }, [])

  // 切换 Tab 时重新从第一页加载
  useEffect(() => {
    if (!loading) {
      loadData(1, false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // 下拉刷新
  const onRefresh = async () => {
    await loadData(1, false)
  }

  // 上拉加载更多
  const loadMore = async () => {
    if (hasMore) {
      await loadData(page + 1, true)
    }
  }

  // 格式化日期
  const formatDateFull = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  }

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  // 日期分组
  const getDateGroup = (dateStr: string): string => {
    if (!dateStr) return '更早'
    const txDate = new Date(dateStr)
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    const txDateStr = txDate.toISOString().split('T')[0]
    if (txDateStr === todayStr) return '今天'
    if (txDateStr === yesterdayStr) return '昨天'
    return formatDateFull(dateStr)
  }

  // 筛选 + 排序
  const filteredTransactions = useMemo(() => {
    const filtered = transactions.filter(tx => {
      if (activeTab === 'all') return true
      const config = TRANSACTION_CONFIG[tx.type] || DEFAULT_CONFIG
      return config.group === activeTab
    })
    // 按 createdAt 降序排列
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [transactions, activeTab])

  // 按日期分组（降序：今天→昨天→更早）
  const groupedTransactions = useMemo(() => {
    const groupMap = new Map<string, Transaction[]>()
    filteredTransactions.forEach(tx => {
      const group = getDateGroup(tx.createdAt)
      if (!groupMap.has(group)) groupMap.set(group, [])
      groupMap.get(group)!.push(tx)
    })

    // 日期分组排序：今天 > 昨天 > 具体日期（降序）
    const groups: { label: string; items: Transaction[] }[] = []
    const todayStr = new Date().toISOString().split('T')[0]
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0]

    const sortedLabels = Array.from(groupMap.keys()).sort((a, b) => {
      if (a === '今天') return -1
      if (b === '今天') return 1
      if (a === '昨天') return -1
      if (b === '昨天') return 1
      // 其余按日期降序 - 通过取每组第一条的 createdAt
      const dateA = groupMap.get(a)![0]?.createdAt
      const dateB = groupMap.get(b)![0]?.createdAt
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })

    sortedLabels.forEach(label => {
      groups.push({ label, items: groupMap.get(label)! })
    })

    return groups
  }, [filteredTransactions])

  // 月度汇总
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthIncome = transactions
    .filter(tx => tx.createdAt?.startsWith(currentMonth) && isIncome(tx.type))
    .reduce((s, tx) => s + Number(tx.amount || 0), 0)
  const monthExpense = transactions
    .filter(tx => tx.createdAt?.startsWith(currentMonth) && !isIncome(tx.type))
    .reduce((s, tx) => s + Number(tx.amount || 0), 0)

  return (
    <div className="tx-page">
      {/* 顶部固定区域 */}
      <div className="tx-fixed-top">
        {/* 顶部导航 */}
        <div className="tx-header">
          <h1 className="tx-header-title">账单明细</h1>
        </div>

        {/* 月度汇总卡片 */}
        <div className="tx-summary-card">
          <div className="tx-summary-label">本月</div>
          <div className="tx-summary-row">
            <div className="tx-summary-item">
              <span className="tx-summary-item-label">收入</span>
              <span className="tx-summary-item-val up">¥{monthIncome.toFixed(2)}</span>
            </div>
            <div className="tx-summary-divider" />
            <div className="tx-summary-item">
              <span className="tx-summary-item-label">支出</span>
              <span className="tx-summary-item-val">¥{monthExpense.toFixed(2)}</span>
            </div>
          </div>
          <div className="tx-summary-actions">
            <button className="tx-nav-btn" onClick={() => navigate('/m/portfolio')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-light)" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              充值
            </button>
            <button className="tx-nav-btn" onClick={() => navigate('/m/portfolio')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-light)" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
              提现
            </button>
          </div>
        </div>

        {/* 分类 Tab */}
        <div className="tx-tabs">
          {TAB_LIST.map(tab => (
            <div
              key={tab.key}
              className={`tx-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </div>
          ))}
        </div>
      </div>

      {/* 可滚动内容区 */}
      <div className="tx-scroll-area">
        <PullToRefresh onRefresh={onRefresh}>
          <div className="tx-content">
          {loading ? (
            <div className="tx-skeleton-list">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="tx-skeleton-card">
                  <div className="tx-skeleton-icon" />
                  <div className="tx-skeleton-body">
                    <div className="tx-skeleton-line" style={{ width: '40%' }} />
                    <div className="tx-skeleton-line" style={{ width: '60%', height: 10 }} />
                  </div>
                  <div className="tx-skeleton-amount" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {groupedTransactions.map(group => (
                <div key={group.label} className="tx-group">
                  <div className="tx-group-header">{group.label}</div>
                  {group.items.map((tx, idx) => {
                    const config = TRANSACTION_CONFIG[tx.type] || DEFAULT_CONFIG
                    const income = isIncome(tx.type)
                    return (
                      <div key={tx.id} className="tx-record" style={{ animationDelay: `${idx * 40}ms` }}>
                        <TypeIcon type={tx.type} config={config} />
                        <div className="tx-record-info">
                          <span className="tx-record-title">{config.label}</span>
                          <span className="tx-record-desc">{tx.description || '--'}</span>
                        </div>
                        <div className="tx-record-amount-wrap">
                          <span className={`tx-record-amount ${income ? 'income' : 'expense'}`}>
                            {income ? '+' : '-'}¥{Math.abs(Number(tx.amount || 0)).toFixed(2)}
                          </span>
                          <span className="tx-record-time">{formatTime(tx.createdAt)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* 空状态 */}
              {filteredTransactions.length === 0 && !loading && (
                <div className="tx-empty">
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <circle cx="28" cy="28" r="24" stroke="var(--color-text-secondary)" strokeWidth="1.5" fill="none" opacity="0.3" />
                    <path d="M18 28h20M28 18v20" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
                  </svg>
                  <p className="tx-empty-text">暂无账单记录</p>
                  <p className="tx-empty-hint">下拉刷新试试</p>
                </div>
              )}

              {/* 上拉加载更多 */}
              <InfiniteScroll loadMore={loadMore} hasMore={hasMore} />
            </>
          )}
        </div>
        </PullToRefresh>
      </div>
    </div>
  )
}

export default Transactions
