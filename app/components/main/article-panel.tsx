import { useClientTranslation } from '@/app/hooks/use-client-translation'
import { useCurrentSubtitles } from '@/app/hooks/use-current-subtitles'
import { useUserStore } from '@/app/stores/use-user-store'
import { useVideoInfoStore } from '@/app/stores/use-video-info-store'
import { useUIStore } from '@/app/stores/use-ui-store'
import {
  ArticleType,
  generateArticlePrompt,
  processSubtitlesInChunks,
} from '@/lib/ai/article-utils'
import { ArticleTypeOptions, getArticleMergePrompt, getXhsSystemPrompt } from '@/lib/ai/constants'
import { save } from '@/lib/db'
import { emitter } from '@/lib/mitt'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { useCompletion } from 'ai/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import MDRenderer from '../md-renderer'
import { Button } from '@/components/ui/button'
import { useLatest } from 'ahooks'
import { useScrollToBottom } from '@/app/hooks/use-scroll-to-bottom'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Textarea } from '@/components/ui/textarea'
import { ChevronDown } from 'lucide-react'
import { throttle } from 'radash'
import { genImagePrompt } from '@/app/actions/optimize'
import { apiKy } from '@/lib/api/api'
import { env } from 'next-runtime-env'

export const ArticlePanel = ({
  height,
  className,
}: {
  height: number
  className: string
}) => {
  const currentSubtitles = useCurrentSubtitles()
  const { articles, updateVideoInfo, customArticlePrompt } = useVideoInfoStore((state) => ({
    articles: state.articles,
    updateVideoInfo: state.updateAll,
    customArticlePrompt: state.customArticlePrompt,
  }))
  const latestCustomArticlePrompt = useLatest(customArticlePrompt)

  const setCustomArticlePrompt = useCallback((value: string) => {
    updateVideoInfo({ customArticlePrompt: value })
  }, [updateVideoInfo])

  const { language } = useUserStore((state) => ({
    language: state.language,
  }))
  const apiKey = env('NEXT_PUBLIC_API_KEY')
  const modelName = env('NEXT_PUBLIC_MODEL_NAME')
  const { t } = useClientTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const { articleType, updateField } = useUIStore(state => ({
    articleType: state.articleType as ArticleType,
    updateField: state.updateField
  }))
  const setArticleType = useCallback((value: ArticleType) => {
    updateField('articleType', value)
  }, [updateField])
  const latestArticleType = useLatest(articleType)
  const currentChunkIndex = useRef(0)

  // Add refs to store stop functions
  const chunkStopRef = useRef<(() => void) | null>(null)
  const mergeStopRef = useRef<(() => void) | null>(null)

  // Function to stop all generations
  const stopGeneration = useCallback(() => {
    if (chunkStopRef.current) {
      chunkStopRef.current()
    }
    if (mergeStopRef.current) {
      mergeStopRef.current()
    }
    setIsLoading(false)
  }, [])

  // Process subtitles into chunks
  const subtitleChunks = useMemo(() => {
    if (!currentSubtitles) return []
    // Add speaker_id if missing
    const subtitlesWithSpeaker = currentSubtitles.map((subtitle) => ({
      ...subtitle,
      speaker_id: subtitle.speaker_id || 0, // Default to 0 if missing
    }))
    return processSubtitlesInChunks(subtitlesWithSpeaker)
  }, [currentSubtitles])

  // State for tracking chunks and merge result
  const [chunks, setChunks] = useState<{
    [key: number]: {
      content: string
      isGenerating: boolean
      timeRange: string
    }
  }>({})

  const chunksRef = useLatest(chunks)
  const [mergeResult, setMergeResult] = useState<{
    content: string
    isGenerating: boolean
  }>({ content: '', isGenerating: false })

  // Calculate generation progress
  const generationProgress = useMemo(() => {
    if (!isLoading) return 0
    if (subtitleChunks.length === 0) return 0

    // Count completed chunks
    const totalChunks = subtitleChunks.length
    const completedChunks = Object.values(chunks).filter(
      (chunk) => chunk.content && !chunk.isGenerating
    ).length

    // Calculate progress based on completed chunks and merge status
    if (mergeResult.isGenerating) {
      // When merging, progress should be between (completedChunks/totalChunks * 85) and 100
      const baseProgress = (completedChunks / totalChunks) * 85 // Chunks take up 85%
      return baseProgress + ((100 - baseProgress) / 2) // Show middle of remaining progress during merge
    }

    if (completedChunks === totalChunks) {
      return 100 // All chunks completed and merge completed
    }

    // Regular chunk progress up to 85%
    return (completedChunks / totalChunks) * 85
  }, [isLoading, chunks, mergeResult.isGenerating, subtitleChunks.length])


  // Chunk generation completion
  const { completion: chunkCompletion, complete: chunkComplete, stop: chunkStop } =
    useCompletion({
      api: '/api/completion',
      onFinish: async (prompt, completion) => {
        try {
          // Update current chunk
          setChunks((prev) => ({
            ...prev,
            [currentChunkIndex.current]: {
              content: completion,
              isGenerating: false,
              timeRange: subtitleChunks[currentChunkIndex.current].timeRange,
            },
          }))

          // Move to next chunk or start merging
          const nextIndex = currentChunkIndex.current + 1
          if (nextIndex < subtitleChunks.length) {
            currentChunkIndex.current = nextIndex
            await generateNextChunk(nextIndex)
          } else {
            await startMerging()
          }
        } catch (error) {
          console.error(error)
        }
      },
      onError: (error) => {
        const errCode = JSON.parse(error.message).error.err_code
        emitter.emit('ToastError', errCode)
        setIsLoading(false)
        setChunks((prev) => {
          const newChunks = { ...prev }
          if (currentChunkIndex.current >= 0 && currentChunkIndex.current < Object.keys(newChunks).length) {
            newChunks[currentChunkIndex.current] = {
              ...newChunks[currentChunkIndex.current],
              isGenerating: false,
            }
          }
          return newChunks
        })
      },
    })

  // Store chunk stop function in ref
  useEffect(() => {
    chunkStopRef.current = chunkStop
  }, [chunkStop])

  useEffect(() => {
    if (chunkCompletion) {
      setChunks((prev) => ({
        ...prev,
        [currentChunkIndex.current]: {
          ...prev[currentChunkIndex.current],
          content: chunkCompletion,
        },
      }))
    }
  }, [chunkCompletion])

  // Merge completion
  const { completion: mergeCompletion, complete: mergeComplete, stop: mergeStop } =
    useCompletion({
      api: '/api/completion',
      onFinish: async (prompt, completion) => {
        setMergeResult({
          content: completion,
          isGenerating: false,
        })
          let finalContent = completion;

          // Handle xhs type specific processing
          if (latestArticleType.current === 'xhs') {
            try {
              // Extract all hashtags from the content
              const hashtags = completion.match(/#[^#\s\n]+/g);

              if (hashtags && hashtags.length > 0) {
                const keywords = hashtags.join(' ');

                setIsGeneratingImage(true);

                // Generate image prompt from keywords
                const imagePrompt = await genImagePrompt({
                  apiKey: apiKey || '',
                  model: modelName || '',
                  text: keywords
                });

                // Generate image using ideogram API
                const imageResponse = await apiKy.post('ideogram/generate', {
                  json: {
                    image_request: {
                      model: "V_2",
                      magic_prompt_option: "AUTO",
                      aspect_ratio: "ASPECT_1_1",
                      prompt: imagePrompt,
                      style_type: "REALISTIC",
                      negative_prompt: "painting",
                      seed: 12345
                    }
                  }
                }).json<{
                  created: string
                  data: {
                    url: string
                  }[]
                }>();

                // Insert image URL at top of article
                if (imageResponse.data?.[0]?.url) {
                  const imageMarkdown = `![Generated Image](${imageResponse.data[0].url})\n\n`
                  // Check if content starts with a first-level heading

                  // If no first-level heading found, add image at the very beginning
                  finalContent = imageMarkdown + finalContent

                  setMergeResult({
                    content: finalContent,
                    isGenerating: false,
                  })
                }

              }
            } catch (error) {
              console.error('Error generating xhs image:', error);
            } finally {
              setIsGeneratingImage(false);
            }
          }

          const currentArticle = {
            chunks: chunksRef.current,
            mergedContent: finalContent
          }

          setTimeout(() => {
            updateVideoInfo({
              articles: {
                ...articles,
                [articleType]: currentArticle
              }
            })
            save(useVideoInfoStore.getState())
            setIsLoading(false)
            toast.success(t('home:main.article.generate_success'))
          }, 2000)
      },
      onError: (error) => {
        const errCode = JSON.parse(error.message).error.err_code
        emitter.emit('ToastError', errCode)
        setIsLoading(false)
        setMergeResult((prev) => ({ ...prev, isGenerating: false }))
      },
    })

  // Store merge stop function in ref
  useEffect(() => {
    mergeStopRef.current = mergeStop
  }, [mergeStop])

  const generateNextChunk = async (index: number) => {
    if (index < 0 || index >= subtitleChunks.length) return

    const chunk = subtitleChunks[index]

    setChunks((prev) => ({
      ...prev,
      [index]: {
        content: '',
        isGenerating: true,
        timeRange: chunk.timeRange,
      },
    }))

    const prompt = generateArticlePrompt({
      language: language || 'en',
      type: articleType,
      timeRange: chunk.timeRange,
      contentType: 'video',
      targetLength: Math.floor(chunk.texts.length * 2),
      sectionContent: chunk.texts.join('\n'),
    })

    await chunkComplete(prompt, {
      body: {
        apiKey: apiKey || '',
        model: modelName || '',
      },
    })
  }

  const startMerging = async () => {
    setMergeResult({
      content: '',
      isGenerating: true,
    })

    const mergePrompt = getArticleMergePrompt(language || 'en', articleType)
    const chunksContent = Object.values(chunksRef.current)
      .map((chunk) => chunk.content)
      .join('\n\n---\n\n')
    let prompt = ''
    if (latestArticleType.current === 'custom') {
      const customPrompt = latestCustomArticlePrompt.current
      if (customPrompt?.includes('{{chunks}}')) {
        prompt = customPrompt.replace('{{chunks}}', chunksContent)
      } else {
        prompt = customPrompt + '\n\n' + chunksContent
      }
    } else {
      prompt = mergePrompt.replace('{{chunks}}', chunksContent)
    }
    if (latestArticleType.current === 'xhs') {
      await mergeComplete(prompt, {
        body: {
          apiKey: apiKey || '',
          model: modelName || '',
          system: getXhsSystemPrompt(language || 'en'),
        },
      })
    } else {
      await mergeComplete(prompt, {
        body: {
          apiKey: apiKey || '',
          model: modelName || '',
        },
      })
    }
  }

  const [containerRef, endRef] = useScrollToBottom<HTMLDivElement>({
    enabled: isLoading
  })

  // Load existing article when type changes
  useEffect(() => {
    if (articles[articleType]) {
      // Convert stored chunks to include isGenerating property
      const storedChunks = Object.entries(articles[articleType].chunks).reduce((acc, [key, chunk]) => {
        acc[Number(key)] = {
          ...chunk,
          isGenerating: false
        }
        return acc
      }, {} as typeof chunks)

      setChunks(storedChunks)
      setMergeResult({
        content: articles[articleType].mergedContent,
        isGenerating: false
      })
    } else {
      setChunks({})
      setMergeResult({ content: '', isGenerating: false })
    }
  }, [articleType, articles])

  const pendingContentRef = useRef<string>('')
  const [throttledContent, setThrottledContent] = useState<string>('')

  const updateThrottledContent = useMemo(() =>
    throttle({ interval: 500 }, () => { // Increase throttle interval to 500ms
      setThrottledContent(pendingContentRef.current)
    }),
    []
  )

  // Ensure final content is always displayed
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (pendingContentRef.current !== throttledContent) {
        setThrottledContent(pendingContentRef.current)
      }
    }, 500) // Match the throttle interval
    return () => clearTimeout(timeoutId)
  }, [throttledContent])

  // Memoize chunks rendering
  const renderedChunks = useMemo(() => {
    return Object.values(chunks).map((chunk, index) => {
      if (chunk.content) {
        return (
          <div key={index} className='rounded-lg border p-4'>
            <div className='mb-2 font-bold'>
              {t('home:main.article.part_label', {
                number: index + 1,
                timeRange: chunk.timeRange,
              })}
              {chunk.isGenerating &&
                t('home:main.article.generating_status')}
            </div>
            <MDRenderer content={chunk.content} />
          </div>
        )
      }
      return null
    })
  }, [chunks, t])

  // Memoize merge result rendering
  const renderedMergeResult = useMemo(() => {
    if (!mergeResult.isGenerating && !mergeResult.content) {
      return null
    }
    return (
      <div className='rounded-lg border p-4'>
        <div className='mb-2 font-bold'>
          {t('home:main.article.final_content')}
          {mergeResult.isGenerating &&
            t('home:main.article.merging_status')}
        </div>
        <MDRenderer
          content={mergeResult.content || mergeCompletion}
        />
      </div>
    )
  }, [mergeResult.isGenerating, mergeResult.content, mergeCompletion, t])

  const clearArticle = useCallback(() => {
    setChunks({})
    setMergeResult({ content: '', isGenerating: false })
    const newArticles = { ...articles }
    delete newArticles[articleType]
    updateVideoInfo({ articles: newArticles })
    save(useVideoInfoStore.getState())
  }, [articles, articleType, updateVideoInfo])

  return (
    <div
      className={cn(
        'flex flex-1 flex-col justify-between space-y-2 p-2',
        'transform-gpu',
        className
      )}
      style={{ height: `${height}px` }}
    >
      <div className='flex items-center justify-between gap-2'>
        <Select
          value={articleType}
          onValueChange={(value: ArticleType) => setArticleType(value)}
          disabled={isLoading}
        >
          <SelectTrigger className='w-full'>
            <SelectValue placeholder={t('home:main.article.select_type')} />
          </SelectTrigger>
          <SelectContent>
            {ArticleTypeOptions.map((type) => {
              return (
                <SelectItem key={type} value={type}>
                  {t(`home:main.article.types.${type}`)}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          {!isLoading ? (
            <>
              <Button
                onClick={() => {
                  setIsLoading(true)
                  setChunks({})
                  setMergeResult({ content: '', isGenerating: false })
                  currentChunkIndex.current = 0
                  generateNextChunk(0)
                }}
              >
                {articles[articleType]
                  ? t('home:main.article.regenerate')
                  : t('home:main.article.generate')}
              </Button>
              {articles[articleType] && (
                <Button
                  variant="outline"
                  onClick={clearArticle}
                >
                  {t('home:main.article.clear')}
                </Button>
              )}
            </>
          ) : (
            <Button
              variant="outline"
              onClick={stopGeneration}
            >
              {t('home:main.article.stop')}
            </Button>
          )}
        </div>
      </div>
      {articleType === 'custom' && (
        <Collapsible className='w-full space-y-2'>
          <CollapsibleTrigger className='flex w-full items-center justify-between rounded-md border bg-muted px-4 py-2 font-medium hover:bg-muted/80'>
            <span>{t('home:main.article.custom_prompt')}</span>
            <ChevronDown className="h-4 w-4 transition-transform duration-200 [&[data-state=open]>svg]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2">
            <Textarea
              className='min-h-[100px] w-full resize-y'
              value={customArticlePrompt}
              onChange={(e) => setCustomArticlePrompt(e.target.value)}
              placeholder={t('home:main.article.custom_prompt_placeholder')}
            />
          </CollapsibleContent>
        </Collapsible>
      )}

      {(isLoading || isGeneratingImage) && (
        <div className='space-y-1'>
          <Progress value={generationProgress} className='w-full' />
          <div className='text-center text-sm text-muted-foreground'>
            {isGeneratingImage
              ? t('home:main.article.generating_image')
              : mergeResult.isGenerating
                ? t('home:main.article.merging')
                : t('home:main.article.generating')}{' '}
            {!isGeneratingImage && `(${Math.round(generationProgress)}%)`}
          </div>
        </div>
      )}

      <div className='flex-1 overflow-y-auto' ref={containerRef}>
        <div className='h-full'>
          {Object.keys(chunks).length === 0 ? (
            <div className='flex h-full items-center justify-center text-muted-foreground'>
              {t('home:main.article.no_article_content')}
            </div>
          ) : (
            <div className='space-y-4'>
              {renderedChunks}
              {renderedMergeResult}
              <div ref={endRef} style={{ height: '1px' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
