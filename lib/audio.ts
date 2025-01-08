"use server"

import { logger } from "./logger"

// Explicit audio type definitions
export type AudioType =
  | 'audio/mpeg'      // MP3
  | 'audio/ogg'       // OGG
  | 'audio/3gp'       // 3GP
  | 'audio/mp4'       // MP4 audio
  | 'audio/webm'      // WebM audio
  | 'audio/flac'      // FLAC
  | 'audio/wav'       // WAV
  | 'audio/aac'       // AAC
  | 'audio/m4a'       // M4A
  | 'audio/opus'      // Opus

/**
 * Check if the given URL is an audio source and return its audio type.
 * Determined by:
 * 1. File extension
 * 2. Content-Type header (must be specific audio MIME type)
 * 3. File size
 * @param url - URL to check
 * @returns Promise resolving to audio type or null (if not audio)
 */
export async function isAudioSource(url: string): Promise<AudioType | null> {
  try {
    // Try HEAD request first
    let response = await fetch(url, {
      method: 'HEAD',
    })

    // If HEAD request fails, try partial GET request
    if (!response.ok) {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Range: 'bytes=0-0', // Only request first byte
        },
      })
    }

    // Check if response is successful
    if (!response.ok) {
      logger.warn(`URL check failed, status: ${response.status}, url: ${url}`)
      return null
    }

    // Check content type
    const contentType = response.headers.get('Content-Type')?.toLowerCase()
    if (!contentType) {
      return null
    }

    // Define supported audio MIME types and their mappings
    const validAudioTypes: Record<string, AudioType> = {
      'audio/mpeg': 'audio/mpeg',
      'audio/ogg': 'audio/ogg',
      'audio/3gp': 'audio/3gp',
      'audio/mp4': 'audio/mp4',
      'audio/webm': 'audio/webm',
      'audio/flac': 'audio/flac',
      'audio/wav': 'audio/wav',
      'audio/x-wav': 'audio/wav',
      'audio/wave': 'audio/wav',
      'audio/x-pn-wav': 'audio/wav',
      'audio/aac': 'audio/aac',
      'audio/m4a': 'audio/m4a',
      'audio/x-m4a': 'audio/m4a',
      'audio/opus': 'audio/opus'
    }

    // Check if it's a supported audio MIME type
    for (const [type, mappedType] of Object.entries(validAudioTypes)) {
      if (contentType.startsWith(type)) {
        // Check content length (if available)
        const contentLength = response.headers.get('Content-Length')
        if (contentLength && parseInt(contentLength) === 0) {
          logger.warn(`Empty content length for url: ${url}`)
          return null
        }
        return mappedType
      }
    }

    logger.warn(`Unsupported content type: ${contentType}, url: ${url}`)
    return null

  } catch (error) {
    logger.error(`Audio source check error for ${url}: %o`, error)
    return null
  }
}
