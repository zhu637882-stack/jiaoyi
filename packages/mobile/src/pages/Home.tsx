import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchBar, Tabs } from 'antd-mobile'
import DrugCard from '../components/DrugCard'
import { marketApi, drugApi } from '../services/api'
import { wsService } from '../services/websocket'
import logoPng from '../assets/logo.png'
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
  fundingHeat?: number
  dailyReturn?: number
  cumulativeReturn?: number
}

const Home: React.FC = () => {
  const navigate = useNavigate()
  const [drugs, setDrugs] = useState<DrugItem[]>([])
  const [hotDrugs, setHotDrugs] = useState<DrugItem[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  const loadData = useCallback(async () => {
    try {
      const [overviewRes, drugsRes] = await Promise.all([
        marketApi.getMarketOverview() as any,
        drugApi.getDrugs({ keyword: keyword || undefined }) as any,
      ])
      const drugsData = drugsRes?.data?.items || drugsRes?.data || drugsRes?.list || drugsRes || []
      const arr = Array.isArray(drugsData) ? drugsData : (drugsData?.items ? drugsData.items : [])
      const mapped = arr.map((d: any) => ({
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
        fundingHeat: Number(d.fundingHeat) || 0,
        dailyReturn: Number(d.dailyReturn) || 0,
        cumulativeReturn: Number(d.cumulativeReturn) || 0,
      }))
      setDrugs(mapped)

      // 热门排行
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
        })))
      } catch {}
    } catch (e) {
      console.error('Load market data error:', e)
    } finally {
      setLoading(false)
    }
  }, [keyword])

  useEffect(() => {
    loadData()
    wsService.connect()
    wsService.subscribeTicker()
    wsService.on('market:ticker', (data: any) => {
      if (data) {
        setDrugs(prev => prev.map(d => {
          const tickerItem = Array.isArray(data) ? data.find((t: any) => String(t.drugId) === String(d.id)) : null
          if (tickerItem) {
            return { ...d, sellingPrice: tickerItem.price || d.sellingPrice, change: tickerItem.change || d.change, changePercent: tickerItem.changePercent || d.changePercent }
          }
          return d
        }))
      }
    })
    return () => {
      wsService.unsubscribeTicker()
    }
  }, [loadData])

  const filteredDrugs = activeTab === 'hot'
    ? hotDrugs
    : drugs.filter(d => {
        if (activeTab === 'funding') return d.status === 'funding'
        if (activeTab === 'selling') return d.status === 'selling'
        return true
      })

  return (
    <div className="mobile-home">
      <div className="mobile-home-header">
        <div className="mobile-home-header-top">
          <img src={logoPng} alt="零钱保" className="mobile-home-logo" />
        </div>
        <div className="mobile-home-search">
          <SearchBar
            placeholder="搜索药品名称/代码"
            value={keyword}
            onChange={setKeyword}
            onSearch={() => loadData()}
            style={{ '--background': 'rgba(255,255,255,0.06)', '--border-radius': '12px', '--placeholder-color': '#5E6673' } as any}
          />
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{
          '--active-line-color': '#F0B90B',
          '--active-title-color': '#F0B90B',
          '--title-color': '#848E9C',
          '--title-font-size': '14px',
          '--active-title-font-size': '14px',
        } as any}
      >
        <Tabs.Tab title="全部" key="all" />
        <Tabs.Tab title="募资中" key="funding" />
        <Tabs.Tab title="销售中" key="selling" />
        <Tabs.Tab title="热门" key="hot" />
      </Tabs>

      <div className="mobile-home-list">
        {loading ? (
          <div className="mobile-home-skeleton">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-loading" style={{ width: '40%', height: 16, marginBottom: 8 }} />
                <div className="skeleton-loading" style={{ width: '25%', height: 12 }} />
              </div>
            ))}
          </div>
        ) : (
          filteredDrugs.map((drug, index) => (
            <DrugCard
              key={drug.id}
              drug={drug}
              index={index}
              onClick={(id) => navigate(`/m/trade/${id}`)}
            />
          ))
        )}
        {!loading && filteredDrugs.length === 0 && (
          <div className="mobile-home-empty">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="28" stroke="#2B3139" strokeWidth="2" fill="none"/>
                <path d="M24 28h16M24 36h10" stroke="#2B3139" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="44" cy="44" r="10" fill="#F0B90B" opacity="0.15"/>
                <path d="M41 44h6M44 41v6" stroke="#F0B90B" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="empty-text">暂无行情数据</div>
            <div className="empty-hint">下拉刷新试试</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Home
