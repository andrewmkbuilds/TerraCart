import type { RetailerAdapter } from './types'
import type { Product, PageScanResult, ProductCategory } from '../types'

/**
 * Generic adapter that uses structured data (JSON-LD), Open Graph meta tags,
 * and common DOM patterns to extract product information from any website.
 */
export const genericAdapter: RetailerAdapter = {
  name: 'Generic',
  hostname: '*',

  canHandle(_url: string): boolean {
    return true // Fallback adapter — always available
  },

  extractProduct(doc: Document, url: string): Product | null {
    // Strategy 1: JSON-LD structured data (best)
    const jsonLdProduct = extractFromJsonLd(doc)
    if (jsonLdProduct) return { ...jsonLdProduct, url }

    // Strategy 2: Open Graph / meta tags
    const ogProduct = extractFromMeta(doc, url)
    if (ogProduct) return ogProduct

    // Strategy 3: Common DOM patterns
    const domProduct = extractFromDom(doc, url)
    if (domProduct) return domProduct

    return null
  },

  extractSearchResults(doc: Document, url: string): Product[] {
    const products: Product[] = []

    // Look for common product grid patterns
    const selectors = [
      '[data-product-id]',
      '[data-product]',
      '.product-card',
      '.product-item',
      '.product-tile',
      '.product',
      '[class*="ProductCard"]',
      '[class*="product-card"]',
      '[class*="ProductItem"]',
      '[class*="product-item"]',
    ]

    for (const selector of selectors) {
      const cards = doc.querySelectorAll(selector)
      if (cards.length >= 2) {
        cards.forEach(card => {
          const product = extractCardProduct(card, url)
          if (product) products.push(product)
        })
        break
      }
    }

    return products.slice(0, 20)
  },

  extractSearchQuery(url: string): string | null {
    try {
      const u = new URL(url)
      for (const key of ['q', 'query', 'search', 'keyword', 'text', 's', 'search_query', 'searchTerm']) {
        const val = u.searchParams.get(key)
        if (val) return val
      }
      // Check URL path for /search/... or /s/...
      const pathMatch = u.pathname.match(/\/(?:search|s)\/([^/?]+)/)
      if (pathMatch) return decodeURIComponent(pathMatch[1])
    } catch { /* ignore */ }
    return null
  },

  scanPage(doc: Document, url: string): PageScanResult {
    const searchQuery = this.extractSearchQuery(url)
    const product = this.extractProduct(doc, url)
    const products = this.extractSearchResults(doc, url)
    const hostname = new URL(url).hostname

    if (product && products.length <= 1) {
      return {
        type: 'product-page',
        products: [product],
        primaryProduct: product,
        retailer: hostname,
        pageTitle: doc.title,
        timestamp: Date.now(),
      }
    }

    if (products.length > 1) {
      return {
        type: 'search-results',
        products,
        searchQuery: searchQuery || undefined,
        retailer: hostname,
        pageTitle: doc.title,
        timestamp: Date.now(),
      }
    }

    if (product) {
      return {
        type: 'product-page',
        products: [product],
        primaryProduct: product,
        retailer: hostname,
        pageTitle: doc.title,
        timestamp: Date.now(),
      }
    }

    return {
      type: 'other',
      products: [],
      retailer: hostname,
      pageTitle: doc.title,
      timestamp: Date.now(),
    }
  },
}

// ---- JSON-LD Extraction ----

function extractFromJsonLd(doc: Document): Product | null {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')

  for (const script of scripts) {
    try {
      let data = JSON.parse(script.textContent || '')
      // Handle arrays
      if (Array.isArray(data)) {
        data = data.find((d: any) => d['@type'] === 'Product') || data[0]
      }
      // Handle @graph
      if (data['@graph']) {
        data = data['@graph'].find((d: any) => d['@type'] === 'Product') || data
      }

      if (data['@type'] !== 'Product' && data['@type'] !== 'IndividualProduct') continue

      const name = data.name || ''
      const price = data.offers?.price || data.offers?.lowPrice || 0
      const currency = data.offers?.priceCurrency || 'USD'
      const image = typeof data.image === 'string' ? data.image : (Array.isArray(data.image) ? data.image[0] : '')
      const description = (data.description || '').slice(0, 500)
      const brand = typeof data.brand === 'string' ? data.brand : data.brand?.name || ''
      const rating = data.aggregateRating?.ratingValue || 0
      const reviewCount = data.aggregateRating?.reviewCount || 0
      const sku = data.sku || data.productID || `jsonld-${Date.now()}`
      const category = data.category || ''

      const materials: string[] = []
      if (data.material) {
        const mat = Array.isArray(data.material) ? data.material : [data.material]
        mat.forEach((m: string) => { if (m && !materials.includes(m.toLowerCase())) materials.push(m.toLowerCase()) })
      }

      return {
        id: sku,
        name,
        category: guessCategory(name + ' ' + description + ' ' + category),
        price: typeof price === 'number' ? price : parseFloat(String(price)) || 0,
        currency,
        image,
        description,
        materials,
        packaging: {
          type: ['unknown'],
          estimatedWeight: 'unknown' as any,
          recyclable: 'unknown',
          containsPlastic: 'unknown' as any,
          refillable: 'unknown' as any,
        },
        retailer: new URL(window.location.href).hostname,
        rating: typeof rating === 'number' ? rating : parseFloat(String(rating)) || 0,
        reviewCount: typeof reviewCount === 'number' ? reviewCount : parseInt(String(reviewCount)) || 0,
        availability: mapAvailability(data.offers?.availability),
        url: window.location.href,
        brand,
        features: [],
      }
    } catch { continue }
  }
  return null
}

// ---- Meta Tag Extraction ----

function extractFromMeta(doc: Document, url: string): Product | null {
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')
  if (!ogTitle) return null

  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || ''
  const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || ''
  const ogPrice = doc.querySelector('meta[property="product:price:amount"]')?.getAttribute('content')
  const ogCurrency = doc.querySelector('meta[property="product:price:currency"]')?.getAttribute('content') || 'USD'
  const ogBrand = doc.querySelector('meta[property="product:brand"]')?.getAttribute('content') || ''
  const ogType = doc.querySelector('meta[property="og:type"]')?.getAttribute('content') || ''

  // Only proceed if this looks like a product page
  if (!ogType.includes('product') && !ogPrice) return null

  return {
    id: `og-${Date.now()}`,
    name: ogTitle.slice(0, 200),
    category: guessCategory(ogTitle + ' ' + ogDesc),
    price: ogPrice ? parseFloat(ogPrice) || 0 : 0,
    currency: ogCurrency,
    image: ogImage,
    description: ogDesc.slice(0, 500),
    materials: [],
    packaging: {
      type: ['unknown'],
      estimatedWeight: 'unknown' as any,
      recyclable: 'unknown',
      containsPlastic: 'unknown' as any,
      refillable: 'unknown' as any,
    },
    retailer: new URL(url).hostname,
    rating: 0,
    reviewCount: 0,
    availability: 'unknown',
    url,
    brand: ogBrand,
    features: [],
  }
}

// ---- DOM Heuristic Extraction ----

function extractFromDom(doc: Document, url: string): Product | null {
  // Look for title-like elements
  const titleSelectors = ['h1', '[class*="product-title"]', '[class*="ProductName"]', '[class*="product-name"]', '[data-testid*="title"]']
  let name = ''
  for (const sel of titleSelectors) {
    const el = doc.querySelector(sel)
    const text = el?.textContent?.trim()
    if (text && text.length > 3 && text.length < 300) {
      name = text
      break
    }
  }
  if (!name) return null

  // Look for price
  const priceSelectors = ['[class*="price"]', '[data-testid*="price"]', '[class*="Price"]', 'span[class*="amount"]']
  let price = 0
  let currency = 'USD'
  for (const sel of priceSelectors) {
    const el = doc.querySelector(sel)
    const text = el?.textContent || ''
    const match = text.match(/[\d,]+\.?\d*/)
    if (match) {
      price = parseFloat(match[0].replace(/,/g, '')) || 0
      if (price > 0) {
        if (text.includes('AED') || text.includes('د.إ')) currency = 'AED'
        else if (text.includes('£') || text.includes('GBP')) currency = 'GBP'
        else if (text.includes('€') || text.includes('EUR')) currency = 'EUR'
        else if (text.includes('₹') || text.includes('INR')) currency = 'INR'
        else if (text.includes('$')) currency = 'USD'
        break
      }
    }
  }

  // Look for image
  const imgSelectors = ['[class*="product"] img', '[class*="Product"] img', 'main img', 'article img']
  let image = ''
  for (const sel of imgSelectors) {
    const el = doc.querySelector(sel)
    const src = el?.getAttribute('src')
    if (src && src.startsWith('http')) {
      image = src
      break
    }
  }

  return {
    id: `dom-${Date.now()}`,
    name,
    category: guessCategory(name),
    price,
    currency,
    image,
    description: '',
    materials: [],
    packaging: {
      type: ['unknown'],
      estimatedWeight: 'unknown' as any,
      recyclable: 'unknown',
      containsPlastic: 'unknown' as any,
      refillable: 'unknown' as any,
    },
    retailer: new URL(url).hostname,
    rating: 0,
    reviewCount: 0,
    availability: 'unknown',
    url,
    features: [],
  }
}

// ---- Card Product Extraction (for search results) ----

function extractCardProduct(card: Element, _url: string): Product | null {
  const nameEl = card.querySelector('h2, h3, [class*="title"], [class*="name"], a[class*="link"]')
  const name = nameEl?.textContent?.trim()
  if (!name || name.length < 3) return null

  const priceEl = card.querySelector('[class*="price"], [class*="Price"]')
  const price = parseFloat(priceEl?.textContent?.replace(/[^\d.]/g, '') || '0')

  const imgEl = card.querySelector('img')
  const image = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || ''

  const linkEl = card.querySelector('a[href]')
  const href = linkEl?.getAttribute('href') || ''
  const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.origin).href

  return {
    id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.slice(0, 200),
    category: guessCategory(name),
    price,
    currency: 'USD',
    image,
    description: '',
    materials: [],
    packaging: {
      type: ['unknown'],
      estimatedWeight: 'unknown' as any,
      recyclable: 'unknown',
      containsPlastic: 'unknown' as any,
      refillable: 'unknown' as any,
    },
    retailer: new URL(_url).hostname,
    rating: 0,
    reviewCount: 0,
    availability: 'unknown',
    url: fullUrl,
  }
}

// ---- Helpers ----

function mapAvailability(val: string | undefined): Product['availability'] {
  if (!val) return 'unknown'
  const v = val.toLowerCase()
  if (v.includes('instock') || v.includes('in_stock') || v.includes('in stock')) return 'in-stock'
  if (v.includes('outofstock') || v.includes('out_of_stock') || v.includes('out of stock')) return 'out-of-stock'
  if (v.includes('limited')) return 'limited'
  return 'unknown'
}

function guessCategory(text: string): ProductCategory {
  const t = text.toLowerCase()
  if (/\b(bottle|cup|mug|tumbler|flask|water|drink|beverage|soda|juice)\b/.test(t)) return 'beverages'
  if (/\b(container|wrap|foil|bowl|plate|utensil|cutlery|food storage|lunch box|kitchen)\b/.test(t)) return 'kitchen'
  if (/\b(clean|detergent|soap|sponge|mop|broom|wipe|trash bag|laundry)\b/.test(t)) return 'cleaning'
  if (/\b(pen|pencil|notebook|paper|eraser|marker|crayon|school|stapler)\b/.test(t)) return 'school-supplies'
  if (/\b(phone|laptop|tablet|headphone|earbuds|charger|battery|cable|speaker|keyboard|mouse|monitor)\b/.test(t)) return 'electronics'
  if (/\b(shirt|pants|shoes|dress|jacket|hat|sock|clothing|apparel|fashion|t-shirt|jeans)\b/.test(t)) return 'clothing'
  if (/\b(toothbrush|shampoo|lotion|razor|deodorant|skincare|makeup|personal care)\b/.test(t)) return 'personal-care'
  if (/\b(light|bulb|furniture|pillow|blanket|curtain|rug|home)\b/.test(t)) return 'home'
  if (/\b(food|snack|granola|coffee|tea|spice|oil|sauce|protein)\b/.test(t)) return 'food'
  if (/\b(suitcase|luggage|travel|passport)\b/.test(t)) return 'travel'
  if (/\b(gym|fitness|yoga|dumbbell|workout|sport)\b/.test(t)) return 'fitness'
  if (/\b(office|desk|printer|staple|clip|tape|binder)\b/.test(t)) return 'office'
  return 'other'
}
