import { Subtitle } from '@/app/hooks/use-current-subtitles'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { logger } from '../logger'
import { TRANSLATION_SYSTEM_PROMPT } from './constants'
import { fillPrompt } from './prompt-util'

interface TranslationProgress {
  progress: number
  total: number
  message: string
}

interface TranslationResult {
  translatedSubtitles: Subtitle[]
  success: boolean
}

export const subtitleTranslationService = {
  async translateSubtitles(
    subtitles: Subtitle[],
    targetLanguage: string,
    apiKey: string,
    modelName: string,
    baseURL: string,
    onProgressUpdate: (progress: TranslationProgress) => void
  ): Promise<TranslationResult> {
    const CONCURRENT_CALLS = 10
    const MAX_SUBTITLES_PER_CALL = 50
    const MAX_RETRIES = 3

    let progress = 0
    const total = Math.ceil(subtitles.length / MAX_SUBTITLES_PER_CALL)

    const updateProgress = () => {
      progress++
      const percentage = Math.floor((progress / total) * 100)
      onProgressUpdate({
        progress: percentage,
        total,
        message: `${percentage}% (${progress}/${total}) Translating subtitles...`,
      })
    }

    const batches = this.createBatches(subtitles, MAX_SUBTITLES_PER_CALL)
    const results: Subtitle[][] = []

    const processBatch = async (batch: Subtitle[]): Promise<Subtitle[]> => {
      let retries = 0
      while (retries < MAX_RETRIES) {
        try {
          const batchContent = this.createBatchContent(batch)
          const translatedBatch = await this.translateBatch(
            batchContent,
            targetLanguage,
            apiKey,
            modelName,
            baseURL
          )
          const processedBatch = this.processTranslatedBatch(
            translatedBatch,
            subtitles
          )
          updateProgress()
          return processedBatch
        } catch (error) {
          logger.error(
            `Translation error (retry ${retries + 1}/${MAX_RETRIES}): %o`,
            error
          )
          retries++
          if (retries >= MAX_RETRIES) {
            throw error
          }
        }
      }
      throw new Error('Translation error: Maximum retries reached')
    }

    try {
      const batchPromises = batches.map(processBatch)
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      const sortedResults = results.flat().sort((a, b) => a.index - b.index)
      return { translatedSubtitles: sortedResults, success: true }
    } catch (error) {
      logger.error('Error during translation process: %o', error)
      throw error
    }
  },

  createBatches(subtitles: Subtitle[], batchSize: number): Subtitle[][] {
    const batches = []
    for (let i = 0; i < subtitles.length; i += batchSize) {
      batches.push(subtitles.slice(i, i + batchSize))
    }
    return batches
  },

  createBatchContent(batch: Subtitle[]): string {
    return batch
      .map((subtitle) => `${subtitle.index} ${subtitle.text}`)
      .join('\n')
  },

  async translateBatch(
    batchContent: string,
    targetLanguage: string,
    apiKey: string,
    modelName: string,
    baseURL: string
  ): Promise<string> {
    const openai = createOpenAI({ apiKey, baseURL })
    const { text: result } = await generateText({
      model: openai(modelName),
      prompt: fillPrompt(TRANSLATION_SYSTEM_PROMPT, {
        targetLanguage: targetLanguage,
        content: batchContent,
      }),
      temperature: 0,
    })

    let extractedContent = result.match(
      /<output_text>([\s\S]*?)<\/output_text>/
    )?.[1]
    if (!extractedContent) {
      extractedContent = result
    }

    extractedContent = extractedContent
      .replace(/^```.*\n/gm, '')
      .replace(/^```\s*$/gm, '')

    if (extractedContent.toUpperCase().includes('<NO_NEED>')) {
      extractedContent = batchContent
    }

    logger.info('extractedContent: \n%s', extractedContent)

    const lines = extractedContent!.split('\n')
    if (lines.length < batchContent.split('\n').length) {
      throw new Error('Number of translated lines is less than input lines')
    }
    if (!lines[0].match(/^\d/)) {
      lines.shift()
    }
    return lines.join('\n')
  },

  processTranslatedBatch(
    translatedBatch: string,
    originalSubtitles: Subtitle[]
  ): Subtitle[] {
    return translatedBatch
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        if (!line.includes(' ')) {
          return { startTime: 0, end: 0, text: line, index: 0 }
        }
        const [indexStr, ...contentParts] = line.split(' ')
        const index = Number.parseInt(indexStr, 10)
        const original = originalSubtitles[index]
        return {
          startTime: original.startTime,
          end: original.end,
          text: contentParts.join(' '),
          index: index,
        }
      })
  },
}
