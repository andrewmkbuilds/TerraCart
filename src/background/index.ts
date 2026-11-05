import type { DetectedProduct, ProductAnalysis, TabContext } from '../types'
import { MSG } from '../utils/messages'
import { storage } from '../services/storage-service'
import { createAnalysis } from '../services/product-service'
import {
  addManualChecklistItem,
  addToChecklist,
  clearActivity,
  recordAlternativeOpen,
  recordAnalysis,
  removeItem,
  resetTerraPoints,
  savePreferences,
  saveProduct,
  saveReminders,
  updateItem,
} from '../services/app-api'
import { handleAlarm, syncAlarms } from '../services/reminders-service'
import { getSyncState, pullSnapshot, pushSnapshot, buildSnapshot } from '../services/base44-service'

const cache = new Map<number, TabContext>()

function ok(sendResponse: (value: unknown) => void, promise: Promise<unknown>) {
  promise
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error: unknown) => sendResponse({ ok: false, error: String((error as Error)?.message || error) }))
  return true
}

async function activeTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab || null
}

function isScannable(url?: string): boolean {
  return !!url && /^https?:/i.test(url)
}

/** Ask the content script for a scan, injecting it if the page predates the install. */
async function requestScan(tabId: number): Promise<ProductAnalysis | null> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: MSG.SCAN_NOW })
    return (response?.analysis as ProductAnalysis) || null
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
      const response = await chrome.tabs.sendMessage(tabId, { type: MSG.SCAN_NOW })
      return (response?.analysis as ProductAnalysis) || null
    } catch {
      return null
    }
  }
}

async function contextForTab(tab: chrome.tabs.Tab, force = false): Promise<TabContext> {
  const cached = cache.get(tab.id || -1)
  const base: TabContext = {
    tabId: tab.id ?? null,
    url: tab.url || '',
    hostname: '',
    title: tab.title || '',
    supported: false,
    analysis: null,
  }

  if (!tab.id || !isScannable(tab.url)) return base

  try {
    base.hostname = new URL(tab.url as string).hostname
  } catch {
    return base
  }

  if (cached && !force && cached.url === tab.url) return cached

  const analysis = await requestScan(tab.id)
  const context: TabContext = {
    ...base,
    supported: !!analysis,
    analysis,
    detectedAt: analysis ? Date.now() : undefined,
  }
  cache.set(tab.id, context)
  return context
}

async function recordFromAnalysis(analysis: ProductAnalysis, action: 'add-checklist' | 'save') {
  if (action === 'add-checklist') {
    const result = await addToChecklist(analysis)
    return { added: result.added, count: result.items.length }
  }
  const result = await saveProduct(analysis)
  return { added: result.added, count: result.saved.length }
}

async function handlePanelAction(payload: {
  action: string
  analysis?: ProductAnalysis
  title?: string
}) {
  switch (payload.action) {
    case 'add-checklist':
    case 'save':
      if (!payload.analysis) return { ok: false }
      return recordFromAnalysis(payload.analysis, payload.action)
    case 'open-alternative':
      if (payload.title) await recordAlternativeOpen(payload.title)
      return { ok: true }
    case 'open-settings':
      await chrome.runtime.openOptionsPage()
      return { ok: true }
    default:
      return { ok: false }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, payload } = message || {}

  switch (type) {
    case MSG.PRODUCT_DETECTED: {
      const analysis = (payload as { analysis?: ProductAnalysis })?.analysis
      if (!analysis) return false
      const tabId = _sender?.tab?.id
      if (tabId) {
        cache.set(tabId, {
          tabId,
          url: analysis.product.url,
          hostname: analysis.product.hostname,
          title: analysis.product.name,
          supported: true,
          analysis,
          detectedAt: Date.now(),
        })
      }
      return ok(sendResponse, recordAnalysis(analysis))
    }

    case MSG.GET_ACTIVE_CONTEXT:
      return ok(
        sendResponse,
        (async () => {
          const tab = await activeTab()
          if (!tab) return { supported: false, analysis: null } as TabContext
          return contextForTab(tab)
        })()
      )

    case MSG.ANALYSE_ACTIVE_TAB:
      return ok(
        sendResponse,
        (async () => {
          const tab = await activeTab()
          if (!tab) return { supported: false, analysis: null } as TabContext
          return contextForTab(tab, true)
        })()
      )

    case MSG.PANEL_ACTION:
      return ok(sendResponse, handlePanelAction(payload as { action: string }))

    case MSG.ADD_TO_CHECKLIST:
      return ok(sendResponse, addToChecklist((payload as { analysis: ProductAnalysis }).analysis))
    case MSG.SAVE_PRODUCT:
      return ok(sendResponse, saveProduct((payload as { analysis: ProductAnalysis }).analysis))
    case MSG.UPDATE_CHECKLIST_ITEM: {
      const { id, patch } = payload as { id: string; patch: Record<string, unknown> }
      return ok(sendResponse, updateItem(id, patch))
    }
    case MSG.DELETE_CHECKLIST_ITEM:
      return ok(sendResponse, removeItem((payload as { id: string }).id))
    case MSG.ADD_CHECKLIST_ITEM:
      return ok(sendResponse, addManualChecklistItem(payload as { name: string; category: string; quantity: number }))
    case MSG.RECORD_ALTERNATIVE_OPEN:
      return ok(sendResponse, recordAlternativeOpen((payload as { title: string }).title))
    case MSG.SAVE_PREFERENCES:
      return ok(sendResponse, savePreferences((payload as { preferences: never }).preferences))
    case MSG.SAVE_REMINDERS:
      return ok(sendResponse, saveReminders((payload as { reminders: never }).reminders))
    case MSG.RESET_POINTS:
      return ok(sendResponse, resetTerraPoints())
    case MSG.CLEAR_ACTIVITY:
      return ok(sendResponse, clearActivity())

    default:
      return false
  }
})

// ------------------------------------------------------------- lifecycle

chrome.tabs.onRemoved.addListener((tabId) => cache.delete(tabId))
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) cache.delete(tabId)
})

chrome.alarms.onAlarm.addListener((alarm) => {
  void handleAlarm(alarm.name)
})

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    const preferences = await storage.getPreferences()
    await storage.setPreferences(preferences)
    await storage.getChecklist()
    await storage.getReminders()
    await storage.getPoints()
    await syncAlarms()
    if (details.reason === 'install') {
      await chrome.runtime.openOptionsPage()
    }
  })()
})

chrome.runtime.onStartup?.addListener(() => {
  void syncAlarms()
})

// ------------------------------------------------------------- optional Base44 sync

async function maybeSync(): Promise<void> {
  const preferences = await storage.getPreferences()
  if (!preferences.cloudSync) return
  const state = await getSyncState()
  if (state.status !== 'connected') return
  try {
    const snapshot = await buildSnapshot()
    await pushSnapshot(snapshot)
  } catch {
    /* sync is best-effort; local data is always authoritative */
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  const keys = Object.keys(changes)
  if (keys.some((key) => key.startsWith('terracart_') && key !== 'terracart_sync_v2')) {
    void maybeSync()
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SYNC_PULL') {
    return ok(sendResponse, pullSnapshot())
  }
  if (message?.type === 'SYNC_NOW') {
    return ok(sendResponse, maybeSync().then(() => getSyncState()))
  }
  return false
})

// Re-export for tooling / debugging.
export type { DetectedProduct }