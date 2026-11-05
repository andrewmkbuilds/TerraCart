import { createAnalysis } from '../services/product-service'
import { storage } from '../services/storage-service'
import { MSG } from '../utils/messages'
import type { ProductAnalysis } from '../types'
import { detectProduct } from './product-detector'
import { TerraCartPanel, type PanelAction } from './panel'

const BLOCKED_HOSTS = [
  'google.',
  'youtube.',
  'github.',
  'reddit.',
  'wikipedia.',
  'instagram.',
  'facebook.',
  'x.com',
  'twitter.com',
  'linkedin.',
  'chatgpt.com',
  'openai.com',
  'claude.ai',
  'mail.google.',
  'docs.google.',
  'drive.google.',
  'notion.so',
  'figma.com',
  'netflix.',
  'spotify.',
  'whatsapp.',
  'web.whatsapp.',
  'outlook.',
  'slack.com',
]

const RETRY_DELAYS = [500, 1400, 2800, 4500]

let panel: TerraCartPanel | null = null
let lastUrl = location.href
let currentAnalysis: ProductAnalysis | null = null
let launcherVisible = true

function isBlocked(hostname: string): boolean {
  return BLOCKED_HOSTS.some((host) => hostname.includes(host))
}

function teardown(): void {
  panel?.destroy()
  panel = null
  currentAnalysis = null
}

function handleAction(action: PanelAction): void {
  if (action.type === 'open-alternative') {
    chrome.runtime
      .sendMessage({
        type: MSG.PANEL_ACTION,
        payload: { action: 'open-alternative', title: action.suggestion.title },
      })
      .catch(() => {})
    return
  }
  if (action.type === 'open-settings') {
    chrome.runtime.sendMessage({ type: MSG.PANEL_ACTION, payload: { action: 'open-settings' } }).catch(() => {})
    return
  }
  if (action.type === 'add-checklist' || action.type === 'save') {
    if (!currentAnalysis) return
    chrome.runtime
      .sendMessage({
        type: MSG.PANEL_ACTION,
        payload: { action: action.type, analysis: currentAnalysis },
      })
      .catch(() => {})
  }
}

async function scan(notify: boolean): Promise<ProductAnalysis | null> {
  if (window.top !== window.self) return null
  if (isBlocked(location.hostname)) {
    teardown()
    return null
  }

  const product = detectProduct()
  if (!product) {
    teardown()
    return null
  }

  const preferences = await storage.getPreferences()
  launcherVisible = preferences.floatingLauncher
  const analysis = createAnalysis(product, preferences)
  currentAnalysis = analysis

  if (panel) {
    panel.update(analysis)
    panel.setLauncherVisible(launcherVisible)
  } else {
    panel = new TerraCartPanel(analysis, handleAction, launcherVisible)
    panel.mount()
  }

  if (notify) {
    chrome.runtime.sendMessage({ type: MSG.PRODUCT_DETECTED, payload: { analysis } }).catch(() => {})
  }

  return analysis
}

function scheduleScans(): void {
  RETRY_DELAYS.forEach((delay) => {
    window.setTimeout(() => {
      // Stop retrying once a product is on screen.
      if (!currentAnalysis) void scan(true)
    }, delay)
  })
}

function watchUrlChanges(): void {
  window.setInterval(() => {
    if (location.href === lastUrl) return
    lastUrl = location.href
    teardown()
    window.setTimeout(() => void scan(true), 600)
    scheduleScans()
  }, 900)
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MSG.SCAN_NOW) {
    scan(true)
      .then((analysis) => sendResponse({ analysis }))
      .catch(() => sendResponse({ analysis: null }))
    return true
  }
  if (message?.type === MSG.OPEN_PANEL) {
    if (!panel) {
      void scan(true).then(() => panel?.expand())
    } else {
      panel.expand()
    }
    sendResponse({ ok: true })
    return false
  }
  return false
})

void scan(true)
scheduleScans()
watchUrlChanges()

// Keep the launcher in sync when the preference changes.
if (chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.terracart_preferences_v2) return
    const next = changes.terracart_preferences_v2.newValue
    launcherVisible = !!next?.floatingLauncher
    panel?.setLauncherVisible(launcherVisible)
  })
}