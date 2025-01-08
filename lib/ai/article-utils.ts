import { ArticleType, EN_ARTICLE_BASE_PROMPTS, ZH_ARTICLE_BASE_PROMPTS, JA_ARTICLE_BASE_PROMPTS } from './constants';

export type { ArticleType };

// Get the base prompt for article generation
function getArticleBasePrompt(language: string, type: ArticleType): string {
  const promptMaps = {
    en: EN_ARTICLE_BASE_PROMPTS,
    zh: ZH_ARTICLE_BASE_PROMPTS,
    ja: JA_ARTICLE_BASE_PROMPTS,
  };

  return promptMaps[language as keyof typeof promptMaps]?.[type] || EN_ARTICLE_BASE_PROMPTS[type];
}

// Helper function to generate the final prompt
export function generateArticlePrompt({
  language,
  type,
  timeRange,
  contentType,
  targetLength,
  sectionContent,
}: {
  language: string;
  type: ArticleType;
  timeRange: string;
  contentType: string;
  targetLength: number;
  sectionContent: string;
}): string {
  const basePrompt = getArticleBasePrompt(language, type);

  return basePrompt
    .replace('{{timeRange}}', timeRange)
    .replace('{{contentType}}', contentType)
    .replace('{{targetLength}}', targetLength.toString())
    .replace('{{sectionContent}}', sectionContent);
}

// Helper function to process subtitles in chunks
export function processSubtitlesInChunks(subtitles: Array<{
  end: number;
  index: number;
  speaker_id: number;
  startTime: number;
  text: string;
}>, chunkDuration: number = 300) { // Default 5 minutes chunks
  const chunks: Array<{
    startTime: number;
    endTime: number;
    texts: string[];
    timeRange: string;
  }> = [];

  let currentChunk = {
    startTime: subtitles[0]?.startTime || 0,
    endTime: 0,
    texts: [] as string[],
    timeRange: '',
  };

  for (const subtitle of subtitles) {
    if (subtitle.startTime - currentChunk.startTime > chunkDuration) {
      // Format time range like "00:00-05:00"
      currentChunk.timeRange = `${formatTime(currentChunk.startTime)}-${formatTime(currentChunk.endTime)}`;
      chunks.push({ ...currentChunk });
      currentChunk = {
        startTime: subtitle.startTime,
        endTime: subtitle.end,
        texts: [subtitle.text],
        timeRange: '',
      };
    } else {
      currentChunk.texts.push(subtitle.text);
      currentChunk.endTime = subtitle.end;
    }
  }

  // Add the last chunk
  if (currentChunk.texts.length > 0) {
    currentChunk.timeRange = `${formatTime(currentChunk.startTime)}-${formatTime(currentChunk.endTime)}`;
    chunks.push(currentChunk);
  }

  return chunks;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}
