import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PullToRefresh, Popup, Toast, Dialog } from 'antd-mobile'
import { settlementApi, accountApi, paymentApi } from '../services/api'
import { isWechatBrowser } from '../utils/browser'
import { getStoredOpenId, redirectToWechatAuth } from '../utils/wechat-auth'
import { useCountUp, formatCountUpValue } from '../hooks/useCountUp'
import './Settlement.css'

// CountUp数字展示组件
const CountUpValue = ({ target, prefix = '', color }: { target: number; prefix?: string; color?: string }) => {
  const safeTarget = Number.isFinite(target) ? target : 0
  const animatedValue = useCountUp(safeTarget)
  const displayValue = Number.isFinite(animatedValue) ? animatedValue : safeTarget
  return (
    <span style={{ color }}>
      {prefix}{formatCountUpValue(displayValue)}
    </span>
  )
}

// 清算记录数据类型
interface SettlementItem {
  id: string
  drugId: string
  drugName: string
  drugCode: string
  settlementDate: string
  totalSalesRevenue: number
  netProfit: number
  myPrincipalReturn: number
  myProfitShare: number
  myLossShare: number
  myNetIncome: number
}

// 统计数据类型
interface SettlementStats {
  totalPrincipalReturn: number
  totalProfitShare: number
  totalLossShare: number
  netProfit: number
  totalReturn: number
}

// 结算记录类型
interface SettlementRecord {
  id: string
  type: string
  amount: number
  status: string
  createdAt: string
  description?: string
}

const Settlement: React.FC = () => {
  const navigate = useNavigate()
  const [settlements, setSettlements] = useState<SettlementItem[]>([])
  const [stats, setStats] = useState<SettlementStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState<any>(null)

  // 弹窗状态
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [bankInfo, setBankInfo] = useState('')
  const [showRecharge, setShowRecharge] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [payChannel, setPayChannel] = useState<'wechat'>('wechat')
  const [payLoading, setPayLoading] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [settlementsRes, statsRes, balRes] = await Promise.all([
        settlementApi.getMySettlements({ page: 1, pageSize: 100 }) as any,
        settlementApi.getMySettlementStats() as any,
        accountApi.getBalance() as any,
      ])

      const listData = settlementsRes?.data?.list || settlementsRes?.list || []
      setSettlements(Array.isArray(listData) ? listData : [])

      if (statsRes?.success && statsRes?.data) {
        setStats(statsRes.data)
      } else {
        setStats(null)
      }

      setBalance(balRes?.data || balRes)
    } catch (e) {
      console.error('Load settlement data error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    const init = async () => {
      try {
        if (isMounted) await loadData()
      } catch (e) {
        console.error('Settlement init error:', e)
      }
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
      const balRes = await accountApi.getBalance() as any
      setBalance(balRes?.data || balRes)
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

  // 格式化金额
  const formatCurrency = (value: number) => {
    return `¥${Number(value || 0).toFixed(2)}`
  }

  // 格式化日期
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  // 计算统计数据
  const totalNetIncome = settlements.reduce((sum, item) => sum + (item.myNetIncome || 0), 0)
  const availableBalance = Number(balance?.availableBalance ?? balance?.balance ?? 0)

  // 模拟最近结算记录
  const recentSettlements: SettlementRecord[] = settlements.slice(0, 5).map((s, i) => ({
    id: s.id,
    type: i % 2 === 0 ? '收入' : '支出',
    amount: i % 2 === 0 ? s.myProfitShare : s.myLossShare,
    status: i === 0 ? 'processing' : 'completed',
    createdAt: s.settlementDate,
    description: s.drugName,
  }))

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed': return { label: '已完成', color: 'var(--color-down)' }
      case 'processing': return { label: '处理中', color: 'var(--color-brand-light)' }
      case 'cancelled': return { label: '已取消', color: 'var(--color-text-secondary)' }
      default: return { label: status, color: 'var(--color-text-secondary)' }
    }
  }

  return (
    <div className="st-page">
      {/* 顶部导航 */}
      <div className="st-header">
        <div className="st-header-left" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </div>
        <h1 className="st-header-title">结算中心</h1>
        <div className="st-header-placeholder" />
      </div>

      {/* 余额卡片 - 蓝色渐变 */}
      <div className="st-balance-card">
        <div className="st-balance-label">可结算金额</div>
        <div className="st-balance-value">
          <CountUpValue target={availableBalance} prefix="¥" />
        </div>
        <div className="st-balance-actions">
          <button className="st-btn-recharge" onClick={() => setShowRecharge(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-light)" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            充值
          </button>
          <button className="st-btn-withdraw" onClick={() => setShowWithdraw(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            提现
          </button>
        </div>
      </div>

      {/* 账户信息卡片 */}
      <div className="st-info-card">
        <div className="st-info-row">
          <div className="st-info-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <span className="st-info-label">银行账户</span>
          <span className="st-info-value">****6218</span>
          <div className="st-info-copy" onClick={() => { navigator.clipboard?.writeText('****6218'); Toast.show({ content: '已复制' }) }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </div>
        </div>
        <div className="st-info-row">
          <div className="st-info-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
            </svg>
          </div>
          <span className="st-info-label">开户行</span>
          <span className="st-info-value">中国工商银行</span>
          <div className="st-info-copy" onClick={() => { navigator.clipboard?.writeText('中国工商银行'); Toast.show({ content: '已复制' }) }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </div>
        </div>
        <div className="st-info-row">
          <div className="st-info-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span className="st-info-label">户名</span>
          <span className="st-info-value">张**</span>
          <div className="st-info-copy" onClick={() => { Toast.show({ content: '隐私信息不可复制' }) }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </div>
        </div>
      </div>

      {/* 最近结算记录 */}
      <div className="st-records-section">
        <div className="st-records-header">
          <span className="st-records-title">结算记录</span>
          <span className="st-records-more" onClick={() => navigate('/m/transactions')}>
            查看全部 &gt;
          </span>
        </div>

        <PullToRefresh onRefresh={loadData}>
          <div className="st-records-list">
            {loading ? (
              <div className="st-skeleton">
                {[1, 2, 3].map(i => (
                  <div key={i} className="st-skeleton-item">
                    <div className="st-skeleton-icon" />
                    <div className="st-skeleton-body">
                      <div className="st-skeleton-line" style={{ width: '40%' }} />
                      <div className="st-skeleton-line" style={{ width: '60%', height: 10 }} />
                    </div>
                    <div className="st-skeleton-amount" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {recentSettlements.map((record, idx) => {
                  const statusStyle = getStatusStyle(record.status)
                  const isIncome = record.type === '收入'
                  return (
                    <div key={record.id} className="st-record-item" style={{ animationDelay: `${idx * 40}ms` }}>
                      <div className="st-record-left">
                        <div className="st-record-icon">
                          {isIncome ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-down)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-up)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
                            </svg>
                          )}
                        </div>
                        <div className="st-record-info">
                          <span className="st-record-type">{record.type} · {record.description}</span>
                          <div className="st-record-meta">
                            <span className="st-record-date">{formatDate(record.createdAt)}</span>
                            <span className="st-record-status" style={{ color: statusStyle.color }}>{statusStyle.label}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`st-record-amount ${isIncome ? 'income' : 'expense'}`}>
                        {isIncome ? '+' : '-'}¥{Math.abs(Number(record.amount || 0)).toFixed(2)}
                      </span>
                    </div>
                  )
                })}

                {recentSettlements.length === 0 && (
                  <div className="st-empty">
                    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                      <circle cx="28" cy="28" r="24" stroke="var(--color-text-secondary)" strokeWidth="1.5" fill="none" opacity="0.3" />
                      <rect x="16" y="20" width="24" height="16" rx="3" stroke="var(--color-text-secondary)" strokeWidth="1.5" opacity="0.3" />
                      <path d="M20 24h16M20 28h12" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
                    </svg>
                    <p className="st-empty-text">暂无结算记录</p>
                    <p className="st-empty-hint">下拉刷新试试</p>
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
        <div className="st-popup">
          <div className="st-popup-header">
            <span>账户提现</span>
            <span className="st-popup-close" onClick={() => setShowWithdraw(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </span>
          </div>
          <div className="st-popup-balance">
            <span className="st-popup-balance-label">当前可用余额</span>
            <span className="st-popup-balance-value">¥{availableBalance.toFixed(2)}</span>
          </div>
          <div className="st-popup-field">
            <label className="st-popup-label">提现金额</label>
            <div className="st-popup-input-wrap">
              <span className="st-popup-currency">¥</span>
              <input type="number" placeholder="请输入提现金额" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="st-popup-input" min="1" step="0.01" />
            </div>
            {withdrawAmount && Number(withdrawAmount) > availableBalance && (
              <span className="st-popup-error">提现金额超过可用余额</span>
            )}
          </div>
          <div className="st-popup-field">
            <label className="st-popup-label">银行卡信息 <span style={{ color: 'var(--color-text-secondary)' }}>(选填)</span></label>
            <input type="text" placeholder="请输入银行卡号或开户行信息" value={bankInfo} onChange={e => setBankInfo(e.target.value)} className="st-popup-bank-input" />
          </div>
          <div className="st-popup-tip">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-light)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            <span>提现申请提交后，管理员将在T+1日确认到账</span>
          </div>
          <button className="st-popup-btn" disabled={withdrawLoading || !withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > availableBalance} onClick={handleWithdraw}>
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
        <div className="st-popup">
          <div className="st-popup-header">
            <span>账户充值</span>
            <span className="st-popup-close" onClick={() => setShowRecharge(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </span>
          </div>
          <div className="st-recharge-amounts">
            {[100, 500, 1000, 5000].map(amt => (
              <div key={amt} className={`st-recharge-chip ${rechargeAmount === String(amt) ? 'active' : ''}`} onClick={() => setRechargeAmount(String(amt))}>
                ¥{amt}
              </div>
            ))}
          </div>
          <div className="st-popup-field">
            <label className="st-popup-label">自定义金额</label>
            <div className="st-popup-input-wrap">
              <span className="st-popup-currency">¥</span>
              <input type="number" placeholder="输入充值金额" value={rechargeAmount} onChange={e => setRechargeAmount(e.target.value)} className="st-popup-input" min="0.01" step="0.01" />
            </div>
          </div>
          <div className="st-recharge-channel">
            <div className={`st-channel-item ${payChannel === 'wechat' ? 'active' : ''}`} onClick={() => setPayChannel('wechat')}>
              <span className="st-channel-icon wechat">微</span>
              <span>微信支付</span>
            </div>
          </div>
          <button className="st-popup-btn" disabled={payLoading || !rechargeAmount || Number(rechargeAmount) <= 0} onClick={handleRecharge}>
            {payLoading ? '处理中...' : '确认充值'}
          </button>
        </div>
      </Popup>
    </div>
  )
}

export default Settlement
