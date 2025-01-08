import { produce } from 'immer'
import { create } from 'zustand'
import { Message } from '../components/chatbox/types'
import { storeMiddleware } from './middleware'
import { Subtitle } from '../hooks/use-current-subtitles'
import { BackgroundType } from '../components/chatbox/message-input'

export interface VideoInfoState {
  _hasHydrated: boolean

  id?: string
  originalVideoUrl?: string
  realVideoUrl?: string
  title: string
  poster?: string
  videoType?: string
  language?: string
  originalSubtitles: Subtitle[]
  translatedSubtitles: Record<string, Subtitle[]>
  brief?: string
  detail?: string
  backgroundType?: string
  customArticlePrompt?: string
  chatMessages?: Message[]
  articles: {
    [key: string]: {
      chunks: {
        [key: number]: {
          content: string
          timeRange: string
        }
      }
      mergedContent: string
    }
  }

  createdAt: number
  updatedAt: number
}

export interface VideoInfoShare {
  id: string;
  originalVideoUrl: string;
  realVideoUrl: string;
  title: string;
  poster: string;
  videoType: string;
  language: string;
  originalSubtitles: Subtitle[];
  translatedSubtitles: Record<string, Subtitle[]>;
  brief: string;
  detail: string;
  backgroundType: BackgroundType;
}

export interface VideoInfoActions {
  refresh: () => void
  updateField: <T extends keyof VideoInfoState>(
    field: T,
    value: VideoInfoState[T]
  ) => void
  updateAll: (fields: Partial<VideoInfoState>) => void
  setHasHydrated: (value: boolean) => void
  reset: () => void
}

const initialState: VideoInfoState = {
  _hasHydrated: false,
  id: '',
  originalVideoUrl: '',
  realVideoUrl: '',
  title: '',
  poster: '',
  videoType: '',
  language: '',
  originalSubtitles: [],
  translatedSubtitles: {},
  brief: '',
  detail: '',
  backgroundType: '',
  customArticlePrompt: '',
  chatMessages: [],
  articles: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

export const useVideoInfoStore = create<VideoInfoState & VideoInfoActions>()(
  storeMiddleware<VideoInfoState & VideoInfoActions>(
    (set) => ({
      ...initialState,
      refresh: () =>
        set(
          produce((state) => {
            state.id = ''
            state.originalVideoUrl = ''
            state.realVideoUrl = ''
            state.title = ''
            state.poster = ''
            state.videoType = ''
            state.language = ''
            state.originalSubtitles = []
            state.translatedSubtitles = {}
            state.brief = ''
            state.detail = ''
            state.backgroundType = ''
            state.customArticlePrompt = ''
            state.chatMessages = []
            state.articles = {}
            state.createdAt = Date.now()
            state.updatedAt = Date.now()
          })
        ),
      updateField: (field, value) =>
        set(
          produce((state) => {
            state[field] = value
            state.updatedAt = Date.now()
          })
        ),
      updateAll: (fields) =>
        set(
          produce((state) => {
            for (const [key, value] of Object.entries(fields)) {
              state[key as keyof VideoInfoState] = value
            }
            state.updatedAt = Date.now()
          })
        ),
      setHasHydrated: (value) =>
        set(
          produce((state) => {
            state._hasHydrated = value
          })
        ),
      reset: () =>
        set(
          produce((state) => {
            state.id = ''
            state.originalVideoUrl = ''
            state.realVideoUrl = ''
            state.title = ''
            state.poster = ''
            state.videoType = ''
            state.language = ''
            state.originalSubtitles = []
            state.translatedSubtitles = {}
            state.brief = ''
            state.detail = ''
            state.backgroundType = ''
            state.customArticlePrompt = ''
            state.chatMessages = []
            state.articles = {}
            state.createdAt = Date.now()
            state.updatedAt = Date.now()
          })
        ),
    }),
    'video_info_store_videosum'
  )
)
