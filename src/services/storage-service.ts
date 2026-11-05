import { STORAGE_KEYS } from '../utils/keys'
import type {
  ChecklistItem,
  DetectedProduct,
  PointsState,
  Preferences,
  Reminder,
  SavedProduct,
  SyncState,
  AnalysisRecord,
} from '../types'

const hasChromeStorage = () => typeof chrome !== 'undefined' && !!chrome.storage?.local

async function read<T>(key: string, fallback: T): Promise<T> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(key)
    return (result?.[key] as T) ?? fallback
  }
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

async function write<T>(key: string, value: T): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [key]: value })
    return
  }
  localStorage.setItem(key, JSON.stringify(value))
}

export const DEFAULT_PREFERENCES: Preferences = {
  priorities: ['plastic-reduction', 'reusability', 'durability'],
  preferredCategories: [],
  notificationsEnabled: false,
  floatingLauncher: true,
  reduceMotion: false,
  compactMode: false,
  saveHistory: true,
  cloudSync: false,
  onboarded: false,
}

export function createDefaultPoints(): PointsState {
  return {
    points: 0,
    events: [],
    achievements: {},
    challengeWeek: { weekId: '', items: [] },
    streak: { current: 0, longest: 0, lastActiveDate: null },
    counters: {
      analyses: 0,
      reusableItemsAdded: 0,
      plasticFreePurchases: 0,
      alternativesOpened: 0,
      featuresUsed: [],
      dailyAnalyses: {},
      awardedKeys: {},
    },
  }
}

export const DEFAULT_REMINDERS: Reminder[] = [
  { id: 'bottle', label: 'Carry a reusable water bottle', enabled: true, time: '08:00', days: [1, 2, 3, 4, 5], custom: false },
  { id: 'bags', label: 'Bring reusable shopping bags', enabled: true, time: '17:00', days: [5, 6], custom: false },
  { id: 'cup', label: 'Carry a coffee cup', enabled: false, time: '08:00', days: [1, 2, 3, 4, 5], custom: false },
  { id: 'containers', label: 'Bring food containers', enabled: false, time: '11:30', days: [1, 2, 3, 4, 5], custom: false },
  { id: 'cutlery', label: 'Avoid disposable cutlery', enabled: false, time: '12:00', days: [1, 2, 3, 4, 5], custom: false },
]

export const storage = {
  getPreferences: () => read<Preferences>(STORAGE_KEYS.preferences, DEFAULT_PREFERENCES),
  setPreferences: (value: Preferences) => write(STORAGE_KEYS.preferences, value),

  getChecklist: () => read<ChecklistItem[]>(STORAGE_KEYS.checklist, []),
  setChecklist: (value: ChecklistItem[]) => write(STORAGE_KEYS.checklist, value),

  getSaved: () => read<SavedProduct[]>(STORAGE_KEYS.saved, []),
  setSaved: (value: SavedProduct[]) => write(STORAGE_KEYS.saved, value),

  getPoints: () => read<PointsState>(STORAGE_KEYS.points, createDefaultPoints()),
  setPoints: (value: PointsState) => write(STORAGE_KEYS.points, value),

  getReminders: () => read<Reminder[]>(STORAGE_KEYS.reminders, DEFAULT_REMINDERS),
  setReminders: (value: Reminder[]) => write(STORAGE_KEYS.reminders, value),

  getHistory: () => read<AnalysisRecord[]>(STORAGE_KEYS.history, []),
  setHistory: (value: AnalysisRecord[]) => write(STORAGE_KEYS.history, value.slice(0, 60)),

  getManualProduct: () => read<DetectedProduct | null>(STORAGE_KEYS.manualProduct, null),
  setManualProduct: (value: DetectedProduct | null) => write(STORAGE_KEYS.manualProduct, value),

  getSync: () =>
    read<SyncState>(STORAGE_KEYS.sync, { status: 'unconfigured' } as SyncState),
  setSync: (value: SyncState) => write(STORAGE_KEYS.sync, value),

  async clearActivity() {
    await this.setHistory([])
    await this.setSaved([])
    await this.setManualProduct(null)
  },

  async resetPoints() {
    await this.setPoints(createDefaultPoints())
  },

  async clearEverything() {
    const keys = Object.values(STORAGE_KEYS)
    if (hasChromeStorage()) {
      await chrome.storage.local.remove(keys)
      return
    }
    keys.forEach((key) => localStorage.removeItem(key))
  },
}

/** Subscribe to storage writes made by any extension context. */
export function onStorageChange(callback: () => void): () => void {
  if (!hasChromeStorage() || !chrome.storage.onChanged) return () => {}
  const listener = (_changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local') callback()
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

export async function exportSnapshot(): Promise<string> {
  const data = {
    exportedAt: new Date().toISOString(),
    preferences: await storage.getPreferences(),
    checklist: await storage.getChecklist(),
    saved: await storage.getSaved(),
    points: await storage.getPoints(),
    reminders: await storage.getReminders(),
    history: await storage.getHistory(),
  }
  return JSON.stringify(data, null, 2)
}