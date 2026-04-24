import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'

/**
 * VirtualList — 通用虚拟滚动组件
 *
 * 原理：
 * 1. 容器设置 height = items.length * itemHeight 保持滚动条正确
 * 2. 监听最近可滚动父元素的 scroll 事件，计算容器在视口中的位置
 * 3. 只渲染可视区域 ± overscan 缓冲区的列表项
 * 4. 使用绝对定位 + transform 控制每项位置
 * 5. 使用 IntersectionObserver 检测尾部哨兵，触发 onEndReached
 */

interface VirtualListProps<T> {
  /** 列表数据 */
  items: T[]
  /** 每项预估高度(px) */
  itemHeight: number
  /** 渲染函数 */
  renderItem: (item: T, index: number) => React.ReactNode
  /** 上下缓冲数量，默认 5 */
  overscan?: number
  /** 容器额外 className */
  className?: string
  /** 列表项的唯一 key 提取函数 */
  keyExtractor?: (item: T, index: number) => string | number
  /** 滚动到底部回调 */
  onEndReached?: () => void
  /** 底部触发阈值(px)，默认 200 */
  endReachedThreshold?: number
}

/**
 * 找到最近的可滚动祖先元素
 */
function getScrollParent(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement
  while (parent) {
    const style = getComputedStyle(parent)
    const overflowY = style.overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent
    }
    parent = parent.parentElement
  }
  return null
}

function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 5,
  className,
  keyExtractor,
  onEndReached,
  endReachedThreshold = 200,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState({ start: 0, end: 20 })

  const totalHeight = items.length * itemHeight

  // 计算可见范围
  const calcRange = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const viewportH = window.innerHeight

    // 容器相对视口的可见区域
    const visibleTop = Math.max(0, -rect.top)
    const visibleBottom = Math.min(totalHeight, viewportH - rect.top)

    if (visibleBottom <= 0 || visibleTop >= totalHeight) {
      // 完全不可见时保留最小渲染范围
      return
    }

    const start = Math.max(0, Math.floor(visibleTop / itemHeight) - overscan)
    const end = Math.min(items.length - 1, Math.ceil(visibleBottom / itemHeight) + overscan)

    setRange(prev => {
      if (prev.start === start && prev.end === end) return prev
      return { start, end }
    })
  }, [items.length, itemHeight, overscan, totalHeight])

  // 监听滚动
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scrollParent = getScrollParent(container)
    const scrollTarget: HTMLElement | Window = scrollParent || window

    const onScroll = () => {
      requestAnimationFrame(calcRange)
    }

    scrollTarget.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })

    // 初始计算
    calcRange()

    return () => {
      scrollTarget.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [calcRange])

  // items 变化时重算
  useEffect(() => {
    calcRange()
  }, [items.length, calcRange])

  // IntersectionObserver 检测底部哨兵 → 触发加载更多
  useEffect(() => {
    if (!onEndReached || !sentinelRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onEndReached()
        }
      },
      { rootMargin: `${endReachedThreshold}px` }
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [onEndReached, endReachedThreshold])

  // 构建可见项
  const visibleItems = useMemo(() => {
    const result: { item: T; index: number }[] = []
    for (let i = range.start; i <= range.end && i < items.length; i++) {
      result.push({ item: items[i], index: i })
    }
    return result
  }, [items, range.start, range.end])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        height: totalHeight,
        overflow: 'hidden',
      }}
    >
      {visibleItems.map(({ item, index }) => (
        <div
          key={keyExtractor ? keyExtractor(item, index) : index}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${index * itemHeight}px)`,
            height: itemHeight,
          }}
        >
          {renderItem(item, index)}
        </div>
      ))}
      {/* 底部哨兵 */}
      {onEndReached && (
        <div
          ref={sentinelRef}
          style={{
            position: 'absolute',
            bottom: 0,
            height: 1,
            width: '100%',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}

export default VirtualList
