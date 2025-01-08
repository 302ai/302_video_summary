import { Subtitle } from '@/app/hooks/use-current-subtitles';
import pLimit from 'p-limit';
import { apiKy } from '../api/api';
import { logger } from '../logger';

/**
 * Translate a single batch of subtitles
 */
async function translateBatch(
  batch: Subtitle[],
  targetLang: string,
): Promise<Subtitle[]> {
  const texts = batch.map(subtitle => subtitle.text);

  try {
    const response: any = await apiKy.post('deepl/v2/translate', {
      json: {
        source_lang: '',
        target_lang: targetLang.toUpperCase(),
        text: texts,
      },
    }).json();

    const translations = response.translations;

    if (!translations || translations.length !== batch.length) {
      throw new Error('Number of translations does not match original subtitles');
    }

    return batch.map((subtitle, index) => ({
      ...subtitle,
      text: translations[index].text,
    }));
  } catch (error) {
    logger.error('Error during batch translation: %o', error);
    throw error;
  }
}

/**
 * Concurrently translate all subtitles
 */
export async function translateSubtitles(
  subtitles: Subtitle[],
  targetLang: string,
  maxBatchSize: number = 100,
  concurrentLimit: number = 5
): Promise<Subtitle[]> {
  // Split subtitles into batches
  const batches: Subtitle[][] = [];
  for (let i = 0; i < subtitles.length; i += maxBatchSize) {
    batches.push(subtitles.slice(i, i + maxBatchSize));
  }

  // Create concurrency limiter
  const limit = pLimit(concurrentLimit);

  // Translate all batches concurrently
  const translationPromises = batches.map(batch =>
    limit(() => translateBatch(batch, targetLang))
  );

  try {
    const translatedBatches = await Promise.all(translationPromises);
    // Merge all translated batches into a single array
    return translatedBatches.flat();
  } catch (error) {
    logger.error('Error during translation process: %o', error)
    throw error
  }
}
