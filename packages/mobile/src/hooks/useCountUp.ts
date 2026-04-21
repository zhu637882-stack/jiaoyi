import { useState, useEffect, useRef, useCallback } from 'react'

// ============================================
// 类型定义
// ============================================

export interface UseCountUpOptions {
  /** 动画持续时间（毫秒） */
  duration?: number
  /** 延迟开始时间（毫秒） */
  delay?: number
  /** 缓动函数类型 */
  easing?: 'linear' | 'easeOut' | 'easeInOut' | 'easeOutCubic' | 'easeOutQuart' | 'bounce'
  /** 是否启用千分位分隔符 */
  useGrouping?: boolean
  /** 小数位数 */
  decimals?: number
  /** 前缀（如 ¥、$） */
  prefix?: string
  /** 后缀（如 %） */
  suffix?: string
  /** 是否从0开始计数 */
  startFromZero?: boolean
  /** 起始值（如果不从0开始） */
  startValue?: number
  /** 是否禁用动画 */
  disabled?: boolean
  /** 完成回调 */
  onComplete?: () => void
}

export interface UseCountUpReturn {
  /** 当前动画值 */
  value: number
  /** 格式化后的显示值 */
  displayValue: string
  /** 是否正在动画中 */
  isAnimating: boolean
  /** 重新开始动画 */
  restart: () => void
  /** 跳转到指定值 */
  jumpTo: (value: number) => void
}

// ============================================
// 缓动函数
// ============================================

type EasingFunction = (t: number) => number

const easings: Record<string, EasingFunction> = {
  // 线性
  linear: (t) => t,
  // 缓出
  easeOut: (t) => 1 - Math.pow(1 - t, 2),
  // 缓入缓出
  easeInOut: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  // 缓出三次方（默认，最自然）
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  // 缓出四次方
  easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
  // 弹跳效果
  bounce: (t) => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375
    }
  },
}

// ============================================
// 格式化函数
// ============================================

/**
 * 格式化数字，支持千分位和小数位
 */
function formatNumberInternal(
  value: number,
  options: {
    useGrouping?: boolean
    decimals?: number
    prefix?: string
    suffix?: string
  } = {}
): string {
  const {
    useGrouping = true,
    decimals = 2,
    prefix = '',
    suffix = '',
  } = options

  // 处理小数位 - 强制转 Number 防止字符串等类型导致 .toFixed 报错
  const safeValue = Number(value)
  const fixed = (Number.isFinite(safeValue) ? safeValue : 0).toFixed(decimals)
  
  if (!useGrouping) {
    return `${prefix}${fixed}${suffix}`
  }

  // 千分位分隔
  const [intPart, decPart] = fixed.split('.')
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  
  return `${prefix}${formatted}.${decPart}${suffix}`
}

/**
 * 简化版格式化（保持向后兼容）
 */
function formatCountUpValueInternal(value: number): string {
  // 防御性处理：处理 undefined/null/NaN 等异常值
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return '0.00'
  }
  try {
    return formatNumberInternal(value, { useGrouping: true, decimals: 2 })
  } catch (e) {
    console.error('formatCountUpValue error:', e)
    return '0.00'
  }
}

// ============================================
// CountUp Hook
// ============================================

/**
 * CountUp 数字动画 Hook - 增强版
 * 
 * @example
 * // 基础用法（向后兼容，返回数字）
 * const value = useCountUp(1234.56)
 * 
 * // 完整配置（返回对象）
 * const { value, displayValue, isAnimating, restart } = useCountUpEnhanced(9999.99, {
 *   duration: 1500,
 *   easing: 'bounce',
 *   prefix: '¥',
 *   suffix: '元',
 *   decimals: 2,
 *   useGrouping: true,
 *   onComplete: () => console.log('动画完成')
 * })
 */
function useCountUpEnhanced(
  target: number,
  options: UseCountUpOptions = {}
): UseCountUpReturn {
  const {
    duration = 800,
    delay = 0,
    easing = 'easeOutCubic',
    useGrouping = true,
    decimals = 2,
    prefix = '',
    suffix = '',
    startFromZero = true,
    startValue: customStartValue,
    disabled = false,
    onComplete,
  } = options

  // 计算实际起始值
  const actualStartValue = startFromZero 
    ? 0 
    : (customStartValue ?? 0)

  // 状态
  const [value, setValue] = useState(actualStartValue)
  const [isAnimating, setIsAnimating] = useState(false)
  const [key, setKey] = useState(0) // 用于触发重新动画

  // Refs
  const animationRef = useRef<number>()
  const startTimeRef = useRef<number>()
  const delayTimeoutRef = useRef<NodeJS.Timeout>()

  // 格式化显示值
  const displayValue = formatNumberInternal(value, {
    useGrouping,
    decimals,
    prefix,
    suffix,
  })

  // 动画函数
  const animate = useCallback((timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp
    }

    const elapsed = timestamp - startTimeRef.current
    const progress = Math.min(elapsed / duration, 1)
    
    // 应用缓动函数
    const easingFn = easings[easing] ?? easings.easeOutCubic
    const easedProgress = easingFn(progress)
    
    // 计算当前值
    const currentValue = actualStartValue + (target - actualStartValue) * easedProgress
    setValue(currentValue)

    if (progress < 1) {
      animationRef.current = requestAnimationFrame(animate)
    } else {
      setValue(target)
      setIsAnimating(false)
      onComplete?.()
    }
  }, [target, actualStartValue, duration, easing, onComplete])

  // 开始动画
  useEffect(() => {
    if (disabled) {
      setValue(target)
      return
    }

    // 重置状态
    setValue(actualStartValue)
    setIsAnimating(true)
    startTimeRef.current = undefined

    // 延迟开始
    if (delay > 0) {
      delayTimeoutRef.current = setTimeout(() => {
        animationRef.current = requestAnimationFrame(animate)
      }, delay)
    } else {
      animationRef.current = requestAnimationFrame(animate)
    }

    // 清理函数
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current)
      }
    }
  }, [target, key, disabled, delay, animate, actualStartValue])

  // 重新开始动画
  const restart = useCallback(() => {
    setKey(prev => prev + 1)
  }, [])

  // 跳转到指定值
  const jumpTo = useCallback((newValue: number) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    setValue(newValue)
    setIsAnimating(false)
  }, [])

  return {
    value,
    displayValue,
    isAnimating,
    restart,
    jumpTo,
  }
}

// ============================================
// 向后兼容的 useCountUp Hook
// ============================================

/**
 * useCountUp Hook - 向后兼容版本
 * 
 * 支持两种调用方式：
 * 1. 旧版调用：useCountUp(target, duration?) 返回 number
 * 2. 新版调用：useCountUp(target, options?) 返回 UseCountUpReturn
 * 
 * @param target - 目标值
 * @param durationOrOptions - 持续时间（数字）或配置选项（对象）
 * @returns number 或 UseCountUpReturn
 */
export function useCountUp(
  target: number,
  durationOrOptions?: number | UseCountUpOptions
): number {
  // 防御性处理：确保 target 是有效数字
  const safeTarget = Number.isFinite(target) ? target : 0
  
  // 解析参数
  const options: UseCountUpOptions = typeof durationOrOptions === 'number' 
    ? { duration: durationOrOptions, decimals: 2 }
    : (durationOrOptions || {})

  try {
    const { value } = useCountUpEnhanced(safeTarget, options)
    // 确保返回值始终是有效数字
    return Number.isFinite(value) ? value : safeTarget
  } catch (e) {
    console.error('useCountUp error:', e)
    // 出错时返回目标值作为 fallback
    return safeTarget
  }
}

// ============================================
// 导出
// ============================================

// 默认导出保持向后兼容
export default useCountUp

// 命名导出
export { useCountUpEnhanced }
export const formatNumber = formatNumberInternal
export const formatCountUpValue = formatCountUpValueInternal
