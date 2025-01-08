import { logger } from "@/lib/logger";
import ky from "ky";
import { env } from "next-runtime-env";

// Error class for Bilibili-specific errors
class BilibiliError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'BilibiliError';
  }
}

// Root Interface representing the entire JSON response for video URL
interface VideoUrlResponse {
  code: number;
  message: string;
  ttl: number;
  data: VideoUrlData;
}

interface VideoUrlData {
  from: string;
  result: string;
  message: string;
  quality: number;
  format: string;
  timelength: number;
  accept_format: string;
  accept_description: string[];
  accept_quality: number[];
  video_codecid: number;
  seek_param: string;
  seek_type: string;
  durl: Durl[];
  support_formats: SupportFormat[];
  high_format: HighFormat | null;
  last_play_time: number;
  last_play_cid: number;
  view_info: ViewInfo | null;
  subtitle: {
    allow_submit: boolean;
    list: SubtitleItem[];
  };
  user_status: {
    login: boolean;
    vip: boolean;
    pay: boolean;
    sponsor: boolean;
  };
}

// Interface for video info response
interface VideoInfoResponse {
  code: number;
  message: string;
  ttl: number;
  data: VideoInfoData;
}

interface VideoInfoData {
  bvid: string;
  aid: number;
  videos: number;
  tid: number;
  tname: string;
  copyright: number;
  pic: string;
  title: string;
  pubdate: number;
  ctime: number;
  desc: string;
  duration: number;
  owner: {
    mid: number;
    name: string;
    face: string;
  };
  stat: {
    aid: number;
    view: number;
    danmaku: number;
    reply: number;
    favorite: number;
    coin: number;
    share: number;
    like: number;
  };
}

interface Durl {
  order: number;
  length: number;
  size: number;
  ahead: string;
  vhead: string;
  url: string;
  backup_url: string[] | null;
}

interface SupportFormat {
  quality: number;
  format: string;
  new_description: string;
  display_desc: string;
  superscript: string;
  codecs: string | null;
}

interface HighFormat {
  quality: number;
  format: string;
  new_description: string;
  display_desc: string;
  superscript: string;
  codecs: string | null;
}

interface ViewInfo {
  count: number;
  danmaku: number;
}

interface SubtitleItem {
  id: number;
  lan: string;
  lan_doc: string;
  is_lock: boolean;
  subtitle_url: string;
  type: number;
}

const validateConfig = () => {
  const apiUrl = env('NEXT_PUBLIC_BILIBILI_API_URL');
  if (!apiUrl) {
    throw new BilibiliError('Bilibili API URL not configured');
  }
  return apiUrl;
};

const validateVideoUrlResponse = (response: VideoUrlResponse) => {
  if (response.code !== 0) {
    throw new BilibiliError(response.message || 'API request failed', response.code);
  }

  if (!response.data?.durl?.length) {
    throw new BilibiliError('No video URL found in response');
  }

  return response;
};

const validateVideoInfoResponse = (response: VideoInfoResponse) => {
  if (response.code !== 0) {
    throw new BilibiliError(response.message || 'API request failed', response.code);
  }

  if (!response.data) {
    throw new BilibiliError('No video info found in response');
  }

  return response;
};

export const getVideoInfo = async (bid: string) => {
  if (!bid) {
    throw new BilibiliError('Missing Bilibili video ID');
  }

  const apiUrl = validateConfig();

  try {
    const response = await ky
      .get(`${apiUrl}/info?bvid=${bid}`, {
        timeout: 10000,
        retry: {
          limit: 2,
          methods: ['get'],
          statusCodes: [408, 429, 500, 502, 503, 504]
        }
      })
      .json<VideoInfoResponse>();

    return validateVideoInfoResponse(response);

  } catch (error) {
    logger.error({
      message: 'Bilibili video info retrieval failed',
      bid,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    if (error instanceof BilibiliError) {
      throw error;
    }

    throw new BilibiliError(
      error instanceof Error ? error.message : 'Failed to get video info for Bilibili'
    );
  }
}

export const getRealUrlForBilibili = async (bid: string) => {
  if (!bid) {
    throw new BilibiliError('Missing Bilibili video ID');
  }

  const apiUrl = validateConfig();

  try {
    const response = await ky
      .get(`${apiUrl}/getvideo?bvid=${bid}`, {
        timeout: 10000,
        retry: {
          limit: 2,
          methods: ['get'],
          statusCodes: [408, 429, 500, 502, 503, 504]
        }
      })
      .json<VideoUrlResponse>();

    const validatedResponse = validateVideoUrlResponse(response);

    return validatedResponse;

  } catch (error) {
    logger.error({
      message: 'Bilibili video URL retrieval failed',
      bid,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    if (error instanceof BilibiliError) {
      throw error;
    }

    throw new BilibiliError(
      error instanceof Error ? error.message : 'Failed to get real URL for Bilibili'
    );
  }
}
