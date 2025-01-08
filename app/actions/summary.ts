'use server'
import {
  BRIEF_SUMMARY_SYSTEM_PROMPT,
  DETAILED_SUMMARY_SYSTEM_PROMPT_P1,
  DETAILED_SUMMARY_SYSTEM_PROMPT_P2,
  DETAILED_SUMMARY_SYSTEM_PROMPT_P3,
  fillPrompt,
} from '@/lib/ai'
import { logger } from '@/lib/logger'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText, streamText } from 'ai'
import { createStreamableValue } from 'ai/rsc'
import { env } from 'next-runtime-env'
import { Message } from '../components/chatbox/types'
import { Step } from './types'

export async function generateBriefSummary(
  title: string,
  subtitle: string,
  apiKey: string,
  model: string,
  language: string
) {
  const stream = createStreamableValue('')

  try {
    const openai = createOpenAI({
      apiKey,
      baseURL: env('NEXT_PUBLIC_API_URL') + '/v1',
    })

    logger.debug('Brief summary request: %s \n %s', title, subtitle)
    ;(async () => {
      try {
        const { textStream } = await streamText({
          model: openai(model),
          system: fillPrompt(BRIEF_SUMMARY_SYSTEM_PROMPT, {
            targetLanguage: language,
          }),
          prompt: `视频标题：${title}\n视频字幕：\n${subtitle}`,
        })
        for await (const delta of textStream) {
          stream.update(delta)
        }

        stream.done()
      } catch (e: any) {
        stream.error(e.responseBody)
      }
    })()
  } catch (error) {
    stream.error(error)
  }

  return { output: stream.value, error: null }
}

export async function generateDetailedSummary(
  subtitle: string,
  apiKey: string,
  model: string,
  language: string
) {
  const stream = createStreamableValue('')
  try {
    const openai = createOpenAI({
      apiKey,
      baseURL: env('NEXT_PUBLIC_API_URL') + '/v1',
    })

    ;(async () => {
      try {
        // Step 1: P1 - Convert subtitle to narrative
        stream.update(
          JSON.stringify({
            type: 'progress',
            message: Step.P1,
            percentage: 0,
          }) + '\n'
        )
        const { text: narrative } = await generateText({
          model: openai(model),
          prompt: fillPrompt(DETAILED_SUMMARY_SYSTEM_PROMPT_P1, {
            subtitle: subtitle,
            targetLanguage: language,
          }),
        })

        // Step 2: P2 - Generate outline
        stream.update(
          JSON.stringify({
            type: 'progress',
            message: Step.P2,
            percentage: 33,
          }) + '\n'
        )
        const { text: outline } = await generateText({
          model: openai(model),
          prompt: fillPrompt(DETAILED_SUMMARY_SYSTEM_PROMPT_P2, {
            subtitle: narrative,
            targetLanguage: language,
          }),
        })

        // Step 3: P3 - Generate detailed summary
        stream.update(
          JSON.stringify({
            type: 'progress',
            message: Step.P3,
            percentage: 66,
          }) + '\n'
        )
        const { textStream } = await streamText({
          model: openai(model),
          prompt: fillPrompt(DETAILED_SUMMARY_SYSTEM_PROMPT_P3, {
            subtitle: subtitle,
            outline: outline,
            targetLanguage: language,
          }),
        })

        for await (const chunk of textStream) {
          stream.update(JSON.stringify({ type: 'content', data: chunk }) + '\n')
        }

        stream.update(
          JSON.stringify({
            type: 'progress',
            message: Step.DONE,
            percentage: 100,
          }) + '\n'
        )
        stream.update(JSON.stringify({ type: 'done' }) + '\n')
      } catch (error: any) {
        logger.error('Error in generateDetailedSummary: %o', error)
        stream.error(error.responseBody)
      } finally {
        stream.done()
      }
    })()
  } catch (error) {
    stream.error(error)
  }

  return { output: stream.value }
}

export async function continueConversation(
  history: Message[],
  videoInfo: string,
  apiKey: string,
  model: string
) {
  const openai = createOpenAI({
    apiKey,
    baseURL: env('NEXT_PUBLIC_API_URL') + '/v1',
  })
  const stream = createStreamableValue()

  ;(async () => {
    try {
      const { textStream } = await streamText({
        model: openai(model),
        system: `你是302AI助手，你的任务是，根据${videoInfo}中的内容回答用户的问题。如果你不知道如何回答，可以说"我不知道"。`,
        messages: history.map((message) => ({
          role: message.sender === 'user' ? 'user' : 'assistant',
          content: message.content,
        })),
      })

      for await (const text of textStream) {
        stream.update(text)
      }

      stream.done()
    } catch (e: any) {
      logger.error('Error in continueConversation: %o', e)
      stream.error(e.responseBody)
    }
  })()

  return {
    output: stream.value,
  }
}
