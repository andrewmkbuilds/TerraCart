// ============================================================
// TerraCart Background Service Worker
// Handles: side panel, tab monitoring, message routing,
// website controls, badge updates, installation,
// Gemini AI request routing
// ============================================================

import { analyzeProductWithGemini, researchAlternativesWithGemini, chatWithGemini } from '../ai/gemini-service'
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

// ---- Known shopping domains ----
const KNOWN_SHOPPING_DOMAINS = [
  'amazon.com', 'amazon.ae', 'amazon.co.uk', 'amazon.de', 'amazon.fr',
  'amazon.co.jp', 'amazon.in', 'amazon.ca', 'amazon.com.au',
  'walmart.com', 'target.com', 'bestbuy.com', 'ebay.com', 'etsy.com',
  'aliexpress.com',
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
  'carrefouruae.com', 'luluhypermarket.com', 'spinneys.com',
  'waitrose.ae', 'boots.ae', 'lifepharmacy.com',
  'sharafdg.com', 'jumbo.ae', 'emax.ae',
  'danubehome.com', 'ikea.ae', 'aceuae.com',
]

// ---- Tab Data Caches ----
const tabScanData = new Map<number, unknown>()
const tabDetectionData = new Map<number, unknown>()
const pendingAutoOpenTimers = new Map<number, ReturnType<typeof setTimeout>>()

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

// ============================================================
// Message Handling — MUST NOT be async.
// Chrome MV3 requires the listener callback to be synchronous.
// Use .then() for async work and return true to keep the channel.
// ============================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

    // ---- Content Script Ready (auto-open logic) ----
    case 'CONTENT_SCRIPT_READY': {
      if (sender.tab?.id) {
        const tabUrl = message.data?.url || ''
        
        // CRITICAL: Check blocklist BEFORE any auto-open logic
        if (isBlocklistedUrl(tabUrl)) {
          sendResponse({ success: false, error: 'Non-shopping site' })
          return false
        }
        
        if (message.data) tabDetectionData.set(sender.tab.id, message.data)
        updateBadgeForTab(sender.tab.id, 'active')

        const pageType = message.data?.pageType as string | undefined

        chrome.storage.local.get(STORAGE_KEYS.PREFERENCES).then((prefs) => {
          const userPrefs = prefs[STORAGE_KEYS.PREFERENCES]
          if (userPrefs?.enableAutoOpenPanel !== false && sender.tab?.windowId) {
            isWebsiteAutoOpen(tabUrl).then((siteAutoOpen) => {
              const productPagesOnly = userPrefs?.autoOpenProductPagesOnly === true
              if (siteAutoOpen && (!productPagesOnly || pageType === 'product')) {
                const tabId = sender.tab!.id!
                const windowId = sender.tab!.windowId!
                const delayMs = ((userPrefs?.autoOpenDelay as number) ?? 2) * 1000
                const showNotification = userPrefs?.autoOpenNotification !== false

                if (showNotification && delayMs > 0 && tabId) {
                  chrome.tabs.sendMessage(tabId, {
                    type: 'AUTO_OPEN_PENDING',
                    delay: delayMs,
                  }).catch(() => {})
                }

                const timerId = setTimeout(() => {
                  pendingAutoOpenTimers.delete(tabId)
                  chrome.sidePanel.open({ windowId }).then(() => {
                    if (tabId) {
                      chrome.tabs.sendMessage(tabId, {
                        type: 'AUTO_OPEN_DONE',
                        chimeVolume: userPrefs?.chimeVolume ?? 'soft',
                      }).catch(() => {})
                    }
                  }).catch(() => {})
                }, delayMs)
                pendingAutoOpenTimers.set(tabId, timerId)
              }
            }).catch(() => {})
          }
        }).catch(() => {})
      }
      sendResponse({ success: true })
      return false
    }

    case 'CANCEL_AUTO_OPEN': {
      const tabIdCancel = sender.tab?.id
      if (tabIdCancel) {
        const timer = pendingAutoOpenTimers.get(tabIdCancel)
        if (timer) {
          clearTimeout(timer)
          pendingAutoOpenTimers.delete(tabIdCancel)
        }
      }
      sendResponse({ success: true })
      return false
    }

    // ---- Page Scan Data ----
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
      const tabIdBadge = sender.tab?.id
      if (tabIdBadge && message.text !== undefined) {
        chrome.action.setBadgeText({ text: message.text, tabId: tabIdBadge })
        if (message.color) chrome.action.setBadgeBackgroundColor({ color: message.color, tabId: tabIdBadge })
      }
      sendResponse({ success: true })
      return false
    }

    // ---- Scan Page ----
    case 'SCAN_PAGE': {
      const emptyResult = (err?: string) => ({
        type: 'other' as const, products: [] as never[], primaryProduct: null,
        retailer: '', pageTitle: '', timestamp: Date.now(),
        ...(err ? { error: err } : {}),
      })
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0]
        if (!tab?.id) { sendResponse(emptyResult('No active tab')); return }
        if (tab.url && /^(chrome|chrome-extension|about|edge):/.test(tab.url)) {
          sendResponse(emptyResult('Cannot scan browser pages')); return
        }
        const tabId = tab.id
        const tabUrl = tab.url || ''
        const tabTitle = tab.title || ''
        const hostname = tabUrl ? new URL(tabUrl).hostname : ''
        // Safety timeout — always respond within 5s
        let responded = false
        const safeRespond = (data: any) => {
          if (!responded) { responded = true; sendResponse(data) }
        }
        setTimeout(() => safeRespond({ ...emptyResult(), retailer: hostname, pageTitle: tabTitle }), 5000)

        // Try content script
        chrome.tabs.sendMessage(tabId, { type: 'SCAN_PAGE' }, (result) => {
          if (!responded && !chrome.runtime.lastError && result) {
            safeRespond(result)
          } else if (!responded) {
            // Content script not loaded — inject it
            chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }).then(() => {
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, { type: 'SCAN_PAGE' }, (retryResult) => {
                  if (!responded && !chrome.runtime.lastError && retryResult) {
                    safeRespond(retryResult)
                  } else if (!responded) {
                    safeRespond({ ...emptyResult(), retailer: hostname, pageTitle: tabTitle })
                  }
                })
              }, 800)
            }).catch(() => {
              safeRespond({ ...emptyResult(), retailer: hostname, pageTitle: tabTitle })
            })
          }
        })
      })
      return true
    }

    case 'GET_TAB_SCAN_DATA': {
      const tabIdData = message.tabId || sender.tab?.id
      if (tabIdData) sendResponse(tabScanData.get(tabIdData) || null)
      else sendResponse(null)
      return false
    }

    case 'GET_ALL_TAB_SCAN_DATA': {
      const allData: Record<number, unknown> = {}
      tabScanData.forEach((data, tid) => { allData[tid] = data })
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
      const tabIdDetect = message.tabId || sender.tab?.id
      if (tabIdDetect) sendResponse(tabDetectionData.get(tabIdDetect) || null)
      else sendResponse(null)
      return false
    }

    case 'IS_KNOWN_SHOPPING_SITE': {
      if (message.url) sendResponse({ known: isKnownDomain(message.url) })
      else sendResponse({ known: false })
      return false
    }

    // ---- Gemini AI ----
    case 'GET_API_KEY': {
      sendResponse({ configured: true, hasKey: true })
      return false
    }

    case 'SET_API_KEY': {
      sendResponse({ success: true })
      return false
    }

    case 'GEMINI_ANALYZE': {
      const product = message.product as Product
      const preferences = message.preferences as UserPreferences
      if (!product) { sendResponse({ error: 'No product provided' }); return false }
      analyzeProductWithGemini(product, preferences).then(result => {
        sendResponse(result)
      }).catch((err: unknown) => {
        sendResponse({ analysis: null, sources: [], error: String(err) })
      })
      return true
    }

    case 'GEMINI_RESEARCH': {
      console.log('TerraCart: GEMINI_RESEARCH received', { product: message.product?.name, type: message.researchType })
      const rProduct = message.product as Product
      const rPrefs = message.preferences as UserPreferences
      const rType = message.researchType as 'alternatives' | 'reusable' | 'packaging' | 'all'
      if (!rProduct) { sendResponse({ error: 'No product provided' }); return false }
      researchAlternativesWithGemini(rProduct, rPrefs, rType || 'all').then(result => {
        console.log('TerraCart: GEMINI_RESEARCH result', { alternatives: result.research?.alternatives?.length || 0, error: result.error })
        sendResponse(result)
      }).catch((err: unknown) => {
        console.error('TerraCart: GEMINI_RESEARCH error', err)
        sendResponse({ research: null, sources: [], searchQueries: [], error: String(err) })
      })
      return true
    }

    case 'GEMINI_CHAT': {
      const chatProduct = message.product as Product | null
      const chatPrefs = message.preferences as UserPreferences
      const chatMsg = message.message as string
      const chatHistory = message.chatHistory as Array<{ role: 'user' | 'assistant'; content: string }> || []
      if (!chatMsg) { sendResponse({ content: 'No message provided', sources: [] }); return false }
      chatWithGemini(chatMsg, chatProduct, chatPrefs, chatHistory).then(result => {
        sendResponse(result)
      }).catch((err: unknown) => {
        sendResponse({ content: 'Error: ' + String(err), sources: [] })
      })
      return true
    }
  }
})

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
  if (timer) { clearTimeout(timer); pendingAutoOpenTimers.delete(tabId) }
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
      chrome.action.setBadgeText({ text: '●', tabId })
      chrome.action.setBadgeBackgroundColor({ color: '#16a34a', tabId })
      break
  }
}

// ---- Non-shopping site blocklist (comprehensive) ----
const NON_SHOPPING_BLOCKLIST = [
  // Google services
  'google.com', 'gemini.google.com', 'aistudio.google.com',
  'gmail.com', 'docs.google.com', 'drive.google.com',
  'calendar.google.com', 'maps.google.com', 'meet.google.com',
  'scholar.google.com', 'news.google.com', 'photos.google.com',
  'translate.google.com', 'cloud.google.com',
  // AI assistants
  'chatgpt.com', 'chat.openai.com', 'openai.com',
  'claude.ai', 'anthropic.com', 'perplexity.ai',
  'copilot.microsoft.com', 'bing.com',
  // Social media
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'linkedin.com', 'reddit.com', 'tiktok.com', 'snapchat.com',
  'pinterest.com', 'threads.net',
  // Video/Streaming
  'youtube.com', 'netflix.com', 'twitch.tv', 'hulu.com',
  'disneyplus.com', 'vimeo.com',
  // Music
  'spotify.com', 'soundcloud.com', 'deezer.com',
  // Productivity/Work
  'notion.so', 'airtable.com', 'figma.com', 'canva.com',
  'slack.com', 'discord.com', 'teams.microsoft.com',
  'trello.com', 'asana.com', 'monday.com', 'clickup.com',
  'jira.atlassian.com', 'confluence.atlassian.com',
  // Cloud/Dev
  'github.com', 'gitlab.com', 'bitbucket.org',
  'stackoverflow.com', 'stackexchange.com',
  'vercel.com', 'netlify.com',
  // File storage
  'dropbox.com', 'onedrive.live.com', 'mega.nz',
  // News/Blogs
  'medium.com', 'substack.com',
  // Communication
  'zoom.us', 'webex.com',
  // Reference
  'wikipedia.org', 'britannica.com',
  // Other non-shopping
  'archive.org', 'imdb.com',
  'tripadvisor.com', 'yelp.com',
  'booking.com', 'airbnb.com',
]

function isBlocklistedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    return NON_SHOPPING_BLOCKLIST.some(d => {
      if (hostname === d) return true
      if (hostname.endsWith('.' + d)) return true
      if (d === 'google.com' && hostname.endsWith('.google.com')) return true
      return false
    })
  } catch {
    return false
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
  } catch { return false }
}

async function isWebsiteEnabled(url: string): Promise<boolean> {
  try {
    const hostname = new URL(url).hostname
    const result = await chrome.storage.local.get(STORAGE_KEYS.WEBSITE_ENABLED)
    const settings = result[STORAGE_KEYS.WEBSITE_ENABLED] || {}
    if (hostname in settings) return settings[hostname]
    return true
  } catch { return true }
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
  } catch { return true }
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
