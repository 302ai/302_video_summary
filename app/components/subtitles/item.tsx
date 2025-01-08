'use client'
import { Subtitle } from '@/app/hooks/use-current-subtitles'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import DOMPurify from 'dompurify'

// Simple color generation with predefined pleasant colors
const COLORS = [
  '60 130 246',   // Blue
  '139 92 246',   // Purple
  '236 72 153',   // Pink
  '45 212 191',   // Teal
  '168 85 247',   // Violet
  '79 70 229',    // Indigo
  '14 165 233',   // Sky
  '99 102 241',   // Slate blue
  '147 51 234',   // Bright purple
  '6 182 212',    // Cyan
  '124 58 237',   // Purple-blue
  '59 130 246',   // Light blue
  '192 38 211',   // Magenta
  '16 185 129',   // Emerald
  '88 28 135',    // Deep purple
]

const generateSpeakerColor = (index: number) => {
  const color = COLORS[Math.abs(index) % COLORS.length]
  return `rgb(${color} / 0.9)`
}

export interface SubtitleItemProps {
  subtitle: Subtitle
  onClick?: (startTime: number) => void
  searchText?: string
  className?: string
  isActive?: boolean
}

export default function SubtitleItem({
  subtitle,
  onClick,
  searchText = '',
  className,
  isActive = false,
}: SubtitleItemProps) {
  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const seconds = Math.floor(time % 60)

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  const highlightContent = (content: string, searchText: string) => {
    if (!searchText) return content
    const regex = new RegExp(`(${searchText})`, 'gi')

    return content.replace(regex, '<mark>$1</mark>')
  }

  const sanitizedContent = DOMPurify.sanitize(
    highlightContent(subtitle.text, searchText)
  )

  const speakerNumber = subtitle.speaker_id !== undefined ? subtitle.speaker_id + 1 : '?'
  const displayNumber = speakerNumber.toString().length > 2
    ? `${speakerNumber}`
    : speakerNumber
  const colorStyle = subtitle.speaker_id !== undefined
    ? { backgroundColor: generateSpeakerColor(Math.abs(subtitle.speaker_id)) }
    : { backgroundColor: 'rgb(148 163 184 / 0.9)' } // Neutral color for unknown speaker

  return (
    <Card
      className={cn(
        'w-full cursor-pointer rounded-md border shadow-none transition-colors hover:border-primary',
        className
      )}
    >
      <CardContent
        className={cn(
          'flex w-full items-center gap-3 p-3 hover:bg-accent/50',
          isActive && 'bg-blue-50 dark:bg-blue-900'
        )}
        onClick={() => onClick?.(subtitle.startTime)}
      >
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-medium shadow-sm text-white',
            displayNumber.toString().length > 2 ? 'text-xs' : 'text-base'
          )}
          style={colorStyle}
        >
          {displayNumber}
        </div>
        <div className='w-full gap-1.5'>
          <span className='text-sm font-medium text-sky-400 inline-block pr-2'>
            {formatTime(subtitle.startTime)}
          </span>
          <span
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
            className='min-h-[1.5em] w-full whitespace-pre-wrap break-words text-sm leading-relaxed'
          />
        </div>
      </CardContent>
    </Card>
  )
}
