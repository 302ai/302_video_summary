'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  FileIcon,
  FileTextIcon,
  Maximize2Icon,
  Minimize2Icon,
  XIcon,
} from 'lucide-react'
import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'
import { throttle } from 'radash'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useClientTranslation } from '../hooks/use-client-translation'
import { useVideoInfoStore } from '../stores/use-video-info-store'

interface MarkmapRendererProps {
  content: string
  className?: string
  contentClassName?: string
  height?: number
  width?: number
}
const transformer = new Transformer()

export default function MarkmapRenderer({
  content,
  className = '',
  contentClassName = '',
  height = 400,
  width = 600,
}: MarkmapRendererProps) {
  const { t } = useClientTranslation()
  const { title } = useVideoInfoStore((state) => ({ title: state.title }))
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fullscreenRef = useRef<HTMLDivElement>(null)
  const refSvg = useRef<SVGSVGElement | null>(null)
  const refMm = useRef<Markmap>()
  const [throttledContent, setThrottledContent] = useState(content)
  const pendingContentRef = useRef(content)
  const fitInProgressRef = useRef(false)
  const [containerReady, setContainerReady] = useState(false)

  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const updateThrottledContent = useMemo(() =>
    throttle({ interval: 200 }, () => {
      setThrottledContent(pendingContentRef.current)
    }),
    []
  )

  // Always update pendingContent immediately, but throttle the state update
  useEffect(() => {
    pendingContentRef.current = content
    updateThrottledContent()
  }, [content, updateThrottledContent])

  // Ensure final content is always displayed
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (pendingContentRef.current !== throttledContent) {
        setThrottledContent(pendingContentRef.current)
      }
    }, 200)
    return () => clearTimeout(timeoutId)
  }, [throttledContent])

  const handleDownload = useCallback(
    async (format: 'png' | 'jpeg' | 'svg') => {
      if (!refSvg.current) return

      const svg = refSvg.current
      const mm = refMm.current

      if (!mm) return
      await mm.fit()

      if (format === 'svg') {
        const svgData = new XMLSerializer().serializeToString(svg)
        const svgBlob = new Blob([svgData], {
          type: 'image/svg+xml;charset=utf-8',
        })
        const svgUrl = URL.createObjectURL(svgBlob)
        const downloadLink = document.createElement('a')

        downloadLink.href = svgUrl
        downloadLink.download = `${title}.svg`
        document.body.appendChild(downloadLink)
        downloadLink.click()
        document.body.removeChild(downloadLink)
        URL.revokeObjectURL(svgUrl)
      } else {
        const svgData = new XMLSerializer().serializeToString(svg)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()

        img.onload = () => {
          const bbox = svg.getBBox()
          const scale = 2

          canvas.width = 3840 * scale
          canvas.height = 2160 * scale

          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            if (format === 'jpeg') {
              ctx.fillStyle = 'white'
              ctx.fillRect(0, 0, canvas.width, canvas.height)
            }

            const scaleX = canvas.width / bbox.width
            const scaleY = canvas.height / bbox.height
            const scaleFactor = Math.min(scaleX, scaleY)

            const translateX =
              (canvas.width - bbox.width * scaleFactor) / 2 -
              bbox.x * scaleFactor
            const translateY =
              (canvas.height - bbox.height * scaleFactor) / 2 -
              bbox.y * scaleFactor

            ctx.setTransform(
              scaleFactor,
              0,
              0,
              scaleFactor,
              translateX,
              translateY
            )

            ctx.drawImage(img, 0, 0)

            const dataUrl = canvas.toDataURL(`image/${format}`, 0.9)
            const downloadLink = document.createElement('a')

            downloadLink.download = `${title}.${format}`
            downloadLink.href = dataUrl
            downloadLink.click()
          }
        }

        img.src =
          'data:image/svg+xml;base64,' +
          btoa(unescape(encodeURIComponent(svgData)))
      }
    },
    [title]
  )

  const handleDownloadPNG = useCallback(
    () => handleDownload('png'),
    [handleDownload]
  )
  const handleDownloadJPEG = useCallback(
    () => handleDownload('jpeg'),
    [handleDownload]
  )
  const handleDownloadSVG = useCallback(
    () => handleDownload('svg'),
    [handleDownload]
  )

  const rebuild = useCallback((forceRebuild = false) => {
    if (!refSvg.current) return

    const svg = refSvg.current
    const rect = svg.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0 || isNaN(rect.width) || isNaN(rect.height)) return

    try {
      if (!refMm.current || forceRebuild) {
        if (refMm.current) {
          refMm.current.destroy()
          refMm.current = undefined
        }
        const mm = Markmap.create(svg)
        refMm.current = mm
        const { root } = transformer.transform(throttledContent)
        mm.setData(root)
        fitInProgressRef.current = true
        mm.fit()
        setTimeout(() => {
          if (isMountedRef.current) {
            fitInProgressRef.current = false
          }
        }, 200)
      }
    } catch (error) {
      console.warn('Failed to rebuild markmap:', error)
      if (isMountedRef.current) {
        fitInProgressRef.current = false
      }
    }
  }, [throttledContent])

  const toggleFullscreen = useCallback(async () => {
    if (!fullscreenRef.current) return

    try {
      if (!document.fullscreenElement) {
        await fullscreenRef.current.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (err) {
      console.error('Error attempting to toggle fullscreen:', err)
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    if (!refSvg.current || !containerReady) return

    const initializeMarkmap = () => {
      const rect = refSvg.current?.getBoundingClientRect()
      if (!rect || rect.width === 0 || rect.height === 0 || isNaN(rect.width) || isNaN(rect.height)) {
        // If dimensions are invalid, retry after a short delay
        requestAnimationFrame(initializeMarkmap)
        return
      }

      try {
        if (!refMm.current) {
          rebuild(true)
        } else {
          const { root } = transformer.transform(throttledContent)
          refMm.current.setData(root)

          // Ensure dimensions are still valid before fitting
          const svgRect = refSvg.current?.getBoundingClientRect()
          if (svgRect && svgRect.width > 0 && svgRect.height > 0 && !isNaN(svgRect.width) && !isNaN(svgRect.height)) {
            refMm.current.fit()
          }
        }
      } catch (error) {
        console.warn('Failed to update markmap:', error)
        rebuild(true)
      }
    }

    initializeMarkmap()
  }, [throttledContent, rebuild, containerReady])

  const contentRef = useRef<HTMLDivElement>(null)
  const [paddingWidth, setPaddingWidth] = useState(0)
  const [paddingHeight, setPaddingHeight] = useState(0)

  useEffect(() => {
    const initializeContainer = () => {
      if (!contentRef.current) {
        requestAnimationFrame(initializeContainer)
        return
      }

      const contentStyles = window.getComputedStyle(contentRef.current)
      const contentWidth =
        parseFloat(contentStyles.paddingLeft) +
        parseFloat(contentStyles.paddingRight)
      const contentHeight =
        parseFloat(contentStyles.paddingTop) +
        parseFloat(contentStyles.paddingBottom)

      if (contentWidth > 0 && contentHeight > 0) {
        setPaddingWidth(contentWidth)
        setPaddingHeight(contentHeight)
        setContainerReady(true)
      } else {
        requestAnimationFrame(initializeContainer)
      }
    }

    initializeContainer()
  }, [])

  useEffect(() => {
    if (!refSvg.current) return
    const svg = refSvg.current

    let resizeTimeout: NodeJS.Timeout
    const handleResize = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }

      resizeTimeout = setTimeout(() => {
        if (refMm.current && !fitInProgressRef.current) {
          const rect = svg.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0 && !isNaN(rect.width) && !isNaN(rect.height)) {
            refMm.current.fit()
          }
        }
      }, 150)
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(svg)

    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      resizeObserver.disconnect()
      if (refMm.current) {
        refMm.current.destroy()
        refMm.current = undefined
      }
    }
  }, [])

  return (
    <Card
      className={`group relative h-full w-full overflow-hidden shadow-none ${className}`}
    >
      <div
        className={`absolute right-2 top-1 z-10 flex items-center space-x-2 overflow-hidden rounded-md border border-border bg-background/80 p-1 text-sm backdrop-blur-sm transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100`}
      >
        <Button
          variant='ghost'
          size='sm'
          onClick={toggleFullscreen}
          className='flex items-center justify-center rounded p-1 hover:bg-accent'
          aria-label={
            isFullscreen
              ? t('extras:mind_map.exit_fullscreen')
              : t('extras:mind_map.enter_fullscreen')
          }
        >
          {isFullscreen ? (
            <Minimize2Icon className='mr-1 h-4 w-4' />
          ) : (
            <Maximize2Icon className='mr-1 h-4 w-4' />
          )}
          {isFullscreen
            ? t('extras:mind_map.collapse')
            : t('extras:mind_map.expand')}
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onClick={handleDownloadSVG}
          className='flex items-center justify-center rounded p-1 hover:bg-accent'
          aria-label={t('extras:mind_map.download_as_svg')}
        >
          <FileIcon className='mr-1 h-4 w-4' />
          SVG
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onClick={handleDownloadPNG}
          className='flex items-center justify-center rounded p-1 hover:bg-accent'
          aria-label={t('extras:mind_map.download_as_png')}
        >
          <FileTextIcon className='mr-1 h-4 w-4' />
          PNG
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onClick={handleDownloadJPEG}
          className='flex items-center justify-center rounded p-1 hover:bg-accent'
          aria-label={t('extras:mind_map.download_as_jpeg')}
        >
          <FileTextIcon className='mr-1 h-4 w-4' />
          JPEG
        </Button>
      </div>
      <div
        ref={fullscreenRef}
        className={`${isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'h-full'}`}
      >
        {isFullscreen && (
          <Button
            variant='outline'
            size='sm'
            onClick={toggleFullscreen}
            className='absolute right-2 top-2 z-10 flex items-center justify-center rounded-full p-2 hover:bg-accent'
            aria-label={t('extras:mind_map.exit_fullscreen')}
          >
            <XIcon className='h-4 w-4' />
          </Button>
        )}
        <div
          className={`h-full overflow-auto p-4 ${contentClassName}`}
          ref={contentRef}
        >
          <svg
            ref={refSvg}
            style={{
              width: isFullscreen
                ? 'calc(100vw - 2rem)'
                : `${Math.max(width - paddingWidth - 4, 300)}px`,
              height: isFullscreen
                ? 'calc(100vh - 2rem)'
                : `${Math.max(height - paddingHeight - 4, 200)}px`,
            }}
          />
        </div>
      </div>
    </Card>
  )
}
