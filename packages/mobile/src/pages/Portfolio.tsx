import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PullToRefresh, Popup, Toast, Dialog } from 'antd-mobile'
import { subscriptionApi, accountApi, paymentApi } from '../services/api'
import { isWechatBrowser } from '../utils/browser'
import { ensureWechatOpenId, getStoredOpenId, redirectToWechatAuth } from '../utils/wechat-auth'
import { useCountUp, formatCountUpValue } from '../hooks/useCountUp'
import './Portfolio.css'

// ============ 类型定义 ============
interface SubItem {
  id: string
  orderNo: string
  drugId: string
  drugName: string
  drugCode: string
  quantity: number
  amount: number
  unsettledAmount: number
  settledQuantity: number
  status: string
  auditStatus?: string
  totalProfit: number
  totalLoss: number
  lockExpiresAt?: string
  dividendAmount?: number
  confirmedAt: string
  effectiveAt: string
  slowSellingDeadline: string
  createdAt: string
}

interface Transaction {
  id: string
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  createdAt: string
}

// ============ 常量映射 ============
const subscriptionStatusMap: Record<string, { label: string; color: string }> = {
  confirmed: { label: '待入库审核', color: 'var(--color-brand)' },
  effective: { label: '已入库', color: 'var(--color-down)' },
  return_pending: { label: '退回审核', color: 'var(--color-accent)' },
  partial_returned: { label: '部分退回', color: 'var(--color-accent)' },
  returned: { label: '已退回', color: 'var(--color-text-secondary)' },
  cancelled: { label: '已取消', color: 'var(--color-text-secondary)' },
  slow_selling_refund: { label: '滞销退款', color: '#722ED1' },
  settled: { label: '已结算', color: 'var(--color-down)' },
  partial_sold: { label: '部分售出', color: 'var(--color-brand)' },
  fully_sold: { label: '全部售出', color: 'var(--color-down)' },
  settling: { label: '回款中', color: 'var(--color-accent)' },
  returned_to_stock: { label: '退货回库', color: 'var(--color-text-secondary)' },
}

const getSubscriptionStatusDisplay = (sub: SubItem) => {
  if (sub.auditStatus === 'pending') return { label: '待审核', color: 'var(--color-accent)' }
  // 锁定期内展示倒计时
  if (sub.status === 'effective' && sub.lockExpiresAt) {
    const remainMs = new Date(sub.lockExpiresAt).getTime() - Date.now()
    if (remainMs > 0) {
      const remainDays = Math.ceil(remainMs / (24 * 60 * 60 * 1000))
      return { label: `锁定期 ${remainDays}天`, color: '#FA8C16' }
    }
    // 锁定期到期但未分红
    if (!sub.dividendAmount) {
      return { label: '待分红结算', color: '#F0B90B' }
    }
  }
  return subscriptionStatusMap[sub.status] || { label: sub.status, color: 'var(--color-text-secondary)' }
}

// ============ CountUp 动画组件 ============
const CountUpValue = ({ target, prefix = '¥', className = '' }: { target: number; prefix?: string; className?: string }) => {
  const safeTarget = Number.isFinite(target) ? target : 0
  const animatedValue = useCountUp(safeTarget)
  const displayValue = Number.isFinite(animatedValue) ? animatedValue : safeTarget
  return <span className={className}>{prefix}{formatCountUpValue(displayValue)}</span>
}

// ============ 左滑卡片组件 ============
const SwipeCard: React.FC<{
  children: React.ReactNode
  onDetail: () => void
  swipeOpenId: string | null
  cardId: string
  onSwipeOpen: (id: string | null) => void
}> = ({ children, onDetail, swipeOpenId, cardId, onSwipeOpen }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const currentXRef = useRef(0)
  const isSwipingRef = useRef(false)
  const directionLockedRef = useRef(false)
  const isHorizontalRef = useRef(false)
  const ACTION_WIDTH = 72
  const THRESHOLD = 80
  const isOpen = swipeOpenId === cardId

  useEffect(() => {
    if (!isOpen && contentRef.current) {
      contentRef.current.style.transform = 'translateX(0)'
      contentRef.current.classList.remove('swiping')
      currentXRef.current = 0
    }
  }, [isOpen])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    startXRef.current = touch.clientX
    startYRef.current = touch.clientY
    directionLockedRef.current = false
    isHorizontalRef.current = false
    isSwipingRef.current = false
    if (contentRef.current) contentRef.current.classList.add('swiping')
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    const deltaX = touch.clientX - startXRef.current
    const deltaY = touch.clientY - startYRef.current
    if (!directionLockedRef.current) {
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        directionLockedRef.current = true
        isHorizontalRef.current = Math.abs(deltaX) > Math.abs(deltaY)
      }
      return
    }
    if (!isHorizontalRef.current) return
    e.preventDefault()
    isSwipingRef.current = true
    const baseOffset = isOpen ? -ACTION_WIDTH : 0
    let offset = Math.max(-ACTION_WIDTH, Math.min(0, baseOffset + deltaX))
    requestAnimationFrame(() => {
      if (contentRef.current) contentRef.current.style.transform = `translateX(${offset}px)`
    })
    currentXRef.current = offset
  }, [isOpen])

  const handleTouchEnd = useCallback(() => {
    if (contentRef.current) contentRef.current.classList.remove('swiping')
    if (!isSwipingRef.current) return
    const shouldOpen = isOpen ? currentXRef.current < -(ACTION_WIDTH - THRESHOLD) : currentXRef.current < -THRESHOLD
    requestAnimationFrame(() => {
      if (contentRef.current) contentRef.current.style.transform = shouldOpen ? `translateX(-${ACTION_WIDTH}px)` : 'translateX(0)'
    })
    onSwipeOpen(shouldOpen ? cardId : null)
    currentXRef.current = shouldOpen ? -ACTION_WIDTH : 0
    isSwipingRef.current = false
  }, [isOpen, cardId, onSwipeOpen])

  return (
    <div className="pf-swipe-wrapper">
      <div className="pf-swipe-actions">
        <button className="pf-swipe-btn detail" onClick={onDetail}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>详情</span>
        </button>
      </div>
      <div
        ref={contentRef}
        className="pf-swipe-content"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: isOpen ? `translateX(-${ACTION_WIDTH}px)` : 'translateX(0)' }}
      >
        {children}
      </div>
    </div>
  )
}

// ============ 错误边界 ============
class PortfolioErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#fff', background: '#0B0E11', minHeight: '100vh' }}>
          <h2 style={{ color: 'var(--color-up)', marginBottom: 16 }}>页面加载出错</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>{this.state.error?.message || '未知错误'}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '12px 24px', background: 'var(--color-brand)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            刷新页面
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// 统一药品胶囊图标
const DrugCapsuleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#848E9C" strokeWidth="2">
    <rect x="5" y="2" width="14" height="20" rx="7" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

// ============ 主内容组件 ============
const PortfolioContent: React.FC = () => {
  const navigate = useNavigate()

  // 数据状态
  const [balance, setBalance] = useState<any>(null)
  const [subscriptionSummary, setSubscriptionSummary] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('all')
  const [loading, setLoading] = useState(true)
  const [subscriptions, setSubscriptions] = useState<SubItem[]>([])
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  // 弹窗状态
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [bankInfo, setBankInfo] = useState('')
  const [showRecharge, setShowRecharge] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [payChannel, setPayChannel] = useState<'wechat'>('wechat')
  const [payLoading, setPayLoading] = useState(false)
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null)
  const [selectedSub, setSelectedSub] = useState<SubItem | null>(null)

  // 加载基础数据
  const loadData = async () => {
    try {
      const [balanceRes, summaryRes] = await Promise.all([
        accountApi.getBalance() as any,
        subscriptionApi.getActiveSubscriptionSummary() as any,
      ])
      setBalance(balanceRes?.data || balanceRes)
      setSubscriptionSummary(summaryRes?.data || summaryRes)
    } catch (e) {
      console.error('Load portfolio error:', e)
    } finally {
      setLoading(false)
    }
  }

  // 加载认购列表
  const loadSubscriptions = async () => {
    setSubscriptionLoading(true)
    try {
      const res = await subscriptionApi.getMySubscriptions({ page: 1, limit: 50 }) as any
      const listData = res?.data?.list || res?.list || res?.data || []
      setSubscriptions(Array.isArray(listData) ? listData : [])
    } catch (e) {
      console.error('Load subscriptions error:', e)
    } finally {
      setSubscriptionLoading(false)
    }
  }

  // 加载交易流水（用于计算今日盈亏）
  const loadTransactions = async () => {
    try {
      const res = await accountApi.getTransactions({ page: 1, pageSize: 100 }) as any
      const listData = res?.list || res?.data?.list || []
      setTransactions(Array.isArray(listData) ? listData : [])
    } catch (e) {
      console.error('Load transactions error:', e)
    }
  }

  useEffect(() => {
    if (isWechatBrowser()) ensureWechatOpenId()
    let isMounted = true
    const init = async () => {
      try {
        if (isMounted) await loadData()
        if (isMounted) await loadSubscriptions()
        if (isMounted) await loadTransactions()
      } catch (e) { console.error('Portfolio init error:', e) }
    }
    init()
    return () => { isMounted = false }
  }, [])

  // 提现
  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount)
    const available = Number(balance?.availableBalance ?? balance?.balance ?? 0)
    if (!amount || amount <= 0) { Toast.show({ content: '请输入提现金额', icon: 'fail' }); return }
    if (amount > available) { Toast.show({ content: '提现金额不能超过可用余额', icon: 'fail' }); return }
    if (amount < 1) { Toast.show({ content: '最小提现金额为1元', icon: 'fail' }); return }
    setWithdrawLoading(true)
    try {
      await accountApi.withdraw(amount, '账户提现', undefined, bankInfo || undefined)
      Toast.show({ content: '提现申请已提交，预计T+1到账', icon: 'success' })
      setShowWithdraw(false); setWithdrawAmount(''); setBankInfo('')
      const balanceRes = await accountApi.getBalance() as any
      setBalance(balanceRes?.data || balanceRes)
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '提现失败'
      Toast.show({ content: Array.isArray(msg) ? msg.join('; ') : msg, icon: 'fail' })
    } finally { setWithdrawLoading(false) }
  }

  // 充值
  const handleRecharge = async () => {
    const amount = Number(rechargeAmount)
    if (!amount || amount <= 0) { Toast.show({ content: '请输入有效金额', icon: 'fail' }); return }
    setPayLoading(true)
    try {
      if (payChannel === 'wechat') {
        if (isWechatBrowser()) {
          const openId = getStoredOpenId()
          if (!openId) { Toast.show({ content: '正在获取微信授权...', icon: 'loading' }); redirectToWechatAuth(); return }
          const res = await paymentApi.createWechatJsapiOrder(amount, openId) as any
          const payData = res?.data || res
          if (payData?.timeStamp && payData?.paySign && (window as any).WeixinJSBridge) {
            ;(window as any).WeixinJSBridge.invoke('getBrandWCPayRequest', {
              appId: payData.appId, timeStamp: payData.timeStamp, nonceStr: payData.nonceStr,
              package: payData.package, signType: payData.signType, paySign: payData.paySign,
            }, (res: any) => {
              if (res.err_msg === 'get_brand_wcpay_request:ok') {
                Dialog.alert({ title: '充值成功', content: '资金已即时到账', confirmText: '我知道了' })
                loadData()
              }
            })
          } else if (payData?.mwebUrl) {
            window.location.href = payData.mwebUrl
          } else if (payData?.codeUrl) {
            window.open(payData.codeUrl, '_blank')
          }
        } else {
          const res = await paymentApi.createWechatOrder(amount) as any
          const payData = res?.data || res
          if (payData?.qrUrl || payData?.payUrl || payData?.qrCode) {
            window.open(payData.qrUrl || payData.payUrl || payData.qrCode, '_blank')
            Toast.show({ content: '请在新窗口完成支付', icon: 'success' })
          }
        }
      }
      setShowRecharge(false); setRechargeAmount('')
    } catch (e) { console.error('Recharge error:', e) } finally { setPayLoading(false) }
  }



  // 筛选持仓 - 只显示有效持仓（已入库/部分售出/回款中）
  const HOLDING_STATUSES = ['effective', 'partial_sold', 'settling']
  const holdingSubscriptions = subscriptions.filter(sub => HOLDING_STATUSES.includes(sub.status))
  const filteredSubscriptions = holdingSubscriptions.filter(sub => {
    if (activeTab === 'all') return true
    if (activeTab === 'effective') return sub.status === 'effective'
    if (activeTab === 'partial_sold') return sub.status === 'partial_sold'
    if (activeTab === 'settling') return sub.status === 'settling'
    return true
  })

  // 汇总统计 - 仅基于有效持仓
  const totalMarketValue = holdingSubscriptions.reduce((s, sub) => s + Number(sub.amount || 0), 0)
  const totalProfitLoss = holdingSubscriptions.reduce((s, sub) => s + (sub.totalProfit || 0) - (sub.totalLoss || 0), 0)
  // 今日盈亏：从交易流水中统计今天的收支
  const todayStr = new Date().toISOString().split('T')[0]
  const todayProfit = transactions
    .filter(tx => tx.createdAt?.startsWith(todayStr))
    .reduce((s, tx) => {
      const isIncomeType = ['RECHARGE', 'PRINCIPAL_RETURN', 'PROFIT_SHARE', 'SLOW_SELL_REFUND', 'recharge', 'principal_return', 'profit_share', 'interest'].includes(tx.type)
      return s + (isIncomeType ? Number(tx.amount || 0) : -Number(tx.amount || 0))
    }, 0)

  // ============ 渲染 ============
  return (
    <div className="pf-page">
      {/* 顶部固定区域 */}
      <div className="pf-fixed-top">
        {/* 顶部导航 */}
        <div className="pf-header">
          <h1 className="pf-header-title">药品库</h1>
          <div className="pf-header-right" onClick={() => Toast.show({ content: '搜索功能开发中' })}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>

        {/* 总资产卡片 - 蓝色渐变 */}
        <div className="pf-asset-card">
          <div className="pf-asset-label">持仓总值</div>
          <div className="pf-asset-value">
            <CountUpValue target={totalMarketValue} prefix="¥" />
          </div>
          <div className="pf-asset-row">
            <div className="pf-asset-item">
              <span className="pf-asset-item-label">持仓品种</span>
              <span className="pf-asset-item-val white">{holdingSubscriptions.length}</span>
            </div>
            <div className="pf-asset-item">
              <span className="pf-asset-item-label">今日盈亏</span>
              <span className={`pf-asset-item-val ${todayProfit >= 0 ? 'up' : 'down'}`}>
                {todayProfit >= 0 ? '+' : ''}¥{Math.abs(todayProfit).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* 快捷操作行 */}
        <div className="pf-quick-actions">
          <div className="pf-quick-btn" onClick={() => navigate('/m/trade')}>
            <div className="pf-quick-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </div>
            <span className="pf-quick-label">进货</span>
          </div>
          <div className="pf-quick-btn" onClick={() => navigate('/m/settlement')}>
            <div className="pf-quick-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 10h20" />
              </svg>
            </div>
            <span className="pf-quick-label">结算</span>
          </div>
        </div>

        {/* 持仓状态Tab */}
        <div className="pf-tabs">
          {[
            { key: 'all', label: '全部持仓' },
            { key: 'effective', label: '已入库' },
            { key: 'partial_sold', label: '部分售出' },
            { key: 'settling', label: '回款中' },
          ].map(tab => (
            <div key={tab.key} className={`pf-tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
              {tab.label}
            </div>
          ))}
        </div>
      </div>

      {/* 可滚动内容区 */}
      <div className="pf-scroll-area" onClick={() => swipeOpenId && setSwipeOpenId(null)}>
        <PullToRefresh onRefresh={async () => { await loadData(); await loadSubscriptions(); await loadTransactions() }}>
          <div className="pf-content">
          {subscriptionLoading ? (
            <div className="pf-skeleton-list">
              {[1, 2, 3].map(i => (
                <div key={i} className="pf-skeleton-card">
                  <div className="pf-skeleton-icon" />
                  <div className="pf-skeleton-body">
                    <div className="pf-skeleton-line" style={{ width: '40%' }} />
                    <div className="pf-skeleton-line" style={{ width: '60%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {filteredSubscriptions.map((sub, index) => {
                const profit = (sub.totalProfit || 0) - (sub.totalLoss || 0)
                const isProfit = profit >= 0
                const statusDisplay = getSubscriptionStatusDisplay(sub)
                return (
                  <SwipeCard
                    key={sub.id} cardId={sub.id} swipeOpenId={swipeOpenId} onSwipeOpen={setSwipeOpenId}
                    onDetail={() => { setSwipeOpenId(null); setSelectedSub(sub) }}
                  >
                    <div className="pf-drug-item" style={{ animationDelay: `${index * 50}ms` }}
                      onClick={() => swipeOpenId === sub.id && setSwipeOpenId(null)}>
                      {/* 左: 40x40 圆形药品图标 */}
                      <div className="pf-drug-avatar">
                        <DrugCapsuleIcon />
                      </div>
                      {/* 中: 药品名+规格+状态 */}
                      <div className="pf-drug-info">
                        <span className="pf-drug-name">{sub.drugName}</span>
                        <span className="pf-drug-spec">{sub.drugCode} · {sub.quantity}盒</span>
                        <span className="pf-drug-status" style={{ color: statusDisplay.color }}>{statusDisplay.label}</span>
                      </div>
                      {/* 右: 持仓数量+市值 */}
                      <div className="pf-drug-values">
                        <span className={`pf-drug-pl ${isProfit ? 'up' : 'down'}`}>
                          {isProfit ? '+' : ''}¥{Math.abs(profit).toFixed(2)}
                        </span>
                        <span className="pf-drug-market">¥{Number(sub.amount || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </SwipeCard>
                )
              })}

              {/* 空状态 */}
              {filteredSubscriptions.length === 0 && !subscriptionLoading && (
                <div className="pf-empty">
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <rect x="12" y="16" width="40" height="36" rx="4" stroke="var(--color-text-secondary)" strokeWidth="2" />
                    <path d="M12 26h40" stroke="var(--color-text-secondary)" strokeWidth="2" />
                    <circle cx="32" cy="40" r="8" stroke="var(--color-brand-light)" strokeWidth="2" strokeDasharray="4 2" />
                  </svg>
                  <p className="pf-empty-text">暂无持仓</p>
                  <p className="pf-empty-hint">您当前没有在库药品，去进货看看吧</p>
                  <button className="pf-empty-btn" onClick={() => navigate('/m/trade')}>去进货</button>
                </div>
              )}
            </>
          )}
          </div>
        </PullToRefresh>
      </div>

      {/* ===== 提现弹窗 ===== */}
      <Popup
        visible={showWithdraw}
        onMaskClick={() => setShowWithdraw(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '45vh', background: 'var(--color-bg-card)' }}
      >
        <div className="pf-popup">
          <div className="pf-popup-header">
            <span>账户提现</span>
            <span className="pf-popup-close" onClick={() => setShowWithdraw(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </span>
          </div>
          <div className="pf-popup-balance">
            <span className="pf-popup-balance-label">当前可用余额</span>
            <span className="pf-popup-balance-value">¥{Number((balance?.availableBalance ?? balance?.balance) || 0).toFixed(2)}</span>
          </div>
          <div className="pf-popup-field">
            <label className="pf-popup-label">提现金额</label>
            <div className="pf-popup-input-wrap">
              <span className="pf-popup-currency">¥</span>
              <input type="number" placeholder="请输入提现金额" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="pf-popup-input" min="1" step="0.01" />
            </div>
            {withdrawAmount && Number(withdrawAmount) > Number((balance?.availableBalance ?? balance?.balance) || 0) && (
              <span className="pf-popup-error">提现金额超过可用余额</span>
            )}
          </div>
          <div className="pf-popup-field">
            <label className="pf-popup-label">银行卡信息 <span style={{ color: 'var(--color-text-secondary)' }}>(选填)</span></label>
            <input type="text" placeholder="请输入银行卡号或开户行信息" value={bankInfo} onChange={e => setBankInfo(e.target.value)} className="pf-popup-bank-input" />
          </div>
          <div className="pf-popup-tip">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-light)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            <span>提现申请提交后，管理员将在T+1日确认到账</span>
          </div>
          <button className="pf-popup-btn" disabled={withdrawLoading || !withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > Number((balance?.availableBalance ?? balance?.balance) || 0)} onClick={handleWithdraw}>
            {withdrawLoading ? '提交中...' : '确认提现'}
          </button>
        </div>
      </Popup>

      {/* ===== 充值弹窗 ===== */}
      <Popup
        visible={showRecharge}
        onMaskClick={() => setShowRecharge(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '50vh', background: 'var(--color-bg-card)' }}
      >
        <div className="pf-popup">
          <div className="pf-popup-header">
            <span>账户充值</span>
            <span className="pf-popup-close" onClick={() => setShowRecharge(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </span>
          </div>
          <div className="pf-recharge-amounts">
            {[100, 500, 1000, 5000].map(amt => (
              <div key={amt} className={`pf-recharge-chip ${rechargeAmount === String(amt) ? 'active' : ''}`} onClick={() => setRechargeAmount(String(amt))}>
                ¥{amt}
              </div>
            ))}
          </div>
          <div className="pf-popup-field">
            <label className="pf-popup-label">自定义金额</label>
            <div className="pf-popup-input-wrap">
              <span className="pf-popup-currency">¥</span>
              <input type="number" placeholder="输入充值金额" value={rechargeAmount} onChange={e => setRechargeAmount(e.target.value)} className="pf-popup-input" min="0.01" step="0.01" />
            </div>
          </div>
          <div className="pf-recharge-channel">
            <div className={`pf-channel-item ${payChannel === 'wechat' ? 'active' : ''}`} onClick={() => setPayChannel('wechat')}>
              <span className="pf-channel-icon wechat">微</span>
              <span>微信支付</span>
            </div>
          </div>
          <button className="pf-popup-btn" disabled={payLoading || !rechargeAmount || Number(rechargeAmount) <= 0} onClick={handleRecharge}>
            {payLoading ? '处理中...' : '确认充值'}
          </button>
        </div>
      </Popup>

      {/* ===== 详情弹窗 ===== */}
      <Popup
        visible={!!selectedSub}
        onMaskClick={() => setSelectedSub(null)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, background: 'var(--color-bg-card)' }}
      >
        {selectedSub && (
          <div className="pf-detail-popup">
            <div className="pf-popup-header">
              <span>持仓详情</span>
              <span className="pf-popup-close" onClick={() => setSelectedSub(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </span>
            </div>

            <div className="pf-detail-card">
              <div className="pf-detail-drug-name">{selectedSub.drugName}</div>
              <div className="pf-detail-drug-code">{selectedSub.drugCode}</div>
              <div className="pf-detail-divider" />
              <div className="pf-detail-row">
                <span className="pf-detail-label">进货数量</span>
                <span className="pf-detail-value">{selectedSub.quantity} 盒</span>
              </div>
              <div className="pf-detail-row">
                <span className="pf-detail-label">进货金额</span>
                <span className="pf-detail-value brand">¥{Number(selectedSub.amount || 0).toFixed(2)}</span>
              </div>
              <div className="pf-detail-row">
                <span className="pf-detail-label">进货时间</span>
                <span className="pf-detail-value">
                  {selectedSub.confirmedAt
                    ? (() => {
                        const d = new Date(selectedSub.confirmedAt)
                        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                      })()
                    : '-'}
                </span>
              </div>
              <div className="pf-detail-divider" />
              <div className="pf-detail-row">
                <span className="pf-detail-label">锁定期</span>
                <span className="pf-detail-value">10 天</span>
              </div>
              <div className="pf-detail-row">
                <span className="pf-detail-label">锁定状态</span>
                <span className="pf-detail-value accent">
                  {selectedSub.lockExpiresAt
                    ? (() => {
                        const remainMs = new Date(selectedSub.lockExpiresAt).getTime() - Date.now()
                        if (remainMs > 0) {
                          const remainDays = Math.ceil(remainMs / (24 * 60 * 60 * 1000))
                          return `剩余 ${remainDays} 天`
                        }
                        return '已到期'
                      })()
                    : '-'}
                </span>
              </div>
              <div className="pf-detail-divider" />
              <div className="pf-detail-row">
                <span className="pf-detail-label">预期收益</span>
                <span className={`pf-detail-value ${((selectedSub.totalProfit || 0) - (selectedSub.totalLoss || 0)) >= 0 ? 'up' : 'down'}`}>
                  {(() => {
                    const profit = (selectedSub.totalProfit || 0) - (selectedSub.totalLoss || 0)
                    return `${profit >= 0 ? '+' : '-'}¥${Math.abs(profit).toFixed(2)}`
                  })()}
                </span>
              </div>
              <div className="pf-detail-row">
                <span className="pf-detail-label">订单状态</span>
                <span className="pf-detail-status-badge" style={{ color: getSubscriptionStatusDisplay(selectedSub).color }}>
                  {getSubscriptionStatusDisplay(selectedSub).label}
                </span>
              </div>
            </div>

            <div className="pf-detail-tip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-light)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
              <span>锁定期结束后由管理员统一结算收益</span>
            </div>
          </div>
        )}
      </Popup>

    </div>
  )
}

const Portfolio: React.FC = () => (
  <PortfolioErrorBoundary>
    <PortfolioContent />
  </PortfolioErrorBoundary>
)

export default Portfolio
