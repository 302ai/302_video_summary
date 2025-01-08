import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export enum CardState {
  Loading = 'loading',
  Empty = 'empty',
  Action = 'action',
}

interface StateConfig {
  loading: {
    title: string
    description: string
    progress?: number
  }
  empty: {
    title: string
    description: string
  }
  action: {
    title: string
    description: string
  }
}

interface ActionCardProps {
  className?: string
  stateConfig: StateConfig
  actionText: string
  onAction: () => void
  cardState: CardState
  setCardState: (state: CardState) => void
}

export const ActionCard = ({
  className,
  stateConfig,
  actionText,
  onAction,
  cardState,
  setCardState,
}: ActionCardProps) => {
  return (
    <Card
      className={cn(
        'h-full flex flex-col items-center justify-center space-y-4 p-8 border-none shadow-none',
        className
      )}
    >
      {cardState === CardState.Loading ? (
        <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
          <div className='flex flex-col items-center justify-center space-y-4'>
            <div className='text-lg font-bold'>{stateConfig.loading.title}</div>
            <div className='text-center text-sm text-gray-500'>
              {stateConfig.loading.description}
            </div>
            {stateConfig.loading.progress !== undefined && (
              <div className='w-full max-w-xs'>
                <div className='h-2 w-full rounded-full bg-gray-200'>
                  <div
                    className='h-2 rounded-full bg-blue-500 transition-all duration-500'
                    style={{ width: `${stateConfig.loading.progress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
          <div className='flex flex-col items-center justify-center space-y-4'>
            <Skeleton className='h-4 w-[250px]' />
            <Skeleton className='h-4 w-[200px]' />
          </div>
        </div>
      ) : cardState === CardState.Empty ? (
        <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
          <div className='text-lg font-bold'>{stateConfig.empty.title}</div>
          <div className='text-center text-sm text-gray-500'>
            {stateConfig.empty.description}
          </div>
        </div>
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
          <div className='text-lg font-bold'>{stateConfig.action.title}</div>
          <div className='text-center text-sm text-gray-500'>
            {stateConfig.action.description}
          </div>
          <Button onClick={onAction}>{actionText}</Button>
        </div>
      )}
    </Card>
  )
}
