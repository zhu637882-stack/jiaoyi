import { useMemo } from 'react'
import './style.css'

interface SubscriptionOverviewProps {
  drugName?: string
  purchasePrice?: number
  sellingPrice?: number
  actualSellingPrice?: number
  totalQuantity?: number
  subscribedQuantity?: number
  userSubscription?: {
    quantity: number
    amount: number
    totalProfit: number
  } | null
  loading?: boolean
}

// 计算客户收益率
const calculateCustomerReturn = (
  purchasePrice: number,
  actualSellingPrice: number
): number => {
  if (!purchasePrice || !actualSellingPrice) return 0
  // 合伙收益 = (实际成交价 - 进价) / 进价 * 30%
  const partnershipReturn = ((actualSellingPrice - purchasePrice) / purchasePrice) * 0.3
  // 固定补贴 5% 年化，简化按日显示为 5%/365
  const dailySubsidy = 0.05 / 365
  // 总收益率（日）
  return partnershipReturn + dailySubsidy
}

// 格式化百分比
const formatPercent = (value: number): string => {
  const percent = value * 100
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`
}

// 格式化金额
const formatAmount = (amount: number): string => {
  if (amount >= 10000) {
    return `¥${(amount / 10000).toFixed(2)}万`
  }
  return `¥${amount.toFixed(2)}`
}

const SubscriptionOverview = ({
  drugName,
  purchasePrice = 0,
  sellingPrice = 0,
  actualSellingPrice = 0,
  totalQuantity = 0,
  subscribedQuantity = 0,
  userSubscription,
  loading = false
}: SubscriptionOverviewProps) => {
  // 使用实际成交价（如果有）或估价
  const effectivePrice = actualSellingPrice || sellingPrice
  
  // 计算客户收益率
  const customerReturn = useMemo(() => {
    return calculateCustomerReturn(purchasePrice, effectivePrice)
  }, [purchasePrice, effectivePrice])

  // 计算认购进度
  const subscriptionProgress = useMemo(() => {
    if (!totalQuantity) return 0
    return Math.min((subscribedQuantity / totalQuantity) * 100, 100)
  }, [totalQuantity, subscribedQuantity])

  // 计算用户收益（如果用户有认购）
  const userEstimatedProfit = useMemo(() => {
    if (!userSubscription || !purchasePrice || !effectivePrice) return 0
    // 合伙收益 = 认购金额 * (实际成交价 - 进价) / 进价 * 30%
    const partnershipProfit = userSubscription.amount * ((effectivePrice - purchasePrice) / purchasePrice) * 0.3
    // 固定补贴（简化计算）
    const subsidy = userSubscription.amount * 0.05 / 365
    return partnershipProfit + subsidy
  }, [userSubscription, purchasePrice, effectivePrice])

  if (loading) {
    return (
      <div className="subscription-overview">
        <div className="subscription-overview-loading">
          <div className="loading-spinner" />
          <span>加载中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="subscription-overview">
      {/* 头部 - 药品名称和收益率 */}
      <div className="subscription-header">
        <div className="subscription-drug-name">{drugName || '请选择药品'}</div>
        <div className={`subscription-return ${customerReturn >= 0 ? 'up' : 'down'}`}>
          <span className="return-label">客户收益率</span>
          <span className="return-value">{formatPercent(customerReturn)}</span>
        </div>
      </div>

      {/* 价格信息 */}
      <div className="subscription-prices">
        <div className="price-item">
          <span className="price-label">进价</span>
          <span className="price-value">¥{purchasePrice.toFixed(2)}</span>
        </div>
        <div className="price-item">
          <span className="price-label">{actualSellingPrice ? '实际成交' : '估价'}</span>
          <span className={`price-value ${effectivePrice > purchasePrice ? 'up' : ''}`}>
            ¥{effectivePrice.toFixed(2)}
          </span>
        </div>
        <div className="price-item">
          <span className="price-label">价差收益</span>
          <span className={`price-value ${effectivePrice > purchasePrice ? 'up' : 'down'}`}>
            {formatPercent((effectivePrice - purchasePrice) / purchasePrice)}
          </span>
        </div>
      </div>

      {/* 认购进度 */}
      <div className="subscription-progress-section">
        <div className="progress-header">
          <span className="progress-label">认购进度</span>
          <span className="progress-value">{subscriptionProgress.toFixed(1)}%</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${subscriptionProgress}%` }}
          />
        </div>
        <div className="progress-stats">
          <span>{subscribedQuantity}盒 / {totalQuantity}盒</span>
          <span>剩余 {Math.max(0, totalQuantity - subscribedQuantity)}盒</span>
        </div>
      </div>

      {/* 用户认购信息（如果有） */}
      {userSubscription && (
        <div className="user-subscription-info">
          <div className="user-subscription-header">
            <span className="section-title">我的认购</span>
          </div>
          <div className="user-subscription-stats">
            <div className="user-stat">
              <span className="user-stat-label">认购数量</span>
              <span className="user-stat-value">{userSubscription.quantity}盒</span>
            </div>
            <div className="user-stat">
              <span className="user-stat-label">认购金额</span>
              <span className="user-stat-value">{formatAmount(userSubscription.amount)}</span>
            </div>
            <div className="user-stat">
              <span className="user-stat-label">预估收益</span>
              <span className={`user-stat-value ${userEstimatedProfit >= 0 ? 'up' : 'down'}`}>
                {formatAmount(userEstimatedProfit)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 收益说明 */}
      <div className="return-info">
        <div className="return-info-title">收益构成</div>
        <div className="return-info-item">
          <span className="dot subsidy" />
          <span>固定补贴：5% 年化</span>
        </div>
        <div className="return-info-item">
          <span className="dot partnership" />
          <span>合伙收益：净利润 30%</span>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionOverview
