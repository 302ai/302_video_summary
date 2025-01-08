"use server"
import { logger } from "@/lib/logger";
import ky from "ky";
import { env } from "next-runtime-env";

// Error class for YouTube-specific errors
class YouTubeError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'YouTubeError';
  }
}

// Video info response interface
interface VideoInfoResponse {
  code: number;
  data: {
    author: string;
    category: string;
    channel_id: string;
    description: string;
    is_live_content: boolean;
    keywords: string[];
    number_of_views: string;
    published_time: string;
    thumbnails: Array<{
      height: number;
      url: string;
      width: number;
    }>;
    title: string;
    type: string;
    video_id: string;
    video_length: string;
  };
  params: {
    video_id: string;
  };
  router: string;
}

// Video stream response interface
interface VideoStreamResponse {
  code: number;
  data: Array<{
    approxDurationMs: string;
    audioChannels?: number;
    audioQuality?: string;
    audioSampleRate?: string;
    averageBitrate: number;
    bitrate: number;
    contentLength: string;
    fps?: number;
    height: number;
    itag: number;
    lastModified: string;
    mimeType: string;
    projectionType: string;
    quality: string;
    qualityLabel: string;
    url: string;
    width: number;
    indexRange?: {
      end: string;
      start: string;
    };
    initRange?: {
      end: string;
      start: string;
    };
  }>;
}

const validateConfig = () => {
  const apiUrl = env('NEXT_PUBLIC_API_URL');
  if (!apiUrl) {
    throw new YouTubeError('API URL not configured');
  }
  return apiUrl;
};

const validateVideoInfoResponse = (response: VideoInfoResponse) => {
  if (response.code !== 200 && response.code !== 0) {
    throw new YouTubeError('Video info API request failed', response.code);
  }

  if (!response.data.video_id) {
    throw new YouTubeError('No video ID found in response');
  }

  return response;
};

const validateStreamResponse = (response: VideoStreamResponse) => {
  if (response.code !== 200 && response.code !== 0) {
    throw new YouTubeError('Video stream API request failed', response.code);
  }

  if (!response.data || response.data.length === 0) {
    throw new YouTubeError('No video streams found in response');
  }

  return response;
};

export const getRealUrlForYoutube = async (id: string, apiKey: string) => {
  if (!id) {
    throw new YouTubeError('Missing video ID');
  }

  if (!apiKey) {
    throw new YouTubeError('Missing API key');
  }

  const API_URL = validateConfig();

  try {
    // First get video info
    const infoResponse = await ky
      .get(`${API_URL}/tools/youtube/web/get_video_info`, {
        searchParams: {
          video_id: id,
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
      .json<VideoInfoResponse>();

    const validatedInfoResponse = validateVideoInfoResponse(infoResponse);

    // Then get video stream URL
    const streamResponse = await ky
      .get(`${API_URL}/tools/youtube/web/get_video_stream`, {
        searchParams: {
          video_id: validatedInfoResponse.data.video_id,
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
      .json<VideoStreamResponse>();

    const validatedStreamResponse = validateStreamResponse(streamResponse);

    // Return combined response
    return {
      code: 200,
      data: {
        ...validatedInfoResponse.data,
        formats: validatedStreamResponse.data
      }
    };

  } catch (error) {
    logger.error({
      message: 'YouTube video URL retrieval failed',
      id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    if (error instanceof YouTubeError) {
      throw error;
    }

    throw new YouTubeError(
      error instanceof Error ? error.message : 'Failed to get real URL for YouTube'
    );
  }
};
