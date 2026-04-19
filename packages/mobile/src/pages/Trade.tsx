import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Popup, Toast } from 'antd-mobile'
import { marketApi, drugApi, subscriptionApi, paymentApi } from '../services/api'
import { wsService } from '../services/websocket'
import './Trade.css'

const Trade: React.FC = () => {
  const { drugId } = useParams<{ drugId: string }>()
  const navigate = useNavigate()
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<any>(null)

  const [drug, setDrug] = useState<any>(null)
  const [klineData, setKlineData] = useState<any[]>([])
  const [period, setPeriod] = useState('1d')
  const [showSubscribe, setShowSubscribe] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [subscribeLoading, setSubscribeLoading] = useState(false)
  const [payChannel, setPayChannel] = useState<'balance' | 'alipay' | 'wechat'>('balance')

  useEffect(() => {
    if (!drugId) return
    loadDrugData()
    loadKLineData()
    wsService.connect()
    wsService.subscribeMarket(drugId)
    wsService.on('market:update', (data: any) => {
      if (data && String(data.drugId) === String(drugId)) {
        setDrug((prev: any) => prev ? { ...prev, sellingPrice: data.price || prev.sellingPrice, change: data.change ?? prev.change, changePercent: data.changePercent ?? prev.changePercent } : prev)
      }
    })
    return () => {
      wsService.disconnect()
    }
  }, [drugId])

  useEffect(() => {
    if (klineData.length > 0 && chartRef.current) {
      renderChart()
    }
  }, [klineData])

  const loadDrugData = async () => {
    try {
      const res = await drugApi.getDrugById(drugId!) as any
      const data = res?.data || res
      setDrug(data)
    } catch (e) {
      console.error('Load drug error:', e)
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
    }
  }

  const renderChart = async () => {
    if (!chartRef.current || klineData.length === 0) return

    try {
      const { init, dispose } = await import('klinecharts')
      if (chartInstanceRef.current) {
        dispose(chartRef.current)
      }
      
      // 币安风格K线图配置
      const chart = init(chartRef.current, {
        styles: {
          candle: {
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
                upColor: '#F6465D',
                downColor: '#0ECB81',
                noChangeColor: '#848E9C',
                line: {
                  show: true,
                  style: 'dashed',
                  dashedValue: [4, 4],
                  size: 1,
                },
                text: {
                  show: true,
                  color: '#F0B90B',
                  size: 12,
                  paddingLeft: 4,
                  paddingRight: 4,
                  paddingTop: 4,
                  paddingBottom: 4,
                  borderRadius: 4,
                },
              },
            },
            tooltip: {
              showRule: 'follow_cross',
              showType: 'rect',
              rect: {
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 8,
                paddingBottom: 8,
                offsetLeft: 20,
                offsetTop: 8,
                offsetRight: 20,
                offsetBottom: 8,
                borderRadius: 4,
                borderSize: 1,
                borderColor: '#2B3139',
                color: 'rgba(30, 35, 41, 0.95)',
              },
            },
          },
          grid: {
            show: true,
            horizontal: {
              show: true,
              size: 1,
              color: '#2B3139',
              style: 'solid',
              dashedValue: [2, 2],
            },
            vertical: {
              show: true,
              size: 1,
              color: '#2B3139',
              style: 'solid',
              dashedValue: [2, 2],
            },
          },
          xAxis: {
            show: true,
            size: 'auto',
            axisLine: {
              show: true,
              color: '#2B3139',
              size: 1,
            },
            tickText: {
              show: true,
              color: '#848E9C',
              size: 10,
              family: 'SF Pro Display, -apple-system, sans-serif',
              marginStart: 4,
              marginEnd: 4,
            },
            tickLine: {
              show: false,
            },
          },
          yAxis: {
            show: true,
            size: 'auto',
            axisLine: {
              show: false,
            },
            tickText: {
              show: true,
              color: '#848E9C',
              size: 10,
              family: 'SF Pro Display, -apple-system, sans-serif',
              marginStart: 4,
              marginEnd: 4,
            },
            tickLine: {
              show: false,
            },
          },
          crosshair: {
            show: true,
            horizontal: {
              show: true,
              line: {
                show: true,
                style: 'dashed',
                dashedValue: [4, 4],
                size: 1,
                color: '#F0B90B',
              },
              text: {
                show: true,
                color: '#181A20',
                backgroundColor: '#F0B90B',
                size: 10,
                paddingLeft: 4,
                paddingRight: 4,
                paddingTop: 2,
                paddingBottom: 2,
                borderRadius: 2,
              },
            },
            vertical: {
              show: true,
              line: {
                show: true,
                style: 'dashed',
                dashedValue: [4, 4],
                size: 1,
                color: '#F0B90B',
              },
              text: {
                show: true,
                color: '#181A20',
                backgroundColor: '#F0B90B',
                size: 10,
                paddingLeft: 4,
                paddingRight: 4,
                paddingTop: 2,
                paddingBottom: 2,
                borderRadius: 2,
              },
            },
          },
          separator: {
            size: 1,
            color: '#2B3139',
            fill: true,
          },
        },
      })
      
      chartInstanceRef.current = chart

      const formattedData = klineData.map((item: any) => ({
        timestamp: new Date(item.snapshotDate || item.date || item.timestamp).getTime(),
        open: Number(item.open || item.purchasePrice || 0),
        high: Number(item.high || item.sellingPrice || 0),
        low: Number(item.low || item.purchasePrice || 0),
        close: Number(item.close || item.sellingPrice || 0),
        volume: Number(item.volume || item.dailySales || 0),
      })).filter((d: any) => d.timestamp > 0)

      if (chart) {
        (chart as any).applyNewData(formattedData)
        // 添加MA均线
        ;(chart as any).createIndicator('MA', false, { 
          id: 'candle_pane',
          params: [5, 10, 20],
          styles: {
            lines: [
              { color: '#F0B90B', size: 1 },
              { color: '#848E9C', size: 1 },
              { color: '#0ECB81', size: 1 },
            ],
          },
        })
        // 添加成交量
        ;(chart as any).createIndicator('VOL', true, {
          styles: {
            bars: [
              { upColor: 'rgba(246, 70, 93, 0.6)', downColor: 'rgba(14, 203, 129, 0.6)' },
            ],
          },
        })
      }
    } catch (e) {
      console.error('Render chart error:', e)
    }
  }

  useEffect(() => {
    if (drugId) loadKLineData()
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
        const res = await subscriptionApi.createSubscription({ 
          drugId: String(drugId), 
          quantity: Number(quantity) 
        }) as any
        Toast.show({ content: '认购成功', icon: 'success' })
        setShowSubscribe(false)
        setQuantity('')
        // 刷新药品数据
        loadDrugData()
      } else {
        const res = await paymentApi.createSubscriptionPayment({
          drugId: String(drugId),
          quantity: Number(quantity),
          channel: payChannel,
        }) as any
        const payData = res?.data || res
        // 如果返回了支付链接，需要跳转
        if (payData?.qrUrl || payData?.payUrl) {
          window.open(payData.qrUrl || payData.payUrl, '_blank')
          Toast.show({ content: '请在新窗口完成支付', icon: 'success', duration: 3000 })
          setShowSubscribe(false)
          setQuantity('')
        } else if (payData?.codeUrl) {
          // 微信支付二维码
          Toast.show({ content: '请使用微信扫码支付', icon: 'success', duration: 3000 })
        } else {
          Toast.show({ content: '订单已创建', icon: 'success' })
          setShowSubscribe(false)
          setQuantity('')
        }
      }
    } catch (e: any) {
      console.error('Subscribe error:', e)
      const errorMsg = e?.response?.data?.message || e?.message || '认购失败，请重试'
      Toast.show({ content: errorMsg, icon: 'fail' })
    } finally {
      setSubscribeLoading(false)
    }
  }

  if (!drug) {
    return <div className="mobile-trade-loading">加载中...</div>
  }

  const isUp = (drug.changePercent || 0) >= 0

  return (
    <div className="mobile-trade">
      <div className="mobile-trade-header">
        <div className="mobile-trade-back" onClick={() => navigate(-1)}>←</div>
        <div className="mobile-trade-header-info">
          <div className="mobile-trade-drug-name">{drug.name}</div>
          <div className="mobile-trade-drug-code">{drug.code}</div>
        </div>
      </div>

      <div className="mobile-trade-price-section">
        <div className={`mobile-trade-price ${isUp ? 'up' : 'down'}`}>
          ¥{drug.sellingPrice?.toFixed(2)}
        </div>
        <div className={`mobile-trade-change ${isUp ? 'up' : 'down'}`}>
          {isUp ? '+' : ''}{drug.change?.toFixed(2)} ({isUp ? '+' : ''}{drug.changePercent?.toFixed(2)}%)
        </div>
      </div>

      <div className="mobile-trade-info-row">
        <div className="mobile-trade-info-item">
          <span className="label">进价</span>
          <span className="value">¥{drug.purchasePrice?.toFixed(2)}</span>
        </div>
        <div className="mobile-trade-info-item">
          <span className="label">售价</span>
          <span className="value">¥{drug.sellingPrice?.toFixed(2)}</span>
        </div>
        <div className="mobile-trade-info-item">
          <span className="label">剩余</span>
          <span className="value">{drug.remainingQuantity || 0}</span>
        </div>
      </div>

      <div className="mobile-trade-periods">
        {['1d', '1w', '1M'].map(p => (
          <div
            key={p}
            className={`mobile-trade-period ${period === p ? 'active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {p === '1d' ? '日' : p === '1w' ? '周' : '月'}
          </div>
        ))}
      </div>

      <div className="mobile-trade-chart" ref={chartRef} />

      <div className="mobile-trade-bottom">
        <button
          className="btn-subscribe-binance"
          onClick={() => setShowSubscribe(true)}
        >
          立即认购
        </button>
      </div>

      <Popup
        visible={showSubscribe}
        onMaskClick={() => setShowSubscribe(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: '40vh', background: 'var(--color-bg-secondary)' }}
      >
        <div className="mobile-trade-subscribe">
          <div className="subscribe-header">
            <span>认购 {drug.name}</span>
            <span className="subscribe-close" onClick={() => setShowSubscribe(false)}>✕</span>
          </div>
          <div className="subscribe-info">
            <div>单价：<strong>¥{drug.sellingPrice?.toFixed(2)}</strong></div>
            <div>可用剩余：<strong>{drug.remainingQuantity || 0}</strong></div>
          </div>
          <div className="subscribe-quantity">
            <input
              type="number"
              placeholder="输入认购数量"
              value={quantity}
              onChange={e => setQuantity(e.target.value.replace(/[^0-9]/g, ''))}
              className="subscribe-input"
              min="1"
              max={drug?.remainingQuantity || 999999}
            />
          </div>
          {quantity && Number(quantity) > 0 && (
            <div className="subscribe-total">
              合计：<strong>¥{(Number(quantity) * (drug.sellingPrice || 0)).toFixed(2)}</strong>
            </div>
          )}
          <div className="subscribe-channels">
            <div className={`subscribe-channel ${payChannel === 'balance' ? 'active' : ''}`} onClick={() => setPayChannel('balance')}>
              <span>💰 余额支付</span>
            </div>
            <div className={`subscribe-channel ${payChannel === 'alipay' ? 'active' : ''}`} onClick={() => setPayChannel('alipay')}>
              <span>🔵 支付宝</span>
            </div>
            <div className={`subscribe-channel ${payChannel === 'wechat' ? 'active' : ''}`} onClick={() => setPayChannel('wechat')}>
              <span>🟢 微信支付</span>
            </div>
          </div>
          <button
            className="btn-subscribe-binance"
            disabled={subscribeLoading}
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

export default Trade
