import React, { useRef, useCallback, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Subtitle } from '@/app/hooks/use-current-subtitles'
import { cn } from '@/lib/utils'
import SubtitleItem from './item'

interface VirtualizedSubtitleListProps {
  subtitles: Subtitle[]
  height: number | string
  width: number | string
  currentTime?: number | null
  searchText?: string
  className?: string
  onSubtitleClick?: (startTime: number) => void
  sync?: boolean
}

export const VirtualizedSubtitleList = ({
  subtitles,
  height,
  width,
  currentTime,
  searchText = '',
  className,
  onSubtitleClick,
  sync = false,
}: VirtualizedSubtitleListProps) => {
  const parentRef = useRef<HTMLDivElement>(null)
  const heightCache = useRef<Record<number, number>>({})
  const ITEM_GAP = 10
  const isScrollingRef = useRef(false)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const estimateSubtitleHeight = useCallback((text: string) => {
    const baseHeight = 76
    const averageCharsPerLine = 15
    const lineHeight = 20
    const additionalLineHeight = Math.max(0, Math.ceil(text.length / averageCharsPerLine) - 1) * lineHeight
    return baseHeight + additionalLineHeight + ITEM_GAP
  }, [])

  const updateHeight = useCallback((index: number, height: number) => {
    heightCache.current[index] = height + ITEM_GAP
  }, [])

  const virtualizer = useVirtualizer({
    count: subtitles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback((index) => {
      return heightCache.current[index] || estimateSubtitleHeight(subtitles[index].text)
    }, [subtitles, estimateSubtitleHeight]),
    overscan: 10,
    paddingStart: 8,
    paddingEnd: 8,
    measureElement: useCallback((element: Element) => {
      if (element) {
        const index = Number(element.getAttribute('data-index'))
        const height = element.getBoundingClientRect().height
        updateHeight(index, height)
        return height + ITEM_GAP
      }
      return 76 + ITEM_GAP
    }, [updateHeight]),
  })

  const currentIndex = useMemo(() => {
    if (currentTime === undefined || currentTime === null || !subtitles || subtitles.length === 0) return -1
    for (let i = 0; i < subtitles.length; i++) {
      const sub = subtitles[i]
      if (currentTime >= sub.startTime && currentTime <= sub.end) {
        return i
      }
      if (currentTime < sub.startTime) {
        return Math.max(0, i - 1)
      }
    }
    return subtitles.length - 1
  }, [currentTime, subtitles])

  const throttle = (fn: Function, wait: number) => {
    let lastTime = 0
    return (...args: any[]) => {
      const now = Date.now()
      if (now - lastTime >= wait) {
        fn(...args)
        lastTime = now
      }
    }
  }

  const scrollToIndex = useCallback(throttle((index: number) => {
    if (!virtualizer || index === -1 || !parentRef.current) return

    // If already scrolling, ignore new request
    if (isScrollingRef.current) {
      return
    }

    isScrollingRef.current = true

    // Calculate target position
    let targetOffset = 0
    for (let i = 0; i < index; i++) {
      targetOffset += heightCache.current[i] || estimateSubtitleHeight(subtitles[i].text)
    }

    // Get container height and target item height
    const containerHeight = parentRef.current.clientHeight
    const itemHeight = heightCache.current[index] || estimateSubtitleHeight(subtitles[index].text)

    // Calculate final scroll position
    const scrollPosition = targetOffset + (itemHeight / 2) - (containerHeight / 2)

    // Perform the scroll
    parentRef.current.scrollTo({
      top: scrollPosition,
      behavior: 'smooth'
    })

    // Listen for scroll end
    const handleScrollEnd = () => {
      isScrollingRef.current = false
      parentRef.current?.removeEventListener('scroll', handleScrollEnd)
    }

    // Add scroll event listener
    parentRef.current.addEventListener('scroll', handleScrollEnd, { passive: true })

    // Fallback timeout in case scroll event doesn't fire
    const timeout = setTimeout(() => {
      isScrollingRef.current = false
      parentRef.current?.removeEventListener('scroll', handleScrollEnd)
    }, 300)

    // Cleanup
    return () => {
      clearTimeout(timeout)
      parentRef.current?.removeEventListener('scroll', handleScrollEnd)
    }
  }, 300), [virtualizer, subtitles, estimateSubtitleHeight])

  useEffect(() => {
    if (sync && currentIndex !== -1 && currentTime !== undefined && currentTime !== null) {
      scrollToIndex(currentIndex)
    }
  }, [currentIndex, sync, scrollToIndex, currentTime])

  return (
    <div
      ref={parentRef}
      className={cn('h-full overflow-auto bg-card', className)}
      style={{
        height,
        width,
        position: 'relative',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
              cursor: onSubtitleClick ? 'pointer' : 'default',
              padding: '0 8px 0 0',
              boxSizing: 'border-box',
            }}
            onClick={() => onSubtitleClick?.(subtitles[virtualItem.index].startTime)}
          >
            <SubtitleItem
              subtitle={subtitles[virtualItem.index]}
              searchText={searchText}
              onClick={onSubtitleClick}
              isActive={sync && virtualItem.index === currentIndex}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default VirtualizedSubtitleList
