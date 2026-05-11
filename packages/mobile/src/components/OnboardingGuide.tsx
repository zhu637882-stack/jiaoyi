import React, { useState, useEffect, useCallback, useRef } from 'react'
import './OnboardingGuide.css'

// ============================================
// 引导步骤配置
// ============================================

interface OnboardingStep {
  /** 目标元素 CSS 选择器 */
  selector: string
  /** 标题 */
  title: string
  /** 描述 */
  description: string
  /** 气泡出现在目标上方还是下方 */
  placement: 'top' | 'bottom'
}

const STEPS: OnboardingStep[] = [
  {
    selector: '.ticker-card',
    title: '浏览药品',
    description: '选择心仪品种，查看实时行情走势',
    placement: 'bottom',
  },
  {
    selector: '.mobile-tabbar-item:nth-child(2)',
    title: '进入交易',
    description: '进入交易页面认购药品，一键下单',
    placement: 'top',
  },
  {
    selector: '.mobile-tabbar-item:nth-child(3)',
    title: '查看持仓',
    description: '查看持仓收益和到期提醒，掌控资产',
    placement: 'top',
  },
  {
    selector: '.mobile-tabbar-item:nth-child(4)',
    title: '邀请赚钱',
    description: '邀请好友赚返利，提现到账快',
    placement: 'top',
  },
]

const STORAGE_KEY = 'onboarding_completed'

// ============================================
// 主引导蒙层组件
// ============================================

const OnboardingGuide: React.FC = () => {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [animKey, setAnimKey] = useState(0)
  const rafRef = useRef<number>(0)

  // ---- 检查是否需要显示引导 ----
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') return
    } catch {
      return
    }
    // 延迟等页面渲染完成
    const timer = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(timer)
  }, [])

  // ---- 定位目标元素 ----
  const locateTarget = useCallback(() => {
    if (!visible) return
    const step = STEPS[currentStep]
    if (!step) return
    const el = document.querySelector(step.selector)
    if (el) {
      const rect = el.getBoundingClientRect()
      setTargetRect(rect)
    } else {
      setTargetRect(null)
    }
  }, [visible, currentStep])

  // ---- 完成/跳过 ----
  const finish = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch { /* ignore */ }
    setExiting(true)
    setTimeout(() => setVisible(false), 350)
  }, [])

  // ---- 如果 targetRect 为 null 超过 1.5 秒，自动关闭引导 ----
  useEffect(() => {
    if (!visible || targetRect !== null) return
    const timer = setTimeout(() => {
      finish()
    }, 1500)
    return () => clearTimeout(timer)
  }, [visible, targetRect, finish])

  // 步骤变化时重新定位
  useEffect(() => {
    if (!visible) return
    // 等待 DOM 更新
    const timer = setTimeout(locateTarget, 100)
    return () => clearTimeout(timer)
  }, [visible, currentStep, locateTarget])

  // 窗口变化时更新位置
  useEffect(() => {
    if (!visible) return
    const handle = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(locateTarget)
    }
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
      cancelAnimationFrame(rafRef.current)
    }
  }, [visible, locateTarget])

  // ---- 下一步 ----
  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
      setAnimKey(prev => prev + 1)
    } else {
      finish()
    }
  }, [currentStep, finish])

  // ---- 渲染 ----
  if (!visible) return null

  const step = STEPS[currentStep]
  const isLast = currentStep === STEPS.length - 1
  const pad = 8 // 高亮区域内边距

  // 如果找不到目标元素，不渲染蒙层（避免拦截所有点击）
  if (!targetRect) return null

  // 计算气泡位置
  let bubbleStyle: React.CSSProperties = { left: '50%' }
  let arrowDir: 'up' | 'down' = 'down'
  let arrowLeft = 50

  if (targetRect) {
    const centerX = targetRect.left + targetRect.width / 2
    arrowLeft = (centerX / window.innerWidth) * 100

    if (step.placement === 'top') {
      // 气泡在目标上方
      bubbleStyle = {
        left: '50%',
        bottom: window.innerHeight - targetRect.top + pad + 12,
      }
      arrowDir = 'down'
    } else {
      // 气泡在目标下方
      bubbleStyle = {
        left: '50%',
        top: targetRect.bottom + pad + 12,
      }
      arrowDir = 'up'
    }
  }

  return (
    <div
      className={`onboarding-overlay ${exiting ? 'onboarding-overlay-exit' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 高亮挖洞 */}
      {targetRect && (
        <div
          className="onboarding-highlight"
          style={{
            left: targetRect.left - pad,
            top: targetRect.top - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
          }}
        />
      )}

      {/* 气泡 */}
      <div className="onboarding-bubble-wrapper" style={bubbleStyle}>
        <div className="onboarding-bubble step-transition" key={animKey}>
          {/* 标题行 */}
          <div className="onboarding-bubble-header">
            <span className="onboarding-step-number">{currentStep + 1}</span>
            <h3 className="onboarding-bubble-title">{step.title}</h3>
          </div>

          {/* 描述 */}
          <p className="onboarding-bubble-desc">{step.description}</p>

          {/* 底部 */}
          <div className="onboarding-bubble-footer">
            {/* 步骤圆点 */}
            <div className="onboarding-dots">
              {STEPS.map((_, idx) => (
                <span
                  key={idx}
                  className={`onboarding-dot ${idx === currentStep ? 'active' : ''}`}
                />
              ))}
            </div>

            {/* 按钮 */}
            <div className="onboarding-btns">
              {!isLast && (
                <button className="onboarding-skip-btn" onClick={finish} type="button">
                  跳过
                </button>
              )}
              <button className="onboarding-next-btn" onClick={handleNext} type="button">
                {isLast ? '开始体验' : '下一步'}
              </button>
            </div>
          </div>

          {/* 箭头 */}
          {arrowDir === 'down' ? (
            <div className="onboarding-bubble-arrow-down" style={{ left: `${arrowLeft}%`, marginLeft: -8 }} />
          ) : (
            <div className="onboarding-bubble-arrow-up" style={{ left: `${arrowLeft}%`, marginLeft: -8 }} />
          )}
        </div>
      </div>
    </div>
  )
}

export default OnboardingGuide
