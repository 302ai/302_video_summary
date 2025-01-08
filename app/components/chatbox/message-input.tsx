import { useClientTranslation } from '@/app/hooks/use-client-translation'
import { useVideoInfoStore } from '@/app/stores/use-video-info-store'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ArticleType } from '@/lib/ai/article-utils'
import { ArticleTypeOptions } from '@/lib/ai/constants'
import { Loader2Icon, SendIcon } from 'lucide-react'
import { isEmpty } from 'radash'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

export type BackgroundType = ArticleType | 'detailSummary'
export const BackgroundTypeOptions = ArticleTypeOptions.concat('detailSummary')

export const MessageInput: React.FC<{
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled: boolean
}> = ({ value, onChange, onSend, disabled }) => {
  const { t } = useClientTranslation()
  const MAX_CHARS = 500


  const { articles, detailSummary, backgroundType, updateVideoInfo } =
    useVideoInfoStore((state) => ({
      articles: state.articles,
      detailSummary: state.detail,
      backgroundType: state.backgroundType,
      updateVideoInfo: state.updateAll,
    }))

  const setBackgroundType = useCallback((value: BackgroundType) => {
    updateVideoInfo({ backgroundType: value })
  }, [updateVideoInfo])

  const hasDetailSummary = !isEmpty(detailSummary)

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const availableBackgroundTypes = useMemo(() => {
    return BackgroundTypeOptions.filter((type) => {
      if (type === 'detailSummary' && hasDetailSummary) {
        return true
      }
      return articles[type as ArticleType] && !isEmpty(articles[type as ArticleType]?.mergedContent)
    })
  }, [articles, hasDetailSummary])


  const handleSend = () => {
    if (!backgroundType) {
      toast.error(t('extras:chatbox.error_no_background'))
      return
    }
    onSend()
  }

  useEffect(() => {
    if (!backgroundType) {
      setBackgroundType(availableBackgroundTypes[0] as BackgroundType)
    }
  }, [backgroundType, availableBackgroundTypes, setBackgroundType])


  return (
    <div className='border-t p-4'>
      <div className='mb-2 flex max-h-32 items-center justify-between gap-2'>
        <span className='shrink-0 text-sm font-medium text-muted-foreground'>
          {t('extras:chatbox.select_context')}
        </span>
        <Select
          value={backgroundType}
          defaultValue={backgroundType}
          onValueChange={(value: BackgroundType) => setBackgroundType(value)}
        >
          <SelectTrigger className='w-full'>
            <SelectValue placeholder={t('home:main.article.select_type')} />
          </SelectTrigger>
          <SelectContent>
            {availableBackgroundTypes.map((type) => {
              return (
                <SelectItem key={type} value={type}>
                  {t(`home:main.article.types.${type}`)}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>
      <div className='flex items-center space-x-2'>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
          onKeyPress={handleKeyPress}
          placeholder={t('extras:chatbox.message_input_placeholder')}
          className='flex-grow resize-none'
          rows={3}
          disabled={disabled}
        />
        <div className='flex flex-col items-center'>
          <Button
            onClick={handleSend}
            disabled={disabled || value.trim() === ''}
            className='px-3 py-2'
          >
            {disabled ? (
              <Loader2Icon className='h-4 w-4 animate-spin' />
            ) : (
              <SendIcon className='h-4 w-4' />
            )}
          </Button>
          <span className='mt-2 text-xs text-muted-foreground'>
            {value.length}/{MAX_CHARS}
          </span>
        </div>
      </div>
    </div>
  )
}
