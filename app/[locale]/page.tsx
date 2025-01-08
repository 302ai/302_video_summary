'use client'
import { Footer } from '@/app/components/footer'
import { useTranslation } from '@/app/i18n/client'
import { transcript } from '@/lib/api/transcript'
import { showBrand } from '@/lib/brand'
import { save } from '@/lib/db'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { env } from 'next-runtime-env'
import { debounce } from 'radash'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { getVideoInfo } from '../actions/video'
import { useChat } from '../components/chatbox/hooks'
import { Header } from '../components/header'
import Main from '../components/main'
import { useHasSubtitles } from '../hooks/use-has-subtitles'
import { useVideoInfoStore } from '../stores/use-video-info-store'
import { isAudioSource } from '@/lib/audio'

export default function Home({
  params: { locale },
}: {
  params: { locale: string }
}) {


  const { t } = useTranslation(locale)

  const { resetMessages } = useChat()
  const { updateVideoInfo, refresh } = useVideoInfoStore((state) => ({
    updateVideoInfo: state.updateAll,
    refresh: state.refresh,
  }))
  const hasSubtitles = useHasSubtitles()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (url: string) => {
    setIsSubmitting(true)

    try {
      refresh()
      resetMessages()

      // Check if it's an audio source and get audio type
      const audioType = await isAudioSource(url)

      if (audioType) {
        // Handle audio file
        const fileName = url.split('/').pop() || 'Audio File'

        updateVideoInfo({
          id: Date.now().toString(),
          title: fileName,
          videoType: audioType, // Use audio type detected from response headers
          originalVideoUrl: url,
          realVideoUrl: url,
          originalSubtitles: [], // Will be populated by transcript API
        })

        // Get transcript for audio file
        const data = await transcript(t, url)
        if (!data) {
          throw new Error('Failed to get transcript')
        }

        // Update with transcript data
        updateVideoInfo({
          id: data.detail.id || Date.now().toString(),
          title: fileName,
          videoType: audioType, // Use audio type detected from response headers
          originalSubtitles: data.detail.subtitlesArray,
          originalVideoUrl: url,
          realVideoUrl: url
        })

      } else {
        // Handle video URL
        const videoInfo = await getVideoInfo(url, env("NEXT_PUBLIC_API_KEY"))

        // Get transcript
        const data = await transcript(t, url)
        if (!data) {
          throw new Error('Failed to get transcript')
        }

        // Update video info
        updateVideoInfo({
          id: data.detail.id || Date.now().toString(),
          title: videoInfo.title || data.detail.title,
          videoType: videoInfo.type,
          poster: videoInfo.cover || data.detail.cover,
          originalSubtitles: data.detail.subtitlesArray,
          originalVideoUrl: url,
          realVideoUrl: videoInfo.videoUrl
        })
      }

      // Save state
      await save(useVideoInfoStore.getState())
      toast.success(t('home:submit.success'))

    } catch (error) {
      logger.error(error)
      toast.error(t('home:submit.get_real_url_failed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const headerRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const [mainHeight, setMainHeight] = useState(0)

  useEffect(() => {
    const calculateMainHeight = () => {
      if (!headerRef.current || !footerRef.current) return

      const headerRect = headerRef.current.getBoundingClientRect()
      const footerRect = footerRef.current.getBoundingClientRect()
      const headerMargin = parseFloat(
        window.getComputedStyle(headerRef.current).marginTop
      )
      const footerMargin = parseFloat(
        window.getComputedStyle(footerRef.current).marginBottom
      )
      const mainHeight =
        window.innerHeight -
        headerRect.height -
        footerRect.height -
        headerMargin -
        footerMargin
      mainRef.current?.style.setProperty('height', `${mainHeight}px`)
      setMainHeight(mainHeight)
    }

    const debouncedCalculateMainHeight = debounce(
      {
        delay: 100,
      },
      calculateMainHeight
    )

    calculateMainHeight()

    const resizeObserver = new ResizeObserver(debouncedCalculateMainHeight)

    if (headerRef.current) {
      resizeObserver.observe(headerRef.current)
    }
    if (footerRef.current) {
      resizeObserver.observe(footerRef.current)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div className='flex h-fit min-h-screen flex-col justify-between'>
      <div
        className={cn(hasSubtitles && !isSubmitting ? 'hidden' : 'block')}
      ></div>
      <Header
        className={cn(hasSubtitles && !isSubmitting ? 'mt-8' : 'mt-0')}
        isSubmitting={isSubmitting}
        onSubmit={onSubmit}
        ref={headerRef}
      />
      <main
        className={cn(
          hasSubtitles && !isSubmitting ? 'block' : 'hidden',
          'container mx-auto min-h-[500px] max-w-[1280px] px-2'
        )}
        ref={mainRef}
      >
        <Main height={mainHeight} />
      </main>
      {!showBrand && <footer ref={footerRef} />}
      {showBrand && <Footer className={cn('mb-4')} ref={footerRef} />}
    </div>
  )
}
