import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PullToRefresh } from 'antd-mobile'
import { settlementApi } from '../services/api'
import { useCountUp, formatCountUpValue } from '../hooks/useCountUp'
import './Settlement.css'

// CountUp数字展示组件
const CountUpValue = ({ target, prefix = '', color }: { target: number; prefix?: string; color?: string }) => {
  // 防御性处理：确保 target 是有效数字
  const safeTarget = Number.isFinite(target) ? target : 0
  const animatedValue = useCountUp(safeTarget)
  // 如果动画值无效，回退到目标值
  const displayValue = Number.isFinite(animatedValue) ? animatedValue : safeTarget
  return (
    <span style={{ color }}>
      {prefix}{formatCountUpValue(displayValue)}
    </span>
  )
}

// 统计卡片组件
const StatCard = ({ 
  icon, 
  label, 
  value, 
  prefix = '',
  color,
  delay = 0
}: { 
  icon: React.ReactNode
  label: string
  value: number
  prefix?: string
  color: string
  delay?: number
}) => (
  <div className="settlement-stat-card" style={{ animationDelay: `${delay}ms` }}>
    <div className="stat-card-icon" style={{ backgroundColor: 'rgba(255, 193, 7, 0.15)' }}>
      {icon}
    </div>
    <div className="stat-card-info">
      <span className="stat-card-label">{label}</span>
      <span className="stat-card-value" style={{ color }}>
        <CountUpValue target={value} prefix={prefix} />
      </span>
    </div>
  </div>
)

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

const Settlement: React.FC = () => {
  const navigate = useNavigate()
  const [settlements, setSettlements] = useState<SettlementItem[]>([])
  const [stats, setStats] = useState<SettlementStats | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      setLoading(true)
      const [settlementsRes, statsRes] = await Promise.all([
        settlementApi.getMySettlements({ page: 1, pageSize: 100 }) as any,
        settlementApi.getMySettlementStats() as any,
      ])

      const listData = settlementsRes?.data?.list || settlementsRes?.list || []
      setSettlements(Array.isArray(listData) ? listData : [])

      if (statsRes?.success && statsRes?.data) {
        setStats(statsRes.data)
      } else {
        setStats(null)
      }
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
    
    return () => {
      isMounted = false
    }
  }, [])

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
  const totalSettlementCount = settlements.length
  const totalSales = settlements.reduce((sum, item) => sum + (item.totalSalesRevenue || 0), 0)
  const totalProfit = stats?.totalProfitShare || 0
  const totalNetIncome = settlements.reduce((sum, item) => sum + (item.myNetIncome || 0), 0)

  return (
    <div className="mobile-settlement">
      {/* 页面标题 */}
      <div className="settlement-header">
        <button className="header-back" onClick={() => navigate('/m/profile')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="settlement-title">清算统计</h1>
        <div className="header-placeholder" />
      </div>

      {/* 统计卡片区 */}
      <div className="settlement-stats-section">
        <StatCard
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="#FFC107" strokeWidth="2"/>
              <path d="M16 2v4M8 2v4M3 10h18" stroke="#FFC107" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          }
          label="总清算次数"
          value={totalSettlementCount}
          color="#FFC107"
          delay={0}
        />
        <StatCard
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="#FFC107" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          label="总销售额"
          value={totalSales}
          prefix="¥"
          color="#FFC107"
          delay={80}
        />
        <StatCard
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#FFC107" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          label="总分润金额"
          value={totalProfit}
          prefix="¥"
          color="#FFC107"
          delay={160}
        />
        <StatCard
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="#FFC107" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          label="净收益"
          value={totalNetIncome}
          prefix="¥"
          color="#FFC107"
          delay={240}
        />
      </div>

      {/* 清算记录列表 */}
      <div className="settlement-list-section">
        <div className="list-section-header">
          <span className="section-title">清算记录</span>
          <span className="section-count">共 {settlements.length} 条</span>
        </div>
        
        <PullToRefresh onRefresh={loadData}>
          <div className="settlement-list">
            {loading ? (
              // 骨架屏
              <div className="settlement-skeleton">
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-header">
                      <div className="skeleton-line" style={{ width: '40%' }} />
                      <div className="skeleton-line" style={{ width: '25%' }} />
                    </div>
                    <div className="skeleton-divider" />
                    <div className="skeleton-body">
                      <div className="skeleton-row">
                        <div className="skeleton-item">
                          <div className="skeleton-line" style={{ width: '60%', height: 12 }} />
                          <div className="skeleton-line" style={{ width: '80%', height: 18 }} />
                        </div>
                        <div className="skeleton-item">
                          <div className="skeleton-line" style={{ width: '60%', height: 12 }} />
                          <div className="skeleton-line" style={{ width: '80%', height: 18 }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {settlements.map((item, index) => (
                  <div 
                    key={item.id} 
                    className="settlement-record-card"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className="record-header">
                      <span className="drug-name">{item.drugName}</span>
                      <span className="settlement-date">{formatDate(item.settlementDate)}</span>
                    </div>
                    <div className="record-divider" />
                    <div className="record-body">
                      <div className="record-row">
                        <div className="record-item">
                          <span className="item-label">销售额</span>
                          <span className="item-value">{formatCurrency(item.totalSalesRevenue)}</span>
                        </div>
                        <div className="record-item">
                          <span className="item-label">净利润</span>
                          <span className={`item-value ${item.netProfit >= 0 ? 'profit' : 'loss'}`}>
                            {item.netProfit >= 0 ? '+' : ''}{formatCurrency(item.netProfit)}
                          </span>
                        </div>
                      </div>
                      <div className="record-row">
                        <div className="record-item">
                          <span className="item-label">分润金额</span>
                          <span className={`item-value ${item.myProfitShare > 0 ? 'profit' : item.myLossShare > 0 ? 'loss' : ''}`}>
                            {item.myProfitShare > 0 
                              ? `+${formatCurrency(item.myProfitShare)}`
                              : item.myLossShare > 0 
                                ? `-${formatCurrency(item.myLossShare)}`
                                : formatCurrency(0)}
                          </span>
                        </div>
                        <div className="record-item">
                          <span className="item-label">净收益</span>
                          <span className={`item-value ${item.myNetIncome >= 0 ? 'profit' : 'loss'}`}>
                            {item.myNetIncome >= 0 ? '+' : ''}{formatCurrency(item.myNetIncome)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="record-footer">
                      <span className="drug-code">{item.drugCode}</span>
                      <span className="principal-return">本金返还: {formatCurrency(item.myPrincipalReturn)}</span>
                    </div>
                  </div>
                ))}

                {/* 空状态 */}
                {settlements.length === 0 && (
                  <div className="settlement-empty">
                    <div className="empty-icon">
                      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                        <circle cx="32" cy="32" r="28" stroke="#2B3139" strokeWidth="2" fill="none"/>
                        <rect x="20" y="24" width="24" height="16" rx="2" stroke="#2B3139" strokeWidth="2"/>
                        <path d="M24 28h16M24 32h12" stroke="#2B3139" strokeWidth="2" strokeLinecap="round"/>
                        <circle cx="44" cy="44" r="10" fill="#F0B90B" opacity="0.15"/>
                        <path d="M41 44h6M44 41v6" stroke="#F0B90B" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div className="empty-text">暂无清算记录</div>
                    <div className="empty-hint">下拉刷新试试</div>
                  </div>
                )}
              </>
            )}
          </div>
        </PullToRefresh>
      </div>
    </div>
  )
}

export default Settlement
