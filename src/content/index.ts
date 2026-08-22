import { scanPage, shouldActivate, detectECommerceSite, isKnownShoppingSite } from '../retailers'
import type { PageScanResult, Product } from '../types'
import type { ECommerceDetection } from '../retailers/detector'

// ============================================================
// TerraCart Content Script
// Automatically detects e-commerce websites and activates
// the shopping copilot with product detection.
// ============================================================

let floatingButton: HTMLElement | null = null
let lastScanResult: PageScanResult | null = null
let lastDetection: ECommerceDetection | null = null
let isActive = false
let scanDebounceTimer: ReturnType<typeof setTimeout> | null = null
const SCAN_DEBOUNCE_MS = 1000

// ---- Quick page type detection (lightweight, no full scan) ----
type QuickPageType = 'product' | 'search' | 'other'

function detectPageType(): QuickPageType {
  const url = window.location.href.toLowerCase()

  // URL-based heuristics (string matching avoids regex escaping issues)
  if (url.includes('/dp/') || url.includes('/gp/product/')) return 'product'
  if (url.includes('/product/') || url.match(/noon\.com.*\/\d+$/)) return 'product'
  if (url.includes('/s?') || url.includes('/s/') || url.includes('/search') || url.includes('?q=') || url.includes('&q=')) return 'search'

  // DOM-based signals (cheap checks)
  const hasProductSchema = !!document.querySelector('script[type="application/ld+json"]')
  const hasAddToCart = !!document.querySelector('#add-to-cart-button, #addToCart, button[name="add"], [class*="add-to-cart"]')
  const hasPrice = !!document.querySelector('[itemprop="price"], .a-price, [class*="product-price"]')
  const hasBuyNow = !!document.querySelector('button[name="buy"], [class*="buy-now"]')

  if ((hasProductSchema || hasPrice) && (hasAddToCart || hasBuyNow)) return 'product'

  // Search results: many product-like items
  const productCards = document.querySelectorAll('[data-asin], [class*="product-card"], [class*="product-item"], [class*="productCard"]')
  if (productCards.length > 3) return 'search'

  return 'other'
}

// ---- Initialize ----
function init() {
  setupMessageListener()
  // Initial detection + scan
  runInitialDetection()
  // Watch for page changes (SPA navigation)
  observePageChanges()
  // reportReady() is called from activateTerraCart() — only for e-commerce sites
}

// ---- Initial Detection ----
function runInitialDetection() {
  const url = window.location.href

  // Fast path: known shopping domain → activate immediately
  if (isKnownShoppingSite(url)) {
    activateTerraCart('known-domain')
    scheduleScan()
    return
  }

  // Quick domain check — skip non-shopping sites immediately
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    const blocklist = [
      'google.com', 'gemini.google.com', 'chatgpt.com', 'openai.com',
      'youtube.com', 'gmail.com', 'github.com', 'gitlab.com',
      'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
      'linkedin.com', 'reddit.com', 'tiktok.com', 'notion.so',
      'spotify.com', 'netflix.com', 'twitch.tv', 'wikipedia.org',
      'medium.com', 'slack.com', 'discord.com', 'teams.microsoft.com',
      'zoom.us', 'meet.google.com', 'claude.ai', 'perplexity.ai',
      'docs.google.com', 'drive.google.com', 'calendar.google.com',
      'maps.google.com', 'stackoverflow.com', 'figma.com', 'canva.com',
      'dropbox.com', 'trello.com', 'asana.com', 'jira.atlassian.com',
      'chat.openai.com', 'bitbucket.org', 'pinterest.com',
      'substack.com', 'stackexchange.com', 'onedrive.live.com',
    ]
    if (blocklist.some(d => hostname === d || hostname.endsWith('.' + d))) {
      return // Never activate on non-shopping sites
    }
  } catch { /* continue with detection */ }

  // Full e-commerce detection via DOM signals
  // Wait a moment for DOM to settle
  setTimeout(() => {
    const detection = detectECommerceSite(document, url)
    lastDetection = detection

    if (detection.isECommerce) {
      activateTerraCart('detected', detection)
      scheduleScan()
    }
    // If not e-commerce, don't activate — content script stays dormant
  }, 800)
}

// ---- Activation ----
function activateTerraCart(reason: string, detection?: ECommerceDetection) {
  if (isActive) return
  isActive = true

  // Always inject floating button on activated pages
  if (reason === 'known-domain' || (detection && detection.confidence >= 40)) {
    injectFloatingButton()
  }

  // Notify background
  chrome.runtime?.sendMessage({
    type: 'CONTENT_SCRIPT_READY',
    data: {
      url: window.location.href,
      reason,
      pageType: detectPageType(),
      detection: detection ? {
        confidence: detection.confidence,
        platform: detection.platform,
        shopifyStore: detection.shopifyStore,
        retailerName: detection.retailerName,
        category: detection.category,
      } : null,
    },
  }).catch(() => {})
}

// ---- Page Scanning ----
function scheduleScan() {
  if (scanDebounceTimer) clearTimeout(scanDebounceTimer)
  scanDebounceTimer = setTimeout(() => {
    performScan()
  }, SCAN_DEBOUNCE_MS)
}

function performScan(): PageScanResult {
  try {
    const result = scanPage(document, window.location.href)
    lastScanResult = result

    const hasProduct = result.type === 'product-page' && result.primaryProduct
    const productCount = result.products.length

    // Update badge via background
    chrome.runtime?.sendMessage({
      type: 'SET_BADGE',
      text: hasProduct ? '●' : productCount > 0 ? String(productCount) : '',
      color: hasProduct ? '#16a34a' : productCount > 0 ? '#3b82f6' : '',
    }).catch(() => {})

    // Notify background of scan results
    chrome.runtime?.sendMessage({
      type: 'PAGE_SCANNED',
      data: {
        type: result.type,
        productCount: result.products.length,
        primaryProduct: result.primaryProduct || null,
        retailer: result.retailer,
        url: window.location.href,
        pageTitle: result.pageTitle,
        searchQuery: result.searchQuery || null,
        detection: lastDetection ? {
          confidence: lastDetection.confidence,
          platform: lastDetection.platform,
          shopifyStore: lastDetection.shopifyStore,
          retailerName: lastDetection.retailerName,
          category: lastDetection.category,
        } : null,
      },
    }).catch(() => {})

    // Show floating button and update with product info
    if (hasProduct || productCount > 0 || isActive) {
      injectFloatingButton()
      updateFloatingButtonProduct(result.primaryProduct || null, result.products.length)
    }

    return result
  } catch (err) {
    console.warn('TerraCart: Scan error', err)
    return {
      type: 'other',
      products: [],
      retailer: window.location.hostname,
      pageTitle: document.title,
      timestamp: Date.now(),
    }
  }
}

// ---- Observe page changes (SPA navigation) ----
function observePageChanges() {
  let lastUrl = window.location.href

  // URL change detection (for SPAs)
  const urlCheckInterval = setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href
      // Re-run detection for new URL
      const detection = detectECommerceSite(document, window.location.href)
      lastDetection = detection

      if (detection.isECommerce && !isActive) {
        activateTerraCart('spa-navigation', detection)
      }

      scheduleScan()
    }
  }, 1000)

  // DOM mutation detection (for dynamic content loading)
  let mutationTimeout: ReturnType<typeof setTimeout> | null = null
  const observer = new MutationObserver(() => {
    if (mutationTimeout) clearTimeout(mutationTimeout)
    mutationTimeout = setTimeout(() => {
      // Only rescan if meaningful content changed
      const priceEls = document.querySelectorAll('[class*="price"], [class*="Price"], [data-price], [itemprop="price"]')
      const productEls = document.querySelectorAll('[class*="product"], [data-product-id]')

      if (priceEls.length > 0 || productEls.length > 3) {
        scheduleScan()
      }
    }, 2000)
  })

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: false,
    })
  }

  window.addEventListener('beforeunload', () => {
    clearInterval(urlCheckInterval)
    observer.disconnect()
  })
}

// ---- Floating Button ----
let productTooltip: HTMLElement | null = null

function injectFloatingButton() {
  if (floatingButton || document.getElementById('terracart-float')) return

  const container = document.createElement('div')
  container.id = 'terracart-float'
  container.setAttribute('role', 'button')
  container.setAttribute('aria-label', 'TerraCart Shopping Copilot')
  container.setAttribute('tabindex', '0')
  container.title = 'TerraCart — AI Shopping Copilot'

  Object.assign(container.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '6px',
    zIndex: '2147483647',
    userSelect: 'none',
    pointerEvents: 'auto',
  })

  // Product tooltip (shown when product is detected)
  const tooltip = document.createElement('div')
  tooltip.className = 'terracart-tooltip'
  Object.assign(tooltip.style, {
    background: 'white',
    borderRadius: '12px',
    padding: '8px 12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    maxWidth: '220px',
    fontSize: '12px',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    color: '#333',
    lineHeight: '1.3',
    display: 'none',
    textAlign: 'right',
    animation: 'terracart-fadein 0.3s ease',
  })
  productTooltip = tooltip
  container.appendChild(tooltip)

  // Main button
  const btn = document.createElement('div')
  Object.assign(btn.style, {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #16a34a, #15803d)',
    border: '3px solid white',
    boxShadow: '0 4px 14px rgba(22, 163, 74, 0.4)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    transition: 'transform 0.2s, box-shadow 0.2s',
  })
  btn.textContent = '🌍'
  container.appendChild(btn)

  // Inject animation keyframes
  if (!document.getElementById('terracart-styles')) {
    const style = document.createElement('style')
    style.id = 'terracart-styles'
    style.textContent = '@keyframes terracart-fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@keyframes terracart-pulse{0%,100%{box-shadow:0 4px 14px rgba(22,163,74,0.4)}50%{box-shadow:0 4px 28px rgba(22,163,74,0.7),0 0 0 8px rgba(22,163,74,0.12)}}'
    document.head.appendChild(style)
  }

  // Pulse animation on first detection (3 cycles, ~4.5s total)
  btn.style.animation = 'terracart-pulse 1.5s ease-in-out 3'
  btn.addEventListener('animationend', () => {
    btn.style.animation = ''
  }, { once: true })

  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.1)'
    btn.style.boxShadow = '0 6px 20px rgba(22, 163, 74, 0.5)'
  })
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)'
    btn.style.boxShadow = '0 4px 14px rgba(22, 163, 74, 0.4)'
  })

  // Click handling with drag support
  let hasMoved = false
  let startX = 0, startY = 0

  btn.addEventListener('mousedown', (e) => {
    hasMoved = false
    startX = e.clientX
    startY = e.clientY
    e.preventDefault()
  })

  document.addEventListener('mousemove', (e) => {
    if (startX === 0) return
    const dx = Math.abs(e.clientX - startX)
    const dy = Math.abs(e.clientY - startY)
    if (dx > 3 || dy > 3) hasMoved = true
  })

  document.addEventListener('mouseup', () => {
    if (startX === 0) return
    startX = 0
    if (!hasMoved) openSidePanel()
  })

  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openSidePanel()
    }
  })

  document.body.appendChild(container)
  floatingButton = container
}

/**
 * Update the floating button tooltip with product info
 */
function updateFloatingButtonProduct(product: Product | null, productCount: number) {
  if (!productTooltip) return
  if (product && product.name) {
    const priceStr = product.price > 0 ? product.currency + ' ' + product.price.toFixed(0) : ''
    const brandStr = product.brand ? product.brand + ' · ' : ''
    productTooltip.innerHTML = '<div style="font-weight:600;margin-bottom:2px">✅ Product detected</div>' +
      '<div>' + product.name.slice(0, 60) + '</div>' +
      (priceStr ? '<div style="color:#16a34a;font-weight:600">' + brandStr + priceStr + '</div>' : '') +
      '<div style="color:#999;font-size:10px;margin-top:2px">Click 🌿 to analyze</div>'
    productTooltip.style.display = 'block'
  } else if (productCount > 0) {
    productTooltip.innerHTML = '<div style="font-weight:600">◎ ' + productCount + ' products on page</div>' +
      '<div style="color:#999;font-size:10px;margin-top:2px">Click 🌿 to scan</div>'
    productTooltip.style.display = 'block'
  } else {
    productTooltip.style.display = 'none'
  }
}

function removeFloatingButton() {
  if (floatingButton) {
    floatingButton.remove()
    floatingButton = null
  }
}

function openSidePanel() {
  chrome.runtime?.sendMessage({ type: 'OPEN_SIDE_PANEL' }).catch(() => {
    try {
      chrome.sidePanel?.open({ windowId: (chrome.windows as any).WINDOW_ID_CURRENT })
    } catch { /* ignore */ }
  })
}

// ---- Message Listener ----
function setupMessageListener() {
  chrome.runtime?.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
      case 'SCAN_PAGE': {
        const result = performScan()
        sendResponse(result)
        return true
      }

      case 'GET_CACHED_SCAN': {
        sendResponse(lastScanResult)
        return false
      }

      case 'GET_ECOMMERCE_DETECTION': {
        if (!lastDetection) {
          lastDetection = detectECommerceSite(document, window.location.href)
        }
        sendResponse(lastDetection)
        return false
      }

      case 'GET_PRODUCT_INFO': {
        if (lastScanResult?.primaryProduct) {
          sendResponse(lastScanResult.primaryProduct)
        } else if (lastScanResult?.products.length) {
          sendResponse(lastScanResult.products[0])
        } else {
          sendResponse(null)
        }
        return false
      }

      case 'ACTIVATE_TERRACART': {
        activateTerraCart('manual')
        sendResponse({ success: true })
        return false
      }

      case 'HIDE_FLOATING_BUTTON': {
        removeFloatingButton()
        sendResponse({ success: true })
        return false
      }

      case 'SHOW_FLOATING_BUTTON': {
        injectFloatingButton()
        sendResponse({ success: true })
        return false
      }

      case 'GET_PAGE_URL': {
        sendResponse({ url: window.location.href, title: document.title })
        return false
      }

      case 'AUTO_OPEN_PENDING': {
        showAutoOpenToast(message.delay || 2000)
        sendResponse({ success: true })
        return false
      }

      case 'AUTO_OPEN_DONE': {
        playAutoOpenSound(message.chimeVolume || 'soft')
        dismissAutoOpenToast()
        sendResponse({ success: true })
        return false
      }
    }
  })
}

// ---- Report readiness to background ----
function reportReady() {
  chrome.runtime?.sendMessage({ type: 'CONTENT_SCRIPT_READY' }).catch(() => {})
}

// ---- Auto-Open Notification ----
let autoOpenToastEl: HTMLElement | null = null
let autoOpenToastTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Show a subtle toast notification when auto-open is about to trigger.
 */
function showAutoOpenToast(delayMs: number) {
  if (autoOpenToastEl || document.getElementById('terracart-auto-open-toast')) return

  // Inject styles if needed
  if (!document.getElementById('terracart-styles')) {
    const style = document.createElement('style')
    style.id = 'terracart-styles'
    style.textContent = '@keyframes terracart-fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@keyframes terracart-toast-out{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-8px)}}'
    document.head.appendChild(style)
  }

  const toast = document.createElement('div')
  toast.id = 'terracart-auto-open-toast'
  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:16px">🌍</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:12px;color:#1a1a1a">TerraCart detected a shopping site</div>
        <div style="font-size:11px;color:#6b7280;margin-top:1px">Opening analysis panel...</div>
      </div>
      <button id="terracart-auto-open-cancel" style="background:none;border:1px solid #d1d5db;border-radius:6px;padding:3px 8px;font-size:10px;color:#6b7280;cursor:pointer;white-space:nowrap;flex-shrink:0" aria-label="Cancel auto-open">Cancel</button>
    </div>
  `
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '88px',
    right: '24px',
    background: 'white',
    borderRadius: '12px',
    padding: '10px 14px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
    zIndex: '2147483647',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    animation: 'terracart-fadein 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    maxWidth: '280px',
    pointerEvents: 'auto',
  })

  document.body.appendChild(toast)
  autoOpenToastEl = toast

  // Cancel button: cancel auto-open from content script side
  const cancelBtn = toast.querySelector('#terracart-auto-open-cancel')
  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      // Notify background to cancel the pending auto-open
      chrome.runtime?.sendMessage({ type: 'CANCEL_AUTO_OPEN' }).catch(() => {})
      dismissAutoOpenToast()
    })
  }

  // Auto-dismiss after delay + small buffer
  autoOpenToastTimer = setTimeout(() => {
    dismissAutoOpenToast()
  }, delayMs + 500)
}

/**
 * Dismiss the auto-open toast with a fade-out animation.
 */
function dismissAutoOpenToast() {
  if (autoOpenToastTimer) {
    clearTimeout(autoOpenToastTimer)
    autoOpenToastTimer = null
  }
  if (autoOpenToastEl) {
    autoOpenToastEl.style.animation = 'terracart-toast-out 0.3s ease forwards'
    setTimeout(() => {
      autoOpenToastEl?.remove()
      autoOpenToastEl = null
    }, 300)
  }
}

/**
 * Play a subtle chime sound when the side panel opens.
 * Uses Web Audio API to generate a soft two-tone chime — no external files needed.
 */
function playAutoOpenSound(volume: 'off' | 'soft' | 'loud' = 'soft') {
  if (volume === 'off') return
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const now = ctx.currentTime
    const peakGain = volume === 'loud' ? 0.18 : 0.08
    const notes = [523.25, 659.25] // C5, E5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + i * 0.12)
      gain.gain.setValueAtTime(0, now + i * 0.12)
      gain.gain.linearRampToValueAtTime(peakGain, now + i * 0.12 + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + i * 0.12)
      osc.stop(now + i * 0.12 + 0.3)
    })
  } catch { /* Web Audio not available */ }
}

// ---- Start ----
init()
