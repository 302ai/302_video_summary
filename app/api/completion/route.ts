import { logger } from '@/lib/logger';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { env } from 'next-runtime-env';

// Allow streaming responses up to 3600 seconds
export const maxDuration = 3600;

export async function POST(req: Request) {
  const { prompt, apiKey, model, system }: { prompt: string; apiKey: string; model: string; system?: string } = await req.json();
  logger.debug('completion request: %s \n %s', prompt, model);
  const openai = createOpenAI({
    apiKey: apiKey,
    baseURL: env('NEXT_PUBLIC_API_URL') + '/v1',
  })
  const result = streamText({
    model: openai(model),
    system,
    prompt,
  });

  return result.toDataStreamResponse();
}
