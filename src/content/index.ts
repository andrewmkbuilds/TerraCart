import { scanPage, shouldActivate, detectECommerceSite, isKnownShoppingSite } from '../retailers'
import type { PageScanResult, Product } from '../types'
import type { ECommerceDetection } from '../retailers/detector'

// ============================================================
// TerraCart Content Script
// Automatically detects e-commerce websites and activates
// the shopping copilot with product detection.
// ============================================================

// Guard against duplicate initialization (re-injection after extension reload)
if ((window as any).__terracartInitialized) {
  // Already running — just ensure the message listener responds to SCAN_PAGE
} else {
  (window as any).__terracartInitialized = true

  let floatingButton: HTMLElement | null = null
  let lastScanResult: PageScanResult | null = null
  let lastDetection: ECommerceDetection | null = null
  let isActive = false
  let scanDebounceTimer: ReturnType<typeof setTimeout> | null = null
  const SCAN_DEBOUNCE_MS = 1000

  // ---- Quick page type detection ----
  type QuickPageType = 'product' | 'search' | 'other'

  function detectPageType(): QuickPageType {
    const url = window.location.href.toLowerCase()
    if (url.includes('/dp/') || url.includes('/gp/product/')) return 'product'
    if (url.includes('/product/') || url.match(/noon\.com.*\/\d+$/)) return 'product'
    if (url.includes('/s?') || url.includes('/s/') || url.includes('/search') || url.includes('?q=') || url.includes('&q=')) return 'search'

    const hasProductSchema = !!document.querySelector('script[type="application/ld+json"]')
    const hasAddToCart = !!document.querySelector('#add-to-cart-button, #addToCart, button[name="add"], [class*="add-to-cart"]')
    const hasPrice = !!document.querySelector('[itemprop="price"], .a-price, [class*="product-price"]')
    const hasBuyNow = !!document.querySelector('button[name="buy"], [class*="buy-now"]')

    if ((hasProductSchema || hasPrice) && (hasAddToCart || hasBuyNow)) return 'product'
    const productCards = document.querySelectorAll('[data-asin], [class*="product-card"], [class*="product-item"], [class*="productCard"]')
    if (productCards.length > 3) return 'search'
    return 'other'
  }

  // ---- Initialize ----
  function init() {
    setupMessageListener()
    runInitialDetection()
    observePageChanges()
  }

  // ---- Non-shopping site blocklist (comprehensive) ----
  // TerraCart MUST NOT activate on any of these sites
  const NON_SHOPPING_BLOCKLIST = [
    // Google services
    'google.com', 'gemini.google.com', 'aistudio.google.com',
    'gmail.com', 'docs.google.com', 'drive.google.com',
    'calendar.google.com', 'maps.google.com', 'meet.google.com',
    'scholar.google.com', 'news.google.com', 'photos.google.com',
    'translate.google.com', 'earth.google.com', 'books.google.com',
    'classroom.google.com', 'forms.google.com', 'sheets.google.com',
    'slides.google.com', 'keep.google.com', 'groups.google.com',
    'cloud.google.com', 'console.cloud.google.com',
    // AI assistants
    'chatgpt.com', 'chat.openai.com', 'openai.com',
    'claude.ai', 'anthropic.com', 'perplexity.ai',
    'copilot.microsoft.com', 'bing.com',
    'huggingface.co', 'replicate.com',
    // Social media
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
    'linkedin.com', 'reddit.com', 'tiktok.com', 'snapchat.com',
    'pinterest.com', 'threads.net', 'mastodon.social',
    'bsky.app', 'truthsocial.com',
    // Video/Streaming
    'youtube.com', 'netflix.com', 'twitch.tv', 'hulu.com',
    'disneyplus.com', 'hbomax.com', 'primevideo.com',
    'vimeo.com', 'dailymotion.com', 'twitch.tv',
    // Music
    'spotify.com', 'music.apple.com', 'soundcloud.com',
    'deezer.com', 'tidal.com', 'pandora.com',
    // Productivity/Work
    'notion.so', 'airtable.com', 'figma.com', 'canva.com',
    'slack.com', 'discord.com', 'teams.microsoft.com',
    'trello.com', 'asana.com', 'monday.com', 'clickup.com',
    'linear.app', 'jira.atlassian.com', 'confluence.atlassian.com',
    'miro.com', 'lucidchart.com',
    // Cloud/Dev
    'github.com', 'gitlab.com', 'bitbucket.org',
    'stackoverflow.com', 'stackexchange.com',
    'vercel.com', 'netlify.com', 'heroku.com',
    'aws.amazon.com', 'cloud.google.com', 'portal.azure.com',
    'digitalocean.com', 'linode.com', 'vultr.com',
    // File storage
    'dropbox.com', 'onedrive.live.com', 'drive.google.com',
    'icloud.com', 'box.com', 'mega.nz',
    // News/Blogs
    'medium.com', 'substack.com', 'wordpress.com',
    'blogger.com', 'ghost.io',
    // Communication
    'zoom.us', 'webex.com', 'goto.com',
    'mailchimp.com', 'sendgrid.com',
    // Education
    'coursera.org', 'udemy.com', 'edx.org',
    'khanacademy.org', 'skillshare.com',
    // Reference
    'wikipedia.org', 'britannica.com',
    // Government/Info
    'gov', '.mil', '.edu',
    // Other non-shopping
    'archive.org', 'imdb.com', 'rottentomatoes.com',
    'metacritic.com', 'goodreads.com', 'tripadvisor.com',
    'yelp.com', 'zomato.com', 'opentable.com',
    'booking.com', 'airbnb.com', 'expedia.com',
    'uber.com', 'lyft.com',
  ]

  // ---- Check if URL is on the blocklist ----
  function isBlocklistedUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.replace('www.', '')
      return NON_SHOPPING_BLOCKLIST.some(d => {
        // Exact match or subdomain match
        if (hostname === d) return true
        if (hostname.endsWith('.' + d)) return true
        // Special handling for Google domains
        if (d === 'google.com' && hostname.endsWith('.google.com')) return true
        return false
      })
    } catch {
      return false
    }
  }

  // ---- Initial Detection ----
  function runInitialDetection() {
    const url = window.location.href

    // CRITICAL: Check blocklist FIRST - before any other detection
    if (isBlocklistedUrl(url)) {
      // Do nothing - TerraCart stays completely inactive
      return
    }

    // Fast path: known shopping domain
    if (isKnownShoppingSite(url)) {
      activateTerraCart('known-domain')
      // Delay scan to let SPA frameworks render product elements
      scheduleScanDelayed(2000)
      return
    }

    // Full e-commerce detection — wait for DOM to settle
    setTimeout(() => {
      // Re-check blocklist after delay (in case of SPA navigation)
      if (isBlocklistedUrl(window.location.href)) {
        return
      }
      
      const detection = detectECommerceSite(document, url)
      lastDetection = detection
      if (detection.isECommerce && detection.confidence >= 60) {
        activateTerraCart('detected', detection)
        scheduleScanDelayed(2000)
      }
    }, 1200)
  }

  // ---- Activation ----
  function activateTerraCart(reason: string, detection?: ECommerceDetection) {
    if (isActive) return
    isActive = true

    if (reason === 'known-domain' || (detection && detection.confidence >= 40)) {
      injectFloatingButton()
    }

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

  // ---- Scan scheduling ----
  function scheduleScan() {
    if (scanDebounceTimer) clearTimeout(scanDebounceTimer)
    scanDebounceTimer = setTimeout(() => { performScan() }, SCAN_DEBOUNCE_MS)
  }

  function scheduleScanDelayed(ms: number) {
    if (scanDebounceTimer) clearTimeout(scanDebounceTimer)
    scanDebounceTimer = setTimeout(() => { performScan() }, ms)
  }

  // ---- Page Scanning ----
  function performScan(): PageScanResult {
    try {
      const result = scanPage(document, window.location.href)
      lastScanResult = result

      const hasProduct = result.type === 'product-page' && result.primaryProduct
      const productCount = result.products.length

      chrome.runtime?.sendMessage({
        type: 'SET_BADGE',
        text: hasProduct ? '●' : productCount > 0 ? String(productCount) : '',
        color: hasProduct ? '#16a34a' : productCount > 0 ? '#3b82f6' : '',
      }).catch(() => {})

      // Send scan results to background (which forwards to side panel)
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

      if (hasProduct || productCount > 0 || isActive) {
        injectFloatingButton()
        updateFloatingButtonProduct(result.primaryProduct || null, result.products.length)
      }

      return result
    } catch (err) {
      console.warn('TerraCart: Scan error', err)
      return {
        type: 'other', products: [], retailer: window.location.hostname,
        pageTitle: document.title, timestamp: Date.now(),
      }
    }
  }

  // ---- SPA Navigation Detection ----
  function observePageChanges() {
    let lastUrl = window.location.href

    const urlCheckInterval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href
        isActive = false
        const detection = detectECommerceSite(document, window.location.href)
        lastDetection = detection
        if (detection.isECommerce && !isActive) {
          activateTerraCart('spa-navigation', detection)
        }
        scheduleScanDelayed(2000)
      }
    }, 1500)

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        const priceElements = document.querySelectorAll('[class*="price"], [class*="Price"], [data-price], [itemprop="price"]')
        const productElements = document.querySelectorAll('[class*="product"], [data-product-id]')
        if (priceElements.length > 0 || productElements.length > 3) {
          scheduleScan()
        }
      }, 2000)
    })

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: false })
    }

    window.addEventListener('beforeunload', () => {
      clearInterval(urlCheckInterval)
      observer.disconnect()
    })
  }

  // ---- Floating Button ----
  let tooltipEl: HTMLDivElement | null = null

  function injectFloatingButton() {
    if (floatingButton || document.getElementById('terracart-float')) return

    const container = document.createElement('div')
    container.id = 'terracart-float'
    container.setAttribute('role', 'button')
    container.setAttribute('aria-label', 'TerraCart Shopping Copilot')
    container.setAttribute('tabindex', '0')
    container.title = 'TerraCart — AI Shopping Copilot'
    Object.assign(container.style, {
      position: 'fixed', bottom: '24px', right: '24px',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px',
      zIndex: '2147483647', userSelect: 'none', pointerEvents: 'auto',
    })

    const tooltip = document.createElement('div')
    tooltip.className = 'terracart-tooltip'
    Object.assign(tooltip.style, {
      background: 'white', borderRadius: '12px', padding: '8px 12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: '220px',
      fontSize: '12px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      color: '#333', lineHeight: '1.3', display: 'none', textAlign: 'right',
    })
    tooltipEl = tooltip
    container.appendChild(tooltip)

    const btn = document.createElement('div')
    Object.assign(btn.style, {
      width: '52px', height: '52px', borderRadius: '50%',
      background: 'linear-gradient(135deg, #16a34a, #15803d)',
      border: '3px solid white', boxShadow: '0 4px 14px rgba(22, 163, 74, 0.4)',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'transform 0.2s, box-shadow 0.2s',
    })
    const btnImg = document.createElement('img')
    btnImg.src = chrome.runtime.getURL('icons/icon48.png')
    btnImg.alt = 'TerraCart'
    btnImg.style.width = '32px'
    btnImg.style.height = '32px'
    btnImg.style.borderRadius = '50%'
    btn.appendChild(btnImg)
    container.appendChild(btn)

    if (!document.getElementById('terracart-styles')) {
      const style = document.createElement('style')
      style.id = 'terracart-styles'
      style.textContent = `
        @keyframes terracart-fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes terracart-pulse{0%,100%{box-shadow:0 4px 14px rgba(22,163,74,0.4)}50%{box-shadow:0 4px 28px rgba(22,163,74,0.7),0 0 0 8px rgba(22,163,74,0.12)}}
        @keyframes terracart-toast-out{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-8px)}}
      `
      document.head.appendChild(style)
    }
    btn.style.animation = 'terracart-pulse 1.5s ease-in-out 3'
    btn.addEventListener('animationend', () => { btn.style.animation = '' }, { once: true })

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)'
      btn.style.boxShadow = '0 6px 20px rgba(22, 163, 74, 0.5)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)'
      btn.style.boxShadow = '0 4px 14px rgba(22, 163, 74, 0.4)'
    })

    let isDragging = false, startX = 0, startY = 0
    btn.addEventListener('mousedown', (e) => { isDragging = false; startX = e.clientX; startY = e.clientY; e.preventDefault() })
    document.addEventListener('mousemove', (e) => { if (startX === 0) return; if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) isDragging = true })
    document.addEventListener('mouseup', () => { if (startX !== 0) { startX = 0; if (!isDragging) openSidePanel() } })
    btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSidePanel() } })

    document.body.appendChild(container)
    floatingButton = container
  }

  function updateFloatingButtonProduct(product: Product | null, productCount: number) {
    if (!tooltipEl) return
    if (product && product.name) {
      const price = product.price > 0 ? `${product.currency} ${product.price.toFixed(0)}` : ''
      const brand = product.brand ? `${product.brand} · ` : ''
      tooltipEl.innerHTML = `<div style="font-weight:600;margin-bottom:2px">✅ Product detected</div><div>${product.name.slice(0, 60)}</div>${price ? `<div style="color:#16a34a;font-weight:600">${brand}${price}</div>` : ''}<div style="color:#999;font-size:10px;margin-top:2px">Click 🌍 to analyze</div>`
      tooltipEl.style.display = 'block'
    } else if (productCount > 0) {
      tooltipEl.innerHTML = `<div style="font-weight:600">◎ ${productCount} products on page</div><div style="color:#999;font-size:10px;margin-top:2px">Click 🌍 to scan</div>`
      tooltipEl.style.display = 'block'
    } else {
      tooltipEl.style.display = 'none'
    }
  }

  function removeFloatingButton() {
    if (floatingButton) { floatingButton.remove(); floatingButton = null }
  }

  function openSidePanel() {
    chrome.runtime?.sendMessage({ type: 'OPEN_SIDE_PANEL' }).catch(() => {
      try { (chrome.sidePanel as any)?.open({ windowId: (chrome.windows as any).WINDOW_ID_CURRENT }) } catch { /* ignore */ }
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
        case 'GET_CACHED_SCAN': { sendResponse(lastScanResult); return false }
        case 'GET_ECOMMERCE_DETECTION': {
          if (!lastDetection) lastDetection = detectECommerceSite(document, window.location.href)
          sendResponse(lastDetection); return false
        }
        case 'GET_PRODUCT_INFO': {
          if (lastScanResult?.primaryProduct) sendResponse(lastScanResult.primaryProduct)
          else if (lastScanResult?.products.length) sendResponse(lastScanResult.products[0])
          else sendResponse(null)
          return false
        }
        case 'ACTIVATE_TERRACART': { activateTerraCart('manual'); sendResponse({ success: true }); return false }
        case 'HIDE_FLOATING_BUTTON': { removeFloatingButton(); sendResponse({ success: true }); return false }
        case 'SHOW_FLOATING_BUTTON': { injectFloatingButton(); sendResponse({ success: true }); return false }
        case 'GET_PAGE_URL': { sendResponse({ url: window.location.href, title: document.title }); return false }
        case 'AUTO_OPEN_PENDING': { showAutoOpenToast(message.delay || 2000); sendResponse({ success: true }); return false }
        case 'AUTO_OPEN_DONE': { dismissAutoOpenToast(); playAutoOpenSound(message.chimeVolume || 'soft'); sendResponse({ success: true }); return false }
      }
    })
  }

  // ---- Auto-Open Toast ----
  let autoOpenToast: HTMLDivElement | null = null
  let autoOpenTimer: ReturnType<typeof setTimeout> | null = null

  function showAutoOpenToast(delay: number) {
    if (autoOpenToast || document.getElementById('terracart-auto-open-toast')) return
    const toast = document.createElement('div')
    toast.id = 'terracart-auto-open-toast'
    toast.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="TerraCart" style="width:24px;height:24px;border-radius:50%" />
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:12px;color:#1a1a1a">TerraCart detected a shopping site</div>
          <div style="font-size:11px;color:#6b7280;margin-top:1px">Opening analysis panel...</div>
        </div>
        <button id="terracart-auto-open-cancel" style="background:none;border:1px solid #d1d5db;border-radius:6px;padding:3px 8px;font-size:10px;color:#6b7280;cursor:pointer;white-space:nowrap;flex-shrink:0">Cancel</button>
      </div>
    `
    Object.assign(toast.style, {
      position: 'fixed', bottom: '88px', right: '24px', background: 'white',
      borderRadius: '12px', padding: '10px 14px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
      zIndex: '2147483647', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      display: 'flex', alignItems: 'center', maxWidth: '280px', pointerEvents: 'auto',
    })
    document.body.appendChild(toast)
    autoOpenToast = toast

    toast.querySelector('#terracart-auto-open-cancel')?.addEventListener('click', (e) => {
      e.stopPropagation()
      chrome.runtime?.sendMessage({ type: 'CANCEL_AUTO_OPEN' }).catch(() => {})
      dismissAutoOpenToast()
    })
    autoOpenTimer = setTimeout(() => { dismissAutoOpenToast() }, delay + 500)
  }

  function dismissAutoOpenToast() {
    if (autoOpenTimer) { clearTimeout(autoOpenTimer); autoOpenTimer = null }
    if (autoOpenToast) { autoOpenToast.remove(); autoOpenToast = null }
  }

  // ---- Sound ----
  function playAutoOpenSound(volume: 'off' | 'soft' | 'loud' = 'soft') {
    if (volume === 'off') return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const now = ctx.currentTime
      const peakGain = volume === 'loud' ? 0.18 : 0.08
      ;[523.25, 659.25].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + i * 0.12)
        gain.gain.setValueAtTime(0, now + i * 0.12)
        gain.gain.linearRampToValueAtTime(peakGain, now + i * 0.12 + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25)
        osc.connect(gain); gain.connect(ctx.destination)
        osc.start(now + i * 0.12); osc.stop(now + i * 0.12 + 0.3)
      })
    } catch { /* Web Audio not available */ }
  }

  // ---- Start ----
  init()
}
