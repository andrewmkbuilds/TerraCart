import type { RetailerAdapter } from './types'
import type { Product, PageScanResult, ProductCategory } from '../types'

/**
 * UAE/GCC Fashion & Retail Adapter
 * Handles: Namshi, Centrepoint, 6thStreet, Ounass, SHEIN, H&M, Zara,
 * Pull&Bear, Bershka, Stradivarius, Massimo Dutti, Nike, Adidas,
 * ASOS, Splash, Max Fashion, Marks & Spencer, Next, LC Waikiki,
 * Sivvi, Level Shoes, Bloomingdale's UAE, Sephora UAE, and more.
 *
 * Uses common DOM patterns found across fashion e-commerce platforms.
 */

const UAE_FASHION_HOSTS = [
  'namshi.com', 'www.namshi.com',
  'centrepoint.com', 'www.centrepoint.com',
  '6thstreet.com', 'www.6thstreet.com',
  'ounass.ae', 'www.ounass.ae',
  'shein.com', 'www.shein.com', 'm.shein.com',
  'hm.com', 'www.hm.com', 'hm.com/en_ae',
  'zara.com', 'www.zara.com',
  'pullandbear.com', 'www.pullanbear.com',
  'bershka.com', 'www.bershka.com',
  'stradivarius.com', 'www.stradivarius.com',
  'massimodutti.com', 'www.massimodutti.com',
  'nike.com', 'www.nike.com', ' nike.com/ae',
  'adidas.ae', 'www.adidas.ae', 'adidas.com',
  'puma.com', 'www.puma.com',
  'newbalance.com', 'www.newbalance.com',
  'asos.com', 'www.asos.com',
  'splashfashion.com', 'www.splashfashion.com',
  'maxfashion.com', 'www.maxfashion.com',
  'marksandspencer.com', 'www.marksandspencer.com',
  'next.ae', 'www.next.ae',
  'lckids.com', 'www.lckids.com',
  'lcwaikiki.com', 'www.lcwaikiki.com',
  'sivvi.com', 'www.sivvi.com',
  'levelshoes.com', 'www.levelshoes.com',
  'bloomingdales.ae', 'www.bloomingdales.ae',
  'harveynichols.com', 'www.harveynichols.com',
  'faces.ae', 'www.faces.ae',
  'sephora.ae', 'www.sephora.ae',
  'thebodyshop.ae', 'www.thebodyshop.ae',
  'bathandbodyworks.com', 'www.bathandbodyworks.com',
  'lookfantastic.com', 'www.lookfantastic.com',
  'iherb.com', 'www.iherb.com',
  'mumzworld.com', 'www.mumzworld.com',
  'firstcry.ae', 'www.firstcry.ae',
  'virginmegastore.me', 'www.virginmegastore.me',
  'kikomilano.ae', 'www.kikomilano.ae',
  'rituals.com', 'www.rituals.com',
  'americaneagle.me', 'www.americaneagle.me',
  'reshoevn8r.com', 'www.reshoevn8r.com',
]

export const uaeFashionAdapter: RetailerAdapter = {
  name: 'UAE Fashion & Retail',
  hostname: '*',

  canHandle(url: string): boolean {
    try {
      const h = new URL(url).hostname.replace('www.', '')
      return UAE_FASHION_HOSTS.some(d => h === d.replace('www.', '') || h === d)
    } catch { return false }
  },

  extractProduct(doc: Document, url: string): Product | null {
    // Try multiple common selectors used across fashion platforms
    const nameSelectors = [
      'h1[class*="product"]', 'h1[class*="Product"]',
      '[data-testid="product-title"]', '[data-testid="pdp-product-title"]',
      '[class*="product-title"]', '[class*="productName"]', '[class*="product_name"]',
      '[itemprop="name"]', 'h1[itemprop="name"]',
      '[class*="pdp-title"]', '[class*="detail-title"]',
      'h1', 'h2[class*="product"]',
    ]

    let name = ''
    for (const sel of nameSelectors) {
      const el = doc.querySelector(sel)
      const text = el?.textContent?.trim()
      if (text && text.length > 3 && text.length < 300) {
        name = text
        break
      }
    }
    if (!name) return null

    // Price extraction
    const priceSelectors = [
      '[data-testid="product-price"]', '[data-testid="pdp-price"]',
      '[class*="product-price"]', '[class*="current-price"]',
      '[class*="Price"] span', '[itemprop="price"]',
      '[class*="pdp-price"]', '[class*="sale-price"]',
      '[class*="now-price"]', '[data-price]',
    ]

    let price = 0
    let currency = detectCurrency(doc, url)
    for (const sel of priceSelectors) {
      const el = doc.querySelector(sel)
      const text = el?.textContent || ''
      const priceAttr = el?.getAttribute('content') || el?.getAttribute('data-price') || ''
      const priceMatch = (text + ' ' + priceAttr).match(/[\d,]+\.?\d*/)
      if (priceMatch) {
        price = parseFloat(priceMatch[0].replace(/,/g, '')) || 0
        if (price > 0) break
      }
    }

    // Image
    const imgSelectors = [
      '[data-testid="product-image"] img', '[class*="product-gallery"] img',
      '[class*="pdp-image"] img', '[class*="product-image"] img',
      '[class*="ProductImage"] img', '[class*="zoom"] img',
      '.swiper-slide-active img', '[class*="carousel"] img',
    ]
    let image = ''
    for (const sel of imgSelectors) {
      const el = doc.querySelector(sel)
      const src = el?.getAttribute('src') || el?.getAttribute('data-src') || ''
      if (src && (src.startsWith('http') || src.startsWith('//'))) {
        image = src.startsWith('//') ? 'https:' + src : src
        break
      }
    }

    // Description
    const descSelectors = [
      '[data-testid="product-description"]', '[class*="product-description"]',
      '[class*="pdp-description"]', '[itemprop="description"]',
      '[class*="detail-description"]', '[class*="product-details"]',
    ]
    let description = ''
    for (const sel of descSelectors) {
      const el = doc.querySelector(sel)
      const text = el?.textContent?.trim()
      if (text && text.length > 10) {
        description = text.slice(0, 500)
        break
      }
    }

    // Rating
    let rating = 0
    let reviewCount = 0
    const ratingEl = doc.querySelector('[class*="rating"] [class*="value"], [itemprop="ratingValue"], [class*="star-rating"]')
    if (ratingEl) {
      rating = parseFloat(ratingEl.textContent?.match(/([\d.]+)/)?.[1] || '0')
    }
    const reviewEl = doc.querySelector('[class*="review-count"], [itemprop="reviewCount"], [class*="reviews-count"]')
    if (reviewEl) {
      reviewCount = parseInt(reviewEl.textContent?.replace(/[^\d]/g, '') || '0')
    }

    // Brand
    const brandSelectors = [
      '[class*="brand-name"]', '[class*="brandName"]', '[itemprop="brand"]',
      '[data-testid="product-brand"]', '[class*="pdp-brand"]',
    ]
    let brand = ''
    for (const sel of brandSelectors) {
      const el = doc.querySelector(sel)
      const text = el?.textContent?.trim()
      if (text && text.length > 1 && text.length < 50) {
        brand = text
        break
      }
    }

    // Material/Fabric (important for fashion)
    const materials = extractMaterials(doc)

    // Features
    const features: string[] = []
    doc.querySelectorAll('[class*="feature"] li, [class*="detail"] li, [class*="spec"] li, [class*="attribute"] li').forEach(el => {
      const text = el.textContent?.trim()
      if (text && text.length > 2 && text.length < 200) features.push(text)
    })

    // Category from breadcrumb or URL
    const category = detectFashionCategory(doc, url, name)

    const productId = extractProductId(doc, url) || `fashion-${Date.now()}`

    return {
      id: productId,
      name,
      category,
      price,
      currency,
      image,
      description,
      materials,
      packaging: {
        type: detectPackagingType(doc),
        estimatedWeight: 'unknown' as any,
        recyclable: 'unknown',
        containsPlastic: 'unknown' as any,
        refillable: 'unknown' as any,
      },
      retailer: getRetailerName(url),
      rating,
      reviewCount,
      availability: detectAvailability(doc),
      url: window.location.href,
      brand,
      features: features.slice(0, 10),
      sustainabilityClaims: extractSustainabilityClaims(doc),
    }
  },

  extractSearchResults(doc: Document, url: string): Product[] {
    const products: Product[] = []

    const gridSelectors = [
      '[data-testid="product-grid"] > *',
      '[class*="product-grid"] > *',
      '[class*="productGrid"] > *',
      '[class*="product-list"] > *',
      '[class*="search-results"] > *',
      '[class*="product-card"]',
      '[class*="productCard"]',
      '[class*="product-item"]',
      '[class*="productItem"]',
      '[class*="product-tile"]',
      '[class*="productTile"]',
      '.product',
    ]

    for (const sel of gridSelectors) {
      const cards = doc.querySelectorAll(sel)
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
      for (const key of ['q', 'query', 'search', 'keyword', 'text', 'searchTerm', 'search_query']) {
        const val = u.searchParams.get(key)
        if (val) return val
      }
    } catch { /* ignore */ }
    return null
  },

  scanPage(doc: Document, url: string): PageScanResult {
    const isProductPage = isProductPageUrl(url) || isProductPageDOM(doc)
    const isSearchResults = isSearchResultsUrl(url) || isSearchResultsDOM(doc)
    const hostname = getRetailerName(url)

    if (isProductPage) {
      const product = this.extractProduct(doc, url)
      return {
        type: 'product-page',
        products: product ? [product] : [],
        primaryProduct: product || undefined,
        retailer: hostname,
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
        retailer: hostname,
        pageTitle: doc.title,
        timestamp: Date.now(),
      }
    }

    return { type: 'other', products: [], retailer: hostname, pageTitle: doc.title, timestamp: Date.now() }
  },
}

// ============================================================
// Helper Functions
// ============================================================

function detectCurrency(doc: Document, url: string): string {
  const bodyText = (doc.body?.textContent || '').slice(0, 2000)
  const urlLower = url.toLowerCase()

  if (bodyText.includes('AED') || bodyText.includes('د.إ') || urlLower.includes('.ae') || urlLower.includes('/ae/')) return 'AED'
  if (bodyText.includes('SAR') || bodyText.includes('ر.س')) return 'SAR'
  if (bodyText.includes('KWD') || bodyText.includes('د.ك')) return 'KWD'
  if (bodyText.includes('QAR') || bodyText.includes('ر.ق')) return 'QAR'
  if (bodyText.includes('BHD') || bodyText.includes('د.ب')) return 'BHD'
  if (bodyText.includes('OMR') || bodyText.includes('ر.ع')) return 'OMR'
  if (bodyText.includes('EGP') || bodyText.includes('ج.م')) return 'EGP'
  if (bodyText.includes('£') || bodyText.includes('GBP')) return 'GBP'
  if (bodyText.includes('€') || bodyText.includes('EUR')) return 'EUR'
  if (bodyText.includes('$') || bodyText.includes('USD')) return 'USD'
  return 'AED' // Default for UAE adapter
}

function extractMaterials(doc: Document): string[] {
  const materials: string[] = []

  // Check material/fabric sections
  const materialSelectors = [
    '[class*="material"]', '[class*="fabric"]', '[class*="composition"]',
    '[itemprop="material"]', '[class*="care-info"]', '[class*="specification"]',
  ]

  for (const sel of materialSelectors) {
    const el = doc.querySelector(sel)
    if (el) {
      const text = el.textContent?.toLowerCase() || ''
      const matPattern = /\b(cotton|polyester|nylon|silk|wool|linen|leather|suede|denim|viscose|rayon|spandex|elastane|lycra|acrylic|cashmere|modal|tencel|bamboo|organic cotton|recycled polyester|recycled nylon|faux leather|canvas|satin|chiffon|tweed|corduroy|velvet|neoprene|rubber|mesh|gore-tex|thermoplastic)\b/gi
      const matches = text.match(matPattern)
      if (matches) {
        matches.forEach(m => {
          const n = m.toLowerCase()
          if (!materials.includes(n)) materials.push(n)
        })
      }
    }
  }

  // Also check body text for material info
  if (materials.length === 0) {
    const bodyText = (doc.body?.textContent || '').slice(0, 5000).toLowerCase()
    const matPattern = /\b(\d+%\s*(?:cotton|polyester|nylon|silk|wool|linen|leather|viscose|rayon|spandex|elastane))\b/gi
    const matches = bodyText.match(matPattern)
    if (matches) {
      matches.forEach(m => {
        if (!materials.includes(m.toLowerCase())) materials.push(m.toLowerCase())
      })
    }
  }

  return materials.slice(0, 6)
}

function detectFashionCategory(doc: Document, url: string, name: string): ProductCategory {
  const combined = (doc.title + ' ' + url + ' ' + name).toLowerCase()

  if (/\b(shoe|sneaker|boot|sandal|slipper|heel|loafer|mule|espadrille|clog|footwear|trainers?)\b/.test(combined)) return 'clothing'
  if (/\b(bag|handbag|backpack|clutch|tote|wallet|belt|hat|cap|scarf|glove|sunglasses|jewelry|watch|necklace|bracelet|earring|accessori)\b/.test(combined)) return 'clothing'
  if (/\b(shirt|pants|dress|jacket|hoodie|jeans|t-shirt|sweater|coat|blouse|trousers|shorts|skirt|cardigan|polo|romper|jumpsuit|leggings|bodysuit|romper)\b/.test(combined)) return 'clothing'
  if (/\b(face|skin|hair|makeup|cosmetic|beauty|lotion|serum|moisturizer|perfume|fragrance|skincare|foundation|lipstick|mascara|cleanser)\b/.test(combined)) return 'personal-care'
  if (/\b(baby|infant|toddler|stroller|kids|children|boy|girl)\b/.test(combined)) return 'clothing'

  return 'clothing' // Default for fashion retailer
}

function extractProductId(doc: Document, url: string): string | null {
  // Try URL patterns
  const urlMatch = url.match(/\/(\d{6,})\/?$/) || url.match(/\/product\/(\d+)/) || url.match(/[?&]id=(\d+)/)
  if (urlMatch) return urlMatch[1]

  // Try data attributes
  const idEl = doc.querySelector('[data-product-id], [data-item-id], [data-sku], [itemprop="sku"]')
  if (idEl) return idEl.getAttribute('data-product-id') || idEl.getAttribute('data-item-id') || idEl.getAttribute('data-sku') || idEl.textContent?.trim() || null

  return null
}

function detectPackagingType(doc: Document): any[] {
  const bodyText = (doc.body?.textContent || '').toLowerCase()
  const types: any[] = ['unknown']

  if (bodyText.includes('plastic') || bodyText.includes('polybag')) types.push('plastic-wrap')
  if (bodyText.includes('cardboard') || bodyText.includes('recyclable box')) types.push('cardboard')

  return types
}

function detectAvailability(doc: Document): Product['availability'] {
  const bodyText = (doc.body?.textContent || '').toLowerCase().slice(0, 3000)
  if (bodyText.includes('out of stock') || bodyText.includes('sold out') || bodyText.includes('unavailable')) return 'out-of-stock'
  if (bodyText.includes('in stock') || bodyText.includes('add to bag') || bodyText.includes('add to cart')) return 'in-stock'
  if (bodyText.includes('limited') || bodyText.includes('few left')) return 'limited'
  return 'unknown'
}

function extractSustainabilityClaims(doc: Document): string[] {
  const claims: string[] = []
  const bodyText = (doc.body?.textContent || '').toLowerCase().slice(0, 10000)

  const patterns = [
    /organic/gi, /recycled/gi, /sustainable/gi, /eco[- ]?friendly/gi,
    /biodegradable/gi, /compostable/gi, /vegan leather/gi, /plant[- ]?based/gi,
    /fair trade/gi, /carbon neutral/gi, /zero waste/gi, /conscious/gi,
    /responsible/gi, /ethical/gi,
  ]

  for (const pattern of patterns) {
    const matches = bodyText.match(pattern)
    if (matches) {
      matches.forEach(m => {
        if (!claims.includes(m.toLowerCase())) claims.push(m.toLowerCase())
      })
    }
  }

  return claims.slice(0, 5)
}

function getRetailerName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    const nameMap: Record<string, string> = {
      'namshi.com': 'Namshi',
      'centrepoint.com': 'Centrepoint',
      '6thstreet.com': '6thStreet',
      'ounass.ae': 'Ounass',
      'shein.com': 'SHEIN',
      'hm.com': 'H&M',
      'zara.com': 'Zara',
      'pullandbear.com': 'Pull&Bear',
      'bershka.com': 'Bershka',
      'stradivarius.com': 'Stradivarius',
      'massimodutti.com': 'Massimo Dutti',
      'nike.com': 'Nike',
      'adidas.ae': 'Adidas',
      'adidas.com': 'Adidas',
      'puma.com': 'Puma',
      'newbalance.com': 'New Balance',
      'asos.com': 'ASOS',
      'splashfashion.com': 'Splash',
      'maxfashion.com': 'Max Fashion',
      'marksandspencer.com': 'Marks & Spencer',
      'next.ae': 'Next',
      'lcwaikiki.com': 'LC Waikiki',
      'sivvi.com': 'Sivvi',
      'levelshoes.com': 'Level Shoes',
      'bloomingdales.ae': "Bloomingdale's",
      'harveynichols.com': 'Harvey Nichols',
      'faces.ae': 'Faces',
      'sephora.ae': 'Sephora',
      'thebodyshop.ae': 'The Body Shop',
      'bathandbodyworks.com': 'Bath & Body Works',
      'lookfantastic.com': 'Lookfantastic',
      'iherb.com': 'iHerb',
      'mumzworld.com': 'Mumzworld',
      'firstcry.ae': 'FirstCry',
      'virginmegastore.me': 'Virgin Megastore',
      'kikomilano.ae': 'KIKO Milano',
      'rituals.com': 'Rituals',
      'americaneagle.me': 'American Eagle',
    }
    return nameMap[hostname] || hostname.split('.')[0].replace(/\b\w/g, l => l.toUpperCase())
  } catch {
    return 'Online Store'
  }
}

function isProductPageUrl(url: string): boolean {
  // Common product page URL patterns
  if (/\/p\/\d+/.test(url)) return true
  if (/\/product\/\d+/.test(url)) return true
  if (/\/\d{6,}\/?$/.test(url)) return true
  if (/\?pid=\d+/.test(url)) return true
  if (/\/dp\//.test(url)) return true
  return false
}

function isProductPageDOM(doc: Document): boolean {
  // Check for product page indicators in DOM
  const hasTitle = !!doc.querySelector('h1[class*="product"], h1[class*="Product"], [itemprop="name"]')
  const hasPrice = !!doc.querySelector('[class*="product-price"], [class*="current-price"], [itemprop="price"]')
  const hasImage = !!doc.querySelector('[class*="product-gallery"], [class*="product-image"], [class*="ProductImage"]')
  return hasTitle && hasPrice
}

function isSearchResultsUrl(url: string): boolean {
  if (/[?&](q|query|search|keyword|searchTerm)=/.test(url)) return true
  if (/\/search\//.test(url)) return true
  if (/\/s\//.test(url)) return true
  return false
}

function isSearchResultsDOM(doc: Document): boolean {
  const gridSelectors = [
    '[class*="product-grid"]', '[class*="productGrid"]',
    '[class*="product-list"]', '[class*="search-results"]',
    '[class*="product-card"]', '[class*="productCard"]',
  ]
  for (const sel of gridSelectors) {
    if (doc.querySelectorAll(sel).length >= 3) return true
  }
  return false
}

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
  const fullUrl = href.startsWith('http') ? href : href.startsWith('//') ? 'https:' + href : new URL(href, window.location.origin).href

  const brandEl = card.querySelector('[class*="brand"]')
  const brand = brandEl?.textContent?.trim() || ''

  return {
    id: `fashion-card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.slice(0, 200),
    category: 'clothing',
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
    retailer: getRetailerName(_url),
    rating: 0,
    reviewCount: 0,
    availability: 'unknown',
    url: fullUrl,
    brand,
  }
}
