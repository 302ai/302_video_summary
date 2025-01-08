'use server'
import { logger } from '@/lib/logger'
import ky from 'ky'
import { env } from 'next-runtime-env'

// Error class for TikTok-specific errors
class TikTokError extends Error {
  constructor(
    message: string,
    public code?: number
  ) {
    super(message)
    this.name = 'TikTokError'
  }
}

interface TikTokApiResponse {
  code: number
  data: {
    aweme_details: Array<{
      video: {
        play_addr: {
          url_list: string[]
        }
      }
      music: {
        play_url: {
          url_list: string[]
        }
      }
      share_info: {
        share_title: string
        share_url: string
        bool_persist: number
        share_desc: string
        share_link_desc: string
        share_quote: string
        share_desc_info: string
        share_title_myself: string
        share_title_other: string
        share_signature_url: string
        share_signature_desc: string
        whatsapp_desc: string
      }
    }>
  }
  params: {
    share_url: string
  }
  router: string
}

const validateConfig = () => {
  const apiUrl = env('NEXT_PUBLIC_API_URL')
  if (!apiUrl) {
    throw new TikTokError('API URL not configured')
  }
  return apiUrl
}

const validateResponse = (response: TikTokApiResponse) => {
  logger.info({ message: 'TikTok response', response })
  if (response.code !== 200 && response.code !== 0) {
    throw new TikTokError('API request failed', response.code)
  }

  const videoDetails = response.data.aweme_details.at(0)
  if (!videoDetails) {
    throw new TikTokError('No video details found in response')
  }

  const url = videoDetails.video.play_addr.url_list.at(0)
  if (!url) {
    throw new TikTokError('No video URL found in response')
  }

  return response
}

export const getRealUrlForTiktok = async (id: string, apiKey: string) => {
  if (!id) {
    throw new TikTokError('Missing video ID')
  }

  if (!apiKey) {
    throw new TikTokError('Missing API key')
  }

  const API_URL = validateConfig()

  try {
    const response = await ky
      .get(`${API_URL}/tools/tiktok/app/v3/fetch_one_video_by_share_url`, {
        searchParams: {
          share_url: id,
        },
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 10000,
        retry: {
          limit: 2,
          methods: ['get'],
          statusCodes: [408, 429, 500, 502, 503, 504],
        },
      })
      .json<TikTokApiResponse>()

    return validateResponse(response)
  } catch (error) {
    logger.error({
      message: 'TikTok video URL retrieval failed',
      id,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    if (error instanceof TikTokError) {
      throw error
    }

    throw new TikTokError(
      error instanceof Error
        ? error.message
        : 'Failed to get real URL for TikTok'
    )
  }
}
