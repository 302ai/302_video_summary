import { useEffect, useRef, type RefObject } from 'react'

interface ScrollToBottomOptions {
  enabled?: boolean
}

export function useScrollToBottom<T extends HTMLElement>(
  options: ScrollToBottomOptions = {}
): [RefObject<T>, RefObject<T>] {
  const { enabled = true } = options
  const containerRef = useRef<T>(null)
  const endRef = useRef<T>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !enabled) return

    const scrollToBottom = () => {
      const end = endRef.current
      if (end && document.contains(end)) {
        end.scrollIntoView({ behavior: 'instant', block: 'end' })
      }
    }

    // Create MutationObserver
    const observer = new MutationObserver((mutations) => {
      // Check if content has changed
      const hasContentChange = mutations.some(mutation =>
        mutation.type === 'childList' ||
        mutation.type === 'characterData' ||
        (mutation.type === 'attributes' && mutation.attributeName === 'class')
      )

      if (hasContentChange) {
        // Use requestAnimationFrame to ensure scrolling happens after DOM updates
        requestAnimationFrame(() => {
          setTimeout(scrollToBottom, 100) // Add small delay to ensure content is rendered
        })
      }
    })

    // Observer configuration
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    })

    // Initial scroll
    scrollToBottom()

    return () => observer.disconnect()
  }, [enabled])

  return [containerRef, endRef]
}
