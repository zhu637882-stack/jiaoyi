import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PullToRefresh, Tabs } from 'antd-mobile'
import { accountApi } from '../services/api'
import './Transactions.css'

// 交易记录类型定义
interface Transaction {
  id: string
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  createdAt: string
}

// 交易类型映射
const transactionTypeMap: Record<string, { label: string; color: string; bgColor: string }> = {
  RECHARGE: { label: '充值', color: '#0ECB81', bgColor: 'rgba(14, 203, 129, 0.15)' },
  WITHDRAW: { label: '提现', color: '#F6465D', bgColor: 'rgba(246, 70, 93, 0.15)' },
  SUBSCRIPTION: { label: '认购', color: '#F0B90B', bgColor: 'rgba(240, 185, 11, 0.15)' },
  PRINCIPAL_RETURN: { label: '本金退回', color: '#1890FF', bgColor: 'rgba(24, 144, 255, 0.15)' },
  PROFIT_SHARE: { label: '收益分成', color: '#F6465D', bgColor: 'rgba(246, 70, 93, 0.15)' },
  LOSS_SHARE: { label: '亏损承担', color: '#0ECB81', bgColor: 'rgba(14, 203, 129, 0.15)' },
  SLOW_SELL_REFUND: { label: '滞销退款', color: '#722ED1', bgColor: 'rgba(114, 46, 209, 0.15)' },
  SETTLEMENT: { label: '清算', color: '#FAAD14', bgColor: 'rgba(250, 173, 20, 0.15)' },
  // 兼容旧类型
  recharge: { label: '充值', color: '#0ECB81', bgColor: 'rgba(14, 203, 129, 0.15)' },
  withdraw: { label: '提现', color: '#F6465D', bgColor: 'rgba(246, 70, 93, 0.15)' },
  funding: { label: '认购冻结', color: '#F0B90B', bgColor: 'rgba(240, 185, 11, 0.15)' },
  principal_return: { label: '本金退回', color: '#1890FF', bgColor: 'rgba(24, 144, 255, 0.15)' },
  profit_share: { label: '收益分成', color: '#F6465D', bgColor: 'rgba(246, 70, 93, 0.15)' },
  loss_share: { label: '亏损承担', color: '#0ECB81', bgColor: 'rgba(14, 203, 129, 0.15)' },
  interest: { label: '利息', color: '#F0B90B', bgColor: 'rgba(240, 185, 11, 0.15)' },
  sell: { label: '卖出', color: '#FAAD14', bgColor: 'rgba(250, 173, 20, 0.15)' },
}

// 类型筛选配置
const typeTabs = [
  { key: 'all', label: '全部' },
  { key: 'recharge', label: '充值' },
  { key: 'withdraw', label: '提现' },
  { key: 'subscription', label: '认购' },
  { key: 'dividend', label: '分红' },
  { key: 'settlement', label: '清算' },
]

// 日期筛选配置
const dateTabs = [
  { key: '7', label: '7天' },
  { key: '30', label: '30天' },
  { key: 'all', label: '全部' },
]

const Transactions: React.FC = () => {
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTypeTab, setActiveTypeTab] = useState('all')
  const [activeDateTab, setActiveDateTab] = useState('7')

  const loadData = async () => {
    try {
      setLoading(true)
      const params: any = { page: 1, pageSize: 100 }
      
      // 日期筛选
      if (activeDateTab !== 'all') {
        const days = parseInt(activeDateTab)
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)
        params.startDate = startDate.toISOString().split('T')[0]
        params.endDate = endDate.toISOString().split('T')[0]
      }

      const res = await accountApi.getTransactions(params) as any
      const listData = res?.list || res?.data?.list || []
      setTransactions(Array.isArray(listData) ? listData : [])
    } catch (e) {
      console.error('Load transactions error:', e)
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
        console.error('Transactions init error:', e)
      }
    }
    
    init()
    
    return () => {
      isMounted = false
    }
  }, [activeTypeTab, activeDateTab])

  // 格式化金额
  const formatCurrency = (value: number) => {
    return `${Number(value || 0).toFixed(2)}`
  }

  // 格式化日期时间
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  // 判断是否为入账
  const isIncome = (type: string) => {
    return ['RECHARGE', 'PRINCIPAL_RETURN', 'PROFIT_SHARE', 'SLOW_SELL_REFUND', 'recharge', 'principal_return', 'profit_share', 'interest'].includes(type)
  }

  // 筛选交易记录
  const filteredTransactions = transactions.filter(tx => {
    if (activeTypeTab === 'all') return true
    
    const typeMap: Record<string, string[]> = {
      recharge: ['RECHARGE', 'recharge'],
      withdraw: ['WITHDRAW', 'withdraw'],
      subscription: ['SUBSCRIPTION', 'funding'],
      dividend: ['PROFIT_SHARE', 'LOSS_SHARE', 'profit_share', 'loss_share', 'interest'],
      settlement: ['SETTLEMENT', 'sell', 'PRINCIPAL_RETURN', 'principal_return'],
    }
    
    return typeMap[activeTypeTab]?.includes(tx.type) || false
  })

  return (
    <div className="mobile-transactions">
      {/* 页面标题 */}
      <div className="transactions-header">
        <button className="header-back" onClick={() => navigate('/m/profile')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="transactions-title">交易明细</h1>
        <div className="header-placeholder" />
      </div>

      {/* 日期筛选Tab */}
      <div className="transactions-date-tabs">
        {dateTabs.map(tab => (
          <button 
            key={tab.key}
            className={`date-tab ${activeDateTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveDateTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 类型筛选Tab */}
      <div className="transactions-type-tabs">
        <Tabs
          activeKey={activeTypeTab}
          onChange={setActiveTypeTab}
          className="type-tabs"
        >
          {typeTabs.map(tab => (
            <Tabs.Tab title={tab.label} key={tab.key} />
          ))}
        </Tabs>
      </div>

      {/* 交易记录列表 */}
      <div className="transactions-list-section">
        <PullToRefresh onRefresh={loadData}>
          <div className="transactions-list">
            {loading ? (
              // 骨架屏
              <div className="transactions-skeleton">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="skeleton-transaction-card">
                    <div className="skeleton-icon" />
                    <div className="skeleton-info">
                      <div className="skeleton-line" style={{ width: '40%', marginBottom: 8 }} />
                      <div className="skeleton-line" style={{ width: '60%', height: 12 }} />
                    </div>
                    <div className="skeleton-amount" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {filteredTransactions.map((tx, index) => {
                  const config = transactionTypeMap[tx.type] || { 
                    label: tx.type, 
                    color: '#848E9C',
                    bgColor: 'rgba(132, 142, 156, 0.15)'
                  }
                  const income = isIncome(tx.type)
                  
                  return (
                    <div 
                      key={tx.id} 
                      className="transaction-record-card"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div 
                        className="transaction-type-badge"
                        style={{ backgroundColor: config.bgColor, color: config.color }}
                      >
                        {config.label}
                      </div>
                      <div className="transaction-info">
                        <div className="transaction-info-header">
                          <span className="transaction-desc" title={tx.description}>
                            {tx.description || '-'}
                          </span>
                          <span className="transaction-time">{formatDateTime(tx.createdAt)}</span>
                        </div>
                        <div className="transaction-balance-info">
                          <span>变动前: ¥{Number(tx.balanceBefore || 0).toFixed(2)}</span>
                          <span>→</span>
                          <span>变动后: ¥{Number(tx.balanceAfter || 0).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="transaction-amount-section">
                        <span className={`transaction-amount ${income ? 'income' : 'expense'}`}>
                          {income ? '+' : '-'}¥{formatCurrency(Math.abs(tx.amount))}
                        </span>
                      </div>
                    </div>
                  )
                })}

                {/* 空状态 */}
                {filteredTransactions.length === 0 && (
                  <div className="transactions-empty">
                    <div className="empty-icon">
                      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                        <circle cx="32" cy="32" r="28" stroke="#2B3139" strokeWidth="2" fill="none"/>
                        <path d="M20 32h24M32 20v24" stroke="#2B3139" strokeWidth="2" strokeLinecap="round"/>
                        <circle cx="44" cy="44" r="10" fill="#F0B90B" opacity="0.15"/>
                        <path d="M41 44h6M44 41v6" stroke="#F0B90B" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div className="empty-text">暂无交易记录</div>
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

export default Transactions
