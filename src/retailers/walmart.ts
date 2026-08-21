import type { RetailerAdapter } from './types'
import type { Product, PageScanResult, ProductCategory } from '../types'

export const walmartAdapter: RetailerAdapter = {
  name: 'Walmart',
  hostname: 'walmart.com',

  canHandle(url: string): boolean {
    try {
      const h = new URL(url).hostname
      return h === 'walmart.com' || h.endsWith('.walmart.com') || h === 'www.walmart.com'
    } catch { return false }
  },

  extractProduct(doc: Document, url: string): Product | null {
    const nameEl = doc.querySelector('[data-testid="product-title"], h1[class*="product-title"], h1[class*="prod-ProductTitle"]')
    const name = nameEl?.textContent?.trim()
    if (!name) return null

    const priceEl = doc.querySelector('[data-testid="price-wrap"], [itemprop="price"], [class*="price-group"]')
    const priceText = priceEl?.textContent?.replace(/[^\d.]/g, '') || '0'
    const price = parseFloat(priceText) || 0

    const imgEl = doc.querySelector('[data-testid="hero-image"] img, img[class*="hover-zoom"]')
    const image = imgEl?.getAttribute('src') || ''

    const descEl = doc.querySelector('[class*="about-desc"], [data-testid="product-description"]')
    const description = descEl?.textContent?.trim()?.slice(0, 500) || ''

    const ratingEl = doc.querySelector('[class*="rating-average"], [itemprop="ratingValue"]')
    const rating = parseFloat(ratingEl?.textContent?.match(/([\d.]+)/)?.[1] || '0')

    const reviewCountEl = doc.querySelector('[class*="reviews-count"], [itemprop="reviewCount"]')
    const reviewCount = parseInt(reviewCountEl?.textContent?.replace(/[^\d]/g, '') || '0')

    const brandEl = doc.querySelector('[data-testid="product-brand"], [class*="brand-name"]')
    const brand = brandEl?.textContent?.trim() || ''

    const sellerEl = doc.querySelector('[class*="seller-name"], [data-testid="seller"]')
    const seller = sellerEl?.textContent?.trim() || ''

    const features: string[] = []
    doc.querySelectorAll('[data-testid="feature-bullets"] li, [class*="about-desc"] li').forEach(el => {
      const text = el.textContent?.trim()
      if (text && text.length > 2 && text.length < 200) features.push(text)
    })

    const productId = url.match(/\/ip\/(\d+)/)?.[1] || url.match(/\/product\/(\d+)/)?.[1] || `walmart-${Date.now()}`

    return {
      id: productId,
      name,
      category: guessCategory(name + ' ' + description),
      price,
      currency: 'USD',
      image,
      description,
      materials: extractMaterials(description + ' ' + features.join(' ')),
      packaging: {
        type: ['unknown'],
        estimatedWeight: 'unknown' as any,
        recyclable: 'unknown',
        containsPlastic: 'unknown' as any,
        refillable: 'unknown' as any,
      },
      retailer: 'Walmart',
      rating,
      reviewCount,
      availability: 'unknown',
      url: window.location.href,
      brand,
      features: features.slice(0, 10),
      seller,
    }
  },

  extractSearchResults(doc: Document, url: string): Product[] {
    const products: Product[] = []
    const cards = doc.querySelectorAll('[data-testid="list-view"] [data-item-id], [class*="product-tile"]')

    cards.forEach(card => {
      const nameEl = card.querySelector('[class*="product-title"], a[class*="product-title"]')
      const name = nameEl?.textContent?.trim()
      if (!name) return

      const priceEl = card.querySelector('[class*="price"], [itemprop="price"]')
      const price = parseFloat(priceEl?.textContent?.replace(/[^\d.]/g, '') || '0')

      const imgEl = card.querySelector('img')
      const image = imgEl?.getAttribute('src') || ''

      const linkEl = card.querySelector('a[href*="/ip/"]')
      const href = linkEl?.getAttribute('href') || ''
      const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.origin).href

      products.push({
        id: `walmart-${Date.now()}-${products.length}`,
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
        retailer: 'Walmart',
        rating: 0,
        reviewCount: 0,
        availability: 'unknown',
        url: fullUrl,
      })
    })

    return products.slice(0, 20)
  },

  extractSearchQuery(url: string): string | null {
    try {
      return new URL(url).searchParams.get('q') || null
    } catch { return null }
  },

  scanPage(doc: Document, url: string): PageScanResult {
    const isProductPage = url.includes('/ip/') || url.includes('/product/')
    const isSearchResults = url.includes('/search') || url.includes('?q=')

    if (isProductPage) {
      const product = this.extractProduct(doc, url)
      return {
        type: 'product-page',
        products: product ? [product] : [],
        primaryProduct: product || undefined,
        retailer: 'Walmart',
        pageTitle: doc.title,
        timestamp: Date.now(),
      }
    }

    if (isSearchResults) {
      const products = this.extractSearchResults(doc, url)
      return {
        type: 'search-results',
        products,
        searchQuery: this.extractSearchQuery(url) || undefined,
        retailer: 'Walmart',
        pageTitle: doc.title,
        timestamp: Date.now(),
      }
    }

    return { type: 'other', products: [], retailer: 'Walmart', pageTitle: doc.title, timestamp: Date.now() }
  },
}

function extractMaterials(text: string): string[] {
  const materials: string[] = []
  const pattern = /\b(stainless steel|plastic|bamboo|glass|aluminum|cotton|polyester|wood|rubber|silicone|ceramic|nylon|leather|metal|paper|cardboard|organic cotton|recycled|biodegradable|compostable|recyclable)\b/gi
  const matches = text.match(pattern)
  if (matches) {
    matches.forEach(m => {
      const n = m.toLowerCase()
      if (!materials.includes(n)) materials.push(n)
    })
  }
  return materials.slice(0, 8)
}

function guessCategory(text: string): ProductCategory {
  const t = text.toLowerCase()
  if (/\b(bottle|cup|mug|tumbler|flask|water|drink|beverage)\b/.test(t)) return 'beverages'
  if (/\b(container|wrap|foil|bowl|plate|utensil|kitchen)\b/.test(t)) return 'kitchen'
  if (/\b(clean|detergent|soap|sponge|mop|broom|wipe|trash bag)\b/.test(t)) return 'cleaning'
  if (/\b(pen|pencil|notebook|paper|school|stapler)\b/.test(t)) return 'school-supplies'
  if (/\b(phone|laptop|tablet|headphone|earbuds|charger|battery|cable|speaker|monitor)\b/.test(t)) return 'electronics'
  if (/\b(shirt|pants|shoes|dress|jacket|hat|clothing|fashion)\b/.test(t)) return 'clothing'
  if (/\b(toothbrush|shampoo|lotion|razor|skincare|personal care)\b/.test(t)) return 'personal-care'
  if (/\b(light|bulb|furniture|pillow|blanket|home)\b/.test(t)) return 'home'
  if (/\b(food|snack|coffee|tea|spice)\b/.test(t)) return 'food'
  if (/\b(suitcase|luggage|travel)\b/.test(t)) return 'travel'
  if (/\b(gym|fitness|yoga)\b/.test(t)) return 'fitness'
  return 'other'
}
