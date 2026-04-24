import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Popup, Toast, Dialog } from 'antd-mobile'
import { marketApi, drugApi, subscriptionApi, paymentApi, accountApi } from '../services/api'
import { isWechatBrowser, isMobile } from '../utils/browser'
import { ensureWechatOpenId, getStoredOpenId, redirectToWechatAuth } from '../utils/wechat-auth'
import { wsService } from '../services/websocket'
import './Trade.css'

// 认购状态映射
const statusMap: Record<string, { label: string; color: string }> = {
  confirmed: { label: '待生效', color: '#1890FF' },
  effective: { label: '认购中', color: '#F6465D' },
  partial_returned: { label: '部分退回', color: '#F0B90B' },
  returned: { label: '已退回', color: '#848E9C' },
  cancelled: { label: '已取消', color: '#0ECB81' },
  slow_selling_refund: { label: '滞销退款', color: '#722ED1' },
  return_pending: { label: '退回审核中', color: '#FAAD14' },
}

// 错误边界组件
class TradeErrorBoundary extends React.Component<
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
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Trade Error Boundary caught:', error, errorInfo)
  }
  
  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error ? this.state.error.message : '未知错误，请稍后重试'
      return (
        <div style={{ 
          padding: 40, 
          textAlign: 'center', 
          color: '#EAECEF',
          background: '#0B0E11',
          minHeight: '100vh'
        }}>
          <h2 style={{ color: '#F6465D', marginBottom: 16 }}>页面加载出错</h2>
          <p style={{ color: '#848E9C', marginBottom: 24 }}>
            {errorMessage}
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: '#F0B90B',
              border: 'none',
              borderRadius: 8,
              color: '#181A20',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            刷新页面
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const TradeContent: React.FC = () => {
  const { drugId } = useParams<{ drugId: string }>()
  const navigate = useNavigate()
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<any>(null)
  const klinechartsModuleRef = useRef<any>(null)
  const formattedDataRef = useRef<any[]>([])
  const [chartLoading, setChartLoading] = useState(true)

  const [drug, setDrug] = useState<any>(null)
  const [marketData, setMarketData] = useState<any>(null)
  const [klineData, setKlineData] = useState<any[]>([])
  const [klineDataLoaded, setKlineDataLoaded] = useState(false)
  const [period, setPeriod] = useState('1d')
  const [showSubscribe, setShowSubscribe] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [subscribeLoading, setSubscribeLoading] = useState(false)
  const [payChannel, setPayChannel] = useState<'balance' | 'wechat'>('balance')
  const [drugSubscriptions, setDrugSubscriptions] = useState<any[]>([])
  const [balance, setBalance] = useState<any>(null)

  useEffect(() => {
    if (!drugId) return
    
    // 微信浏览器中从URL提取openId（OAuth回调后被动接收）
    if (isWechatBrowser()) {
      ensureWechatOpenId()
    }
    
    let isMounted = true
    
    const initData = async () => {
      try {
        await loadDrugData()
        if (isMounted) await loadKLineData()
        if (isMounted) await loadDrugSubscriptions()
        if (isMounted) await loadBalance()
        if (isMounted) await loadMarketData()
      } catch (e) {
        console.error('Init data error:', e)
      }
    }
    
    initData()
    
    try {
      wsService.connect()
      wsService.subscribeMarket(drugId)
      wsService.on('market:update', (data: any) => {
        if (isMounted && data && String(data?.drugId) === String(drugId)) {
          setDrug((prev: any) => prev ? { 
            ...prev, 
            sellingPrice: data?.price || prev?.sellingPrice, 
            change: data?.change ?? prev?.change, 
            changePercent: data?.changePercent ?? prev?.changePercent 
          } : prev)
        }
      })
    } catch (e) {
      console.error('WebSocket error:', e)
    }
    
    return () => {
      isMounted = false
      try {
        wsService.disconnect()
      } catch (e) {
        console.error('WebSocket disconnect error:', e)
      }
    }
  }, [drugId])

  // 格式化K线数据 - 适配 klinecharts 10.0.0-beta1
  const formattedKlineData = useMemo(() => {
    if (!klineData || klineData.length === 0) return []
    return klineData
      .map((item: any) => ({
        timestamp: Number(item?.time || 0) * 1000, // 秒转毫秒
        open: Number(item?.open || 0),
        high: Number(item?.high || 0),
        low: Number(item?.low || 0),
        close: Number(item?.close || 0),
        volume: Number(item?.volume || 0),
      }))
      .filter((d: any) => d.timestamp > 0)
      .sort((a: any, b: any) => a.timestamp - b.timestamp)
  }, [klineData])

  // 同步到 ref，供 DataLoader 回调使用
  useEffect(() => {
    formattedDataRef.current = formattedKlineData
  }, [formattedKlineData])

  // 初始化K线图 - 使用 DataLoader 模式（与PC端一致）
  useEffect(() => {
    if (!chartContainerRef.current) {
      setChartLoading(false)
      return
    }

    let resizeObserver: ResizeObserver | null = null
    let isDisposed = false

    const initChart = async () => {
      try {
        setChartLoading(true)
        const klinecharts = await import('klinecharts')
        if (isDisposed || !chartContainerRef.current) return

        klinechartsModuleRef.current = klinecharts

        const chart = klinecharts.init(chartContainerRef.current, {
          styles: {
            candle: {
              type: 'candle_solid',
              bar: {
                upColor: '#F6465D',
                downColor: '#0ECB81',
                noChangeColor: '#848E9C',
                upBorderColor: '#F6465D',
                downBorderColor: '#0ECB81',
                noChangeBorderColor: '#848E9C',
                upWickColor: '#F6465D',
                downWickColor: '#0ECB81',
                noChangeWickColor: '#848E9C',
              },
              priceMark: {
                last: {
                  show: true,
                  upColor: '#F6465D',
                  downColor: '#0ECB81',
                  noChangeColor: '#848E9C',
                  line: { show: true, style: 'dashed', dashedValue: [4, 4], size: 1 },
                  text: { show: true, color: '#F0B90B', size: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 4 },
                },
              },
              tooltip: {
                showRule: 'follow_cross',
                showType: 'standard',
              },
            },
            grid: {
              show: true,
              horizontal: { show: true, size: 1, color: '#2B2F36', style: 'dashed', dashedValue: [2, 2] },
              vertical: { show: true, size: 1, color: '#2B2F36', style: 'dashed', dashedValue: [2, 2] },
            },
            xAxis: {
              show: true,
              axisLine: { show: true, color: '#2B2F36', size: 1 },
              tickText: { show: true, color: '#848E9C', size: 10 },
              tickLine: { show: false },
            },
            yAxis: {
              show: true,
              axisLine: { show: false },
              tickText: { show: true, color: '#848E9C', size: 10 },
              tickLine: { show: false },
            },
            crosshair: {
              show: true,
              horizontal: {
                line: { show: true, style: 'dashed', dashedValue: [4, 4], size: 1, color: '#F0B90B' },
                text: { show: true, color: '#181A20', backgroundColor: '#F0B90B', size: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
              },
              vertical: {
                line: { show: true, style: 'dashed', dashedValue: [4, 4], size: 1, color: '#F0B90B' },
                text: { show: true, color: '#181A20', backgroundColor: '#F0B90B', size: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
              },
            },
            separator: { size: 1, color: '#2B2F36', fill: false },
          },
        })

        if (!chart) return
        chartInstanceRef.current = chart

        // 设置交易对和周期（与PC端一致）
        chart.setSymbol({
          ticker: drug?.name || 'KLine',
          pricePrecision: 2,
          volumePrecision: 0,
        })
        chart.setPeriod({ type: 'day', span: 1 })

        // 使用 DataLoader 模式加载数据（与PC端一致）
        chart.setDataLoader({
          getBars: (params: any) => {
            const data = formattedDataRef.current
            if (data && data.length > 0) {
              params.callback(data, false)
              // 自适应蜡烛宽度，滚动到最新数据
              setTimeout(() => {
                if (chartInstanceRef.current && chartContainerRef.current) {
                  const containerWidth = chartContainerRef.current.offsetWidth
                  const availableWidth = containerWidth - 80
                  const idealBarSpace = Math.max(4, Math.min(availableWidth / data.length, 16))
                  chartInstanceRef.current.setBarSpace(idealBarSpace)
                  chartInstanceRef.current.scrollToRealTime()
                }
              }, 100)
            } else {
              params.callback([], false)
            }
          },
        })

        // 响应式处理
        resizeObserver = new ResizeObserver(() => {
          chart.resize()
        })
        resizeObserver.observe(chartContainerRef.current)
      } catch (e) {
        console.error('Init chart error:', e)
      } finally {
        // 确保所有代码路径都能关闭 loading 状态
        setChartLoading(false)
      }
    }

    initChart()

    return () => {
      isDisposed = true
      if (resizeObserver) resizeObserver.disconnect()
      if (chartContainerRef.current && klinechartsModuleRef.current) {
        klinechartsModuleRef.current.dispose(chartContainerRef.current)
      }
      chartInstanceRef.current = null
    }
  }, [])

  // 数据更新时重新加载图表
  useEffect(() => {
    if (chartInstanceRef.current && formattedKlineData.length > 0) {
      chartInstanceRef.current.resetData()
      setTimeout(() => {
        if (chartInstanceRef.current && chartContainerRef.current) {
          const containerWidth = chartContainerRef.current.offsetWidth
          const availableWidth = containerWidth - 80
          const idealBarSpace = Math.max(4, Math.min(availableWidth / formattedKlineData.length, 16))
          chartInstanceRef.current.setBarSpace(idealBarSpace)
          chartInstanceRef.current.scrollToRealTime()
        }
      }, 50)
    }
  }, [formattedKlineData])

  const loadDrugData = async () => {
    try {
      const res = await drugApi.getDrugById(drugId!) as any
      const data = res?.data || res
      setDrug(data)
    } catch (e) {
      console.error('Load drug error:', e)
    }
  }

  const loadMarketData = async () => {
    try {
      const res = await marketApi.getDrugMarket(drugId!) as any
      const data = res?.data || res
      setMarketData(data)
    } catch (e) {
      console.error('Load market data error:', e)
    }
  }

  const loadKLineData = async () => {
    try {
      const res = await marketApi.getDrugKLine(drugId!, period) as any
      const data = res?.data || res?.list || res || []
      const arr = Array.isArray(data) ? data : []
      setKlineData(arr)
    } catch (e) {
      console.error('Load kline error:', e)
    } finally {
      setKlineDataLoaded(true)
    }
  }

  const loadDrugSubscriptions = async () => {
    try {
      const res = await subscriptionApi.getMySubscriptions() as any
      const list = res?.data?.list || res?.data || res?.list || []
      const arr = Array.isArray(list) ? list : []
      const filtered = arr.filter((s: any) => String(s.drugId || s.drug?.id) === String(drugId))
      setDrugSubscriptions(filtered)
    } catch (e) {
      console.error('Load drug subscriptions error:', e)
    }
  }

  const loadBalance = async () => {
    try {
      const res = await accountApi.getBalance() as any
      setBalance(res?.data || res)
    } catch (e) {
      console.error('Load balance error:', e)
    }
  }

  useEffect(() => {
    if (drugId) {
      setKlineDataLoaded(false)
      loadKLineData()
    }
  }, [period, drugId])

  const handleSubscribe = async () => {
    if (!quantity || Number(quantity) <= 0) {
      Toast.show({ content: '请输入认购数量', icon: 'fail' })
      return
    }
    if (Number(quantity) > (drug?.remainingQuantity || 0)) {
      Toast.show({ content: '认购数量超过剩余份额', icon: 'fail' })
      return
    }
    setSubscribeLoading(true)
    try {
      if (payChannel === 'balance') {
        const requiredAmount = Number(quantity || 0) * Number(drug?.sellingPrice || 0)
        if (requiredAmount > Number(availableBalance || 0)) {
          Toast.show({ content: `余额不足，需要 ¥${requiredAmount.toFixed(2)}`, icon: 'fail' })
          setSubscribeLoading(false)
          return
        }
        await subscriptionApi.createSubscription({ drugId: String(drugId), quantity: Number(quantity) })
        Toast.show({ content: '认购成功', icon: 'success' })
        setShowSubscribe(false)
        setQuantity('')
        loadDrugData()
        loadDrugSubscriptions()
        loadBalance()
      } else {
        // 微信支付
        if (payChannel === 'wechat') {
          if (isWechatBrowser()) {
            // 微信浏览器内 → 检查openId，无则跳转OAuth
            const openId = getStoredOpenId()
            if (!openId) {
              Toast.show({ content: '正在获取微信授权...', icon: 'loading' })
              redirectToWechatAuth()
              return
            }
            // 微信浏览器内 → JSAPI支付
            const res = await paymentApi.createSubscriptionJsapiPayment({
              drugId: String(drugId),
              quantity: Number(quantity),
              openId
            }) as any
            const payData = res?.data || res

            if (payData?.timeStamp && payData?.paySign) {
              // JSAPI支付：调用WeixinJSBridge
              if ((window as any).WeixinJSBridge) {
                ;(window as any).WeixinJSBridge.invoke('getBrandWCPayRequest', {
                  appId: payData.appId,
                  timeStamp: payData.timeStamp,
                  nonceStr: payData.nonceStr,
                  package: payData.package,
                  signType: payData.signType,
                  paySign: payData.paySign,
                }, (res: any) => {
                  if (res.err_msg === 'get_brand_wcpay_request:ok') {
                    Dialog.alert({
                      title: '认购成功',
                      content: '支付已完成，认购订单已即时生效！可前往「持仓」页面查看您的认购记录和收益情况。',
                      confirmText: '我知道了',
                    })
                    setShowSubscribe(false)
                    setQuantity('')
                    loadDrugData()
                    loadDrugSubscriptions()
                    loadBalance()
                  }
                })
              }
            } else if (payData?.mwebUrl) {
              // H5支付降级：跳转支付URL
              window.location.href = payData.mwebUrl
            } else if (payData?.codeUrl) {
              // 兜底：二维码
              window.open(payData.codeUrl, '_blank')
            }
            setShowSubscribe(false)
            setQuantity('')
          } else {
            // 非微信浏览器 → 保持原有逻辑（NATIVE二维码）
            const res = await paymentApi.createSubscriptionPayment({
              drugId: String(drugId),
              quantity: Number(quantity),
              channel: 'wechat',
            }) as any
            const payData = res?.data || res
            if (payData?.qrCode) {
              window.open(payData.qrCode, '_blank')
              Toast.show({ content: '请在新窗口完成支付', icon: 'success', duration: 3000 })
            } else if (payData?.codeUrl) {
              Toast.show({ content: '请使用微信扫码支付', icon: 'success', duration: 3000 })
            } else {
              Toast.show({ content: '订单已创建', icon: 'success' })
            }
            setShowSubscribe(false)
            setQuantity('')
          }
        }
      }
    } catch (e: any) {
      const errorMsg = e?.response?.data?.message || e?.message || '认购失败，请重试'
      Toast.show({ content: String(errorMsg), icon: 'fail' })
    } finally {
      setSubscribeLoading(false)
    }
  }

  if (!drug) {
    return (
      <div className="trade-loading">
        <div className="trade-loading-spinner" />
        <div className="trade-loading-text">加载中...</div>
      </div>
    )
  }

  const isUp = (drug.changePercent || 0) >= 0
  const availableBalance = Number(balance?.availableBalance ?? balance?.balance ?? 0)
  const high24h = marketData?.high24h || marketData?.high || drug.sellingPrice || 0
  const low24h = marketData?.low24h || marketData?.low || drug.purchasePrice || 0
  const totalAmount = Number(quantity || 0) * (drug.sellingPrice || 0)

  return (
    <div className="trade-page">
      {/* 导航栏 */}
      <div className="trade-nav">
        <div className="trade-nav-back" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="trade-nav-info">
          <span className="trade-nav-name">{drug.name}</span>
          <span className="trade-nav-code">{drug.code}</span>
        </div>
        <div className="trade-nav-placeholder" />
      </div>

      {/* 价格卡片 */}
      <div className="info-card trade-price-card shutter-card" style={{ animationDelay: '0s' }}>
        <div className="trade-price-main">
          <span className={`trade-price-value ${isUp ? 'up' : 'down'}`}>
            ¥{Number(drug.sellingPrice || 0).toFixed(2)}
          </span>
          <span className={`trade-price-change ${isUp ? 'up' : 'down'}`}>
            {isUp ? '+' : ''}{Number(drug.change || 0).toFixed(2)} ({isUp ? '+' : ''}{Number(drug.changePercent || 0).toFixed(2)}%)
          </span>
        </div>
        <div className="trade-price-stats">
          <div className="trade-stat">
            <span className="trade-stat-label">进价</span>
            <span className="trade-stat-value">¥{Number(drug.purchasePrice || 0).toFixed(2)}</span>
          </div>
          <div className="trade-stat">
            <span className="trade-stat-label">售价</span>
            <span className={`trade-stat-value ${isUp ? 'up' : 'down'}`}>¥{Number(drug.sellingPrice || 0).toFixed(2)}</span>
          </div>
          <div className="trade-stat">
            <span className="trade-stat-label">24h高</span>
            <span className="trade-stat-value">¥{Number(high24h).toFixed(2)}</span>
          </div>
          <div className="trade-stat">
            <span className="trade-stat-label">24h低</span>
            <span className="trade-stat-value">¥{Number(low24h).toFixed(2)}</span>
          </div>
          <div className="trade-stat">
            <span className="trade-stat-label">剩余</span>
            <span className="trade-stat-value">{drug.remainingQuantity || 0}</span>
          </div>
        </div>
      </div>

      {/* K线图卡片 */}
      <div className="info-card trade-chart-card shutter-card" style={{ animationDelay: '0.15s' }}>
        <div className="trade-chart-tabs">
          {[
            { key: '1d', label: '日' },
            { key: '1w', label: '周' },
            { key: '1mo', label: '月' },
            { key: '1y', label: '年' },
          ].map(t => (
            <div
              key={t.key}
              className={`trade-chart-tab ${period === t.key ? 'active' : ''}`}
              onClick={() => setPeriod(t.key)}
            >
              {t.label}
            </div>
          ))}
        </div>
        <div className="trade-chart-wrapper">
          <div
            className="trade-chart"
            ref={chartContainerRef}
            style={{
              opacity: chartLoading || !klineDataLoaded || klineData.length === 0 ? 0 : 1,
              visibility: chartLoading || !klineDataLoaded || klineData.length === 0 ? 'hidden' : 'visible',
              transition: 'opacity 0.2s ease',
            }}
          />
          {(chartLoading || !klineDataLoaded || klineData.length === 0) && (
            <div className="trade-chart-loading">
              {chartLoading && <div className="trade-loading-spinner" />}
              <span>
                {chartLoading ? '加载图表...' : !klineDataLoaded ? '加载K线数据...' : '暂无K线数据'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 认购面板 */}
      <div className="info-card trade-subscribe-card shutter-card" style={{ animationDelay: '0.30s' }}>
        <div className="subscribe-card-header">
          <span className="subscribe-card-title">认购</span>
          <span className="subscribe-card-badge">余额 ¥{Number(availableBalance || 0).toFixed(2)}</span>
        </div>
        <div className="subscribe-price-info">
          <div className="subscribe-price-row">
            <span className="subscribe-price-label">单价</span>
            <span className="subscribe-price-val">¥{Number(drug.sellingPrice || 0).toFixed(2)}</span>
          </div>
          <div className="subscribe-price-row">
            <span className="subscribe-price-label">可购数量</span>
            <span className="subscribe-price-val">{drug.remainingQuantity || 0}</span>
          </div>
          <div className="subscribe-price-row highlight">
            <span className="subscribe-price-label">合计</span>
            <span className="subscribe-price-val profit">¥{Number(totalAmount || 0).toFixed(2)}</span>
          </div>
        </div>
        <div className="subscribe-quantity-section">
          <span className="subscribe-section-label">认购数量</span>
          <div className="subscribe-quantity-control">
            <button className="qty-btn" onClick={() => setQuantity(String(Math.max(1, Number(quantity || 0) - 1)))}>−</button>
            <input
              type="number"
              className="qty-input"
              value={quantity}
              onChange={e => setQuantity(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              min="1"
              max={drug?.remainingQuantity || 999999}
            />
            <button className="qty-btn" onClick={() => setQuantity(String(Math.min(drug?.remainingQuantity || 0, Number(quantity || 0) + 1)))}>+</button>
          </div>
        </div>
        <div className="subscribe-pay-channels">
          <div className={`pay-channel ${payChannel === 'balance' ? 'active' : ''}`} onClick={() => setPayChannel('balance')}>
            <svg className="pay-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#F0B90B"/>
              <text x="12" y="16" textAnchor="middle" fill="#181A20" fontSize="12" fontWeight="bold">¥</text>
            </svg>
            <div className="pay-channel-info">
              <span className="pay-channel-name">余额支付</span>
              <span className="pay-channel-balance">¥{Number(availableBalance || 0).toFixed(2)}</span>
            </div>
          </div>
          <div className={`pay-channel ${payChannel === 'wechat' ? 'active' : ''}`} onClick={() => setPayChannel('wechat')}>
            <svg className="pay-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#07C160"/>
              <path d="M8 10c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm6 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z" fill="#fff"/>
            </svg>
            <div className="pay-channel-info">
              <span className="pay-channel-name">微信支付</span>
            </div>
          </div>
        </div>
        <button
          className="btn-subscribe-confirm"
          disabled={subscribeLoading || !quantity || Number(quantity) <= 0}
          onClick={handleSubscribe}
        >
          {subscribeLoading ? '认购中...' : '确认认购'}
        </button>
      </div>

      {/* 认购历史 */}
      <div className="info-card trade-history-card shutter-card" style={{ animationDelay: '0.45s' }}>
        <div className="trade-section-title">认购记录</div>
        {drugSubscriptions.length === 0 ? (
          <div className="trade-empty">暂无认购记录</div>
        ) : (
          drugSubscriptions.map((sub: any) => {
            const st = statusMap[sub.status] || { label: sub.status, color: '#848E9C' }
            return (
              <div className="trade-history-item" key={sub.id}>
                <div className="history-item-top">
                  <span className="history-order-no">{sub.orderNo || '-'}</span>
                  <span className="history-status-tag" style={{ color: st.color, backgroundColor: `${st.color}20` }}>{st.label}</span>
                </div>
                <div className="history-item-mid">
                  <div className="history-mid-col">
                    <span className="history-mid-label">数量</span>
                    <span className="history-mid-value">{sub.quantity}</span>
                  </div>
                  <div className="history-mid-col">
                    <span className="history-mid-label">金额</span>
                    <span className="history-mid-value">¥{Number(sub.amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="history-mid-col">
                    <span className="history-mid-label">收益</span>
                    <span className={`history-mid-value ${(sub.totalProfit || 0) >= 0 ? 'profit' : 'loss'}`}>
                      ¥{Number(sub.totalProfit || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="history-item-bottom">
                  {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : '-'}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 底部固定栏 */}
      <div className="trade-bottom-bar">
        <button className="btn-trade-subscribe" onClick={() => setShowSubscribe(true)}>
          立即认购
        </button>
      </div>

      {/* 认购弹窗 */}
      <Popup
        visible={showSubscribe}
        onMaskClick={() => setShowSubscribe(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '40vh', background: 'var(--color-bg-secondary)' }}
      >
        <div className="trade-popup">
          <div className="trade-popup-header">
            <span className="trade-popup-title">认购 {drug.name}</span>
            <span className="trade-popup-close" onClick={() => setShowSubscribe(false)}>✕</span>
          </div>
          <div className="trade-popup-info">
            <div className="popup-info-row">
              <span>单价</span>
              <strong>¥{Number(drug.sellingPrice || 0).toFixed(2)}</strong>
            </div>
            <div className="popup-info-row">
              <span>可用余额</span>
              <strong>¥{Number(availableBalance || 0).toFixed(2)}</strong>
            </div>
            <div className="popup-info-row">
              <span>可购数量</span>
              <strong>{drug.remainingQuantity || 0}</strong>
            </div>
          </div>
          <div className="trade-popup-quantity">
            <span className="popup-qty-label">认购数量</span>
            <div className="popup-qty-control">
              <button className="qty-btn" onClick={() => setQuantity(String(Math.max(1, Number(quantity || 0) - 1)))}>−</button>
              <input
                type="number"
                className="qty-input"
                value={quantity}
                onChange={e => setQuantity(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                min="1"
                max={drug?.remainingQuantity || 999999}
              />
              <button className="qty-btn" onClick={() => setQuantity(String(Math.min(drug?.remainingQuantity || 0, Number(quantity || 0) + 1)))}>+</button>
            </div>
          </div>
          {quantity && Number(quantity) > 0 && (
            <div className="trade-popup-total">
              <span>合计</span>
              <span className="popup-total-value">¥{Number(totalAmount || 0).toFixed(2)}</span>
            </div>
          )}
          <div className="trade-popup-channels">
            <div className={`popup-channel ${payChannel === 'balance' ? 'active' : ''}`} onClick={() => setPayChannel('balance')}>余额支付</div>
            <div className={`popup-channel ${payChannel === 'wechat' ? 'active' : ''}`} onClick={() => setPayChannel('wechat')}>微信支付</div>
          </div>
          <button
            className="btn-subscribe-confirm"
            disabled={subscribeLoading || !quantity || Number(quantity) <= 0}
            onClick={handleSubscribe}
            style={{ marginTop: 16 }}
          >
            {subscribeLoading ? '认购中...' : '确认认购'}
          </button>
        </div>
      </Popup>
    </div>
  )
}

// 导出带错误边界的组件
const Trade: React.FC = () => {
  return (
    <TradeErrorBoundary>
      <TradeContent />
    </TradeErrorBoundary>
  )
}

export default Trade
