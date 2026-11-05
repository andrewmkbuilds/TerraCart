import { MSG } from './messages'
import * as api from '../services/app-api'
import { demoAnalysis } from '../services/demo-context'
import type { ChecklistItem, Preferences, ProductAnalysis, Reminder, TabContext } from '../types'
import { storage } from '../services/storage-service'

export function hasExtension(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.id
}

type FallbackPayload = Record<string, unknown> | undefined

async function fallback<T>(type: string, payload: FallbackPayload): Promise<T> {
  switch (type) {
    case MSG.GET_ACTIVE_CONTEXT:
    case MSG.ANALYSE_ACTIVE_TAB: {
      const preferences = await storage.getPreferences()
      const analysis = await api.recordAnalysis(await demoAnalysis(preferences))
      const context: TabContext = {
        tabId: null,
        url: analysis.product.url,
        hostname: analysis.product.hostname,
        title: analysis.product.name,
        supported: true,
        analysis,
      }
      return context as unknown as T
    }
    case MSG.ADD_TO_CHECKLIST:
      return api.addToChecklist((payload as { analysis: ProductAnalysis }).analysis) as unknown as T
    case MSG.SAVE_PRODUCT:
      return api.saveProduct((payload as { analysis: ProductAnalysis }).analysis) as unknown as T
    case MSG.UPDATE_CHECKLIST_ITEM: {
      const { id, patch } = payload as { id: string; patch: Partial<ChecklistItem> }
      return api.updateItem(id, patch) as unknown as T
    }
    case MSG.DELETE_CHECKLIST_ITEM:
      return api.removeItem((payload as { id: string }).id) as unknown as T
    case MSG.ADD_CHECKLIST_ITEM:
      return api.addManualChecklistItem(
        payload as { name: string; category: string; quantity: number; reusable?: boolean }
      ) as unknown as T
    case MSG.RECORD_ALTERNATIVE_OPEN:
      await api.recordAlternativeOpen((payload as { title: string }).title)
      return { ok: true } as unknown as T
    case MSG.SAVE_PREFERENCES:
      return api.savePreferences((payload as { preferences: Preferences }).preferences) as unknown as T
    case MSG.SAVE_REMINDERS:
      return api.saveReminders((payload as { reminders: Reminder[] }).reminders) as unknown as T
    case MSG.RESET_POINTS:
      return api.resetTerraPoints() as unknown as T
    case MSG.CLEAR_ACTIVITY:
      await api.clearActivity()
      return { ok: true } as unknown as T
    default:
      throw new Error(`Unsupported action: ${type}`)
  }
}

/** Send a message to the background worker, or run the same action locally in preview. */
export async function send<T = unknown>(type: string, payload?: FallbackPayload): Promise<T> {
  if (hasExtension()) {
    return new Promise<T>((resolve, reject) => {
      chrome.runtime.sendMessage({ type, payload }, (response: { ok: boolean; data?: T; error?: string }) => {
        const error = chrome.runtime.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }
        if (!response) {
          reject(new Error('No response from TerraCart background'))
          return
        }
        if (!response.ok) {
          reject(new Error(response.error || 'Request failed'))
          return
        }
        resolve(response.data as T)
      })
    })
  }
  return fallback<T>(type, payload)
}

export function openSettings(): void {
  if (hasExtension() && chrome.runtime.openOptionsPage) {
    void chrome.runtime.openOptionsPage()
    return
  }
  window.open('?view=settings', '_blank', 'noopener')
}