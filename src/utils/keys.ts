/** Single source of truth for chrome.storage keys. */
export const STORAGE_KEYS = {
  preferences: 'terracart_preferences_v2',
  checklist: 'terracart_checklist_v2',
  saved: 'terracart_saved_v2',
  points: 'terracart_points_v2',
  reminders: 'terracart_reminders_v2',
  history: 'terracart_history_v2',
  manualProduct: 'terracart_manual_product_v2',
  sync: 'terracart_sync_v2',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]