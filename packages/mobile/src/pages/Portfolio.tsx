import React, { useEffect, useState } from 'react'
import { PullToRefresh, Tabs } from 'antd-mobile'
import { subscriptionApi, accountApi } from '../services/api'
import './Portfolio.css'

interface SubItem {
  id: string | number
  orderNo: string
  drugName: string
  quantity: number
  amount: number
  status: string
  totalProfit: number
  totalLoss: number
  createdAt: string
  drug?: any
}

const statusMap: Record<string, { label: string; color: string }> = {
  confirmed: { label: '已确认', color: '#0ECB81' },
  effective: { label: '生效中', color: '#0ECB81' },
  partial_returned: { label: '部分退回', color: '#F0B90B' },
  returned: { label: '已退回', color: '#848E9C' },
  cancelled: { label: '已取消', color: '#F6465D' },
  slow_selling_refund: { label: '滞销退款', color: '#F6465D' },
}

const Portfolio: React.FC = () => {
  const [balance, setBalance] = useState<any>(null)
  const [subscriptions, setSubscriptions] = useState<SubItem[]>([])
  const [activeTab, setActiveTab] = useState('all')
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [balanceRes, subRes] = await Promise.all([
        accountApi.getBalance() as any,
        subscriptionApi.getMySubscriptions() as any,
      ])
      setBalance(balanceRes?.data || balanceRes)
      const subData = subRes?.data?.list || subRes?.data || subRes?.list || []
      const arr = Array.isArray(subData) ? subData : []
      setSubscriptions(arr.map((s: any) => ({
        id: s.id,
        orderNo: s.orderNo,
        drugName: s.drug?.name || s.drugName || '-',
        quantity: s.quantity,
        amount: s.amount,
        status: s.status,
        totalProfit: s.totalProfit || 0,
        totalLoss: s.totalLoss || 0,
        createdAt: s.createdAt,
        drug: s.drug,
      })))
    } catch (e) {
      console.error('Load portfolio error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredSubs = activeTab === 'all'
    ? subscriptions
    : subscriptions.filter(s => s.status === activeTab)

  return (
    <div className="mobile-portfolio">
      <div className="mobile-portfolio-header">
        <h1 className="mobile-portfolio-title">我的持仓</h1>
      </div>

      {balance && (
        <div className="mobile-portfolio-balance">
          <div className="balance-item">
            <span className="balance-label">账户余额</span>
            <span className="balance-value">¥{balance.balance?.toFixed(2) || '0.00'}</span>
          </div>
          <div className="balance-item">
            <span className="balance-label">冻结金额</span>
            <span className="balance-value">¥{balance.frozenAmount?.toFixed(2) || '0.00'}</span>
          </div>
          <div className="balance-item">
            <span className="balance-label">累计收益</span>
            <span className="balance-value profit">¥{balance.totalProfit?.toFixed(2) || '0.00'}</span>
          </div>
        </div>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ '--active-line-color': '#F0B90B', '--active-title-color': '#F0B90B', '--title-color': '#848E9C' } as any}
      >
        <Tabs.Tab title="全部" key="all" />
        <Tabs.Tab title="生效中" key="effective" />
        <Tabs.Tab title="已确认" key="confirmed" />
        <Tabs.Tab title="已退回" key="returned" />
      </Tabs>

      <PullToRefresh onRefresh={loadData}>
        <div className="mobile-portfolio-list">
          {filteredSubs.map(sub => {
            const st = statusMap[sub.status] || { label: sub.status, color: '#848E9C' }
            return (
              <div className="portfolio-card" key={sub.id}>
                <div className="portfolio-card-top">
                  <span className="portfolio-drug-name">{sub.drugName}</span>
                  <span className="portfolio-status" style={{ color: st.color }}>{st.label}</span>
                </div>
                <div className="portfolio-card-mid">
                  <div className="portfolio-mid-item">
                    <span className="label">数量</span>
                    <span className="value">{sub.quantity}</span>
                  </div>
                  <div className="portfolio-mid-item">
                    <span className="label">金额</span>
                    <span className="value">¥{sub.amount?.toFixed(2)}</span>
                  </div>
                  <div className="portfolio-mid-item">
                    <span className="label">收益</span>
                    <span className={`value ${sub.totalProfit >= 0 ? 'profit' : 'loss'}`}>
                      ¥{sub.totalProfit?.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="portfolio-card-bottom">
                  <span>{sub.orderNo}</span>
                  <span>{new Date(sub.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            )
          })}
          {filteredSubs.length === 0 && (
            <div className="portfolio-empty">暂无认购记录</div>
          )}
        </div>
      </PullToRefresh>
    </div>
  )
}

export default Portfolio
