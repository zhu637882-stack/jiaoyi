import { useEffect, useRef, useState, useMemo } from 'react'
import './style.css'

// 动态导入 klinecharts 类型
import type { Chart, KLineData as KLineChartsData, DeepPartial, Styles, DataLoader } from 'klinecharts'

// K线数据接口 - 与后端返回格式一致
export interface KLineData {
  date: string
  time: number // Unix timestamp（秒）
  open: number
  high: number
  low: number
  close: number
  volume: number
  dailySalesQuantity: number
  dailySalesRevenue: number
  averageSellingPrice: number
  dailyReturn: number
  totalFundingAmount: number
  cumulativeReturn: number
  fundingHeat: number
}

// 周期类型 - 简化：只保留日/周/月/年
type PeriodType = '1d' | '1w' | '1mo' | '1y'

interface KLineChartProps {
  data: KLineData[]
  loading?: boolean
  period?: PeriodType
  onPeriodChange?: (period: PeriodType) => void
  drugName?: string
}

// 颜色常量 - 币安风格：涨红跌绿
const COLORS = {
  UP: '#cf1322',
  DOWN: '#00b96b',
  TEXT: '#8B949E',
  TEXT_LIGHT: '#E6EDF3',
  GRID: '#21262D',
  BORDER: '#30363D',
  BG: '#0D1117',
}

// 深色主题配置
const darkThemeConfig: DeepPartial<Styles> = {
  grid: {
    show: true,
    horizontal: {
      show: true,
      color: COLORS.GRID,
      size: 1,
      style: 'dashed',
      dashedValue: [2, 2],
    },
    vertical: {
      show: true,
      color: COLORS.GRID,
      size: 1,
      style: 'dashed',
      dashedValue: [2, 2],
    },
  },
  candle: {
    type: 'candle_solid',
    bar: {
      upColor: COLORS.UP,
      downColor: COLORS.DOWN,
      noChangeColor: '#8B949E',
      upBorderColor: COLORS.UP,
      downBorderColor: COLORS.DOWN,
      noChangeBorderColor: '#8B949E',
      upWickColor: COLORS.UP,
      downWickColor: COLORS.DOWN,
      noChangeWickColor: '#8B949E',
      compareRule: 'current_open',
    },
    priceMark: {
      show: true,
      high: {
        show: true,
        color: COLORS.UP,
      },
      low: {
        show: true,
        color: COLORS.DOWN,
      },
      last: {
        show: true,
        upColor: COLORS.UP,
        downColor: COLORS.DOWN,
        noChangeColor: '#8B949E',
        line: {
          show: true,
          style: 'dashed',
          size: 1,
          dashedValue: [4, 2],
        },
        text: {
          show: true,
          color: COLORS.TEXT_LIGHT,
          borderColor: COLORS.BORDER,
          borderRadius: 4,
        },
      },
    },
    tooltip: {
      showRule: 'follow_cross',
      showType: 'standard',
    },
  },
  indicator: {
    lastValueMark: {
      show: true,
      text: {
        show: true,
        color: COLORS.TEXT_LIGHT,
        borderColor: COLORS.BORDER,
        borderRadius: 4,
      },
    },
    tooltip: {
      showRule: 'follow_cross',
      showType: 'standard',
    },
  },
  xAxis: {
    show: true,
    axisLine: {
      show: true,
      color: COLORS.BORDER,
      size: 1,
    },
    tickLine: {
      show: true,
      color: COLORS.BORDER,
      size: 1,
      length: 4,
    },
    tickText: {
      show: true,
      color: COLORS.TEXT,
      size: 11,
      family: 'SF Mono, Monaco, monospace',
    },
  },
  yAxis: {
    show: true,
    axisLine: {
      show: true,
      color: COLORS.BORDER,
      size: 1,
    },
    tickLine: {
      show: true,
      color: COLORS.BORDER,
      size: 1,
      length: 4,
    },
    tickText: {
      show: true,
      color: COLORS.TEXT,
      size: 11,
      family: 'SF Mono, Monaco, monospace',
    },
  },
  crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: {
        show: true,
        color: COLORS.BORDER,
        style: 'dashed',
        size: 1,
        dashedValue: [4, 2],
      },
      text: {
        show: true,
        color: COLORS.TEXT_LIGHT,
        borderColor: COLORS.BORDER,
        borderRadius: 4,
      },
    },
    vertical: {
      show: true,
      line: {
        show: true,
        color: COLORS.BORDER,
        style: 'dashed',
        size: 1,
        dashedValue: [4, 2],
      },
      text: {
        show: true,
        color: COLORS.TEXT_LIGHT,
        borderColor: COLORS.BORDER,
        borderRadius: 4,
      },
    },
  },
  separator: {
    size: 1,
    color: COLORS.GRID,
    fill: false,
    activeBackgroundColor: COLORS.GRID,
  },
}

const KLineChart = ({
  data,
  loading = false,
  period = '1d',
  onPeriodChange,
  drugName,
}: KLineChartProps) => {
  // DOM ref
  const containerRef = useRef<HTMLDivElement>(null)
  // Chart instance ref
  const chartRef = useRef<Chart | null>(null)

  // klinecharts 模块 ref
  const klinechartsRef = useRef<typeof import('klinecharts') | null>(null)

  // klinecharts 加载状态
  const [klineLoading, setKlineLoading] = useState(true)

  // 当前数据点信息（鼠标hover时的数据）
  const [currentData, setCurrentData] = useState<{
    open: number
    high: number
    low: number
    close: number
    volume: number
    date: string
    cumulativeReturn?: number
    fundingHeat?: number
    dailyReturn?: number
    totalFundingAmount?: number
  } | null>(null)

  // 确保数据按时间升序排列
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return data
    return [...data].sort((a, b) => a.time - b.time)
  }, [data])

  // 时间周期选项 - 简化：只保留日/周/月/年
  const periods = [
    { key: '1d' as const, label: '日' },
    { key: '1w' as const, label: '周' },
    { key: '1mo' as const, label: '月' },
    { key: '1y' as const, label: '年' },
  ]

  // 转换数据格式 - 将价格数据转换为客户收益率数据
  // 客户收益率 = (收盘价 - 进价) / 进价 * 30% + 5%年化补贴
  const convertedData = useMemo((): KLineChartsData[] => {
    if (!sortedData || sortedData.length === 0) return []
    
    // 假设进价为第一个开盘价的 80%（如果没有进价数据）
    const basePurchasePrice = sortedData[0]?.open * 0.8 || 10
    
    return sortedData.map(item => {
      // 计算客户收益率（基于价格变动）
      const priceReturn = (item.close - basePurchasePrice) / basePurchasePrice
      const customerReturn = priceReturn * 0.3 + (0.05 / 365) // 30%合伙收益 + 5%年化补贴
      
      // 计算开盘、最高、最低对应的客户收益率
      const openReturn = ((item.open - basePurchasePrice) / basePurchasePrice) * 0.3 + (0.05 / 365)
      const highReturn = ((item.high - basePurchasePrice) / basePurchasePrice) * 0.3 + (0.05 / 365)
      const lowReturn = ((item.low - basePurchasePrice) / basePurchasePrice) * 0.3 + (0.05 / 365)
      
      return {
        timestamp: item.time * 1000, // 秒转毫秒
        open: Number((openReturn * 100).toFixed(4)), // 转为百分比显示
        close: Number((customerReturn * 100).toFixed(4)),
        high: Number((highReturn * 100).toFixed(4)),
        low: Number((lowReturn * 100).toFixed(4)),
        volume: Number(item.volume || 0),
        turnover: Number(item.dailySalesRevenue || 0),
      }
    })
  }, [sortedData])

  // 数据 ref，供 DataLoader 回调使用
  const dataRef = useRef<KLineChartsData[]>([])
  
  // 当 convertedData 变化时更新 ref（使用 useEffect，避免在 render 阶段产生副作用）
  useEffect(() => {
    dataRef.current = convertedData
  }, [convertedData])

  // 动态加载 klinecharts 并初始化图表
  useEffect(() => {
    if (!containerRef.current) return

    let resizeObserver: ResizeObserver | null = null
    let isDisposed = false

    // 动态导入 klinecharts
    const loadKLineCharts = async () => {
      try {
        setKlineLoading(true)
        const klinecharts = await import('klinecharts')
        
        if (isDisposed || !containerRef.current) return
        
        klinechartsRef.current = klinecharts
        const { init } = klinecharts

        const chart = init(containerRef.current!, {
          styles: darkThemeConfig,
        })
        
        if (!chart) return
        chartRef.current = chart
        setKlineLoading(false)

        // 设置右侧偏移距离，最新数据点右侧会有80px的缓冲区
        chart.setOffsetRightDistance(80)

        // 【关键】先设置交易对和周期，再设置 DataLoader
        // 因为 setDataLoader 内部会立即调用 resetData，此时需要 symbol/period 已设置
        chart.setSymbol({
          ticker: drugName || 'KLine',
          pricePrecision: 4, // 收益率显示4位小数
          volumePrecision: 0,
        })
        chart.setPeriod({ type: 'day', span: 1 })

        // 最后设置 DataLoader，此时 resetData 能正确触发 getBars
        const dataLoader: DataLoader = {
          getBars: (params) => {
            // 使用当前数据
            params.callback(dataRef.current, false)
            // 初始化加载后动态调整蜡烛宽度并滚动到最新数据
            setTimeout(() => {
              if (chartRef.current && containerRef.current) {
                const dataCount = dataRef.current.length
                if (dataCount > 0) {
                  const containerWidth = containerRef.current.offsetWidth
                  const availableWidth = containerWidth - 140
                  const idealBarSpace = Math.max(6, Math.min(availableWidth / dataCount, 20))
                  chartRef.current.setBarSpace(idealBarSpace)
                }
                chartRef.current.scrollToRealTime()
              }
            }, 100)
          },
        }
        chart.setDataLoader(dataLoader)

        // 简化：不创建任何指标，只显示K线

        // 订阅十字光标变化事件
        chart.subscribeAction('onCrosshairChange', (params) => {
          const crosshair = params as { dataIndex?: number; kLineData?: KLineChartsData }
          if (crosshair.dataIndex === undefined || crosshair.dataIndex < 0) {
            setCurrentData(null)
            return
          }
          
          const dataIndex = crosshair.dataIndex
          const originalData = sortedData?.[dataIndex]
          
          if (!originalData) {
            setCurrentData(null)
            return
          }

          setCurrentData({
            open: originalData.open,
            high: originalData.high,
            low: originalData.low,
            close: originalData.close,
            volume: originalData.volume,
            date: originalData.date,
            cumulativeReturn: originalData.cumulativeReturn,
            fundingHeat: originalData.fundingHeat,
            dailyReturn: originalData.dailyReturn,
            totalFundingAmount: originalData.totalFundingAmount,
          })
        })

        // 响应式处理
        resizeObserver = new ResizeObserver(() => {
          chart.resize()
        })
        resizeObserver.observe(containerRef.current)
      } catch (error) {
        console.error('加载 klinecharts 失败:', error)
        setKlineLoading(false)
      }
    }

    loadKLineCharts()

    return () => {
      isDisposed = true
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      if (containerRef.current && klinechartsRef.current) {
        klinechartsRef.current.dispose(containerRef.current)
      }
      chartRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 更新数据 - 调用 resetData 触发 DataLoader 重新加载
  useEffect(() => {
    if (chartRef.current && convertedData.length > 0) {
      chartRef.current.resetData()

      // 动态计算蜡烛宽度，使数据填满整个图表视口
      setTimeout(() => {
        if (chartRef.current && containerRef.current) {
          const containerWidth = containerRef.current.offsetWidth
          const dataCount = convertedData.length
          // 预留右侧80px偏移 + 左侧Y轴约60px
          const availableWidth = containerWidth - 140
          // 计算每根蜡烛的理想宽度（包含间距），限制在合理范围内
          const idealBarSpace = Math.max(6, Math.min(availableWidth / dataCount, 20))
          chartRef.current.setBarSpace(idealBarSpace)
          chartRef.current.scrollToRealTime()
        }
      }, 50)
    }
  }, [convertedData])



  // 格式化数字显示
  const formatValue = (value: number | undefined | null, decimals: number = 2): string => {
    if (value === undefined || value === null) return '-'
    return Number(value || 0).toFixed(decimals)
  }

  const formatVolume = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '-'
    const num = Number(value || 0)
    if (num >= 10000) {
      return (num / 10000).toFixed(2) + '万'
    }
    return num.toFixed(0)
  }

  // 计算最新K线的默认数据（当没有鼠标hover时显示）
  const latestData = useMemo(() => {
    if (!sortedData || sortedData.length === 0) return null

    const lastCandle = sortedData[sortedData.length - 1]

    return {
      open: lastCandle.open,
      high: lastCandle.high,
      low: lastCandle.low,
      close: lastCandle.close,
      volume: lastCandle.volume,
      date: lastCandle.date,
      cumulativeReturn: lastCandle.cumulativeReturn,
      fundingHeat: lastCandle.fundingHeat,
      dailyReturn: lastCandle.dailyReturn,
      totalFundingAmount: lastCandle.totalFundingAmount,
    }
  }, [sortedData])

  // 实际显示的数据：优先使用 currentData（hover时），否则使用 latestData
  const displayData = currentData || latestData

  // 计算涨跌幅
  const calcChange = (data: NonNullable<typeof currentData>) => {
    if (!sortedData || sortedData.length < 2) return null
    const prevClose = sortedData[sortedData.length - 2]?.close
    if (!prevClose) return null
    const change = data.close - prevClose
    const changePercent = (change / prevClose) * 100
    return { change, changePercent }
  }

  const changeInfo = displayData ? calcChange(displayData) : null

  return (
    <div className="kline-chart-container">
      {/* 工具栏 - 合并周期选择、指标选择和价格信息 */}
      <div className="kline-toolbar">
        <div className="toolbar-left">
          {/* 药品名称 */}
          {drugName && <span className="drug-name">{drugName}</span>}
          
          {/* 客户收益率显示 */}
          {displayData && (
            <>
              <span
                className="toolbar-current-price"
                style={{ color: displayData.close >= 0 ? COLORS.UP : COLORS.DOWN }}
              >
                {displayData.close >= 0 ? '+' : ''}{formatValue(displayData.close)}%
              </span>
              <span className="toolbar-label">客户收益率</span>
              {changeInfo && (
                <span className={`toolbar-change ${changeInfo.change >= 0 ? 'up' : 'down'}`}>
                  {changeInfo.change >= 0 ? '↗' : '↘'}
                  {formatValue(Math.abs(changeInfo.changePercent))}%
                </span>
              )}
            </>
          )}
        </div>
        <div className="toolbar-right">
          {/* 时间周期选择器 */}
          <div className="period-selector">
            {periods.map((p) => (
              <button
                key={p.key}
                className={`period-btn ${period === p.key ? 'active' : ''}`}
                onClick={() => onPeriodChange?.(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>


        </div>
      </div>

      {/* 收益率数据栏 - 显示客户收益率相关信息 */}
      {displayData && (
        <div className="kline-data-bar">
          <span className="data-date">{displayData.date}</span>
          <span className="data-item">
            <span className="data-label">开盘收益</span>
            <span className={`data-value ${displayData.open >= 0 ? 'up' : 'down'}`}>
              {displayData.open >= 0 ? '+' : ''}{formatValue(displayData.open)}%
            </span>
          </span>
          <span className="data-item">
            <span className="data-label">最高收益</span>
            <span className="data-value up">+{formatValue(displayData.high)}%</span>
          </span>
          <span className="data-item">
            <span className="data-label">最低收益</span>
            <span className={`data-value ${displayData.low >= 0 ? 'up' : 'down'}`}>
              {displayData.low >= 0 ? '+' : ''}{formatValue(displayData.low)}%
            </span>
          </span>
          <span className="data-item">
            <span className="data-label">收盘收益</span>
            <span className={`data-value ${displayData.close >= 0 ? 'up' : 'down'}`}>
              {displayData.close >= 0 ? '+' : ''}{formatValue(displayData.close)}%
            </span>
          </span>
          <span className="data-item">
            <span className="data-label">成交量</span>
            <span className="data-value">{formatVolume(displayData.volume)}</span>
          </span>
          {displayData.cumulativeReturn !== undefined && (
            <span className="data-item highlight">
              <span className="data-label">累计收益</span>
              <span className="data-value up">
                +{(displayData.cumulativeReturn * 100).toFixed(2)}%
              </span>
            </span>
          )}
        </div>
      )}

      {/* 图表区域 */}
      <div className="kline-charts-wrapper">
        {/* K线图表容器 */}
        <div
          ref={containerRef}
          className="kline-main-chart"
          style={{
            opacity: loading || klineLoading || !data || data.length === 0 ? 0 : 1,
            visibility: loading || klineLoading || !data || data.length === 0 ? 'hidden' : 'visible',
            transition: 'opacity 0.2s ease'
          }}
        />

        {/* klinecharts 库加载状态 */}
        {klineLoading && (
          <div className="kline-chart-loading">
            <div className="loading-spinner" />
            <span>加载图表组件...</span>
          </div>
        )}

        {/* 数据加载状态 */}
        {!klineLoading && loading && (
          <div className="kline-chart-loading">
            <div className="loading-spinner" />
            <span>加载图表数据...</span>
          </div>
        )}

        {/* 空数据状态 */}
        {!klineLoading && !loading && (!data || data.length === 0) && (
          <div className="kline-chart-loading">
            <span>暂无数据</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default KLineChart
