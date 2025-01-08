"use server"

import { isAudioSource } from "./audio"
import { logger } from "./logger"

/**
 * 检查给定的视频或音频 URL 是否可用。
 * @param url - 要检查的媒体 URL。
 * @returns 返回一个 Promise，解析为 `true` 如果 URL 可用并且内容类型是视频或音频；否则为 `false`。
 */
export async function isVideoUrlUsable(url: string): Promise<boolean> {
  // Skip check for YouTube URLs since they use a different player
  if (url.includes('youtube.com')) {
    return true
  }

  // Extract actual URL from proxy URL
  if (url.includes('/video-proxy')) {
    const _url = new URL(url, 'http://localhost:3000')
    url = _url.searchParams.get('url')!
  }

  try {
    // First check if it's an audio source
    const audioType = await isAudioSource(url)
    if (audioType) {
      return true
    }

    // If not audio, proceed with video check
    // Try HEAD request first
    let response = await fetch(url, {
      method: 'HEAD',
    })

    // If HEAD request fails (e.g., 405 Method Not Allowed), try partial GET request
    if (!response.ok) {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Range: 'bytes=0-0', // Request first byte only
        },
      })
    }

    // Check if response is successful
    if (!response.ok) {
      logger.warn(`URL check failed, status: ${response.status}, url: ${url}`)
      return false
    }

    // Check content type
    const contentType = response.headers.get('Content-Type')?.toLowerCase()
    const validContentTypes = [
      'video/',
      'url-media',
      'application/octet-stream',
      'application/x-mpegurl',
      'application/vnd.apple.mpegurl'
    ]

    const isValidContentType = contentType &&
      validContentTypes.some(type => contentType.startsWith(type))

    if (!isValidContentType) {
      logger.warn(`Invalid content type: ${contentType}, url: ${url}`)
      return false
    }

    // Check content length if available
    const contentLength = response.headers.get('Content-Length')
    if (contentLength && parseInt(contentLength) === 0) {
      logger.warn(`Empty content length for url: ${url}`)
      return false
    }

    return true

  } catch (error) {
    logger.error(`URL check error for ${url}: %o`, error)
    return false
  }
}
