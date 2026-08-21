import type { RetailerAdapter } from './types'
import type { Product, PageScanResult, ProductCategory } from '../types'

export const noonAdapter: RetailerAdapter = {
  name: 'Noon',
  hostname: 'noon.com',

  canHandle(url: string): boolean {
    try {
      const h = new URL(url).hostname
      return h === 'noon.com' || h.endsWith('.noon.com') || h === 'www.noon.com'
    } catch { return false }
  },

  extractProduct(doc: Document, url: string): Product | null {
    // Noon uses various class patterns
    const nameEl = doc.querySelector('[data-qa="product-name"]') || doc.querySelector('h1') || doc.querySelector('[class*="ProductName"]')
    const name = nameEl?.textContent?.trim()
    if (!name) return null

    const priceEl = doc.querySelector('[data-qa="product-price"]') || doc.querySelector('[class*="Price"] span')
    const priceText = priceEl?.textContent?.replace(/[^\d.]/g, '') || '0'
    const price = parseFloat(priceText) || 0

    const currencyEl = doc.querySelector('[data-qa="product-price"]') || doc.querySelector('[class*="Price"]')
    const currencyText = currencyEl?.textContent || ''
    const currency = currencyText.includes('AED') ? 'AED' : currencyText.includes('SAR') ? 'SAR' : currencyText.includes('EGP') ? 'EGP' : 'AED'

    const imgEl = doc.querySelector('[data-qa="product-gallery"] img') || doc.querySelector('img[class*="Gallery"]')
    const image = imgEl?.getAttribute('src') || ''

    const descEl = doc.querySelector('[data-qa="product-description"]') || doc.querySelector('[class*="Description"]')
    const description = descEl?.textContent?.trim()?.slice(0, 500) || ''

    const ratingEl = doc.querySelector('[class*="Rating"]') || doc.querySelector('[data-qa="rating"]')
    const rating = parseFloat(ratingEl?.textContent?.match(/([\d.]+)/)?.[1] || '0')

    const reviewCountEl = doc.querySelector('[class*="ReviewCount"]') || doc.querySelector('[data-qa="reviews-count"]')
    const reviewCount = parseInt(reviewCountEl?.textContent?.replace(/[^\d]/g, '') || '0')

    const brandEl = doc.querySelector('[class*="Brand"]') || doc.querySelector('[data-qa="brand-name"]')
    const brand = brandEl?.textContent?.trim() || ''

    const features: string[] = []
    doc.querySelectorAll('[class*="Feature"] li, [data-qa="feature"] li').forEach(el => {
      const text = el.textContent?.trim()
      if (text && text.length > 2 && text.length < 200) features.push(text)
    })

    const productId = url.match(/\/(\d+)$/)?.[1] || `noon-${Date.now()}`

    return {
      id: productId,
      name,
      category: guessCategory(name + ' ' + description),
      price,
      currency,
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
      retailer: 'Noon',
      rating,
      reviewCount,
      availability: 'unknown',
      url: window.location.href,
      brand,
      features: features.slice(0, 10),
    }
  },

  extractSearchResults(doc: Document, url: string): Product[] {
    const products: Product[] = []
    const cards = doc.querySelectorAll('[class*="productItem"], [data-qa="product-card"]')

    cards.forEach(card => {
      const nameEl = card.querySelector('[class*="name"], h2, h3')
      const name = nameEl?.textContent?.trim()
      if (!name) return

      const priceEl = card.querySelector('[class*="price"]')
      const price = parseFloat(priceEl?.textContent?.replace(/[^\d.]/g, '') || '0')

      const imgEl = card.querySelector('img')
      const image = imgEl?.getAttribute('src') || ''

      const linkEl = card.querySelector('a')
      const href = linkEl?.getAttribute('href') || ''
      const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.origin).href

      const ratingEl = card.querySelector('[class*="rating"], [class*="Rating"]')
      const rating = parseFloat(ratingEl?.textContent?.match(/([\d.]+)/)?.[1] || '0')

      products.push({
        id: `noon-${Date.now()}-${products.length}`,
        name: name.slice(0, 200),
        category: guessCategory(name),
        price,
        currency: 'AED',
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
        retailer: 'Noon',
        rating,
        reviewCount: 0,
        availability: 'unknown',
        url: fullUrl,
      })
    })

    return products.slice(0, 20)
  },

  extractSearchQuery(url: string): string | null {
    try {
      return new URL(url).searchParams.get('q') || new URL(url).searchParams.get('search') || null
    } catch { return null }
  },

  scanPage(doc: Document, url: string): PageScanResult {
    const isProductPage = url.includes('/product/') || url.match(/\/\d+$/)
    const isSearchResults = url.includes('/search') || url.includes('?q=')

    if (isProductPage) {
      const product = this.extractProduct(doc, url)
      return {
        type: 'product-page',
        products: product ? [product] : [],
        primaryProduct: product || undefined,
        retailer: 'Noon',
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
        retailer: 'Noon',
        pageTitle: doc.title,
        timestamp: Date.now(),
      }
    }

    return { type: 'other', products: [], retailer: 'Noon', pageTitle: doc.title, timestamp: Date.now() }
  },
}

function extractMaterials(text: string): string[] {
  const materials: string[] = []
  const patterns = [
    /\b(stainless steel|plastic|bamboo|glass|aluminum|aluminium|cotton|polyester|wood|rubber|silicone|ceramic|nylon|leather|metal|paper|cardboard|bamboo fiber|organic cotton|hemp|linen|wool|titanium|copper|zinc|fiberglass|carbon fiber|TPU|BPA-free|recycled|FSC|organic|biodegradable|compostable|recyclable)\b/gi,
  ]
  for (const pattern of patterns) {
    const matches = text.match(pattern)
    if (matches) {
      matches.forEach(m => {
        const normalized = m.toLowerCase()
        if (!materials.includes(normalized)) materials.push(normalized)
      })
    }
  }
  return materials.slice(0, 8)
}

function guessCategory(text: string): ProductCategory {
  const t = text.toLowerCase()
  if (/\b(bottle|cup|mug|tumbler|flask|water|drink|beverage)\b/.test(t)) return 'beverages'
  if (/\b(container|wrap|foil|bowl|plate|utensil|kitchen)\b/.test(t)) return 'kitchen'
  if (/\b(clean|detergent|soap|sponge|mop|broom|wipe|trash bag)\b/.test(t)) return 'cleaning'
  if (/\b(pen|pencil|notebook|paper|eraser|marker|school)\b/.test(t)) return 'school-supplies'
  if (/\b(phone|laptop|tablet|headphone|earbuds|charger|battery|cable|speaker)\b/.test(t)) return 'electronics'
  if (/\b(shirt|pants|shoes|dress|jacket|hat|clothing|fashion)\b/.test(t)) return 'clothing'
  if (/\b(toothbrush|shampoo|lotion|razor|deodorant|skincare|personal care)\b/.test(t)) return 'personal-care'
  if (/\b(light|bulb|furniture|pillow|blanket|home)\b/.test(t)) return 'home'
  if (/\b(food|snack|coffee|tea|spice)\b/.test(t)) return 'food'
  if (/\b(suitcase|luggage|travel)\b/.test(t)) return 'travel'
  if (/\b(gym|fitness|yoga)\b/.test(t)) return 'fitness'
  return 'other'
}
