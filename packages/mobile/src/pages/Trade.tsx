import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Toast, Dialog, Popup } from 'antd-mobile'
import { drugApi, subscriptionApi, paymentApi, accountApi } from '../services/api'
import { isWechatBrowser } from '../utils/browser'
import { ensureWechatOpenId, getStoredOpenId, redirectToWechatAuth, extractWechatErrorFromUrl, hasRecentOAuthFailure, clearOAuthFailure } from '../utils/wechat-auth'
import { wsService } from '../services/websocket'
import './Trade.css'

// ============ 类型定义 ============

interface DrugItem {
  id: string
  name: string
  code: string
  spec?: string
  manufacturer?: string
  category?: string
  type?: string
  sellingPrice: number
  purchasePrice: number
  remainingQuantity: number
  totalQuantity: number
  imageUrl?: string
  image?: string
}

// 构建图片URL - 优先使用缩略图（600px，适合详情页），失败回退原图
const buildImageUrls = (url: string | undefined) => {
  if (!url) return { thumb: '', original: '' }
  if (url.startsWith('http://') || url.startsWith('https://')) return { thumb: url, original: url }
  const path = url.startsWith('/') ? url : `/${url}`
  // 详情页缩略图使用 _thumb 后缀（300px），nginx 代理到后端
  const thumb = path.replace(/(\.[^.]+)$/, '_thumb$1')
  return { thumb, original: path }
}

// HeroImage 组件 - 带懒加载、缩略图优先、错误回退
const HeroImage: React.FC<{ drug: DrugItem }> = ({ drug }) => {
  const [loaded, setLoaded] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [useFallback, setUseFallback] = React.useState(false)

  const { thumb: thumbSrc, original: originalSrc } = buildImageUrls(drug.imageUrl || drug.image)
  const src = useFallback ? originalSrc : thumbSrc

  const handleError = () => {
    if (!useFallback && thumbSrc !== originalSrc) {
      console.warn(`详情页缩略图加载失败,回退原图: ${thumbSrc}`)
      setUseFallback(true)
      return
    }
    setError(true)
  }

  if (!thumbSrc || error) {
    return (
      <div className="trade-hero-placeholder">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.5">
          <rect x="5" y="2" width="14" height="20" rx="7" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
    )
  }

  return (
    <>
      {!loaded && (
        <div className="trade-hero-placeholder">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.5">
            <rect x="5" y="2" width="14" height="20" rx="7" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
      )}
      <img
        src={src}
        alt={drug.name}
        className="trade-hero-img"
        style={{ opacity: loaded ? 1 : 0 }}
        onLoad={() => setLoaded(true)}
        onError={handleError}
      />
    </>
  )
}

// ============ 错误边界 ============

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
        <div className="trade-error-fallback">
          <h2 style={{ color: '#ff1744', marginBottom: 16 }}>页面加载出错</h2>
          <p style={{ color: '#888888', marginBottom: 24 }}>{errorMessage}</p>
          <button className="trade-error-reload" onClick={() => window.location.reload()}>
            刷新页面
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ============ 工具函数 ============

const formatPrice = (price: number): string => {
  return price.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const getDrugInitial = (name: string): string => {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}

// ============ 主内容组件 ============

const TradeContent: React.FC = () => {
  const { drugId } = useParams<{ drugId: string }>()
  const navigate = useNavigate()

  const [drug, setDrug] = useState<DrugItem | null>(null)
  const [allDrugs, setAllDrugs] = useState<DrugItem[]>([])
  const [showDrugPicker, setShowDrugPicker] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [balance, setBalance] = useState<any>(null)
  const [subscribeLoading, setSubscribeLoading] = useState(false)
  const [payChannel, setPayChannel] = useState<'balance' | 'wechat'>('balance')
  const [pickerLoading, setPickerLoading] = useState(false)

  // 加载药品数据
  const loadDrug = useCallback(async (id: string) => {
    try {
      const res = await drugApi.getDrugById(id) as any
      const data = res?.data || res
      setDrug({
        id: String(data.id),
        name: data.name || '未知药品',
        code: data.code || '',
        spec: data.spec || data.unit || '',
        manufacturer: data.manufacturer || data.factory || '',
        category: data.category || data.type || '',
        type: data.type || data.category || '',
        imageUrl: data.imageUrl || data.image || '',
        sellingPrice: Number(data.sellingPrice || data.price || 0),
        purchasePrice: Number(data.purchasePrice || data.costPrice || 0),
        remainingQuantity: Number(data.remainingQuantity || 0),
        totalQuantity: Number(data.totalQuantity || data.remainingQuantity || 0),
      })
    } catch (e) {
      console.error('Load drug error:', e)
    }
  }, [])

  // 加载所有药品（用于选择器）
  const loadAllDrugs = useCallback(async () => {
    if (allDrugs.length > 0) return
    setPickerLoading(true)
    try {
      const res = await drugApi.getDrugs({ page: 1, pageSize: 100 }) as any
      const drugsData = res?.data?.items || res?.data || res?.list || res || []
      const arr = Array.isArray(drugsData) ? drugsData : (drugsData?.items ? drugsData.items : [])
      setAllDrugs(arr.map((d: any) => ({
        id: String(d.id),
        name: d.name || '未知药品',
        code: d.code || '',
        spec: d.spec || d.unit || '',
        manufacturer: d.manufacturer || d.factory || '',
        category: d.category || d.type || '',
        type: d.type || d.category || '',
        imageUrl: d.imageUrl || d.image || '',
        sellingPrice: Number(d.sellingPrice || d.price || 0),
        purchasePrice: Number(d.purchasePrice || d.costPrice || 0),
        remainingQuantity: Number(d.remainingQuantity || 0),
        totalQuantity: Number(d.totalQuantity || d.remainingQuantity || 0),
      })))
    } catch (e) {
      console.error('Load all drugs error:', e)
    } finally {
      setPickerLoading(false)
    }
  }, [allDrugs.length])

  // 加载余额
  const loadBalance = useCallback(async () => {
    try {
      const res = await accountApi.getBalance() as any
      setBalance(res?.data || res)
    } catch (e) {
      console.error('Load balance error:', e)
    }
  }, [])

  // 初始化
  useEffect(() => {
    if (isWechatBrowser()) {
      // 先检查OAuth回调错误
      const wechatError = extractWechatErrorFromUrl()
      if (wechatError) {
        Toast.show({ content: wechatError, icon: 'fail', duration: 3000 })
        return
      }
      ensureWechatOpenId()
    }

    let isMounted = true
    const init = async () => {
      if (drugId && isMounted) {
        await loadDrug(drugId)
      }
      if (isMounted) await loadBalance()
    }
    init()

    // WebSocket 价格推送
    if (drugId) {
      try {
        wsService.connect()
        wsService.subscribeMarket(drugId)
        wsService.on('market:update', (data: any) => {
          if (isMounted && data && String(data?.drugId) === String(drugId)) {
            setDrug((prev: DrugItem | null) => prev ? {
              ...prev,
              sellingPrice: data?.price || prev.sellingPrice,
            } : prev)
          }
        })
      } catch (e) {
        console.error('WebSocket error:', e)
      }
    }

    return () => {
      isMounted = false
      try { wsService.disconnect() } catch (e) { /* ignore */ }
    }
  }, [drugId, loadDrug, loadBalance])

  // 打开药品选择器
  const openDrugPicker = async () => {
    await loadAllDrugs()
    setShowDrugPicker(true)
  }

  // 选择药品
  const handleSelectDrug = (selectedDrug: DrugItem) => {
    setDrug(selectedDrug)
    setQuantity('')
    setShowDrugPicker(false)
    // 更新 URL 但不跳转
    window.history.replaceState(null, '', `/m/trade/${selectedDrug.id}`)
    // 重新订阅 WebSocket
    try {
      wsService.subscribeMarket(selectedDrug.id)
    } catch (e) { /* ignore */ }
  }

  // 快捷数量
  const handleQuickQty = (pct: number) => {
    if (!drug || drug.remainingQuantity <= 0) return
    const qty = Math.floor(drug.remainingQuantity * pct)
    setQuantity(String(Math.max(100, qty)))
  }

  // 计算金额
  const totalAmount = useMemo(() => {
    return Number(quantity || 0) * (drug?.sellingPrice || 0)
  }, [quantity, drug?.sellingPrice])

  const estimated = useMemo(() => {
    return totalAmount
  }, [totalAmount])

  const availableBalance = Number(balance?.availableBalance ?? balance?.balance ?? 0)

  // 提交进货
  const handleSubscribe = async () => {
    if (!drug) {
      Toast.show({ content: '请先选择药品', icon: 'fail' })
      return
    }
    if (!quantity || Number(quantity) <= 0) {
      Toast.show({ content: '请输入进货数量', icon: 'fail' })
      return
    }
    if (Number(quantity) < 100) {
      Toast.show({ content: '最小进货数量为100盒', icon: 'fail' })
      return
    }
    if (Number(quantity) > drug.remainingQuantity) {
      Toast.show({ content: '进货数量超过剩余可进货数量', icon: 'fail' })
      return
    }

    setSubscribeLoading(true)
    try {
      if (payChannel === 'balance') {
        const requiredAmount = Number(quantity || 0) * Number(drug.sellingPrice || 0)
        if (requiredAmount > availableBalance) {
          Toast.show({ content: `余额不足，需要 ¥${requiredAmount.toFixed(2)}`, icon: 'fail' })
          setSubscribeLoading(false)
          return
        }
        await subscriptionApi.createSubscription({ drugId: String(drug.id), quantity: Number(quantity) })
        Toast.show({ content: '进货申请已提交', icon: 'success' })
        setQuantity('')
        loadBalance()
      } else {
        // 微信支付
        if (isWechatBrowser()) {
          const openId = getStoredOpenId()
          if (!openId) {
            // 检查是否最近OAuth已失败，避免无限循环
            if (hasRecentOAuthFailure()) {
              Toast.show({ content: '微信授权失败，请5分钟后重试或使用余额支付', icon: 'fail', duration: 3000 })
              setSubscribeLoading(false)
              return
            }
            Toast.show({ content: '正在获取微信授权...', icon: 'loading' })
            // 清除失败记录，允许本次重定向
            clearOAuthFailure()
            redirectToWechatAuth()
            return
          }
          const res = await paymentApi.createSubscriptionJsapiPayment({
            drugId: String(drug.id),
            quantity: Number(quantity),
            openId
          }) as any
          const payData = res?.data || res

          if (payData?.timeStamp && payData?.paySign) {
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
                    title: '进货申请已提交',
                    content: '支付已完成，进货订单已即时生效！可前往「我的进货」页面查看您的进货记录和收入情况。',
                    confirmText: '我知道了',
                  })
                  setQuantity('')
                  loadBalance()
                }
              })
            }
          } else if (payData?.mwebUrl) {
            window.location.href = payData.mwebUrl
          } else if (payData?.codeUrl) {
            window.open(payData.codeUrl, '_blank')
          }
          setQuantity('')
        } else {
          const res = await paymentApi.createSubscriptionPayment({
            drugId: String(drug.id),
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
          setQuantity('')
        }
      }
    } catch (e: any) {
      const errorMsg = e?.response?.data?.message || e?.message || '进货失败，请重试'
      Toast.show({ content: String(errorMsg), icon: 'fail' })
    } finally {
      setSubscribeLoading(false)
    }
  }

  // 获取分类标签
  const getCategoryLabel = (cat?: string): string => {
    const map: Record<string, string> = {
      'otc': 'OTC',
      'OTC': 'OTC',
      'prescription': '处方药',
      '处方药': '处方药',
      'supplement': '保健品',
      '保健品': '保健品',
      'health_supplement': '保健品',
    }
    return map[cat || ''] || 'OTC'
  }

  return (
    <div className="trade-page">
      {/* ===== 顶部导航 ===== */}
      <div className="trade-nav">
        <div className="trade-nav-back" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="trade-nav-title">进货下单</div>
        <div className="trade-nav-placeholder" />
      </div>

      {/* ===== 产品大图展示 - 增强视觉冲击力 ===== */}
      {drug && (
        <div className="trade-hero-image">
          <HeroImage drug={drug} />
          <div className="trade-hero-overlay">
            <div className="trade-hero-price">
              <span className="trade-hero-price-label">进货价</span>
              <span className="trade-hero-price-value">¥{formatPrice(drug.purchasePrice)}</span>
            </div>
          </div>
          <div className="trade-category-badge" style={{
            background: drug.category === 'prescription' || drug.category === '处方药' 
              ? 'rgba(239, 68, 68, 0.95)' 
              : drug.category === 'supplement' || drug.category === '保健品' || drug.category === 'health_supplement'
              ? 'rgba(240, 185, 11, 0.95)'
              : 'rgba(16, 185, 129, 0.95)',
            color: '#fff'
          }}>
            {getCategoryLabel(drug.category)}
          </div>
        </div>
      )}

      {/* ===== 产品详细信息卡片 - 整合优化 ===== */}
      {drug && (
        <div className="trade-drug-detail-card">
          <div className="trade-drug-detail-header">
            <div className="trade-drug-detail-name">{drug.name}</div>
            {drug.code && <div className="trade-drug-detail-code">{drug.code}</div>}
          </div>
          <div className="trade-drug-detail-grid">
            {drug.spec && (
              <div className="trade-drug-detail-item">
                <span className="trade-drug-detail-label">规格</span>
                <span className="trade-drug-detail-value">{drug.spec}</span>
              </div>
            )}
            {drug.manufacturer && (
              <div className="trade-drug-detail-item">
                <span className="trade-drug-detail-label">厂家</span>
                <span className="trade-drug-detail-value">{drug.manufacturer}</span>
              </div>
            )}
            <div className="trade-drug-detail-item highlight">
              <span className="trade-drug-detail-label">销售价</span>
              <span className="trade-drug-detail-value" style={{ color: 'var(--color-up)' }}>¥{formatPrice(drug.sellingPrice)}</span>
            </div>
            <div className="trade-drug-detail-item">
              <span className="trade-drug-detail-label">库存</span>
              <span className={`trade-drug-detail-value ${drug.remainingQuantity < drug.totalQuantity * 0.1 ? 'low-stock' : ''}`}>
                {drug.remainingQuantity} 盒
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ===== 药品选择卡片 ===== */}
      <div className="trade-drug-card" onClick={openDrugPicker}>
        <div className="trade-drug-label">切换药品</div>
        {drug ? (
          <div className="trade-drug-selected">
            <div className="trade-drug-icon">{getDrugInitial(drug.name)}</div>
            <div className="trade-drug-info">
              <div className="trade-drug-name">{drug.name}</div>
              <div className="trade-drug-spec">{drug.spec || drug.code}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#848E9C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        ) : (
          <div className="trade-drug-placeholder">
            <span>请选择要进货的药品</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#848E9C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        )}
      </div>

      {/* ===== 数量输入区域 ===== */}
      <div className="trade-quantity-section">
        <div className="trade-section-label">进货数量</div>
        <div className="trade-quantity-input-wrap">
          <input
            type="number"
            className="trade-quantity-input"
            value={quantity}
            onChange={e => setQuantity(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="0"
            min="100"
          />
          <span className="trade-quantity-unit">盒</span>
        </div>
        {drug && (
          <div className={`trade-quantity-hint ${drug.totalQuantity > 0 && drug.remainingQuantity / drug.totalQuantity < 0.1 ? 'low-stock' : ''}`}>
            剩余可购: {drug.remainingQuantity}盒
          </div>
        )}
        <div className="trade-quick-btns">
          {[
            { label: '25%', value: 0.25 },
            { label: '50%', value: 0.5 },
            { label: '75%', value: 0.75 },
            { label: '100%', value: 1 },
          ].map(btn => (
            <button
              key={btn.label}
              className="trade-quick-btn"
              onClick={() => handleQuickQty(btn.value)}
              disabled={!drug || drug.remainingQuantity <= 0}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== 价格信息区域 ===== */}
      <div className="trade-price-card">
        <div className="trade-price-row">
          <span className="trade-price-label">单价</span>
          <span className="trade-price-value">
            ¥{drug ? formatPrice(drug.sellingPrice) : '--'}
          </span>
        </div>
        <div className="trade-price-row">
          <span className="trade-price-label">总金额</span>
          <span className="trade-price-value">
            ¥{totalAmount > 0 ? formatPrice(totalAmount) : '--'}
          </span>
        </div>
        <div className="trade-price-row highlight">
          <span className="trade-price-label">预计到账</span>
          <span className="trade-price-value accent">
            ¥{estimated > 0 ? formatPrice(estimated) : '--'}
          </span>
        </div>
      </div>

      {/* ===== 支付方式 ===== */}
      <div className="trade-pay-section">
        <div className="trade-section-label">支付方式</div>
        <div className="trade-pay-channels">
          <div
            className={`trade-pay-channel ${payChannel === 'balance' ? 'active' : ''}`}
            onClick={() => setPayChannel('balance')}
          >
            <div className="trade-pay-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#F0B90B"/>
                <text x="12" y="16" textAnchor="middle" fill="#0B0E11" fontSize="12" fontWeight="bold">¥</text>
              </svg>
            </div>
            <div className="trade-pay-channel-info">
              <span className="trade-pay-channel-name">余额支付</span>
              <span className="trade-pay-channel-balance">¥{formatPrice(availableBalance)}</span>
            </div>
          </div>
          <div
            className={`trade-pay-channel ${payChannel === 'wechat' ? 'active' : ''}`}
            onClick={() => setPayChannel('wechat')}
          >
            <div className="trade-pay-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#07C160"/>
                <path d="M8 10c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm6 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z" fill="#fff"/>
              </svg>
            </div>
            <div className="trade-pay-channel-info">
              <span className="trade-pay-channel-name">微信支付</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 底部操作区 ===== */}
      <div className="trade-bottom-fixed">
        <button
          className="trade-confirm-btn"
          disabled={subscribeLoading || !drug || !quantity || Number(quantity) <= 0}
          onClick={handleSubscribe}
        >
          {subscribeLoading ? '提交中...' : '确认进货'}
        </button>
      </div>

      {/* ===== 药品选择器弹窗 ===== */}
      <Popup
        visible={showDrugPicker}
        onMaskClick={() => setShowDrugPicker(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, background: '#1E2026', maxHeight: '70vh' }}
      >
        <div className="trade-picker">
          <div className="trade-picker-header">
            <span className="trade-picker-title">选择药品</span>
            <span className="trade-picker-close" onClick={() => setShowDrugPicker(false)}>✕</span>
          </div>
          <div className="trade-picker-body">
            {pickerLoading ? (
              <div className="trade-picker-loading">
                <div className="trade-picker-spinner" />
                <span>加载中...</span>
              </div>
            ) : (
              <>
                {allDrugs.map(d => (
                  <div
                    key={d.id}
                    className={`trade-picker-item ${drug?.id === d.id ? 'active' : ''}`}
                    onClick={() => handleSelectDrug(d)}
                  >
                    <div className="trade-picker-item-icon">{getDrugInitial(d.name)}</div>
                    <div className="trade-picker-item-info">
                      <div className="trade-picker-item-name">{d.name}</div>
                      <div className={`trade-picker-item-spec ${d.totalQuantity > 0 && d.remainingQuantity / d.totalQuantity < 0.1 ? 'low-stock' : ''}`}>{d.spec || d.code} · 剩余可购: {d.remainingQuantity}盒</div>
                    </div>
                    <div className="trade-picker-item-price">¥{formatPrice(d.sellingPrice)}</div>
                  </div>
                ))}
                {allDrugs.length === 0 && (
                  <div className="trade-picker-empty">暂无可进货药品</div>
                )}
              </>
            )}
          </div>
        </div>
      </Popup>
    </div>
  )
}

// ============ 导出带错误边界的组件 ============

const Trade: React.FC = () => {
  return (
    <TradeErrorBoundary>
      <TradeContent />
    </TradeErrorBoundary>
  )
}

export default Trade
