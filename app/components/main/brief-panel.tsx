import { useClientTranslation } from '@/app/hooks/use-client-translation'
import { useCurrentSubtitles } from '@/app/hooks/use-current-subtitles'
import { useUserStore } from '@/app/stores/use-user-store'
import { useVideoInfoStore } from '@/app/stores/use-video-info-store'
import { fillPrompt } from '@/lib/ai'
import { BRIEF_SUMMARY_SYSTEM_PROMPT } from '@/lib/ai/constants'
import { save } from '@/lib/db'
import { emitter } from '@/lib/mitt'
import { cn } from '@/lib/utils'
import { useCompletion } from 'ai/react'
import { ChevronDown } from 'lucide-react'
import { debounce } from 'radash'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ActionCard, CardState } from '../action-card'
import MDRenderer from '../md-renderer'
import MarkmapRenderer from '../mind-map-renderer'
import { env } from 'next-runtime-env'

export const BriefPanel = ({
  height,
  className,
}: {
  height: number
  className: string
}) => {
  const currentSubtitles = useCurrentSubtitles()
  const { brief, title, originalSubtitles, updateVideoInfo } =
    useVideoInfoStore((state) => ({
      brief: state.brief,
      title: state.title,
      originalSubtitles: state.originalSubtitles,
      updateVideoInfo: state.updateAll,
    }))
  const { language } = useUserStore((state) => ({
    language: state.language,
  }))
  const apiKey = env('NEXT_PUBLIC_API_KEY')
  const modelName = env('NEXT_PUBLIC_MODEL_NAME')
  const { t } = useClientTranslation()
  const outerRef = useRef<HTMLDivElement>(null)
  const briefTitleRef = useRef<HTMLButtonElement>(null)
  const mindmapTitleRef = useRef<HTMLButtonElement>(null)
  const contentWrapperRef = useRef<HTMLDivElement>(null)
  const [contentWrapperHeight, setContentWrapperHeight] = useState(0)
  const [contentHeight, setContentHeight] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)
  const markmapContainerRef = useRef<HTMLDivElement>(null)
  const [expandedPanel, setExpandedPanel] = useState<'brief' | 'mindmap' | null>('brief')
  const [isTransitioning, setIsTransitioning] = useState(false)

  const updateHeight = useCallback(() => {
    if (!briefTitleRef.current || !mindmapTitleRef.current || !outerRef.current) return

    // Check if panel is visible
    const isVisible = outerRef.current.offsetParent !== null
    if (!isVisible) return

    // Fixed title height (py-2 = 16px)
    const titleHeight = 42 // text-lg(20px) + py-2(16px) + border(1px) = 42px

    // Calculate total available space for outer container
    const containerPadding = 16 // p-2 = 8px * 2
    const containerGap = 8 // gap-2 = 8px

    // Total available height = container height - two title heights - container padding - gap
    const availableHeight = height - (titleHeight * 2) - containerPadding - containerGap

    setContentWrapperHeight(availableHeight + titleHeight) // Expanded panel total height = content height + title height
    setContentHeight(availableHeight) // Actual content area height
  }, [height])

  // Width update logic
  useEffect(() => {
    if (!markmapContainerRef.current) return

    const updateWidth = () => {
      if (markmapContainerRef.current) {
        // Get actual container width
        const containerWidth = markmapContainerRef.current.clientWidth
        setContentWidth(containerWidth)
      }
    }

    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(markmapContainerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // Observe visibility changes
  useEffect(() => {
    if (!outerRef.current) return

    const observer = new ResizeObserver(() => {
      updateHeight()
    })

    observer.observe(outerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [updateHeight])

  useEffect(() => {
    if (!outerRef.current) return

    const updateDimensions = debounce({
      delay: 100
    }, () => {
      updateHeight()
      if (markmapContainerRef.current) {
        setContentWidth(markmapContainerRef.current.clientWidth)
      }
    })

    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(outerRef.current)

    // Initial update
    updateDimensions()

    return () => {
      resizeObserver.disconnect()
      updateDimensions.cancel()
    }
  }, [updateHeight])

  const hasSubtitles = useMemo(() => {
    return currentSubtitles.length > 0
  }, [currentSubtitles])

  const [briefCardState, setBriefCardState] = useState(CardState.Action)

  const { completion: briefCompletion, complete: briefComplete } = useCompletion({
    api: '/api/completion',
    onFinish: async (prompt, completion) => {
      completion = completion.replace(/^```.*\n/gm, '').replace(/^```\s*$/gm, '')

      if (completion.length === 0) {
        toast.error(t('home:main.brief.generate_error'))
        setBriefCardState(CardState.Action)
        return
      }

      updateVideoInfo({ brief: completion })
      setBriefCardState(CardState.Action)
      toast.success(t('home:main.brief.generate_success'))
      await save(useVideoInfoStore.getState())
    },
  });

  const hasBrief = useMemo(() => {
    return (brief && brief.length > 0) || briefCompletion
  }, [brief, briefCompletion])

  useEffect(() => {
    if (!hasBrief) return

    updateHeight()
  }, [hasBrief, updateHeight])

  const handleGenerateBrief = async () => {
    updateVideoInfo({ brief: '' })
    setBriefCardState(CardState.Loading)

    try {
      await briefComplete(`Video Title: ${title}\nVideo Subtitles:\n${currentSubtitles
        ?.map((subtitle) => {
          return subtitle.text
        })
        .join('\n') || ''}`,{
        body: {
          apiKey: apiKey || '',
          model: modelName || '',
          system: fillPrompt(BRIEF_SUMMARY_SYSTEM_PROMPT, {
            targetLanguage: language || 'en',
          }),
        },
      })
    } catch (error) {
      const errCode = JSON.parse(error as string).error.err_code
      emitter.emit('ToastError', errCode)
    }
  }

  const handleContentChange = useCallback((newContent: string) => {
    updateVideoInfo({ brief: newContent })
    save(useVideoInfoStore.getState())
  }, [updateVideoInfo])

  const displayContent = briefCompletion || brief || ''

  const handlePanelToggle = useCallback((panel: 'brief' | 'mindmap') => {
    if (isTransitioning) return // Prevent triggering during animation

    setIsTransitioning(true)
    setExpandedPanel(prev => prev === panel ? null : panel)

    // Reset state after animation ends
    setTimeout(() => {
      setIsTransitioning(false)
    }, 300) // Match animation duration
  }, [isTransitioning])

  return (
    <div
      className={cn(
        'flex flex-1 flex-col justify-between gap-2 p-2 overflow-hidden rounded-lg bg-gradient-to-br from-background/50 to-background/30 backdrop-blur-sm border border-border/5',
        className
      )}
      ref={outerRef}
      style={{ height }}
    >
      {hasBrief ? (
        <>
          <div
            ref={contentWrapperRef}
            className='group flex flex-col rounded-md transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]'
            style={{
              height: expandedPanel === 'brief' ? `${contentWrapperHeight}px` : '42px',
              transform: `translateY(${expandedPanel === 'brief' ? 0 : 2}px)`,
            }}
          >
            <button
              onClick={() => handlePanelToggle('brief')}
              className={cn(
                'w-full shrink-0 px-4 py-2 text-lg font-medium text-foreground/90 flex items-center justify-between transition-all duration-300',
                'hover:bg-card/50 group-hover:bg-card/30 active:bg-card/60',
                expandedPanel === 'brief' ? 'rounded-t-md shadow-sm' : 'rounded-md',
                isTransitioning && 'pointer-events-none'
              )}
              ref={briefTitleRef}
              disabled={isTransitioning}
            >
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "h-2 w-2 rounded-full transition-all duration-300",
                  expandedPanel === 'brief' ? 'bg-primary scale-110' : 'bg-primary/60'
                )} />
                {t('home:main.brief.brief_summary')}
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-all duration-300 text-foreground/50',
                  expandedPanel === 'brief' ? 'rotate-0' : '-rotate-90',
                  'group-hover:text-foreground/70'
                )}
              />
            </button>
            <div
              className={cn(
                'flex-1 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] bg-card/30',
                expandedPanel === 'brief' ? 'opacity-100 rounded-b-md' : 'opacity-0'
              )}
              style={{
                height: expandedPanel === 'brief' ? `${contentHeight}px` : 0,
                transform: `translateY(${expandedPanel === 'brief' ? 0 : -8}px)`,
              }}
            >
              <div className="h-full p-3">
                <MDRenderer
                  content={displayContent}
                  onRegenerate={handleGenerateBrief}
                  onContentChange={handleContentChange}
                  contentHeight={contentHeight - 24} // Subtract padding
                  className="h-full"
                />
              </div>
            </div>
          </div>
          <div
            ref={markmapContainerRef}
            className='group flex flex-col rounded-md transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]'
            style={{
              height: expandedPanel === 'mindmap' ? `${contentWrapperHeight}px` : '42px',
              transform: `translateY(${expandedPanel === 'mindmap' ? 0 : 2}px)`,
            }}
          >
            <button
              onClick={() => handlePanelToggle('mindmap')}
              className={cn(
                'w-full shrink-0 px-4 py-2 text-lg font-medium text-foreground/90 flex items-center justify-between transition-all duration-300',
                'hover:bg-card/50 group-hover:bg-card/30 active:bg-card/60',
                expandedPanel === 'mindmap' ? 'rounded-t-md shadow-sm' : 'rounded-md',
                isTransitioning && 'pointer-events-none'
              )}
              ref={mindmapTitleRef}
              disabled={isTransitioning}
            >
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "h-2 w-2 rounded-full transition-all duration-300",
                  expandedPanel === 'mindmap' ? 'bg-primary scale-110' : 'bg-primary/60'
                )} />
                {t('home:main.brief.mind_map')}
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-all duration-300 text-foreground/50',
                  expandedPanel === 'mindmap' ? 'rotate-0' : '-rotate-90',
                  'group-hover:text-foreground/70'
                )}
              />
            </button>
            <div
              className={cn(
                'flex-1 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] bg-card/30',
                expandedPanel === 'mindmap' ? 'opacity-100 rounded-b-md' : 'opacity-0'
              )}
              style={{
                height: expandedPanel === 'mindmap' ? `${contentHeight}px` : 0,
                transform: `translateY(${expandedPanel === 'mindmap' ? 0 : -8}px)`,
              }}
            >
              <div className="h-full w-full">
                <MarkmapRenderer
                  content={displayContent}
                  height={contentHeight}
                  width={contentWidth}
                  className="h-full w-full"
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <ActionCard
          className='flex flex-1 h-full flex-col items-center justify-center rounded-md bg-card/30 hover:bg-card/40 transition-all duration-300'
          stateConfig={{
            loading: {
              title: t('home:main.brief.loading'),
              description: t('home:main.brief.loading_description'),
            },
            empty: {
              title: t('home:main.brief.empty_title'),
              description: t('home:main.brief.empty_description'),
            },
            action: {
              title: t('home:main.brief.action_title'),
              description: t('home:main.brief.action_description'),
            },
          }}
          actionText={t('home:main.brief.action_text')}
          onAction={handleGenerateBrief}
          cardState={briefCardState}
          setCardState={setBriefCardState}
        />
      )}
    </div>
  )
}
