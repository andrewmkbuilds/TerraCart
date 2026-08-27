// ============================================================
// TerraCart Background Service Worker
// Handles: side panel, tab monitoring, message routing,
// website controls, badge updates, installation,
// Research request routing
// ============================================================

import type { Product } from '../types'

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const RESEARCH_BACKEND_URL = API_BASE ? `${API_BASE}/api/research` : 'http://localhost:8787/api/research'
const ANALYSIS_BACKEND_URL = API_BASE ? `${API_BASE}/api/analyze` : 'http://localhost:8787/api/analyze'

async function runGeminiAnalysis(product: Product | null) {
  if (!product || !product.name || !product.url || !product.retailer) {
    return { success: false, error: 'No product detected. Scan the current shopping page first.' }
  }
  console.log('[TerraCart] Sending GEMINI_ANALYZE', { backendUrl: ANALYSIS_BACKEND_URL, product: { name: product.name, brand: product.brand, retailer: product.retailer, url: product.url, category: product.category, price: product.price, currency: product.currency } })
  try {
    const response = await fetch(ANALYSIS_BACKEND_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product }),
    })
    const responseBody = await response.text()
    console.log('[TerraCart] Gemini analysis response status:', response.status)
    if (!response.ok) {
      let errorBody: any = null
      try { errorBody = JSON.parse(responseBody) } catch { /* preserve text below */ }
      return { success: false, error: `Backend HTTP ${response.status}: ${errorBody?.error || responseBody || 'empty response'}` }
    }
    const result = JSON.parse(responseBody)
    return result && typeof result === 'object' ? result : { success: false, error: 'Backend returned invalid analysis JSON.' }
  } catch (error: unknown) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    console.error('[TerraCart] Gemini analysis FAILED:', detail)
    return { success: false, error: `Backend connection error: ${detail}` }
  }
}

async function runTerraCartResearch(product: Product | null, researchType: 'all' | 'reusable' | 'packaging') {
  console.log('[TerraCart] Sending TAVILY_RESEARCH', {
    backendUrl: RESEARCH_BACKEND_URL,
    researchType,
    product: product ? { name: product.name, retailer: product.retailer, url: product.url, price: product.price, currency: product.currency, category: product.category } : null,
  })
  if (!product || !product.name || !product.url || !product.retailer) {
    console.warn('[TerraCart] Research rejected: no valid product payload')
    return { success: false, error: 'No product detected. Scan the current shopping page first.' }
  }
  try {
    const response = await fetch(RESEARCH_BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product, researchType }),
    })
    const responseBody = await response.text()
    console.log('[TerraCart] Backend response status:', response.status)
    console.log('[TerraCart] Backend response:', responseBody.slice(0, 4000))
    let result: any = null
    try { result = responseBody ? JSON.parse(responseBody) : null } catch { /* handled below */ }
    if (!response.ok) {
      return { success: false, error: `Backend HTTP ${response.status}: ${result?.error || responseBody || 'empty response'}` }
    }
    if (!result || typeof result !== 'object') {
      return { success: false, error: 'Backend returned an invalid JSON response.' }
    }
    console.log('[TerraCart] Alternatives received:', Array.isArray(result.alternatives) ? result.alternatives.length : 0)
    return result
  } catch (error: unknown) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    console.error('[TerraCart] Research FAILED:', { backendUrl: RESEARCH_BACKEND_URL, researchType, error: detail })
    return { success: false, error: `Backend connection error: ${detail}` }
  }
}

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
const contentScriptLoadedTabs = new Set<number>()

function clearTabActivation(tabId: number) {
  tabScanData.delete(tabId)
  tabDetectionData.delete(tabId)
  const timer = pendingAutoOpenTimers.get(tabId)
  if (timer) {
    clearTimeout(timer)
    pendingAutoOpenTimers.delete(tabId)
  }
  chrome.action.setBadgeText({ text: '', tabId }).catch(() => {})
  chrome.sidePanel?.setOptions({ tabId, enabled: false }).catch(() => {})
  // Notify side panel if open (best-effort, no listener required)
  chrome.runtime.sendMessage({ type: 'TAB_DEACTIVATED', tabId }).catch(() => {})
}

function isShoppingTab(tab: chrome.tabs.Tab): boolean {
  if (!tab.id || !tab.url || isBlocklistedUrl(tab.url)) return false
  if (isKnownDomain(tab.url)) return true
  const detection = tabDetectionData.get(tab.id) as { isECommerce?: boolean; confidence?: number } | undefined
  const scan = tabScanData.get(tab.id) as { primaryProduct?: unknown; productCount?: number } | undefined
  return !!(detection?.isECommerce && (detection.confidence || 0) >= 55) || !!scan?.primaryProduct || !!scan?.productCount
}

// ---- Side Panel Setup ----
if (chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})
  chrome.sidePanel.setOptions({ enabled: true }).catch(() => {})
}

// ---- Click on extension icon: open side panel ----
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id && isShoppingTab(tab)) {
    try {
      await chrome.sidePanel.setOptions({ tabId: tab.id, enabled: true })
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
        contentScriptLoadedTabs.add(sender.tab.id)
        const tabUrl = message.data?.url || ''
        
        // CRITICAL: Check blocklist BEFORE any auto-open logic
        if (isBlocklistedUrl(tabUrl)) {
          clearTabActivation(sender.tab.id)
          sendResponse({ success: false, error: 'Non-shopping site' })
          return false
        }
        
        if (message.data) tabDetectionData.set(sender.tab.id, message.data)
        const detection = message.data?.detection
        if (!isKnownDomain(tabUrl) && !(detection?.isECommerce && (detection.confidence || 0) >= 55)) {
          clearTabActivation(sender.tab.id)
          sendResponse({ success: false, error: 'Not an e-commerce site' })
          return false
        }
        chrome.sidePanel?.setOptions({ tabId: sender.tab.id, enabled: true }).catch(() => {})
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

                // Clear any existing auto-open timer for this tab
                const existingTimer = pendingAutoOpenTimers.get(tabId)
                if (existingTimer) {
                  clearTimeout(existingTimer)
                  pendingAutoOpenTimers.delete(tabId)
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

    case 'TERRACART_DEACTIVATED': {
      if (sender.tab?.id) clearTabActivation(sender.tab.id)
      sendResponse({ success: true })
      return false
    }

    // ---- Page Scan Data ----
    case 'PAGE_SCANNED': {
      if (sender.tab?.id && message.data) {
        tabScanData.set(sender.tab.id, message.data)
        contentScriptLoadedTabs.add(sender.tab.id)
        if (message.data.primaryProduct) {
          updateBadgeForTab(sender.tab.id, 'product')
        } else if (message.data.productCount > 0) {
          updateBadgeForTab(sender.tab.id, 'search')
        } else {
          updateBadgeForTab(sender.tab.id, 'active')
        }
        // CRITICAL: Broadcast scan results to all extension views (side panel, popup)
        // so the side panel's PAGE_SCANNED listener receives the data in real time.
        chrome.runtime.sendMessage({
          type: 'PAGE_SCANNED',
          data: message.data,
          tabId: sender.tab.id,
        }).catch(() => { /* no side panel open — ignore */ })
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
        if (tab.url && isBlocklistedUrl(tab.url)) {
          sendResponse(emptyResult('Non-shopping site')); return
        }
        const tabId = tab.id
        const tabUrl = tab.url || ''
        const tabTitle = tab.title || ''
        const hostname = tabUrl ? new URL(tabUrl).hostname : ''

        // Return cached scan data if fresh (< 10 seconds old)
        const cached = tabScanData.get(tabId) as any
        if (cached && cached.timestamp && (Date.now() - cached.timestamp < 10000) && (cached.primaryProduct || cached.productCount > 0)) {
          sendResponse(cached)
          return
        }

        // Safety timeout — always respond within 8s
        let responded = false
        const safeRespond = (data: any) => {
          if (!responded) { responded = true; sendResponse(data) }
        }
        setTimeout(() => safeRespond({ ...emptyResult(), retailer: hostname, pageTitle: tabTitle }), 8000)

        // Try content script (already injected)
        chrome.tabs.sendMessage(tabId, { type: 'SCAN_PAGE' }, (result) => {
          if (!responded && !chrome.runtime.lastError && result) {
            // Store result in cache
            if (result.type !== 'other' || result.primaryProduct) {
              tabScanData.set(tabId, { ...result, timestamp: Date.now() })
            }
            safeRespond(result)
          } else if (!responded && !contentScriptLoadedTabs.has(tabId)) {
            // Content script not loaded — inject it then wait for it to initialize
            chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }).then(() => {
              // Give the content script 2s to call init() and set up listeners
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, { type: 'SCAN_PAGE' }, (retryResult) => {
                  if (!responded && !chrome.runtime.lastError && retryResult) {
                    if (retryResult.type !== 'other' || retryResult.primaryProduct) {
                      tabScanData.set(tabId, { ...retryResult, timestamp: Date.now() })
                    }
                    safeRespond(retryResult)
                  } else if (!responded) {
                    safeRespond({ ...emptyResult(), retailer: hostname, pageTitle: tabTitle })
                  }
                })
              }, 2000)
            }).catch(() => {
              safeRespond({ ...emptyResult(), retailer: hostname, pageTitle: tabTitle })
            })
          } else if (!responded) {
            safeRespond({ ...emptyResult(), retailer: hostname, pageTitle: tabTitle })
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

    case 'OPEN_EXTERNAL_URL': {
      const targetUrl = typeof message.url === 'string' ? message.url : ''
      try {
        const parsedUrl = new URL(targetUrl)
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Invalid URL protocol')
        chrome.tabs.create({ url: parsedUrl.href }).then(tab => sendResponse({ success: true, tabId: tab.id }))
          .catch((err: unknown) => sendResponse({ success: false, error: String(err) }))
      } catch {
        sendResponse({ success: false, error: 'Invalid product URL' })
        return false
      }
      return true
    }

    // ---- Server-side Tavily research ----
    case 'GEMINI_ANALYZE': {
      runGeminiAnalysis((message.product || null) as Product | null)
        .then(sendResponse)
        .catch((error: unknown) => sendResponse({ success: false, error: `Analysis proxy error: ${error instanceof Error ? error.message : String(error)}` }))
      return true
    }

    case 'TAVILY_RESEARCH': {
      const researchType = message.researchType === 'reusable' || message.researchType === 'packaging' ? message.researchType : 'all'
      console.log('[TerraCart] TAVILY_RESEARCH received', { researchType, hasProduct: !!message.product, productName: message.product?.name || '' })
      runTerraCartResearch((message.product || null) as Product | null, researchType)
        .then(sendResponse)
        .catch((error: unknown) => {
          console.error('TerraCart research proxy error:', error)
          sendResponse({ success: false, error: `Research proxy error: ${error instanceof Error ? error.message : String(error)}` })
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
        const scanData = tabScanData.get(activeInfo.tabId) as any
        if (scanData?.primaryProduct) {
          updateBadgeForTab(activeInfo.tabId, 'product')
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
    if (isBlocklistedUrl(tab.url)) {
      // Blocklisted: fully deactivate
      clearTabActivation(tabId)
    } else if (isKnownDomain(tab.url)) {
      // Known shopping domain: ensure side panel is available
      chrome.sidePanel?.setOptions({ tabId, enabled: true }).catch(() => {})
      updateBadgeForTab(tabId, 'active')
    }
    // For detected (non-known) shops, let the content script handle re-activation.
    // For non-shopping tabs, do nothing — the content script handles its own state.
  } else if (changeInfo.title || changeInfo.url) {
    // SPA navigation: title or url changed - trigger re-scan via the content script
    if (tab?.url && isBlocklistedUrl(tab.url)) {
      clearTabActivation(tabId)
    } else if (tab?.url && (isKnownDomain(tab.url) || tabDetectionData.has(tabId))) {
      // Re-scan known domains AND detected e-commerce shops (not just known)
      setTimeout(() => {
        try {
          chrome.tabs.sendMessage(tabId, { type: 'SCAN_PAGE' }, () => {
            void chrome.runtime.lastError
          })
        } catch { /* no-op */ }
      }, 200)
    }
    // Note: non-shopping, non-blocklisted tabs are left alone —
    // the content script handles its own deactivation.
  }
})

// ---- Backup SPA navigation listener (webNavigation) ----
if (chrome.webNavigation?.onHistoryStateUpdated) {
  chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (!details.url || details.frameId !== 0) return
      if (isBlocklistedUrl(details.url)) { clearTabActivation(details.tabId); return }
    if (isKnownDomain(details.url)) {
      console.log('TerraCart: SPA navigation detected (webNavigation):', details.url)
      setTimeout(() => {
        try {
          chrome.tabs.sendMessage(details.tabId, { type: 'SCAN_PAGE' }, () => { void chrome.runtime.lastError })
        } catch { /* no-op */ }
      }, 150)
    }
  }, { url: [{ schemes: ['http', 'https'] }] })
}
if (chrome.webNavigation?.onReferenceFragmentUpdated) {
  chrome.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
    if (details.frameId !== 0 || !details.url || isBlocklistedUrl(details.url)) return
    if (isKnownDomain(details.url)) {
      try {
        chrome.tabs.sendMessage(details.tabId, { type: 'SCAN_PAGE' }, () => { void chrome.runtime.lastError })
      } catch { /* no-op */ }
    }
  }, { url: [{ schemes: ['http', 'https'] }] })
}

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabActivation(tabId)
  contentScriptLoadedTabs.delete(tabId)
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
