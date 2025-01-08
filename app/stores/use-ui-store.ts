import { produce } from 'immer'
import { create } from 'zustand'

import { storeMiddleware } from './middleware'
type SettingKey = 'hideBrand' | 'showCost'
interface UIStore {
  _hasHydrated: boolean
  activeTab: string
  activeTabLeft: string
  activeTabRight: string
  articleType: string
}

interface UIActions {
  updateField: <T extends keyof UIStore>(
    field: T,
    value: UIStore[T]
  ) => void
  updateAll: (fields: Partial<UIStore>) => void
  setHasHydrated: (value: boolean) => void
}

export const useUIStore = create<UIStore & UIActions>()(
  storeMiddleware<UIStore & UIActions>(
    (set) => ({
      _hasHydrated: false,
      activeTab: 'video',
      activeTabLeft: 'video',
      activeTabRight: 'brief',
      articleType: 'regular',
      updateField: (field, value) =>
        set(
          produce((state) => {
            state[field] = value
          })
        ),
      updateAll: (fields) =>
        set(
          produce((state) => {
            for (const [key, value] of Object.entries(fields)) {
              state[key as keyof UIStore] = value
            }
          })
        ),
      setHasHydrated: (value) =>
        set(
          produce((state) => {
            state._hasHydrated = value
          })
        ),
    }),
    'ui_store_videosum'
  )
)
