'use server'
import { logger } from '@/lib/logger';
import ky from 'ky';
import { env } from 'next-runtime-env';
import { getAwemeId } from './douyin/aweme-id';

// Error class for Douyin-specific errors
class DouyinError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'DouyinError';
  }
}

interface VideoResponse {
  code: number;
  data: {
    aweme_details: Array<{
      video: {
        play_addr: {
          url_list: string[];
        };
      };
      music: {
        play_url: {
          url_list: string[];
        };
      };
      share_info: {
        share_title: string;
        share_url: string;
        bool_persist: number;
        share_desc: string;
        share_link_desc: string;
        share_quote: string;
        share_desc_info: string;
        share_title_myself: string;
        share_title_other: string;
        share_signature_url: string;
        share_signature_desc: string;
        whatsapp_desc: string;
      };
    }>;
  };
}

const validateConfig = () => {
  const apiUrl = env('NEXT_PUBLIC_API_URL');
  if (!apiUrl) {
    throw new DouyinError('API URL not configured');
  }
  return apiUrl;
};

const validateResponse = (response: VideoResponse) => {
  if (response.code !== 0 && response.code !== 200) {
    throw new DouyinError('API request failed', response.code);
  }

  const videoDetails = response.data.aweme_details.at(0);
  if (!videoDetails) {
    throw new DouyinError('No video details found in response');
  }

  const url = videoDetails.video.play_addr.url_list.at(0);
  if (!url) {
    throw new DouyinError('No video URL found in response');
  }

  return response;
};

export const getRealUrlForDouyin = async (id: string, apiKey: string) => {
  if (!id) {
    throw new DouyinError('Missing video ID');
  }

  if (!apiKey) {
    throw new DouyinError('Missing API key');
  }

  const API_URL = validateConfig();

  try {
    // Get aweme ID first
    const awemeId = await getAwemeId(id, apiKey);
    if (!awemeId) {
      throw new DouyinError('Failed to get aweme ID');
    }

    // Fetch video details
    const response = await ky
      .get(`${API_URL}/tools/douyin/web/fetch_one_video_v2`, {
        searchParams: {
          aweme_id: awemeId,
        },
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 10000,
        retry: {
          limit: 2,
          methods: ['get'],
          statusCodes: [408, 429, 500, 502, 503, 504]
        }
      })
      .json<VideoResponse>();

    return validateResponse(response);

  } catch (error) {
    logger.error({
      message: 'Douyin video URL retrieval failed',
      id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    if (error instanceof DouyinError) {
      throw error;
    }

    throw new DouyinError(
      error instanceof Error ? error.message : 'Failed to get real URL for Douyin'
    );
  }
};
