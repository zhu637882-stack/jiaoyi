import React from 'react'
import './DrugCard.css'

interface DrugCardProps {
  drug: {
    id: string | number
    name: string
    code: string
    purchasePrice: number
    sellingPrice: number
    change?: number
    changePercent?: number
    status: string
    remainingQuantity?: number
    totalQuantity?: number
    fundingHeat?: number
    dailyReturn?: number
    cumulativeReturn?: number
  }
  index?: number
  onClick: (id: string | number) => void
}

const DrugCard: React.FC<DrugCardProps> = ({ drug, index = 0, onClick }) => {
  const isUp = (drug.changePercent || 0) >= 0

  return (
    <div
      className="drug-card card-hover"
      onClick={() => onClick(drug.id)}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="drug-card-left">
        <div className="drug-card-name">{drug.name}</div>
        <div className="drug-card-meta">
          <span className="drug-card-code">{drug.code}</span>
          {drug.fundingHeat !== undefined && drug.fundingHeat > 0 && (
            <span className="drug-card-heat">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1C5 1 8 4 8 6C8 7.66 6.66 9 5 9C3.34 9 2 7.66 2 6C2 4 5 1 5 1Z" fill="#F6465D" opacity="0.8"/>
              </svg>
              {drug.fundingHeat}
            </span>
          )}
        </div>
      </div>
      <div className="drug-card-center">
        <div className={`drug-card-price ${isUp ? 'rise' : 'fall'}`}>
          ¥{drug.sellingPrice?.toFixed(2)}
        </div>
        <div className="drug-card-info">进 ¥{drug.purchasePrice?.toFixed(2)}</div>
      </div>
      <div className={`drug-card-right ${isUp ? 'up' : 'down'}`}>
        <div className="drug-card-change">
          {isUp ? '+' : ''}{(drug.changePercent || 0).toFixed(2)}%
        </div>
        <div className="drug-card-change-val">
          {isUp ? '+' : ''}{(drug.change || 0).toFixed(2)}
        </div>
      </div>
    </div>
  )
}

export default DrugCard
