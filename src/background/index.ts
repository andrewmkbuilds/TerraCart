// ============================================================
// TerraCart Background Service Worker
// Handles: side panel, tab monitoring, message routing,
// website controls, badge updates, installation,
// Gemini AI request routing
// ============================================================

import { analyzeProductWithGemini, researchAlternativesWithGemini, chatWithGemini } from '../ai/gemini-service'
import { getApiKey, saveApiKey, isApiKeyConfigured } from '../ai/gemini-client'
import type { Product, UserPreferences } from '../types'

const STORAGE_KEYS = {
  FIRST_RUN: 'terracart_first_run',
  PAUSED: 'terracart_paused',
  PREFERENCES: 'terracart_preferences',
  WEBSITE_ENABLED: 'terracart_website_enabled',
  HISTORY: 'terracart_history',
  SAVED: 'terracart_saved',
  PATTERNS: 'terracart_patterns',
  INTERACTIONS: 'terracart_interactions',
  AUTO_ACTIVATE: 'terracart_auto_activate',
  WEBSITE_AUTO_OPEN: 'terracart_website_auto_open',
} as const

// ---- Known shopping domains (expanded for UAE/GCC focus) ----
const KNOWN_SHOPPING_DOMAINS = [
  // Global
  'amazon.com', 'amazon.ae', 'amazon.co.uk', 'amazon.de', 'amazon.fr',
  'amazon.co.jp', 'amazon.in', 'amazon.ca', 'amazon.com.au',
  'walmart.com', 'target.com', 'bestbuy.com', 'ebay.com', 'etsy.com',
  'aliexpress.com',
  // UAE/GCC Major Retailers
  'noon.com', 'namshi.com', 'centrepoint.com', '6thstreet.com',
  'ounass.ae', 'shein.com', 'hm.com', 'zara.com', 'pullandbear.com',
  'bershka.com', 'stradivarius.com', 'massimodutti.com',
  'nike.com', 'adidas.ae', 'adidas.com', 'puma.com', 'newbalance.com',
  'asos.com', 'splashfashion.com', 'maxfashion.com',
  'marksandspencer.com', 'next.ae', 'lcwaikiki.com',
  'sivvi.com', 'levelshoes.com', 'bloomingdales.ae',
  'harveynichols.com', 'faces.ae', 'sephora.ae',
  'thebodyshop.ae', 'bathandbodyworks.com', 'lookfantastic.com',
  'iherb.com', 'mumzworld.com', 'firstcry.ae',
  'virginmegastore.me', 'kikomilano.ae', 'rituals.com',
  'americaneagle.me',
  // UAE Grocery & Pharmacy
  'carrefouruae.com', 'luluhypermarket.com', 'spinneys.com',
  'waitrose.ae', 'boots.ae', 'lifepharmacy.com',
  // UAE Electronics
  'sharafdg.com', 'jumbo.ae', 'emax.ae',
  // UAE Home
  'danubehome.com', 'ikea.ae', 'aceuae.com',
]

// ---- Side Panel Setup ----
if (chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})
  chrome.sidePanel.setOptions({ enabled: true }).catch(() => {})
}

// ---- Click on extension icon: open side panel ----
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId })
    } catch {
      chrome.tabs.sendMessage(tab.id, { type: 'OPEN_SIDE_PANEL' }).catch(() => {})
    }
  }
})

// ---- Message Handling ----
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  switch (message.type) {

    // ---- Panel / Navigation ----
    case 'OPEN_SIDE_PANEL': {
      chrome.sidePanel?.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
        .then(() => sendResponse({ success: true }))
        .catch((err: unknown) => sendResponse({ success: false, error: String(err) }))
      return true
    }

    case 'CLOSE_SIDE_PANEL': {
      sendResponse({ success: true })
      return false
    }

    // ---- Tab / Scan Data ----
    case 'CONTENT_SCRIPT_READY': {
      if (sender.tab?.id) {
        if (message.data) tabDetectionData.set(sender.tab.id, message.data)
        updateBadgeForTab(sender.tab.id, 'active')

        // Auto-open side panel on e-commerce sites if enableAutoOpenPanel is on
        const prefs = await chrome.storage.local.get(STORAGE_KEYS.PREFERENCES)
        const userPrefs = prefs[STORAGE_KEYS.PREFERENCES]
        if (userPrefs?.enableAutoOpenPanel !== false && sender.tab.windowId) {
          // Check per-site auto-open override
          const tabUrl = message.data?.url || ''
          const siteAutoOpen = await isWebsiteAutoOpen(tabUrl)
          const pageType = message.data?.pageType as string | undefined
          const productPagesOnly = userPrefs?.autoOpenProductPagesOnly === true
          if (siteAutoOpen && (!productPagesOnly || pageType === 'product')) {
            const tabId = sender.tab.id
            const windowId = sender.tab.windowId
            const delayMs = ((userPrefs?.autoOpenDelay as number) ?? 2) * 1000
            const showNotification = userPrefs?.autoOpenNotification !== false

            // Notify content script that auto-open is pending (shows toast)
            if (showNotification && delayMs > 0 && tabId) {
              try {
                chrome.tabs.sendMessage(tabId, {
                  type: 'AUTO_OPEN_PENDING',
                  delay: delayMs,
                }).catch(() => {})
              } catch { /* tab may have navigated */ }
            }

            // Delay the actual panel open
            const timerId = setTimeout(async () => {
              pendingAutoOpenTimers.delete(tabId)
              try {
                await chrome.sidePanel.open({ windowId })
                // Notify content script that panel opened (plays sound with configured volume)
                if (tabId) {
                  chrome.tabs.sendMessage(tabId, {
                    type: 'AUTO_OPEN_DONE',
                    chimeVolume: userPrefs?.chimeVolume ?? 'soft',
                  }).catch(() => {})
                }
              } catch { /* side panel may already be open or context invalidated */ }
            }, delayMs)
            pendingAutoOpenTimers.set(tabId, timerId)
          }
        }
      }
      sendResponse({ success: true })
      return false
    }

    case 'CANCEL_AUTO_OPEN': {
      const tabId4 = sender.tab?.id
      if (tabId4) {
        const timer = pendingAutoOpenTimers.get(tabId4)
        if (timer) {
          clearTimeout(timer)
          pendingAutoOpenTimers.delete(tabId4)
        }
      }
      sendResponse({ success: true })
      return false
    }

    case 'PAGE_SCANNED': {
      if (sender.tab?.id && message.data) {
        tabScanData.set(sender.tab.id, message.data)
        if (message.data.primaryProduct) {
          updateBadgeForTab(sender.tab.id, 'product')
        } else if (message.data.productCount > 0) {
          updateBadgeForTab(sender.tab.id, 'search')
        } else {
          updateBadgeForTab(sender.tab.id, 'active')
        }
      }
      sendResponse({ success: true })
      return false
    }

    case 'SET_BADGE': {
      const tabId = sender.tab?.id
      if (tabId && message.text !== undefined) {
        chrome.action.setBadgeText({ text: message.text, tabId })
        if (message.color) chrome.action.setBadgeBackgroundColor({ color: message.color, tabId })
      }
      sendResponse({ success: true })
      return false
    }

    case 'SCAN_PAGE': {
      // MUST use non-async callback so return true keeps the channel open
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0]
        if (!tab?.id) {
          sendResponse({ error: 'No active tab found', type: 'other', products: [], retailer: '', pageTitle: '', timestamp: Date.now() })
          return
        }
        const tabId = tab.id
        if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://'))) {
          sendResponse({ error: 'Cannot scan browser pages. Navigate to a website first.', type: 'other', products: [], retailer: '', pageTitle: tab.title || '', timestamp: Date.now() })
          return
        }
        // Try sending to content script
        chrome.tabs.sendMessage(tabId, { type: 'SCAN_PAGE' }, (result) => {
          if (chrome.runtime.lastError || !result) {
            // Content script not loaded — inject it
            console.log('TerraCart BG: Content script not responding, injecting...')
            chrome.scripting.executeScript({
              target: { tabId },
              files: ['content.js'],
            }, () => {
              // Wait for init then retry
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, { type: 'SCAN_PAGE' }, (retryResult) => {
                  if (chrome.runtime.lastError || !retryResult) {
                    sendResponse({
                      type: 'other',
                      products: [],
                      primaryProduct: null,
                      retailer: tab.url ? new URL(tab.url).hostname : '',
                      pageTitle: tab.title || '',
                      timestamp: Date.now(),
                    })
                  } else {
                    sendResponse(retryResult)
                  }
                })
              }, 600)
            })
          } else {
            sendResponse(result)
          }
        })
      })
      return true
    }

    case 'GET_TAB_SCAN_DATA': {
      const tabId2 = message.tabId || sender.tab?.id
      if (tabId2) sendResponse(tabScanData.get(tabId2) || null)
      else sendResponse(null)
      return false
    }

    case 'GET_ALL_TAB_SCAN_DATA': {
      const allData: Record<number, unknown> = {}
      tabScanData.forEach((data, tabId) => { allData[tabId] = data })
      sendResponse(allData)
      return false
    }

    // ---- Website Controls ----
    case 'CHECK_WEBSITE_ENABLED': {
      if (message.url) {
        isWebsiteEnabled(message.url).then(enabled => sendResponse({ enabled }))
        return true
      }
      sendResponse({ enabled: true })
      return false
    }

    case 'TOGGLE_WEBSITE': {
      if (message.hostname) {
        toggleWebsiteEnabled(message.hostname, message.enabled).then(() => sendResponse({ success: true }))
        return true
      }
      sendResponse({ success: false })
      return false
    }

    case 'GET_WEBSITES': {
      getWebsiteSettings().then(settings => sendResponse(settings))
      return true
    }

    case 'TOGGLE_WEBSITE_AUTO_OPEN': {
      if (message.hostname) {
        toggleWebsiteAutoOpen(message.hostname, message.enabled).then(() => sendResponse({ success: true }))
        return true
      }
      sendResponse({ success: false })
      return false
    }

    case 'GET_WEBSITE_AUTO_OPEN_SETTINGS': {
      getWebsiteAutoOpenSettings().then(settings => sendResponse(settings))
      return true
    }

    case 'GET_CURRENT_TAB': {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0]
        sendResponse(tab ? { id: tab.id, url: tab.url, title: tab.title } : null)
      })
      return true
    }

    case 'GET_DETECTION_DATA': {
      const tabId3 = message.tabId || sender.tab?.id
      if (tabId3) sendResponse(tabDetectionData.get(tabId3) || null)
      else sendResponse(null)
      return false
    }

    case 'IS_KNOWN_SHOPPING_SITE': {
      if (message.url) sendResponse({ known: isKnownDomain(message.url) })
      else sendResponse({ known: false })
      return false
    }

    // ============================================================
    // GEMINI AI MESSAGES — the core AI functionality
    // ============================================================

    case 'GET_API_KEY': {
      // Always report configured — embedded key is used as fallback
      sendResponse({ configured: true, hasKey: true })
      return false
    }

    case 'SET_API_KEY': {
      // No-op: API key is embedded
      sendResponse({ success: true })
      return false
    }

    case 'GEMINI_ANALYZE': {
      const product = message.product as Product
      const preferences = message.preferences as UserPreferences
      if (!product) {
        sendResponse({ error: 'No product provided' })
        return false
      }
      console.log('TerraCart BG: Starting GEMINI_ANALYZE for', product.name)
      analyzeProductWithGemini(product, preferences).then(result => {
        console.log('TerraCart BG: GEMINI_ANALYZE result:', result.error || 'success')
        sendResponse(result)
      }).catch((err: unknown) => {
        console.error('TerraCart BG: GEMINI_ANALYZE failed:', err)
        sendResponse({ analysis: null, sources: [], error: String(err) })
      })
      return true
    }

    case 'GEMINI_RESEARCH': {
      const rProduct = message.product as Product
      const rPrefs = message.preferences as UserPreferences
      const rType = message.researchType as 'alternatives' | 'reusable' | 'packaging' | 'all'
      if (!rProduct) {
        sendResponse({ error: 'No product provided' })
        return false
      }
      console.log('TerraCart BG: Starting GEMINI_RESEARCH for', rProduct.name, 'type:', rType)
      researchAlternativesWithGemini(rProduct, rPrefs, rType || 'all').then(result => {
        console.log('TerraCart BG: GEMINI_RESEARCH result:', result.error || 'success', 'alternatives:', result.research?.alternatives?.length || 0)
        sendResponse(result)
      }).catch((err: unknown) => {
        console.error('TerraCart BG: GEMINI_RESEARCH failed:', err)
        sendResponse({ research: null, sources: [], searchQueries: [], error: String(err) })
      })
      return true
    }

    case 'GEMINI_CHAT': {
      const chatProduct = message.product as Product | null
      const chatPrefs = message.preferences as UserPreferences
      const chatMsg = message.message as string
      const chatHistory = message.chatHistory as Array<{ role: 'user' | 'assistant'; content: string }> || []
      if (!chatMsg) {
        sendResponse({ content: 'No message provided', sources: [] })
        return false
      }
      console.log('TerraCart BG: Starting GEMINI_CHAT')
      chatWithGemini(chatMsg, chatProduct, chatPrefs, chatHistory).then(result => {
        console.log('TerraCart BG: GEMINI_CHAT result:', result.content?.slice(0, 100) || 'empty')
        sendResponse(result)
      }).catch((err: unknown) => {
        console.error('TerraCart BG: GEMINI_CHAT failed:', err)
        sendResponse({ content: 'Error: ' + String(err), sources: [] })
      })
      return true
    }
  }
})

// ---- Tab Data Caches ----
const tabScanData = new Map<number, unknown>()
const tabDetectionData = new Map<number, unknown>()
const pendingAutoOpenTimers = new Map<number, ReturnType<typeof setTimeout>>()

// ---- Tab Monitoring ----
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    if (tab.url) {
      const enabled = await isWebsiteEnabled(tab.url)
      if (enabled) {
        const detection = tabDetectionData.get(activeInfo.tabId)
        const scanData = tabScanData.get(activeInfo.tabId) as any
        if (scanData?.primaryProduct) {
          updateBadgeForTab(activeInfo.tabId, 'product')
        } else if (detection && (detection as any).confidence > 50) {
          updateBadgeForTab(activeInfo.tabId, 'active')
        } else if (isKnownDomain(tab.url)) {
          updateBadgeForTab(activeInfo.tabId, 'active')
        } else {
          updateBadgeForTab(activeInfo.tabId, 'active')
        }
      } else {
        chrome.action.setBadgeText({ text: 'OFF', tabId: activeInfo.tabId })
        chrome.action.setBadgeBackgroundColor({ color: '#9ca3af', tabId: activeInfo.tabId })
      }
    }
  } catch { /* tab may not exist */ }
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    tabScanData.delete(tabId)
    tabDetectionData.delete(tabId)

    isWebsiteEnabled(tab.url).then(enabled => {
      if (enabled) {
        if (isKnownDomain(tab.url!)) {
          updateBadgeForTab(tabId, 'active')
        } else {
          chrome.action.setBadgeText({ text: '', tabId })
        }
      } else {
        chrome.action.setBadgeText({ text: 'OFF', tabId })
        chrome.action.setBadgeBackgroundColor({ color: '#9ca3af', tabId })
      }
    })
  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  tabScanData.delete(tabId)
  tabDetectionData.delete(tabId)
  const timer = pendingAutoOpenTimers.get(tabId)
  if (timer) {
    clearTimeout(timer)
    pendingAutoOpenTimers.delete(tabId)
  }
})

// ---- Badge Management ----
function updateBadgeForTab(tabId: number, state: 'active' | 'product' | 'search') {
  switch (state) {
    case 'product':
      chrome.action.setBadgeText({ text: '●', tabId })
      chrome.action.setBadgeBackgroundColor({ color: '#16a34a', tabId })
      break
    case 'search':
      chrome.action.setBadgeText({ text: '◎', tabId })
      chrome.action.setBadgeBackgroundColor({ color: '#3b82f6', tabId })
      break
    case 'active':
      chrome.action.setBadgeText({ text: '🌍', tabId })
      chrome.action.setBadgeBackgroundColor({ color: '#16a34a', tabId })
      break
  }
}

// ---- Website Controls ----
function isKnownDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    return KNOWN_SHOPPING_DOMAINS.some(d => {
      const clean = d.replace('www.', '')
      return hostname === clean || hostname.endsWith('.' + clean)
    })
  } catch {
    return false
  }
}

async function isWebsiteEnabled(url: string): Promise<boolean> {
  try {
    const hostname = new URL(url).hostname
    const result = await chrome.storage.local.get(STORAGE_KEYS.WEBSITE_ENABLED)
    const settings = result[STORAGE_KEYS.WEBSITE_ENABLED] || {}
    if (hostname in settings) return settings[hostname]
    if (isKnownDomain(url)) return true
    return true
  } catch {
    return true
  }
}

async function toggleWebsiteEnabled(hostname: string, enabled: boolean): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.WEBSITE_ENABLED)
  const settings = result[STORAGE_KEYS.WEBSITE_ENABLED] || {}
  settings[hostname] = enabled
  await chrome.storage.local.set({ [STORAGE_KEYS.WEBSITE_ENABLED]: settings })
}

async function getWebsiteSettings(): Promise<Record<string, boolean>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.WEBSITE_ENABLED)
  return result[STORAGE_KEYS.WEBSITE_ENABLED] || {}
}

async function isWebsiteAutoOpen(urlOrHostname: string): Promise<boolean> {
  try {
    let hostname = urlOrHostname
    if (urlOrHostname.startsWith('http')) hostname = new URL(urlOrHostname).hostname
    const result = await chrome.storage.local.get(STORAGE_KEYS.WEBSITE_AUTO_OPEN)
    const settings = result[STORAGE_KEYS.WEBSITE_AUTO_OPEN] || {}
    if (hostname in settings) return settings[hostname]
    const prefs = await chrome.storage.local.get(STORAGE_KEYS.PREFERENCES)
    return prefs[STORAGE_KEYS.PREFERENCES]?.enableAutoOpenPanel !== false
  } catch {
    return true
  }
}

async function toggleWebsiteAutoOpen(hostname: string, enabled: boolean): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.WEBSITE_AUTO_OPEN)
  const settings = result[STORAGE_KEYS.WEBSITE_AUTO_OPEN] || {}
  settings[hostname] = enabled
  await chrome.storage.local.set({ [STORAGE_KEYS.WEBSITE_AUTO_OPEN]: settings })
}

async function getWebsiteAutoOpenSettings(): Promise<Record<string, boolean>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.WEBSITE_AUTO_OPEN)
  return result[STORAGE_KEYS.WEBSITE_AUTO_OPEN] || {}
}

// ---- Installation ----
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({
      [STORAGE_KEYS.FIRST_RUN]: true,
      [STORAGE_KEYS.PAUSED]: false,
      [STORAGE_KEYS.AUTO_ACTIVATE]: true,
      [STORAGE_KEYS.PREFERENCES]: {
        sustainabilityPriorities: ['reduce-plastic', 'buy-reusable'],
        recommendationStyle: 'balanced',
        preferredBrands: [],
        preferredRetailers: [],
        sizePreferences: [],
        notificationsEnabled: true,
        enableFloatingButton: true,
        enableAutoOpenPanel: true,
        autoOpenDelay: 2,
        autoOpenNotification: true,
        autoOpenProductPagesOnly: false,
        chimeVolume: 'soft',
        enableHistory: true,
        enablePatternDetection: true,
        reducedMotion: false,
      },
      [STORAGE_KEYS.WEBSITE_ENABLED]: {},
      [STORAGE_KEYS.WEBSITE_AUTO_OPEN]: {},
      [STORAGE_KEYS.HISTORY]: [],
      [STORAGE_KEYS.SAVED]: [],
      [STORAGE_KEYS.PATTERNS]: [],
      [STORAGE_KEYS.INTERACTIONS]: [],
    })
    chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') })
  }
})

console.log('TerraCart background service worker loaded 🌍')
