/**
 * TerraCart site gate.
 * Positive shopping detection is the primary switch.
 * A compact hard-block list is a safety net, not the whole system.
 */

export type SiteGateResult = {
  blocked: boolean
  knownShopping: boolean
  isEcommerce: boolean
  hostname: string
  reason: string
}

const KNOWN_SHOPPING_HOSTS = [
  'amazon.com', 'amazon.ae', 'amazon.co.uk', 'amazon.de', 'amazon.fr',
  'amazon.co.jp', 'amazon.in', 'amazon.ca', 'amazon.com.au', 'amazon.sa',
  'amazon.eg', 'walmart.com', 'target.com', 'bestbuy.com', 'ebay.com', 'etsy.com',
  'aliexpress.com', 'costco.com', 'homedepot.com',
  'noon.com', 'souq.com', 'namshi.com', 'centrepoint.com', '6thstreet.com',
  'ounass.ae', 'shein.com', 'hm.com', 'zara.com', 'pullandbear.com',
  'bershka.com', 'stradivarius.com', 'massimodutti.com', 'mango.com',
  'nike.com', 'adidas.ae', 'adidas.com', 'puma.com', 'newbalance.com',
  'asos.com', 'splashfashion.com', 'maxfashion.com',
  'marksandspencer.com', 'next.ae', 'lcwaikiki.com',
  'sivvi.com', 'levelshoes.com', 'levelkids.com',
  'bloomingdales.ae', 'harveynichols.com', 'americaneagle.me',
  'faces.ae', 'sephora.ae', 'kikomilano.ae',
  'thebodyshop.ae', 'bathandbodyworks.com', 'rituals.com', 'lookfantastic.com',
  'carrefouruae.com', 'luluhypermarket.com', 'spinneys.com',
  'waitrose.ae', 'boots.ae', 'lifepharmacy.com',
  'sharafdg.com', 'jumbo.ae', 'emax.ae',
  'danubehome.com', 'ikea.ae', 'ikea.com', 'aceuae.com',
  'mumzworld.com', 'firstcry.ae', 'virginmegastore.me',
  'iherb.com', 'sephora.com', 'nordstrom.com', 'uniqlo.com',
  'decathlon.com', 'decathlon.ae', 'luluhypermarket.com',
  'samsung.com', 'apple.com', 'store.apple.com',
  'sharafdg.com', 'jumbo.ae',
]

const HARD_BLOCK_HOSTS = [
  'google.com', 'gemini.google.com', 'aistudio.google.com', 'bard.google.com',
  'gmail.com', 'docs.google.com', 'drive.google.com', 'calendar.google.com',
  'maps.google.com', 'meet.google.com', 'news.google.com', 'photos.google.com',
  'translate.google.com', 'classroom.google.com', 'mail.google.com',
  'chatgpt.com', 'chat.openai.com', 'openai.com', 'claude.ai', 'anthropic.com',
  'perplexity.ai', 'copilot.microsoft.com', 'bing.com',
  'youtube.com', 'youtu.be', 'gmail.com',
  'github.com', 'gitlab.com', 'bitbucket.org',
  'reddit.com', 'wikipedia.org', 'instagram.com', 'facebook.com', 'fb.com',
  'x.com', 'twitter.com', 'linkedin.com', 'tiktok.com', 'snapchat.com',
  'pinterest.com', 'threads.net',
  'slack.com', 'discord.com', 'notion.so', 'figma.com', 'canva.com',
  'stackoverflow.com', 'medium.com', 'substack.com',
  'netflix.com', 'spotify.com', 'twitch.tv',
]

const GOOGLE_HOST_RE = /(^|\.)google(\.[a-z]{2,})+$/i
const PRODUCT_URL_RE =
  /\/(dp|gp\/product|product|products|p|pd|ip)\/|\/itm\/|\/[A-Z0-9]{10}(?:[/?]|$)/i

export function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

function hostMatches(hostname: string, domain: string): boolean {
  const d = domain.replace(/^www\./i, '').toLowerCase()
  return hostname === d || hostname.endsWith('.' + d)
}

export function isHardBlockedHost(url: string): boolean {
  const hostname = hostnameFromUrl(url)
  if (!hostname) return true
  if (GOOGLE_HOST_RE.test(hostname)) return true
  return HARD_BLOCK_HOSTS.some((d) => hostMatches(hostname, d))
}

export function isKnownShoppingHost(url: string): boolean {
  if (isHardBlockedHost(url)) return false
  const hostname = hostnameFromUrl(url)
  if (!hostname) return false
  return KNOWN_SHOPPING_HOSTS.some((d) => hostMatches(hostname, d))
}

export function isEcommerceSite(
  url: string,
  detection?: { isECommerce?: boolean; confidence?: number } | null,
): boolean {
  if (isHardBlockedHost(url)) return false
  if (isKnownShoppingHost(url)) return true
  if (detection?.isECommerce && (detection.confidence ?? 0) >= 55) return true
  return false
}

export function looksLikeProductUrl(url: string): boolean {
  try {
    return PRODUCT_URL_RE.test(new URL(url).pathname + new URL(url).search)
  } catch {
    return false
  }
}

export function evaluateSiteGate(
  url: string,
  detection?: { isECommerce?: boolean; confidence?: number } | null,
): SiteGateResult {
  const hostname = hostnameFromUrl(url)
  if (!hostname || /^(chrome|chrome-extension|edge|about|devtools):/i.test(url)) {
    return { blocked: true, knownShopping: false, isEcommerce: false, hostname, reason: 'browser-page' }
  }
  if (isHardBlockedHost(url)) {
    return { blocked: true, knownShopping: false, isEcommerce: false, hostname, reason: 'hard-block' }
  }
  const knownShopping = isKnownShoppingHost(url)
  const detected = !!(detection?.isECommerce && (detection.confidence ?? 0) >= 55)
  const isEcommerce = knownShopping || detected
  return {
    blocked: false,
    knownShopping,
    isEcommerce,
    hostname,
    reason: knownShopping ? 'known-shopping' : detected ? 'detected' : 'not-ecommerce',
  }
}

export const MANIFEST_EXCLUDE_MATCHES = [
  '*://*.google.com/*',
  '*://google.com/*',
  '*://gemini.google.com/*',
  '*://*.youtube.com/*',
  '*://youtube.com/*',
  '*://chatgpt.com/*',
  '*://*.chatgpt.com/*',
  '*://chat.openai.com/*',
  '*://*.openai.com/*',
  '*://claude.ai/*',
  '*://*.claude.ai/*',
  '*://*.github.com/*',
  '*://github.com/*',
  '*://*.reddit.com/*',
  '*://*.wikipedia.org/*',
  '*://*.instagram.com/*',
  '*://*.facebook.com/*',
  '*://*.x.com/*',
  '*://*.twitter.com/*',
  '*://*.linkedin.com/*',
  '*://mail.google.com/*',
  '*://docs.google.com/*',
  '*://drive.google.com/*',
]
