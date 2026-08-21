import type { RetailerAdapter } from './types'
import type { PageScanResult } from '../types'
import { amazonAdapter } from './amazon'
import { noonAdapter } from './noon'
import { walmartAdapter } from './walmart'
import { uaeFashionAdapter } from './uae-fashion'
import { genericAdapter } from './generic'
import { detectECommerce, type ECommerceDetection } from './detector'

/**
 * Retailer adapters in priority order.
 * First matching adapter wins. Generic is always last.
 */
const adapters: RetailerAdapter[] = [
  amazonAdapter,
  noonAdapter,
  walmartAdapter,
  uaeFashionAdapter,
  genericAdapter, // Must be last — always matches
]

// Known shopping domains for quick checks without DOM analysis
const KNOWN_SHOPPING_DOMAINS = new Set([
  // ---- Global Major Retailers ----
  'amazon.com', 'amazon.ae', 'amazon.co.uk', 'amazon.de', 'amazon.fr',
  'amazon.co.jp', 'amazon.in', 'amazon.ca', 'amazon.com.au',
  'walmart.com', 'target.com', 'bestbuy.com', 'ebay.com', 'etsy.com',
  'aliexpress.com', 'costco.com', 'homedepot.com',
  // ---- UAE / GCC ----
  'noon.com', 'souq.com',
  // ---- UAE Fashion ----
  'namshi.com', 'centrepoint.com', '6thstreet.com', 'ounass.ae',
  'shein.com', 'hm.com', 'zara.com', 'pullandbear.com', 'bershka.com',
  'stradivarius.com', 'massimodutti.com', 'mango.com',
  'nike.com', 'adidas.ae', 'adidas.com', 'puma.com', 'newbalance.com',
  'asos.com', 'splashfashion.com', 'maxfashion.com',
  'marksandspencer.com', 'next.ae', 'lcwaikiki.com',
  'sivvi.com', 'levelshoes.com', 'levelkids.com',
  'bloomingdales.ae', 'harveynichols.com',
  'americaneagle.me',
  // ---- UAE Beauty ----
  'faces.ae', 'sephora.ae', 'kikomilano.ae',
  'thebodyshop.ae', 'bathandbodyworks.com', 'rituals.com',
  'lookfantastic.com',
  // ---- UAE Grocery / Pharmacy ----
  'carrefouruae.com', 'luluhypermarket.com', 'spinneys.com',
  'waitrose.ae', 'boots.ae', 'lifepharmacy.com',
  // ---- UAE Electronics ----
  'sharafdg.com', 'jumbo.ae', 'emax.ae',
  // ---- UAE Home ----
  'danubehome.com', 'ikea.ae', 'aceuae.com',
  // ---- UAE Kids / Baby ----
  'mumzworld.com', 'firstcry.ae',
  // ---- UAE Other ----
  'virginmegastore.me',
  // ---- Global Fashion / Beauty / Health ----
  'iherb.com', 'sephora.com', 'nordstrom.com',
  'hm.com', 'zara.com', 'uniqlo.com',
  'nike.com', 'adidas.com', 'puma.com', 'newbalance.com',
  'asos.com', 'boohoo.com', 'prettylittlething.com',
  'matchesfashion.com', 'mytheresa.com',
  'ssense.com', 'farfetch.com', 'net-a-porter.com',
  'johnlewis.com', 'selfridges.com', 'harrods.com',
  // ---- Global Electronics ----
  'newegg.com', 'microcenter.com',
  // ---- Global Home / Furniture ----
  'wayfair.com', 'overstock.com',
])

/**
 * Get the best adapter for a given URL.
 */
export function getAdapterForUrl(url: string): RetailerAdapter {
  for (const adapter of adapters) {
    if (adapter.canHandle(url) && adapter.name !== 'Generic') {
      return adapter
    }
  }
  return genericAdapter
}

/**
 * Scan a page using the appropriate adapter.
 */
export function scanPage(doc: Document, url: string): PageScanResult {
  const adapter = getAdapterForUrl(url)
  return adapter.scanPage(doc, url)
}

/**
 * Detect if a page is an e-commerce website.
 * Uses the multi-signal detection engine.
 */
export function detectECommerceSite(doc: Document, url: string): ECommerceDetection {
  return detectECommerce(doc, url)
}

/**
 * Quick check: is this a known shopping domain?
 * No DOM analysis needed — just URL matching.
 */
export function isKnownShoppingSite(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    return KNOWN_SHOPPING_DOMAINS.has(hostname) || KNOWN_SHOPPING_DOMAINS.has('www.' + hostname)
  } catch {
    return false
  }
}

/**
 * Check if a page should activate TerraCart.
 * First checks known domains, then falls back to e-commerce detection.
 */
export function shouldActivate(doc: Document, url: string): { activate: boolean; detection: ECommerceDetection | null } {
  // Fast path: known domain
  if (isKnownShoppingSite(url)) {
    return { activate: true, detection: null }
  }

  // Full detection via DOM analysis
  const detection = detectECommerce(doc, url)
  return { activate: detection.isECommerce, detection }
}

/**
 * List all supported/known retailers.
 */
export function getSupportedRetailers(): string[] {
  return adapters.filter(a => a.name !== 'Generic').map(a => a.name)
}

/**
 * Check if a URL is a known shopping site (alias for backward compatibility).
 */
export function isShoppingSite(url: string): boolean {
  return isKnownShoppingSite(url)
}

export type { RetailerAdapter }
export { ECommerceDetection }
