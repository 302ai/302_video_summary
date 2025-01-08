import { UseTranslationReturnType } from '@/types'
import { translateSubtitles } from '../ai/deepl-translation'
import { logger } from '../logger'
import { apiKy } from './api'
import { Subtitle } from '@/app/hooks/use-current-subtitles'

export interface TranscriptResult {
  detail: Detail
  success: boolean
}

export interface Detail {
  author: string
  authorId: string
  chapters: string[]
  contentText: string
  cover: string
  dbId: string
  descriptionText: string
  duration: number
  embedId: string
  id: string
  pageId: string
  rawLang: string
  subtitlesArray: Subtitle[]
  summary: string
  title: string
  type: string
  url: string
}

export const translate = async (
  t: UseTranslationReturnType,
  subtitles: Subtitle[],
  language: string
) => {
  try {

    const translatedSubtitles = await translateSubtitles(
      subtitles,
      language,
      100,
      10
    )
    const resetAllEndTime = translatedSubtitles.map(
      (subtitle, index, array) => {
        if (index < array.length - 1) {
          subtitle.end = array[index + 1].startTime
        }
        return subtitle
      }
    )

    return resetAllEndTime
  } catch (e) {
    throw new Error(t('errors.-10003'))
  }
}

export const transcript = async (t: UseTranslationReturnType, url: string) => {
  try {
    const resp = await apiKy
      .get('302/transcript', {
        searchParams: {
          url,
        },
      })
      .json<TranscriptResult>()
    return resp
  } catch (e) {
    logger.error(e)
    throw new Error(t('errors.-10003'))
  }
}
