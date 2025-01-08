import { getRealUrlForVideo } from '@/app/actions/video'
import { useClientTranslation } from '@/app/hooks/use-client-translation'
import { useIsSharePath } from '@/app/hooks/use-is-share-path'
import { useUserStore } from '@/app/stores/use-user-store'
import {  useVideoInfoStore } from '@/app/stores/use-video-info-store'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { isVideoUrlUsable } from '@/lib/video'
import {
  MediaPlayer,
  type MediaPlayerInstance,
  MediaProvider,
  Poster,
  Track,
  useMediaRemote,
  VideoMimeType,
} from '@vidstack/react'
import type { DefaultLayoutTranslations } from '@vidstack/react/player/layouts/default'
import {
  DefaultAudioLayout,
  defaultLayoutIcons,
  DefaultVideoLayout,
} from '@vidstack/react/player/layouts/default'
import '@vidstack/react/player/styles/default/layouts/video.css'
import '@vidstack/react/player/styles/default/theme.css'
import ISO6391 from 'iso-639-1'
import { env } from 'next-runtime-env'
import {
  type ForwardedRef,
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import toast from 'react-hot-toast'

interface PlayerProps {
  id?: string
  language?: string
  aspectRatio?: string
  className?: string
  onTimeUpdate?: (time: number) => void
  onWaiting?: () => void
  onPlaying?: () => void
  onCanPlay?: () => void
  onError?: () => void
}

const Player = forwardRef(function Player(
  {
    aspectRatio = '16/9',
    className,
    onTimeUpdate,
    onError,
  }: PlayerProps,
  ref: ForwardedRef<MediaPlayerInstance>
) {
  const { t } = useClientTranslation()
  const playerRef = useRef<MediaPlayerInstance | null>(null)

  useEffect(() => {
    if (ref) {
      if (typeof ref === 'function') {
        ref(playerRef.current)
      } else {
        ref.current = playerRef.current
      }
    }
  }, [ref])

  const playerLanguage: DefaultLayoutTranslations = {
    'Caption Styles': t('extras:player.caption_styles'),
    'Captions look like this': t('extras:player.captions_look_like_this'),
    'Closed-Captions Off': t('extras:player.closed-captions_off'),
    'Closed-Captions On': t('extras:player.closed-captions_on'),
    'Display Background': t('extras:player.display_background'),
    'Enter Fullscreen': t('extras:player.enter_fullscreen'),
    'Enter PiP': t('extras:player.enter_pip'),
    'Exit Fullscreen': t('extras:player.exit_fullscreen'),
    'Exit PiP': t('extras:player.exit_pip'),
    'Google Cast': t('extras:player.google_cast'),
    'Keyboard Animations': t('extras:player.keyboard_animations'),
    'Seek Backward': t('extras:player.seek_backward'),
    'Seek Forward': t('extras:player.seek_forward'),
    'Skip To Live': t('extras:player.skip_to_live'),
    'Text Background': t('extras:player.text_background'),
    Accessibility: t('extras:player.accessibility'),
    AirPlay: t('extras:player.airplay'),
    Announcements: t('extras:player.announcements'),
    Audio: t('extras:player.audio'),
    Auto: t('extras:player.auto'),
    Boost: t('extras:player.boost'),
    Captions: t('extras:player.captions'),
    Chapters: t('extras:player.chapters'),
    Color: t('extras:player.color'),
    Connected: t('extras:player.connected'),
    Connecting: t('extras:player.connecting'),
    Continue: t('extras:player.continue'),
    Default: t('extras:player.default'),
    Disabled: t('extras:player.disabled'),
    Disconnected: t('extras:player.disconnected'),
    Download: t('extras:player.download'),
    Family: t('extras:player.family'),
    Font: t('extras:player.font'),
    Fullscreen: t('extras:player.fullscreen'),
    LIVE: t('extras:player.live'),
    Loop: t('extras:player.loop'),
    Mute: t('extras:player.mute'),
    Normal: t('extras:player.normal'),
    Off: t('extras:player.off'),
    Opacity: t('extras:player.opacity'),
    Pause: t('extras:player.pause'),
    PiP: t('extras:player.pip'),
    Play: t('extras:player.play'),
    Playback: t('extras:player.playback'),
    Quality: t('extras:player.quality'),
    Replay: t('extras:player.replay'),
    Reset: t('extras:player.reset'),
    Seek: t('extras:player.seek'),
    Settings: t('extras:player.settings'),
    Shadow: t('extras:player.shadow'),
    Size: t('extras:player.size'),
    Speed: t('extras:player.speed'),
    Text: t('extras:player.text'),
    Track: t('extras:player.track'),
    Unmute: t('extras:player.unmute'),
    Volume: t('extras:player.volume'),
  }

  const {
    id,
    title,
    poster,
    realVideoUrl,
    videoId,
    videoType,
    language: currentLanguage,
    originalSubtitles,
    translatedSubtitles,
    updateVideoInfo,
    originalVideoUrl,
  } = useVideoInfoStore((state) => ({
    id: state.id,
    title: state.title,
    poster: state.poster,
    realVideoUrl: state.realVideoUrl,
    videoId: state.id,
    videoType: state.videoType,
    language: state.language,
    originalSubtitles: state.originalSubtitles,
    translatedSubtitles: state.translatedSubtitles,
    updateVideoInfo: state.updateAll,
    originalVideoUrl: state.originalVideoUrl,
  }))
  const allSubtitles = useMemo(() => {
    return Object.entries(translatedSubtitles).map(([language, subtitles]) => ({
      language,
      cues: subtitles?.map((item) => ({
        startTime: item.startTime,
        endTime: item.end,
        text: item.text,
      })),
    }))
  }, [translatedSubtitles])
  const originalSubtitlesCues = useMemo(() => {
    return originalSubtitles?.map((item) => ({
      startTime: item.startTime,
      endTime: item.end,
      text: item.text,
    }))
  }, [originalSubtitles])

  const remote = useMediaRemote(playerRef.current)

  useEffect(() => {
    for (let i = 0; i < allSubtitles.length; i++) {
      if (allSubtitles[i].language === currentLanguage) {
        remote.changeTextTrackMode(i, 'showing')
      } else {
        remote.changeTextTrackMode(i, 'disabled')
      }
    }
  }, [allSubtitles, currentLanguage, remote])

  useEffect(() => {
    if (allSubtitles.length === 0) {
      remote.changeTextTrackMode(0, 'showing')
    }
  }, [allSubtitles, remote])

  const realVideoType = useMemo(() => {
    return videoType?.startsWith('audio') ? videoType : videoType === 'youtube' ? 'video/youtube' : 'video/mp4'
  }, [videoType])

  const { isSharePage } = useIsSharePath()

  useEffect(() => {
    if (isSharePage) {
      return
    }

    let videoUrl = realVideoUrl
    if (!videoUrl) {
      videoUrl = originalVideoUrl!
    }

    // Skip URL check for YouTube videos
    if (videoUrl.includes('youtube.com')) {
      return
    }

    if (videoUrl) {
      isVideoUrlUsable(videoUrl).then((res: boolean) => {
        if (!res) {
          const retryGetRealUrl = async (retries = 3) => {
            for (let i = 0; i < retries; i++) {
              try {
                // For Douyin videos, pass originalVideoUrl instead of videoId
                const idOrUrl =
                  videoType === 'douyin' || videoType === 'tiktok'
                    ? originalVideoUrl
                    : videoId
                const url = await getRealUrlForVideo(
                  videoType as string,
                  idOrUrl as string,
                  env('NEXT_PUBLIC_API_KEY') || ''
                )
                logger.info(`Retry ${i + 1}: realVideoUrl`, url)

                // For non-YouTube videos, verify the URL is usable
                if (url && !url.includes('youtube.com')) {
                  const isUsable = await isVideoUrlUsable(url)
                  if (isUsable) {
                    updateVideoInfo({ realVideoUrl: url })
                    return
                  }
                }

                // Wait before next retry
                if (i < retries - 1) {
                  await new Promise((resolve) => setTimeout(resolve, 1000))
                }
              } catch (error) {
                logger.error(`Retry ${i + 1} failed:`, error)
                if (i === retries - 1) {
                  toast.error(t('home:submit.get_real_url_failed'))
                }
              }
            }
          }
          retryGetRealUrl()
        }
      })
    }
  }, [videoType, videoId, updateVideoInfo, originalVideoUrl, t, isSharePage, realVideoUrl])

  return (
    <MediaPlayer
      ref={playerRef}
      title={title}
      src={{ src: realVideoUrl || '', type: realVideoType as VideoMimeType }}
      preload="auto"
      load="eager"
      logLevel='warn'
      crossOrigin
      className={cn('h-full w-full', className)}
      onError={(error) => {
        logger.error('Player error: %o', error)
        onError?.()
      }}
      onTimeUpdate={({ currentTime }) => {
        onTimeUpdate?.(currentTime)
      }}
    >
      <MediaProvider>
        <Poster
          className='absolute inset-0 block h-full w-full rounded-md object-cover opacity-0 transition-opacity data-[visible]:opacity-100'
          src={poster}
          alt=''
        />
        <Track
          key='Origin'
          label={'Origin'}
          kind='subtitles'
          language='Origin'
          type='json'
          default={true}
          content={{
            cues: originalSubtitlesCues,
          }}
        />
        {allSubtitles &&
          allSubtitles.map((subtitle) => (
            <Track
              key={subtitle.language}
              label={ISO6391.getNativeName(subtitle.language)}
              kind='subtitles'
              language={subtitle.language}
              type='json'
              default={subtitle.language === currentLanguage}
              content={{
                cues: subtitle.cues,
              }}
            />
          ))}
      </MediaProvider>
      <DefaultVideoLayout
        translations={playerLanguage}
        icons={defaultLayoutIcons}
      />
      <DefaultAudioLayout
        translations={playerLanguage}
        icons={defaultLayoutIcons}
      />
    </MediaPlayer>
  )
})

export const VideoPlayer = Player
