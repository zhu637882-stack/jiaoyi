import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import './GuideOverlay.css'

// ============================================
// 引导步骤配置
// ============================================

interface GuideStep {
  title: string
  description: string
  route: string
}

const steps: GuideStep[] = [
  {
    title: '药品行情',
    description: '实时查看药品价格走势，选择优质认购标的',
    route: '/m',
  },
  {
    title: '在线交易',
    description: '一键充值，选择药品快速认购',
    route: '/m/trade',
  },
  {
    title: '我的持仓',
    description: '查看账户余额、认购记录和收益曲线',
    route: '/m/portfolio',
  },
  {
    title: '个人中心',
    description: '管理账户安全、查看交易明细',
    route: '/m/profile',
  },
]

// ============================================
// 步骤徽章数字
// ============================================

const StepBadge: React.FC<{ step: number }> = ({ step }) => (
  <div className="guide-step-badge">
    <span className="guide-step-badge-text">{step}</span>
  </div>
)

// ============================================
// 引导气泡组件
// ============================================

interface GuideBubbleProps {
  step: GuideStep
  currentStep: number
  totalSteps: number
  isLastStep: boolean
  onNext: () => void
  onSkip: () => void
  arrowLeftPercent: number
}

const GuideBubble: React.FC<GuideBubbleProps> = ({
  step,
  currentStep,
  totalSteps,
  isLastStep,
  onNext,
  onSkip,
  arrowLeftPercent,
}) => {
  return (
    <div className="guide-bubble">
      {/* 跳过按钮 */}
      <button className="guide-skip-btn" onClick={onSkip} type="button">
        跳过
      </button>

      {/* 标题 */}
      <h3 className="guide-bubble-title">{step.title}</h3>

      {/* 描述 */}
      <p className="guide-bubble-desc">{step.description}</p>

      {/* 底部操作区 */}
      <div className="guide-bubble-footer">
        {/* 步骤指示器 */}
        <div className="guide-dots">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <span
              key={idx}
              className={`guide-dot ${idx === currentStep ? 'active' : ''}`}
            />
          ))}
        </div>

        {/* 下一步按钮 */}
        <button
          className="guide-next-btn"
          onClick={onNext}
          type="button"
        >
          {isLastStep ? '开始体验' : '下一步'}
        </button>
      </div>

      {/* 底部三角箭头 - 指向实际Tab位置 */}
      <div className="guide-bubble-arrow" style={{ left: `${arrowLeftPercent}%` }} />
    </div>
  )
}

// ============================================
// 主引导蒙层组件
// ============================================

const GuideOverlay: React.FC = () => {
  const navigate = useNavigate()

  // ---- 状态 ----
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [windowHeight, setWindowHeight] = useState(window.innerHeight)

  // ---- 检查是否需要显示引导 ----
  useEffect(() => {
    try {
      const completed = localStorage.getItem('guide_completed_v3')
      if (completed !== 'true') {
        // 延迟显示，等页面完全渲染后再定位 Tab 元素
        const timer = setTimeout(() => {
          setVisible(true)
        }, 600)
        return () => clearTimeout(timer)
      }
    } catch {
      // localStorage 不可用（如隐私模式），不显示引导
    }
  }, [])

  // ---- 处理跳过 ----
  const handleSkip = useCallback(() => {
    try {
      localStorage.setItem('guide_completed_v3', 'true')
    } catch {
      // localStorage 不可用，忽略
    }
    setExiting(true)
    setTimeout(() => {
      setVisible(false)
    }, 350)
  }, [])

  // ---- 处理下一步 ----
  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      handleSkip()
    }
  }, [currentStep, handleSkip])

  // ---- 获取目标 Tab 元素位置 ----
  const updateTargetRect = useCallback(() => {
    if (!visible) return
    const tabElements = document.querySelectorAll('.mobile-tabbar-item')
    if (tabElements[currentStep]) {
      const rect = tabElements[currentStep].getBoundingClientRect()
      setTargetRect(rect)
      setWindowHeight(window.innerHeight)
    } else {
      // 找不到目标元素时自动跳过引导，避免全屏蒙层拦截点击
      setTargetRect(null)
    }
  }, [visible, currentStep])

  // ---- 如果 targetRect 为 null 超过 1.5 秒，自动关闭引导 ----
  useEffect(() => {
    if (!visible || targetRect !== null) return
    const timer = setTimeout(() => {
      handleSkip()
    }, 1500)
    return () => clearTimeout(timer)
  }, [visible, targetRect, handleSkip])

  // ---- 步骤变化时：先切路由，再定位 ----
  useEffect(() => {
    if (!visible) return
    // 先导航到对应页面
    navigate(steps[currentStep].route, { replace: true })
    // 等待路由切换和页面渲染完成后再定位
    const timer = setTimeout(() => {
      updateTargetRect()
    }, 150)
    return () => clearTimeout(timer)
  }, [currentStep, visible, navigate, updateTargetRect])

  // ---- 窗口/视口变化时更新位置 ----
  useEffect(() => {
    if (!visible) return
    const handleResize = () => {
      setWindowHeight(window.innerHeight)
      updateTargetRect()
    }
    window.addEventListener('resize', handleResize)
    // 处理移动端地址栏显示/隐藏导致的视口变化
    window.addEventListener('scroll', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize)
    }
  }, [visible, updateTargetRect])

  // ---- 渲染 ----
  if (!visible) return null

  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1

  // 如果找不到目标元素，不渲染蒙层（避免拦截所有点击）
  if (!targetRect) return null

  return (
    <div className={`guide-overlay ${exiting ? 'guide-overlay-exit' : ''}`}>
      {/* 高亮区域 - box-shadow 挖洞效果 */}
      {targetRect && (
        <>
          {/* 高亮框本体（透明，仅用于 box-shadow 挖洞） */}
          <div
            className="guide-highlight"
            style={{
              left: targetRect.left - 6,
              top: targetRect.top - 6,
              width: targetRect.width + 12,
              height: targetRect.height + 12,
            }}
          />

          {/* 步骤数字徽章 */}
          <div
            className="guide-step-badge-wrapper"
            style={{
              left: targetRect.right - 10,
              top: targetRect.top - 10,
            }}
          >
            <StepBadge step={currentStep + 1} />
          </div>

          {/* 引导气泡 - 始终水平居中屏幕 */}
          <div
            className="guide-bubble-wrapper"
            style={{
              left: '50%',
              bottom: windowHeight - targetRect.top + 16,
            }}
          >
            <GuideBubble
              step={step}
              currentStep={currentStep}
              totalSteps={steps.length}
              isLastStep={isLastStep}
              onNext={handleNext}
              onSkip={handleSkip}
              arrowLeftPercent={((targetRect.left + targetRect.width / 2) / window.innerWidth) * 100}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default GuideOverlay
