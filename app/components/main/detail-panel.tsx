import { Step } from '@/app/actions/types'
import { useClientTranslation } from '@/app/hooks/use-client-translation'
import { useCurrentSubtitles } from '@/app/hooks/use-current-subtitles'
import { useUserStore } from '@/app/stores/use-user-store'
import { useVideoInfoStore } from '@/app/stores/use-video-info-store'
import { fillPrompt } from '@/lib/ai'
import { DETAILED_SUMMARY_SYSTEM_PROMPT_P1, DETAILED_SUMMARY_SYSTEM_PROMPT_P2, DETAILED_SUMMARY_SYSTEM_PROMPT_P3 } from '@/lib/ai/constants'
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

export const DetailPanel = ({
  height,
  className,
}: {
  height: number
  className: string
}) => {
  const currentSubtitles = useCurrentSubtitles()
  const { detail, title, originalSubtitles, updateVideoInfo } =
    useVideoInfoStore((state) => ({
      detail: state.detail,
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
  const detailTitleRef = useRef<HTMLButtonElement>(null)
  const mindmapTitleRef = useRef<HTMLButtonElement>(null)
  const contentWrapperRef = useRef<HTMLDivElement>(null)
  const [contentWrapperHeight, setContentWrapperHeight] = useState(0)
  const [contentHeight, setContentHeight] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)
  const markmapContainerRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState<Step | null>(null)
  const [expandedPanel, setExpandedPanel] = useState<'detail' | 'mindmap' | null>('detail')
  const [isTransitioning, setIsTransitioning] = useState(false)

  const updateHeight = useCallback(() => {
    if (!detailTitleRef.current || !mindmapTitleRef.current || !outerRef.current) return

    // Check if panel is visible
    const isVisible = outerRef.current.offsetParent !== null
    if (!isVisible) return

    // Fixed title height (py-2 = 16px)
    const titleHeight = 42 // text-lg(20px) + py-2(16px) + border(1px) = 42px

    // Calculate total available height of outer container
    const containerPadding = 16 // p-2 = 8px * 2
    const containerGap = 8 // gap-2 = 8px

    // Total available height = container height - two title heights - container padding - gap
    const availableHeight = height - (titleHeight * 2) - containerPadding - containerGap

    setContentWrapperHeight(availableHeight + titleHeight) // Expanded panel total height = content height + title height
    setContentHeight(availableHeight) // Actual content area height
  }, [height])

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

  const [detailCardState, setDetailCardState] = useState(CardState.Action)

  // Step 1: Convert subtitle to narrative
  const { completion: narrativeCompletion, complete: narrativeComplete } = useCompletion({
    api: '/api/completion',
    onFinish: async (prompt, completion) => {
      setProgress(33)
      setCurrentStep(Step.P2)
      await outlineComplete(completion, {
        body: {
          apiKey: apiKey || '',
          model: modelName || '',
          system: fillPrompt(DETAILED_SUMMARY_SYSTEM_PROMPT_P2, {
            targetLanguage: language || 'en',
            subtitle: completion
          }),
        },
      })
    },
    onError: (error) => {
      const errCode = JSON.parse(error.message).error.err_code
      emitter.emit('ToastError', errCode)
      setDetailCardState(CardState.Action)
    }
  })

  // Step 2: Generate outline
  const { completion: outlineCompletion, complete: outlineComplete } = useCompletion({
    api: '/api/completion',
    onFinish: async (prompt, completion) => {
      setProgress(66)
      setCurrentStep(Step.P3)
      const subtitleText = currentSubtitles
        ?.map((subtitle) => subtitle.text)
        .join('\n') || ''
      await detailComplete(subtitleText, {
        body: {
          apiKey: apiKey || '',
          model: modelName || '',
          system: fillPrompt(DETAILED_SUMMARY_SYSTEM_PROMPT_P3, {
            targetLanguage: language || 'en',
            subtitle: subtitleText,
            outline: completion
          }),
        },
      })
    },
    onError: (error) => {
      const errCode = JSON.parse(error.message).error.err_code
      emitter.emit('ToastError', errCode)
      setDetailCardState(CardState.Action)
    }
  })

  // Step 3: Generate detailed summary
  const { completion: detailCompletion, complete: detailComplete } = useCompletion({
    api: '/api/completion',
    onFinish: async (prompt, completion) => {
      completion = completion.replace(/^```.*\n/gm, '').replace(/^```\s*$/gm, '')

      if (completion.length === 0) {
        toast.error(t('home:main.detail.error_generate_detail'))
        setDetailCardState(CardState.Action)
        return
      }

      updateVideoInfo({ detail: completion })
      setDetailCardState(CardState.Action)
      setProgress(100)
      setCurrentStep(Step.DONE)

      toast.success(t('home:main.detail.success_generate_detail'))
      await save(useVideoInfoStore.getState())
    },
    onError: (error) => {
      const errCode = JSON.parse(error.message).error.err_code
      emitter.emit('ToastError', errCode)
      setDetailCardState(CardState.Action)
    }
  })

  const handleGenerateDetail = async () => {
    updateVideoInfo({ detail: '' })
    setDetailCardState(CardState.Loading)
    setProgress(0)
    setCurrentStep(Step.P1)

    try {
      const subtitleText = currentSubtitles
        ?.map((subtitle) => subtitle.text)
        .join('\n') || ''

      await narrativeComplete(subtitleText, {
        body: {
          apiKey: apiKey || '',
          model: modelName || '',
          system: fillPrompt(DETAILED_SUMMARY_SYSTEM_PROMPT_P1, {
            targetLanguage: language || 'en',
            subtitle: subtitleText
          }),
        },
      })
    } catch (error) {
      const errCode = JSON.parse(error as string).error.err_code
      emitter.emit('ToastError', errCode)
    }
  }

  const handleContentChange = useCallback((newContent: string) => {
    updateVideoInfo({ detail: newContent })
    save(useVideoInfoStore.getState())
  }, [updateVideoInfo])

  const getLoadingDescription = useCallback(() => {
    switch (currentStep) {
      case Step.P1:
        return t('home:main.detail.loading_description_p1')
      case Step.P2:
        return t('home:main.detail.loading_description_p2')
      case Step.P3:
        return t('home:main.detail.loading_description_p3')
      default:
        return t('home:main.detail.loading_description')
    }
  }, [currentStep, t])

  const hasDetail = useMemo(() => {
    return (detail && detail.length > 0) || (currentStep === Step.P3 && detailCompletion)
  }, [detail, currentStep, detailCompletion])

  useEffect(() => {
    if (!hasDetail) {
      return
    }
    updateHeight()
  }, [hasDetail, updateHeight])

  const displayContent = currentStep === Step.P3 ? detailCompletion : detail || ''

  const handlePanelToggle = useCallback((panel: 'detail' | 'mindmap') => {
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
      {hasDetail ? (
        <>
          <div
            ref={contentWrapperRef}
            className='group flex flex-col rounded-md transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]'
            style={{
              height: expandedPanel === 'detail' ? `${contentWrapperHeight}px` : '42px',
              transform: `translateY(${expandedPanel === 'detail' ? 0 : 2}px)`,
            }}
          >
            <button
              onClick={() => handlePanelToggle('detail')}
              className={cn(
                'w-full shrink-0 px-4 py-2 text-lg font-medium text-foreground/90 flex items-center justify-between transition-all duration-300',
                'hover:bg-card/50 group-hover:bg-card/30 active:bg-card/60',
                expandedPanel === 'detail' ? 'rounded-t-md shadow-sm' : 'rounded-md',
                isTransitioning && 'pointer-events-none'
              )}
              ref={detailTitleRef}
              disabled={isTransitioning}
            >
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "h-2 w-2 rounded-full transition-all duration-300",
                  expandedPanel === 'detail' ? 'bg-primary scale-110' : 'bg-primary/60'
                )} />
                {t('home:main.detail.detail_summary')}
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-all duration-300 text-foreground/50',
                  expandedPanel === 'detail' ? 'rotate-0' : '-rotate-90',
                  'group-hover:text-foreground/70'
                )}
              />
            </button>
            <div
              className={cn(
                'flex-1 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] bg-card/30',
                expandedPanel === 'detail' ? 'opacity-100 rounded-b-md' : 'opacity-0'
              )}
              style={{
                height: expandedPanel === 'detail' ? `${contentHeight}px` : 0,
                transform: `translateY(${expandedPanel === 'detail' ? 0 : -8}px)`,
              }}
            >
              <div className="h-full p-3">
                <MDRenderer
                  content={displayContent}
                  onRegenerate={handleGenerateDetail}
                  onContentChange={handleContentChange}
                  contentHeight={contentHeight - 24}
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
                {t('home:main.detail.mind_map')}
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
              title: t('home:main.detail.loading'),
              description: getLoadingDescription(),
              progress,
            },
            empty: {
              title: t('home:main.detail.empty_title'),
              description: t('home:main.detail.empty_description'),
            },
            action: {
              title: t('home:main.detail.action_title'),
              description: t('home:main.detail.action_description'),
            },
          }}
          actionText={t('home:main.detail.action_text')}
          onAction={handleGenerateDetail}
          cardState={detailCardState}
          setCardState={setDetailCardState}
        />
      )}
    </div>
  )
}
