import { generateText } from "ai";

import {  fillPrompt } from "@/lib/ai";
import { createOpenAI } from "@ai-sdk/openai";
import { env } from "next-runtime-env";
import { GEN_IMAGE_PROMPT } from "@/lib/ai/constants";

export async function genImagePrompt({
  apiKey,
  model,
  text
}: {
  apiKey: string
  model: string
  text: string
}) {
  const openai = createOpenAI({
    apiKey,
    baseURL: env('NEXT_PUBLIC_API_URL') + '/v1',
  })
  const { text: prompt } = await generateText({
    model: openai(model),
    prompt: fillPrompt(GEN_IMAGE_PROMPT, {
      text
    }),
  })

  return prompt
}
