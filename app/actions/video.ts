'use server'
import { logger } from '@/lib/logger'
import { getRealUrlForBilibili, getVideoInfo as getBilibiliInfo } from './video/bilibili'
import { getRealUrlForDouyin } from './video/douyin'
import { getRealUrlForTiktok } from './video/tiktok'
import { getRealUrlForXiaohongshu } from './video/xiaohongshu'
import { getRealUrlForYoutube } from './video/youtube'

// Error class for video URL retrieval failures
class VideoUrlError extends Error {
  constructor(platform: string, message: string, cause?: unknown) {
    super(`Failed to get video URL from ${platform}: ${message}`)
    this.name = 'VideoUrlError'
    this.cause = cause
  }
}

// Unified video information interface
interface VideoInfo {
  videoUrl: string;
  audioUrl?: string;
  title: string;
  type: 'bilibili' | 'youtube' | 'xiaohongshu' | 'douyin' | 'tiktok';
  description?: string;
  cover?: string;
}

// Helper to create proxy URL for videos
const createProxyUrl = (url: string, type: VideoInfo['type']): string => {
  // Bilibili videos don't need proxy
  if (type === 'bilibili') return url
  return `/api/video-proxy?url=${encodeURIComponent(url)}`
}

// Helper to create proxy URL for images
const createImageProxyUrl = (url: string): string => {
  return `/api/video-proxy?url=${encodeURIComponent(url)}`
}

// Helper to safely extract URL with validation
const extractUrl = (url: string | undefined | null): string => {
  if (!url) {
    throw new Error('URL is empty or undefined')
  }
  try {
    // Basic URL validation
    new URL(url)
    return url
  } catch (e) {
    throw new Error('Invalid URL format')
  }
}

// Legacy function for backward compatibility
export const getRealUrlForVideo = async (type: string, ...extras: string[]) => {
  logger.info('getRealUrlForVideo %s %s', type, extras[1])

  try {
    let response
    let url: string | undefined

    switch (type) {
      case 'bilibili':
        response = await getRealUrlForBilibili(extras[0])
        url = response?.data.durl.at(-1)?.url
        break

      case 'youtube':
        response = await getRealUrlForYoutube(extras[0], extras[1])
        // url = response?.data.formats.at(0)?.url
        url = `https://www.youtube.com/watch?v=${extras[0]}`
        break

      case 'xiaohongshu':
        response = await getRealUrlForXiaohongshu(extras[0], extras[1])
        url = response?.data.data.data.at(0)?.note_list.at(0)?.video.url
        break

      case 'douyin':
        response = await getRealUrlForDouyin(extras[0], extras[1])
        url = response?.data.aweme_details.at(0)?.video.play_addr.url_list.at(0)
        break

      case 'tiktok':
        response = await getRealUrlForTiktok(extras[0], extras[1])
        url = response?.data.aweme_details.at(0)?.video.play_addr.url_list.at(0)
        break

      default:
        throw new VideoUrlError(type, 'Unsupported platform')
    }

    const validatedUrl = extractUrl(url)
    return (type === 'bilibili' || type === 'youtube' )? validatedUrl : createProxyUrl(validatedUrl, type as VideoInfo['type'])

  } catch (error) {
    logger.error({
      message: 'Video URL retrieval failed',
      platform: type,
      error: error instanceof Error ? error.message : 'Unknown error',
      extras
    })

    throw error instanceof VideoUrlError
      ? error
      : new VideoUrlError(
          type,
          error instanceof Error ? error.message : 'Unknown error',
          error
        )
  }
}

// New unified function for getting video information
export const getVideoInfo = async (url: string, apiKey?: string): Promise<VideoInfo> => {
  logger.info('getVideoInfo', { url, apiKey: apiKey ? '***' : undefined })

  try {
    // Determine platform from URL
    let type: VideoInfo['type']
    if (url.includes('douyin.com')) {
      type = 'douyin'
    } else if (url.includes('tiktok.com')) {
      type = 'tiktok'
    } else if (url.includes('youtube.com')) {
      type = 'youtube'
    } else if (url.includes('bilibili.com')) {
      type = 'bilibili'
    } else if (url.includes('xiaohongshu.com')) {
      type = 'xiaohongshu'
    } else {
      throw new VideoUrlError('unknown', 'Unsupported platform')
    }

    // Extract video info based on platform
    switch (type) {
      case 'bilibili': {
        const videoId = url.match(/BV\w+/)?.[0]
        if (!videoId) throw new VideoUrlError(type, 'Invalid Bilibili URL')

        // Get both video URL and info
        const [urlResponse, infoResponse] = await Promise.all([
          getRealUrlForBilibili(videoId),
          getBilibiliInfo(videoId)
        ]);

        const videoUrl = extractUrl(urlResponse.data.durl.at(-1)?.url)

        return {
          videoUrl,
          title: infoResponse.data.title,
          type,
          description: infoResponse.data.desc,
          cover: infoResponse.data.pic ? createImageProxyUrl(infoResponse.data.pic) : undefined // Proxy the cover image
        }
      }

      case 'youtube': {
        const videoId = new URLSearchParams(url.split('?')[1]).get('v')
        if (!videoId) throw new VideoUrlError(type, 'Invalid YouTube URL')

        const response = await getRealUrlForYoutube(videoId, apiKey!)
        return {
          videoUrl: url,
          title: response.data.title || videoId,
          type,
          description: response.data.description,
          cover: response.data.thumbnails?.[0]?.url
        }
      }

      case 'xiaohongshu': {
        const noteId = url.match(/items\/(\w+)/)?.[1]
        if (!noteId) throw new VideoUrlError(type, 'Invalid Xiaohongshu URL')

        const response = await getRealUrlForXiaohongshu(noteId, apiKey!)
        const note = response.data.data.data[0]?.note_list[0]
        if (!note?.video?.url) throw new VideoUrlError(type, 'No video found')

        return {
          videoUrl: createProxyUrl(extractUrl(note.video.url), type),
          title: note.title || noteId,
          type,
          description: note.desc,
          cover: note.video.thumbnail
        }
      }

      case 'douyin':
      case 'tiktok': {
        const fn = type === 'douyin' ? getRealUrlForDouyin : getRealUrlForTiktok
        const response = await fn(url, apiKey!)
        const video = response.data.aweme_details[0]
        if (!video) throw new VideoUrlError(type, 'No video found')

        const videoUrl = extractUrl(video.video.play_addr.url_list[0])
        const audioUrl = video.music?.play_url?.url_list?.[0]

        return {
          videoUrl: createProxyUrl(videoUrl, type),
          audioUrl: audioUrl ? createProxyUrl(audioUrl, type) : undefined,
          title: video.share_info.share_title || url,
          type,
          description: video.share_info.share_desc
        }
      }

      default:
        throw new VideoUrlError('unknown', 'Unsupported platform')
    }

  } catch (error) {
    logger.error({
      message: 'Video info retrieval failed',
      url,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    throw error instanceof VideoUrlError
      ? error
      : new VideoUrlError(
          'unknown',
          error instanceof Error ? error.message : 'Unknown error',
          error
        )
  }
}
