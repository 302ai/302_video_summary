import { useClientTranslation } from '@/app/hooks/use-client-translation'
import { useVideoInfoStore } from '@/app/stores/use-video-info-store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActionCard, CardState } from '../action-card'
import { ErrorMessage } from '../chatbox/error-message'
import { useChat } from '../chatbox/hooks'
import { LoadingIndicator } from '../chatbox/loading-indicator'
import { MessageInput } from '../chatbox/message-input'
import { MessageList } from '../chatbox/message-list'

export default function AIPanel({ className, setActiveTab }: { className?: string, setActiveTab: (tab: string) => void }) {
  const { t } = useClientTranslation()
  const { messages, isLoading, error, sendMessage, clearMessages } = useChat()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const { detailSummary, articles } = useVideoInfoStore((state) => ({
    detailSummary: state.detail,
    articles: state.articles,
  }))

  const hasDetailSummaryOrArticles = useMemo(() => {
    return detailSummary && detailSummary.length > 0 || articles && Object.values(articles).length > 0
  }, [detailSummary, articles])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (input.trim() !== '') {
      sendMessage(input)
      setInput('')
    }
  }
  const [aiCardState, setAICardState] = useState<CardState>(CardState.Action)
  const handleOnAction = () => {
    setActiveTab('detailed')
  }

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-xl bg-background',
        className
      )}
    >
     {hasDetailSummaryOrArticles ? (
      <>
       <ScrollArea className='flex-grow space-y-4 p-4'>
        <div ref={scrollRef}>
          <MessageList messages={messages} />
        </div>
      </ScrollArea>
      {error && <ErrorMessage message={error} />}
      {isLoading && <LoadingIndicator />}
      <MessageInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={isLoading}
      />
      <Button onClick={clearMessages} variant='link' className='text-sm'>
        {t('home:main.ai.clear_chat')}
      </Button></>
     ): (
      <ActionCard
          className='flex h-full flex-col items-center justify-center'
          stateConfig={{
            loading: {
              title: '',
              description: '',
            },
            empty: {
              title: '',
              description: '',
            },
            action: {
              title: t('home:main.ai.action_title'),
              description: t('home:main.ai.action_description'),
            },
          }}
          actionText={t('home:main.ai.action_text')}
          onAction={handleOnAction}
          cardState={aiCardState}
          setCardState={setAICardState}
        />
     )}
    </div>
  )
}
