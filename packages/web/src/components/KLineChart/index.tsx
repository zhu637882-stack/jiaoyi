import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { init, dispose, Chart, KLineData as KLineChartsData, DeepPartial, Styles, DataLoader } from 'klinecharts'
import './style.css'

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

// 周期类型
type PeriodType = '15m' | '1h' | '4h' | '1d' | '1w' | '1mo' | '7d' | '30d' | '90d' | 'all'

interface KLineChartProps {
  data: KLineData[]
  loading?: boolean
  period?: PeriodType
  onPeriodChange?: (period: PeriodType) => void
  drugName?: string
}

// 指标类型
type MainIndicatorKey = 'MA' | 'BOLL'
type SubIndicatorKey = 'MACD' | 'RSI' | 'KDJ'

// 颜色常量 - 统一主题配色
const COLORS = {
  UP: '#00D4AA',
  DOWN: '#FF4D4F',
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
  // 副图 paneId
  const subPaneIdRef = useRef<string | null>(null)

  // 指标状态
  const [activeMainIndicators, setActiveMainIndicators] = useState<MainIndicatorKey[]>(['MA'])
  const [activeSubIndicator, setActiveSubIndicator] = useState<SubIndicatorKey | null>(null)

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

  // 时间周期选项
  const periods = [
    { key: '15m', label: '15分' },
    { key: '1h', label: '1时' },
    { key: '4h', label: '4时' },
    { key: '1d', label: '日线' },
    { key: '1w', label: '周线' },
    { key: '1mo', label: '月线' },
  ] as const

  // 转换数据格式
  const convertedData = useMemo((): KLineChartsData[] => {
    if (!sortedData || sortedData.length === 0) return []
    return sortedData.map(item => ({
      timestamp: item.time * 1000, // 秒转毫秒
      open: Number(item.open),
      close: Number(item.close),
      high: Number(item.high),
      low: Number(item.low),
      volume: Number(item.volume || 0),
      turnover: Number(item.dailySalesRevenue || 0),
    }))
  }, [sortedData])

  // 数据 ref，供 DataLoader 回调使用
  const dataRef = useRef<KLineChartsData[]>([])
  
  // 当 convertedData 变化时更新 ref（使用 useEffect，避免在 render 阶段产生副作用）
  useEffect(() => {
    dataRef.current = convertedData
  }, [convertedData])

  // 初始化图表
  useEffect(() => {
    if (!containerRef.current) return

    const chart = init(containerRef.current, {
      styles: darkThemeConfig,
    })
    
    if (!chart) return
    chartRef.current = chart

    // 【关键】先设置交易对和周期，再设置 DataLoader
    // 因为 setDataLoader 内部会立即调用 resetData，此时需要 symbol/period 已设置
    chart.setSymbol({
      ticker: drugName || 'KLine',
      pricePrecision: 2,
      volumePrecision: 0,
    })
    chart.setPeriod({ type: 'day', span: 1 })

    // 最后设置 DataLoader，此时 resetData 能正确触发 getBars
    const dataLoader: DataLoader = {
      getBars: (params) => {
        // 使用当前数据
        params.callback(dataRef.current, false)
      },
    }
    chart.setDataLoader(dataLoader)

    // 创建成交量指标（副图，始终显示）
    chart.createIndicator('VOL', false, { height: 80 })

    // 创建默认主图指标 MA
    chart.createIndicator('MA', true)

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
    const resizeObserver = new ResizeObserver(() => {
      chart.resize()
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      if (containerRef.current) {
        dispose(containerRef.current)
      }
      chartRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 更新数据 - 调用 resetData 触发 DataLoader 重新加载
  useEffect(() => {
    if (chartRef.current && convertedData.length > 0) {
      // resetData 会触发 DataLoader.getBars
      chartRef.current.resetData()
    }
  }, [convertedData])

  // 切换主图指标
  const toggleMainIndicator = useCallback((name: MainIndicatorKey) => {
    if (!chartRef.current) return
    
    if (activeMainIndicators.includes(name)) {
      // 移除指标
      chartRef.current.removeIndicator({ name })
      setActiveMainIndicators(prev => prev.filter(i => i !== name))
    } else {
      // 添加指标
      chartRef.current.createIndicator(name, true)
      setActiveMainIndicators(prev => [...prev, name])
    }
  }, [activeMainIndicators])

  // 切换副图指标（互斥）
  const toggleSubIndicator = useCallback((name: SubIndicatorKey) => {
    if (!chartRef.current) return
    
    if (activeSubIndicator === name) {
      // 移除当前副图指标
      if (subPaneIdRef.current) {
        chartRef.current.removeIndicator({ paneId: subPaneIdRef.current, name })
      }
      subPaneIdRef.current = null
      setActiveSubIndicator(null)
    } else {
      // 先移除之前的副图指标
      if (activeSubIndicator && subPaneIdRef.current) {
        chartRef.current.removeIndicator({ paneId: subPaneIdRef.current, name: activeSubIndicator })
      }
      // 创建新的副图指标
      const paneId = chartRef.current.createIndicator(name, false, { height: 100 })
      subPaneIdRef.current = paneId
      setActiveSubIndicator(name)
    }
  }, [activeSubIndicator])

  // 切换指标（统一入口）
  const toggleIndicator = useCallback((key: MainIndicatorKey | SubIndicatorKey) => {
    if (key === 'MA' || key === 'BOLL') {
      toggleMainIndicator(key as MainIndicatorKey)
    } else {
      toggleSubIndicator(key as SubIndicatorKey)
    }
  }, [toggleMainIndicator, toggleSubIndicator])

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
          
          {/* 最新价格 + 涨跌 */}
          {displayData && (
            <>
              <span
                className="toolbar-current-price"
                style={{ color: displayData.close >= displayData.open ? COLORS.UP : COLORS.DOWN }}
              >
                ¥{formatValue(displayData.close)}
              </span>
              {changeInfo && (
                <span className={`toolbar-change ${changeInfo.change >= 0 ? 'up' : 'down'}`}>
                  {changeInfo.change >= 0 ? '+' : ''}
                  {formatValue(changeInfo.change)}
                  ({changeInfo.changePercent >= 0 ? '+' : ''}
                  {formatValue(changeInfo.changePercent)}%)
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

          {/* 指标选择器 */}
          <div className="indicator-selector">
            <span className="indicator-label">指标:</span>
            {(['MA', 'MACD', 'RSI', 'KDJ', 'BOLL'] as const).map((key) => {
              const isActive = key === 'MA' || key === 'BOLL'
                ? activeMainIndicators.includes(key as MainIndicatorKey)
                : activeSubIndicator === key
              
              return (
                <button
                  key={key}
                  className={`indicator-btn ${isActive ? 'active' : ''}`}
                  onClick={() => toggleIndicator(key)}
                >
                  {key}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* MA/OHLC 数值显示栏 - 单行紧凑显示 */}
      {displayData && (
        <div className="kline-data-bar">
          <span className="data-date">{displayData.date}</span>
          <span className="data-item">
            <span className="data-label">开</span>
            <span className="data-value">{formatValue(displayData.open)}</span>
          </span>
          <span className="data-item">
            <span className="data-label">高</span>
            <span className="data-value up">{formatValue(displayData.high)}</span>
          </span>
          <span className="data-item">
            <span className="data-label">低</span>
            <span className="data-value down">{formatValue(displayData.low)}</span>
          </span>
          <span className="data-item">
            <span className="data-label">收</span>
            <span className={`data-value ${displayData.close >= displayData.open ? 'up' : 'down'}`}>
              {formatValue(displayData.close)}
            </span>
          </span>
          <span className="data-item">
            <span className="data-label">量</span>
            <span className="data-value">{formatVolume(displayData.volume)}</span>
          </span>
        </div>
      )}

      {/* 图表区域 */}
      <div className="kline-charts-wrapper">
        {/* K线图表容器 */}
        <div
          ref={containerRef}
          className="kline-main-chart"
          style={{
            display: loading || !data || data.length === 0 ? 'none' : 'block',
          }}
        />

        {/* 加载状态 */}
        {loading && (
          <div className="kline-chart-loading">
            <div className="loading-spinner" />
            <span>加载图表数据...</span>
          </div>
        )}

        {/* 空数据状态 */}
        {!loading && (!data || data.length === 0) && (
          <div className="kline-chart-loading">
            <span>暂无数据</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default KLineChart
