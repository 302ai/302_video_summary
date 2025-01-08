'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  EyeIcon,
  FileIcon,
  FileTextIcon,
  Maximize2Icon,
  Minimize2Icon,
  PenIcon,
  RefreshCcw,
  XIcon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import { useClientTranslation } from '../hooks/use-client-translation'
import { useIsSharePath } from '../hooks/use-is-share-path'
import { useVideoInfoStore } from '../stores/use-video-info-store'

interface MDRendererProps {
  content: string
  className?: string
  contentClassName?: string
  isGenerating?: boolean
  onRegenerate?: () => void
  onContentChange?: (newContent: string) => void
  contentHeight?: number
}

export default memo(function MDRenderer({
  content,
  className = '',
  contentClassName = '',
  isGenerating = false,
  onRegenerate,
  onContentChange,
  contentHeight,
}: MDRendererProps) {
  const { t } = useClientTranslation()
  const { isSharePage } = useIsSharePath()
  const { title } = useVideoInfoStore((state) => ({ title: state.title }))
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fullscreenRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingContent, setEditingContent] = useState(content)
  const [displayContent, setDisplayContent] = useState(content)

  // Update content states when prop changes
  useEffect(() => {
    setEditingContent(content)
    setDisplayContent(content)
  }, [content])

  // Reset scroll position on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [])

  const toggleFullscreen = useCallback(async () => {
    if (!fullscreenRef.current) return

    try {
      if (!document.fullscreenElement) {
        await fullscreenRef.current.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (err) {
      console.error('Error attempting to toggle fullscreen:', err)
    }
  }, [])

  const downloadText = useCallback(() => {
    const element = document.createElement('a')
    const file = new Blob([content], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = `${title}.txt`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }, [content, title])

  const downloadMD = useCallback(() => {
    const element = document.createElement('a')
    const file = new Blob([content], { type: 'text/markdown' })
    element.href = URL.createObjectURL(file)
    element.download = `${title}.md`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }, [content, title])

  const { theme } = useTheme()

  const isDark = useMemo(() => {
    return theme === 'dark'
  }, [theme])

  const handleEditToggle = useCallback(() => {
    if (isEditing) {
      const newContent = editingContent
      onContentChange?.(newContent)
      setDisplayContent(newContent)
    }
    setIsEditing(prev => !prev)
  }, [isEditing, editingContent, onContentChange])

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setEditingContent(newValue)
    onContentChange?.(newValue)
    setDisplayContent(newValue)
  }, [onContentChange])

  // Memoize syntax highlighting style
  const syntaxStyle = useMemo(() => isDark ? oneDark : oneLight, [isDark])

  // Add fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  return (
    <Card
      className={`group relative h-full w-full overflow-hidden shadow-none ${className}`}
    >
      <div
        className={`absolute right-2 top-1 z-10 flex items-center space-x-2 overflow-hidden rounded-md border border-border bg-background/80 p-1 text-sm backdrop-blur-sm transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100`}
      >
        {onRegenerate && (
          <Button
            variant='ghost'
            size='sm'
            onClick={onRegenerate}
            className={cn('flex items-center justify-center rounded p-1 hover:bg-accent', isSharePage && 'hidden')}
            aria-label={t('extras:md_renderer.regenerate')}
          >
            <RefreshCcw className='mr-1 h-4 w-4' />
            {t('extras:md_renderer.regenerate')}
          </Button>
        )}
        {onContentChange && (
          <Button
            variant='ghost'
            size='sm'
            onClick={handleEditToggle}
            className='flex items-center justify-center rounded p-1 hover:bg-accent'
            aria-label={t('extras:md_renderer.edit')}
          >
            {isEditing ? (
              <EyeIcon className='mr-1 h-4 w-4' />
            ) : (
              <PenIcon className='mr-1 h-4 w-4' />
            )}
            {isEditing ? t('extras:md_renderer.preview') : t('extras:md_renderer.edit')}
          </Button>
        )}
        <Button
          variant='ghost'
          size='sm'
          onClick={toggleFullscreen}
          className='flex items-center justify-center rounded p-1 hover:bg-accent'
          aria-label={
            isFullscreen
              ? t('extras:md_renderer.exit_fullscreen')
              : t('extras:md_renderer.enter_fullscreen')
          }
        >
          {isFullscreen ? (
            <Minimize2Icon className='mr-1 h-4 w-4' />
          ) : (
            <Maximize2Icon className='mr-1 h-4 w-4' />
          )}
          {isFullscreen
            ? t('extras:md_renderer.collapse')
            : t('extras:md_renderer.expand')}
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onClick={downloadText}
          className='flex items-center justify-center rounded p-1 hover:bg-accent'
          aria-label={t('extras:md_renderer.download_as_text')}
        >
          <FileTextIcon className='mr-1 h-4 w-4' />
          TXT
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onClick={downloadMD}
          className='flex items-center justify-center rounded p-1 hover:bg-accent'
          aria-label={t('extras:md_renderer.download_as_markdown')}
        >
          <FileIcon className='mr-1 h-4 w-4' />
          MD
        </Button>
      </div>
      <div
        ref={fullscreenRef}
        className={`${isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'h-full'}`}
      >
        {isFullscreen && (
          <Button
            variant='outline'
            size='sm'
            onClick={toggleFullscreen}
            className='absolute right-2 top-2 z-10 flex items-center justify-center rounded-full p-2 hover:bg-accent'
            aria-label={t('extras:md_renderer.exit_fullscreen')}
          >
            <XIcon className='h-4 w-4' />
          </Button>
        )}

        <div
          ref={scrollRef}
          className={cn(
            'prose dark:prose-invert mx-auto h-full p-4 text-sm max-w-none overflow-y-auto',
            'prose-headings:font-semibold prose-headings:tracking-tight',
            'prose-h1:text-2xl prose-h1:mt-4 prose-h1:mb-2',
            'prose-h2:text-xl prose-h2:mt-3 prose-h2:mb-2',
            'prose-h3:text-lg prose-h3:mt-3 prose-h3:mb-1.5',
            'prose-h4:text-base prose-h4:mt-2 prose-h4:mb-1',
            'prose-p:text-sm prose-p:leading-6 prose-p:my-2',
            'prose-blockquote:border-l-2 prose-blockquote:pl-3 prose-blockquote:my-2 prose-blockquote:italic prose-blockquote:text-muted-foreground',
            'prose-ul:my-2 prose-ul:list-disc prose-ul:pl-5',
            'prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-5',
            'prose-li:my-0.5 prose-li:text-sm',
            'prose-code:rounded prose-code:bg-muted/50 prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-xs',
            'prose-pre:my-2 prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-muted/50 prose-pre:p-3',
            'prose-img:my-2 prose-img:rounded-lg prose-img:border prose-img:border-border',
            'prose-hr:my-4 prose-hr:border-border',
            'prose-table:my-2 prose-table:w-full prose-table:text-sm prose-table:border-collapse',
            'prose-th:border prose-th:border-border prose-th:bg-muted/50 prose-th:p-2 prose-th:text-left',
            'prose-td:border prose-td:border-border prose-td:p-2',
            'prose-strong:font-semibold',
            'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
            '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
            contentClassName
          )}
          style={{ overflowAnchor: 'none' }}
        >
          {isEditing ? (
            <Textarea
              value={editingContent}
              onChange={handleTextareaChange}
              className="w-full font-mono text-sm"
              style={{
                height: isFullscreen
                  ? 'calc(100vh - 32px)'
                  : contentHeight
                    ? `${contentHeight - 32}px`
                    : '100%',
                resize: 'none'
              }}
            />
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // @ts-ignore
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter
                      // @ts-ignore
                      style={syntaxStyle}
                      language={match[1]}
                      PreTag='div'
                      customStyle={{
                        margin: 0,
                        fontSize: '12px',
                        lineHeight: '1.5',
                        borderRadius: '0.5rem',
                        background: isDark ? 'hsl(var(--muted))' : 'hsl(var(--muted))',
                      }}
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={cn('bg-muted/50 px-1 py-0.5 rounded text-xs font-mono', className)} {...props}>
                      {children}
                    </code>
                  )
                },
              }}
            >
              {displayContent}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </Card>
  )
}, (prevProps, nextProps) => {
  return prevProps.content === nextProps.content &&
    prevProps.className === nextProps.className &&
    prevProps.contentClassName === nextProps.contentClassName &&
    prevProps.contentHeight === nextProps.contentHeight
})
