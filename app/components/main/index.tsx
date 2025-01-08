'use client'
import { useCurrentSubtitles } from '@/app/hooks/use-current-subtitles'
import { useIsSharePath } from '@/app/hooks/use-is-share-path'
import { useVideoInfoStore } from '@/app/stores/use-video-info-store'
import { useUIStore } from '@/app/stores/use-ui-store'
import { CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { MediaPlayerInstance } from '@vidstack/react'
import { forwardRef, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useMediaQuery } from 'react-responsive'
import { useClientTranslation } from '../../hooks/use-client-translation'
import Card from '../card'
import { VideoPlayer } from '../player'
import AIPanel from './ai-panel'
import { BriefPanel } from './brief-panel'
import { DetailPanel } from './detail-panel'
import { SubtitlePanel } from './subtitle-panel'
import { ArticlePanel } from './article-panel'
import VirtualizedSubtitleList from '../subtitles/virtualized-list'
import { Switch } from '@/components/ui/switch'

const DESKTOP_WIDTH = 768

// Add type definitions for panel props
interface PanelProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  height: number
  videoPlayer: React.ReactNode
  videoDimensions: { width: number; height: number }
  isLoadingDimensions: boolean
  currentTime: number
  player: React.RefObject<MediaPlayerInstance>
  shouldShowVideo: (platform?: string, position?: 'left' | 'right' | 'center') => boolean
  className?: string
  platform?: string
  position: 'left' | 'right' | 'center'
}

const ContentPanel = forwardRef<
  HTMLDivElement,
  PanelProps
>(({ activeTab, setActiveTab, className, platform, height, position, videoPlayer, videoDimensions, isLoadingDimensions, currentTime, player, shouldShowVideo }, ref) => {
  const currentSubtitles = useCurrentSubtitles()
  const [searchText, setSearchText] = useState('')
  const [syncSubtitles, setSyncSubtitles] = useState(true)
  const { t } = useClientTranslation()
  // Calculate video dimensions that fit within container
  const { videoHeight, videoWidth } = useMemo(() => {
    // Get container width (card width)
    const containerWidth = document.querySelector('.video-container')?.clientWidth || 0

    // If we're still loading or failed to get dimensions, fall back to 16:9
    if (videoDimensions.width === 0 || videoDimensions.height === 0 || isLoadingDimensions) {
      const heightByAspectRatio = (containerWidth * 9) / 16
      if (heightByAspectRatio > height) {
        // Scale down proportionally to fit height
        return {
          videoHeight: height,
          videoWidth: (height * 16) / 9
        }
      }
      return {
        videoHeight: heightByAspectRatio,
        videoWidth: containerWidth
      }
    }

    // Calculate dimensions based on actual video aspect ratio
    const heightByAspectRatio = (containerWidth * videoDimensions.height) / videoDimensions.width
    if (heightByAspectRatio > height) {
      // Scale down proportionally to fit height
      return {
        videoHeight: height,
        videoWidth: (height * videoDimensions.width) / videoDimensions.height
      }
    }
    return {
      videoHeight: heightByAspectRatio,
      videoWidth: containerWidth
    }
  }, [videoDimensions, height, isLoadingDimensions])

  // Calculate remaining height for subtitles
  const remainingHeight = height - videoHeight
  const showSubtitles = remainingHeight >= 200

  return (
    <Card className={cn('w-full', className)}>
      <CardContent
        className='flex h-full flex-col justify-center p-0'
        ref={ref}
        style={{ height: height }}
      >
        <div className={cn('flex flex-col h-full', activeTab === 'video' ? '' : 'hidden')}>
          {shouldShowVideo(platform, position) && (
            <div className="w-full flex justify-center video-container" style={{ position: 'relative' }}>
              <div className="relative w-full" style={{
                maxWidth: videoWidth,
                height: videoHeight
              }}>
                <div className="video-mount-point" style={{ width: '100%', height: '100%' }} />
              </div>
            </div>
          )}

          {showSubtitles && (
            <div className="w-full flex-1">
              <div className="flex items-center justify-end px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t('home:main.auto_scroll')}
                  </span>
                  <Switch
                    checked={syncSubtitles}
                    onCheckedChange={setSyncSubtitles}
                  />
                </div>
              </div>
              <VirtualizedSubtitleList
                subtitles={currentSubtitles || []}
                height={remainingHeight - 40}
                width="100%"
                currentTime={currentTime}
                searchText={searchText}
                sync={syncSubtitles}
                onSubtitleClick={(time) => {
                  if (player.current) {
                    player.current.currentTime = time
                  }
                }}
                className="rounded-md pl-2"
              />
            </div>
          )}
        </div>
        <SubtitlePanel
          player={player.current}
          height={height}
          className={cn(activeTab === 'subtitles' ? '' : 'hidden')}
          setActiveTab={setActiveTab}
        />
        <BriefPanel height={height} className={cn(activeTab === 'brief' ? '' : 'hidden')} />
        <DetailPanel height={height} className={cn(activeTab === 'detailed' ? '' : 'hidden')} />
        <ArticlePanel height={height} className={cn(activeTab === 'article' ? '' : 'hidden')} />
        <AIPanel
          className={cn(activeTab === 'ai' ? '' : 'hidden')}
          setActiveTab={setActiveTab}
        />
      </CardContent>
    </Card>
  )
})

ContentPanel.displayName = 'ContentPanel'

const TopTabs = forwardRef<
  HTMLDivElement,
  {
    activeTab: string
    setActiveTab: (tab: string) => void
  }
>(({ activeTab, setActiveTab }, ref) => {
  const { t } = useClientTranslation()
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full'>
      <TabsList
        className='mb-4 grid w-full grid-cols-2 bg-gray-200 dark:bg-gray-800'
        ref={ref}
      >
        <TabsTrigger value='video'>{t('home:main.view_video')}</TabsTrigger>
        <TabsTrigger value='subtitles'>
          {t('home:main.view_subtitles')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
})

TopTabs.displayName = 'TopTabs'

const BottomTabs = forwardRef<
  HTMLDivElement,
  {
    activeTab: string
    setActiveTab: (tab: string) => void
  }
>(({ activeTab, setActiveTab }, ref) => {
  const { t } = useClientTranslation()
  const { isSharePage } = useIsSharePath()

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full'>
      <TabsList
        className={cn('mt-4 grid w-full  bg-gray-200 dark:bg-gray-800', isSharePage ? 'grid-cols-3' : 'grid-cols-4')}
        ref={ref}
      >
        <TabsTrigger value='brief'>{t('home:main.brief_summary')}</TabsTrigger>
        <TabsTrigger value='detailed'>
          {t('home:main.detailed_summary')}
        </TabsTrigger>
        <TabsTrigger value='article'>
          {t('home:main.article_generation')}
        </TabsTrigger>
        {!isSharePage && (
          <TabsTrigger value='ai'>{t('home:main.ai_question')}</TabsTrigger>
        )}
      </TabsList>
    </Tabs>
  )
})

BottomTabs.displayName = 'BottomTabs'

const DesktopLeftPanel = ({
  activeTab,
  setActiveTab,
  height,
  videoPlayer,
  videoDimensions,
  isLoadingDimensions,
  currentTime,
  player,
  shouldShowVideo,
  position,
}: PanelProps) => {
  const { t } = useClientTranslation()
  const triggerRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)

  useEffect(() => {
    if (!triggerRef.current) return
    const styles = window.getComputedStyle(triggerRef.current)
    const updateHeight = () => {
      if (!triggerRef.current) return
      const triggerHeight = triggerRef.current.clientHeight
      setContentHeight(height - triggerHeight - parseFloat(styles.marginBottom))
    }
    updateHeight()
  }, [height])
  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className='flex h-full w-full flex-col'
    >
      <TabsList
        className='mb-4 grid w-full grid-cols-2 bg-gray-200 dark:bg-gray-800'
        ref={triggerRef}
      >
        <TabsTrigger value='video'>{t('home:main.view_video')}</TabsTrigger>
        <TabsTrigger value='subtitles'>
          {t('home:main.view_subtitles')}
        </TabsTrigger>
      </TabsList>

      <ContentPanel
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        className='h-full'
        platform='desktop'
        height={contentHeight}
        position={position}
        videoPlayer={videoPlayer}
        videoDimensions={videoDimensions}
        isLoadingDimensions={isLoadingDimensions}
        currentTime={currentTime}
        player={player}
        shouldShowVideo={shouldShowVideo}
      />
    </Tabs>
  )
}

const DesktopRightPanel = ({
  activeTab,
  setActiveTab,
  height,
  videoPlayer,
  videoDimensions,
  isLoadingDimensions,
  currentTime,
  player,
  shouldShowVideo,
  position,
}: PanelProps) => {
  const { t } = useClientTranslation()
  const { isSharePage } = useIsSharePath()

  const triggerRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)
  useEffect(() => {
    if (!triggerRef.current) return
    const styles = window.getComputedStyle(triggerRef.current)
    const updateHeight = () => {
      if (!triggerRef.current) return
      const triggerHeight = triggerRef.current.clientHeight
      setContentHeight(height - triggerHeight - parseFloat(styles.marginBottom))
    }
    updateHeight()
  }, [height])
  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className='flex h-full w-full flex-col'
    >
      <TabsList
        className={cn('mb-4 grid w-full  bg-gray-200 dark:bg-gray-800', isSharePage ? 'grid-cols-3' : 'grid-cols-4')}
        ref={triggerRef}
      >
        <TabsTrigger value='brief'>{t('home:main.brief_summary')}</TabsTrigger>
        <TabsTrigger value='detailed'>
          {t('home:main.detailed_summary')}
        </TabsTrigger>
        {!isSharePage && (
          <TabsTrigger value='article'>
            {t('home:main.article_generation')}
          </TabsTrigger>
        )}
        {!isSharePage && (
          <TabsTrigger value='ai'>{t('home:main.ai_question')}</TabsTrigger>
        )}
      </TabsList>
      <ContentPanel
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        className='h-full'
        height={contentHeight}
        platform='desktop'
        position={position}
        videoPlayer={videoPlayer}
        videoDimensions={videoDimensions}
        isLoadingDimensions={isLoadingDimensions}
        currentTime={currentTime}
        player={player}
        shouldShowVideo={shouldShowVideo}
      />
    </Tabs>
  )
}

export default function Main({ height }: { height: number }) {
  const { activeTab, activeTabRight, updateField } = useUIStore(state => ({
    activeTab: state.activeTab,
    activeTabRight: state.activeTabRight,
    updateField: state.updateField
  }))

  const isDesktop = useMediaQuery({ minWidth: DESKTOP_WIDTH })
  const player = useRef<MediaPlayerInstance>(null)
  const playerContainerRef = useRef<HTMLDivElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 })
  const [isLoadingDimensions, setIsLoadingDimensions] = useState(false)

  // Get the current active video container
  const getActiveVideoContainer = useCallback(() => {
    if (isDesktop) {
      return document.querySelector('.desktop-left .video-mount-point')
    } else {
      return document.querySelector('.mobile-center .video-mount-point')
    }
  }, [isDesktop])

  // Handle video container movement
  useEffect(() => {
    const container = getActiveVideoContainer()
    if (!container || !playerContainerRef.current) return

    // Move the container
    container.appendChild(playerContainerRef.current)
  }, [isDesktop, getActiveVideoContainer])

  // Create video player only once
  const videoPlayerWrapper = useMemo(() => {
    return (
      <div ref={playerContainerRef} className="fixed-video-player" style={{ width: '100%', height: '100%' }}>
        <VideoPlayer
          ref={player}
          aspectRatio={videoDimensions.width && videoDimensions.height ?
            `${videoDimensions.width}/${videoDimensions.height}` :
            '16/9'}
          onTimeUpdate={setCurrentTime}
        />
      </div>
    )
  }, [])

  // Calculate whether to show video based on current layout
  const shouldShowVideo = useCallback((platform?: string, position?: 'left' | 'right' | 'center') => {
    return (
      (!(
        (isDesktop && platform === 'mobile') ||
        (!isDesktop && platform === 'desktop')
      ) ||
        (position === 'center' && !isDesktop)) &&
      position !== 'right'
    )
  }, [isDesktop])

  const topTabsRef = useRef<HTMLDivElement>(null)
  const bottomTabsRef = useRef<HTMLDivElement>(null)
  const outerRef = useRef<HTMLDivElement>(null)
  const [mobileContentHeight, setMobileContentHeight] = useState(0)
  const [desktopContentHeight, setDesktopContentHeight] = useState(0)
  const [activeLeftPanel, setActiveLeftPanel] = useState('video')

  // Mobile
  useEffect(() => {
    const updateHeight = () => {
      if (!outerRef.current || !topTabsRef.current || !bottomTabsRef.current)
        return
      const outerStyles = window.getComputedStyle(outerRef.current)
      const topTabsStyles = window.getComputedStyle(topTabsRef.current)
      const bottomTabsStyles = window.getComputedStyle(bottomTabsRef.current)
      const newHeight =
        height -
        (topTabsRef.current?.clientHeight || 0) -
        (bottomTabsRef.current?.clientHeight || 0) -
        parseFloat(outerStyles.paddingTop) -
        parseFloat(outerStyles.paddingBottom) -
        parseFloat(topTabsStyles.marginBottom) -
        parseFloat(bottomTabsStyles.marginTop)
      setMobileContentHeight(newHeight)
    }
    updateHeight()
  }, [height])

  // Desktop
  useEffect(() => {
    const updateHeight = () => {
      if (!outerRef.current) return
      const outerStyles = window.getComputedStyle(outerRef.current)
      const newHeight =
        height -
        (topTabsRef.current?.clientHeight || 0) -
        (bottomTabsRef.current?.clientHeight || 0) -
        parseFloat(outerStyles.paddingTop) -
        parseFloat(outerStyles.paddingBottom)
      setDesktopContentHeight(newHeight)
    }
    updateHeight()
  }, [height])

  const setActiveTab = useCallback((value: string) => {
    updateField('activeTab', value)
  }, [updateField])

  const setActiveTabRight = useCallback((value: string) => {
    updateField('activeTabRight', value)
  }, [updateField])


  return (
    <>
      <div
        className='grid gap-4 py-4 md:grid-cols-2'
        style={{ height: height }}
        ref={outerRef}
      >
        <div
          className={isDesktop ? 'desktop-left' : 'hidden'}
          style={{ height: desktopContentHeight }}
        >
          <DesktopLeftPanel
            activeTab={activeLeftPanel}
            setActiveTab={setActiveLeftPanel}
            height={desktopContentHeight}
            videoPlayer={null}
            videoDimensions={videoDimensions}
            isLoadingDimensions={isLoadingDimensions}
            currentTime={currentTime}
            player={player}
            shouldShowVideo={shouldShowVideo}
            position="left"
          />
        </div>
        <div
          className={isDesktop ? 'desktop-right' : 'hidden'}
          style={{ height: desktopContentHeight }}
        >
          <DesktopRightPanel
            activeTab={activeTabRight}
            setActiveTab={setActiveTabRight}
            height={desktopContentHeight}
            videoPlayer={null}
            videoDimensions={videoDimensions}
            isLoadingDimensions={isLoadingDimensions}
            currentTime={currentTime}
            player={player}
            shouldShowVideo={shouldShowVideo}
            position="right"
          />
        </div>
        <div className={isDesktop ? 'hidden' : 'flex flex-col mobile-center'}>
          <TopTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            ref={topTabsRef}
          />

          <ContentPanel
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            className='h-full'
            platform='mobile'
            height={mobileContentHeight}
            position='center'
            videoPlayer={null}
            videoDimensions={videoDimensions}
            isLoadingDimensions={isLoadingDimensions}
            currentTime={currentTime}
            player={player}
            shouldShowVideo={shouldShowVideo}
          />

          <BottomTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            ref={bottomTabsRef}
          />
        </div>
      </div>
      {/* Initial render of video player */}
      <div style={{ display: 'none' }}>
        {videoPlayerWrapper}
      </div>
    </>
  )
}
