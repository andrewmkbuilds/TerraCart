import { useCallback, useEffect, useState } from 'react'
import type {
  AnalysisRecord,
  ChecklistItem,
  ChecklistSummary,
  LevelInfo,
  PointsState,
  Preferences,
  Reminder,
  SavedProduct,
  SyncState,
  TabContext,
} from '../types'
import { createDefaultPoints, DEFAULT_PREFERENCES, onStorageChange, storage } from '../services/storage-service'
import { ensureWeek, levelFor } from '../services/points-service'
import { summaryOf } from '../services/checklist-service'
import { MSG } from '../utils/messages'
import { applyAppearance } from '../utils/theme'
import { send } from '../utils/messaging'

export type AnalysisStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

export interface PopupData {
  ready: boolean
  preferences: Preferences
  points: PointsState
  level: LevelInfo
  checklist: ChecklistItem[]
  summary: ChecklistSummary
  saved: SavedProduct[]
  reminders: Reminder[]
  history: AnalysisRecord[]
  sync: SyncState
  context: TabContext | null
  status: AnalysisStatus
  error: string | null
  refresh: () => Promise<void>
  analyse: () => Promise<void>
  updatePreferences: (patch: Partial<Preferences>) => Promise<void>
}

export function usePopupData(analyseOnOpen = true): PopupData {
  const [ready, setReady] = useState(false)
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [points, setPoints] = useState<PointsState>(createDefaultPoints())
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [saved, setSaved] = useState<SavedProduct[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [history, setHistory] = useState<AnalysisRecord[]>([])
  const [sync, setSync] = useState<SyncState>({ status: 'unconfigured' })
  const [context, setContext] = useState<TabContext | null>(null)
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [nextPreferences, nextPoints, nextChecklist, nextSaved, nextReminders, nextHistory, nextSync] =
      await Promise.all([
        storage.getPreferences(),
        storage.getPoints(),
        storage.getChecklist(),
        storage.getSaved(),
        storage.getReminders(),
        storage.getHistory(),
        storage.getSync(),
      ])
    setPreferences(nextPreferences)
    setPoints(ensureWeek(nextPoints))
    setChecklist(nextChecklist)
    setSaved(nextSaved)
    setReminders(nextReminders)
    setHistory(nextHistory)
    setSync(nextSync)
    applyAppearance(nextPreferences)
    setReady(true)
  }, [])

  const analyse = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const next = await send<TabContext>(MSG.ANALYSE_ACTIVE_TAB)
      setContext(next)
      setStatus(next.supported ? 'ready' : 'empty')
      await refresh()
    } catch (cause) {
      setError((cause as Error)?.message || 'Could not analyse this page')
      setStatus('error')
    }
  }, [refresh])

  const updatePreferences = useCallback(
    async (patch: Partial<Preferences>) => {
      const next = { ...preferences, ...patch }
      setPreferences(next)
      applyAppearance(next)
      await send(MSG.SAVE_PREFERENCES, { preferences: next })
      await refresh()
    },
    [preferences, refresh]
  )

  useEffect(() => {
    void (async () => {
      await refresh()
      if (analyseOnOpen) {
        setStatus('loading')
        try {
          const next = await send<TabContext>(MSG.GET_ACTIVE_CONTEXT)
          setContext(next)
          setStatus(next.supported ? 'ready' : 'empty')
        } catch {
          setStatus('empty')
        }
      }
    })()
  }, [refresh, analyseOnOpen])

  useEffect(() => {
    return onStorageChange(() => {
      void refresh()
    })
  }, [refresh])

  return {
    ready,
    preferences,
    points,
    level: levelFor(points.points),
    checklist,
    summary: summaryOf(checklist),
    saved,
    reminders,
    history,
    sync,
    context,
    status,
    error,
    refresh,
    analyse,
    updatePreferences,
  }
}