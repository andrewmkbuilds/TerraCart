import type {
  UserPreferences,
  HistoryEntry,
  SavedProduct,
  ShoppingPattern,
  UserInteraction,
  PreferenceUpdate,
} from '../types'

const STORAGE_KEYS = {
  PREFERENCES: 'terracart_preferences',
  HISTORY: 'terracart_history',
  SAVED_PRODUCTS: 'terracart_saved',
  PATTERNS: 'terracart_patterns',
  INTERACTIONS: 'terracart_interactions',
  PREFERENCE_UPDATES: 'terracart_pref_updates',
  FIRST_RUN: 'terracart_first_run',
  PAUSED: 'terracart_paused',
} as const

// Use chrome.storage.local if available, otherwise fallback to localStorage
const isChromeExtension = typeof chrome !== 'undefined' && chrome.storage

async function getItem<T>(key: string): Promise<T | null> {
  if (isChromeExtension) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] ?? null)
      })
    })
  }
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

async function setItem<T>(key: string, value: T): Promise<void> {
  if (isChromeExtension) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve)
    })
  }
  localStorage.setItem(key, JSON.stringify(value))
}

async function removeItem(key: string): Promise<void> {
  if (isChromeExtension) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], resolve)
    })
  }
  localStorage.removeItem(key)
}

// ---- Preferences ----
export async function getPreferences(): Promise<UserPreferences | null> {
  return getItem<UserPreferences>(STORAGE_KEYS.PREFERENCES)
}

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  await setItem(STORAGE_KEYS.PREFERENCES, prefs)
}

// ---- History ----
export async function getHistory(): Promise<HistoryEntry[]> {
  return (await getItem<HistoryEntry[]>(STORAGE_KEYS.HISTORY)) ?? []
}

export async function saveHistory(history: HistoryEntry[]): Promise<void> {
  await setItem(STORAGE_KEYS.HISTORY, history.slice(0, 200))
}

export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
  const history = await getHistory()
  history.unshift(entry)
  await saveHistory(history.slice(0, 200))
}

// ---- Saved Products ----
export async function getSavedProducts(): Promise<SavedProduct[]> {
  return (await getItem<SavedProduct[]>(STORAGE_KEYS.SAVED_PRODUCTS)) ?? []
}

export async function saveSavedProducts(products: SavedProduct[]): Promise<void> {
  await setItem(STORAGE_KEYS.SAVED_PRODUCTS, products)
}

// ---- Patterns ----
export async function getPatterns(): Promise<ShoppingPattern[]> {
  return (await getItem<ShoppingPattern[]>(STORAGE_KEYS.PATTERNS)) ?? []
}

export async function savePatterns(patterns: ShoppingPattern[]): Promise<void> {
  await setItem(STORAGE_KEYS.PATTERNS, patterns)
}

// ---- Interactions ----
export async function getInteractions(): Promise<UserInteraction[]> {
  return (await getItem<UserInteraction[]>(STORAGE_KEYS.INTERACTIONS)) ?? []
}

export async function saveInteractions(interactions: UserInteraction[]): Promise<void> {
  await setItem(STORAGE_KEYS.INTERACTIONS, interactions.slice(0, 500))
}

// ---- First Run ----
export async function getFirstRun(): Promise<boolean> {
  const val = await getItem<boolean>(STORAGE_KEYS.FIRST_RUN)
  return val === null ? true : val
}

export async function setFirstRun(firstRun: boolean): Promise<void> {
  await setItem(STORAGE_KEYS.FIRST_RUN, firstRun)
}

// ---- Pause ----
export async function getPaused(): Promise<boolean> {
  return (await getItem<boolean>(STORAGE_KEYS.PAUSED)) ?? false
}

export async function setPaused(paused: boolean): Promise<void> {
  await setItem(STORAGE_KEYS.PAUSED, paused)
}

// ---- Clear All ----
export async function clearAllData(): Promise<void> {
  const keys = Object.values(STORAGE_KEYS)
  if (isChromeExtension) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, resolve)
    })
  }
  keys.forEach((key) => localStorage.removeItem(key))
}
