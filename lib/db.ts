'use client'

import {
  VideoInfoActions,
  VideoInfoState,
} from '@/app/stores/use-video-info-store'
import Dexie, { type Table } from 'dexie'

class SessionDatabase extends Dexie {
  sessions!: Table<Omit<VideoInfoState, '_hasHydrated'>>

  constructor() {
    super('VideoSummarySessions')
    this.version(2).stores({
      sessions: '++id, title, createdAt, updatedAt',
    })
  }
}

const db = new SessionDatabase()

export const save = async (session: VideoInfoState & VideoInfoActions) => {
  const result = {
    id: session.id,
    originalVideoUrl: session.originalVideoUrl,
    realVideoUrl: session.realVideoUrl,
    title: session.title,
    poster: session.poster,
    videoType: session.videoType,
    language: session.language,
    originalSubtitles: session.originalSubtitles,
    translatedSubtitles: session.translatedSubtitles,
    brief: session.brief,
    detail: session.detail,
    backgroundType: session.backgroundType,
    customArticlePrompt: session.customArticlePrompt,
    chatMessages: session.chatMessages,
    articles: session.articles,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }

  const data = await db.sessions.get(result.id)

  if (data) {
    await db.sessions.update(session.id, { ...result })
  } else {
    await db.sessions.add({
      ...result,
      createdAt: result.createdAt!,
      updatedAt: result.updatedAt!,
    })
  }
}

export const getAll = async () => {
  const sessions = await db.sessions.toArray()
  return sessions.sort((prev, next) => next.updatedAt - prev.updatedAt)
}

export const remove = async (id: string) => {
  await db.sessions.delete(id)
}
