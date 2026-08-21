import type { RetailerAdapter } from './types'
import type { Product, PageScanResult, ProductCategory } from '../types'

const AMAZON_HOSTS = [
  'amazon.com', 'amazon.ae', 'amazon.co.uk', 'amazon.de', 'amazon.fr',
  'amazon.co.jp', 'amazon.in', 'amazon.ca', 'amazon.com.au',
]

export const amazonAdapter: RetailerAdapter = {
  name: 'Amazon',
  hostname: 'amazon',

  canHandle(url: string): boolean {
    try {
      const h = new URL(url).hostname
      return AMAZON_HOSTS.some(d => h === d || h.endsWith('.' + d))
    } catch { return false }
  },

  extractProduct(doc: Document, url: string): Product | null {
    const nameEl = doc.querySelector('#productTitle') || doc.querySelector('h1.a-size-large')
    const name = nameEl?.textContent?.trim() || null
    if (!name) return null

    const priceWhole = doc.querySelector('.a-price-whole')?.textContent?.replace(/[^\d]/g, '') || '0'
    const priceFraction = doc.querySelector('.a-price-fraction')?.textContent?.replace(/[^\d]/g, '') || '00'
    const price = parseFloat(priceWhole + '.' + priceFraction) || 0

    const currency = doc.querySelector('.a-price-symbol')?.textContent?.trim() || detectCurrencyFromHost(url)

    const imgEl = doc.querySelector('#landingImage') || doc.querySelector('#imgBlkFront') || doc.querySelector('img[data-old-hires]') || doc.querySelector('#main-image')
    const image = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-old-hires') || ''

    const descEl = doc.querySelector('#productDescription') || doc.querySelector('#feature-bullets')
    const description = descEl?.textContent?.trim()?.slice(0, 500) || ''

    const ratingEl = doc.querySelector('#acrPopover') || doc.querySelector('.a-icon-alt')
    const ratingText = ratingEl?.textContent || ''
    const ratingMatch = ratingText.match(/([\d.]+)\s*out/)
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0

    const reviewCountEl = doc.querySelector('#acrCustomerReviewCount')
    const reviewCount = parseInt(reviewCountEl?.textContent?.replace(/[^\d]/g, '') || '0')

    const brandEl = doc.querySelector('#bylineInfo') || doc.querySelector('.po-brand .po-break-word')
    const brand = brandEl?.textContent?.replace(/^(Visit the |Brand:\s*)/i, '').replace(/\s*Store$/i, '').trim() || ''

    const sellerEl = doc.querySelector('#sellerProfileTriggerId') || doc.querySelector('#merchant-info')
    const seller = sellerEl?.textContent?.trim() || ''

    const availEl = doc.querySelector('#availability') || doc.querySelector('#outOfStock')
    const availText = availEl?.textContent?.trim()?.toLowerCase() || ''
    const availability = availText.includes('in stock') ? 'in-stock' as const
      : availText.includes('out of stock') ? 'out-of-stock' as const
      : availText.includes('limited') ? 'limited' as const
      : 'unknown' as const

    // Specs / features
    const features: string[] = []
    doc.querySelectorAll('#feature-bullets li, #productDetails_techSpec_section_1 tr').forEach(el => {
      const text = el.textContent?.trim()
      if (text && text.length > 2 && text.length < 200) features.push(text)
    })

    // Category from breadcrumb
    const breadcrumbs = doc.querySelectorAll('#wayfinding-breadcrumbs_feature_div a, .a-breadcrumb li a')
    const categoryGuess = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 1]?.textContent?.trim() : undefined

    const productId = url.match(/\/dp\/([A-Z0-9]{10})/)?.[1] || url.match(/\/gp\/product\/([A-Z0-9]{10})/)?.[1] || `amazon-${Date.now()}`

    return {
      id: productId,
      name,
      category: guessCategory(name, description, categoryGuess),
      price,
      currency,
      image,
      description: description.slice(0, 500),
      materials: extractMaterials(description + ' ' + features.join(' ')),
      durability: undefined,
      reusability: undefined,
      repairability: undefined,
      packaging: {
        type: ['unknown'],
        estimatedWeight: 'unknown' as any,
        recyclable: 'unknown',
        containsPlastic: 'unknown' as any,
        refillable: 'unknown' as any,
      },
      retailer: 'Amazon',
      rating,
      reviewCount,
      availability,
      url: window.location.href,
      brand,
      features: features.slice(0, 10),
      seller,
      shippingInfo: extractShippingInfo(doc),
      sustainabilityClaims: extractSustainabilityClaims(description + ' ' + features.join(' ')),
    }
  },

  extractSearchResults(doc: Document, url: string): Product[] {
    const products: Product[] = []
    const cards = doc.querySelectorAll('[data-asin]:not([data-asin=""])')

    cards.forEach(card => {
      const asin = card.getAttribute('data-asin')
      if (!asin || asin.length < 5) return

      const nameEl = card.querySelector('h2 a span, h2 span')
      const name = nameEl?.textContent?.trim()
      if (!name) return

      const priceWhole = card.querySelector('.a-price-whole')?.textContent?.replace(/[^\d]/g, '') || '0'
      const priceFraction = card.querySelector('.a-price-fraction')?.textContent?.replace(/[^\d]/g, '') || '00'
      const price = parseFloat(priceWhole + '.' + priceFraction) || 0

      const imgEl = card.querySelector('img.s-image')
      const image = imgEl?.getAttribute('src') || ''

      const ratingEl = card.querySelector('.a-icon-alt')
      const ratingText = ratingEl?.textContent || ''
      const ratingMatch = ratingText.match(/([\d.]+)\s*out/)
      const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0

      const reviewCountEl = card.querySelector('.a-size-base.s-underline-text')
      const reviewCount = parseInt(reviewCountEl?.textContent?.replace(/[^\d]/g, '') || '0')

      const linkEl = card.querySelector('h2 a')
      const href = linkEl?.getAttribute('href') || ''
      const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.origin).href

      products.push({
        id: asin,
        name: name.slice(0, 200),
        category: guessCategory(name, '', undefined),
        price,
        currency: detectCurrencyFromHost(url),
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
        retailer: 'Amazon',
        rating,
        reviewCount,
        availability: 'unknown',
        url: fullUrl,
      })
    })

    return products.slice(0, 20)
  },

  extractSearchQuery(url: string): string | null {
    try {
      return new URL(url).searchParams.get('k') || new URL(url).searchParams.get('field-keywords') || null
    } catch { return null }
  },

  scanPage(doc: Document, url: string): PageScanResult {
    const isProductPage = url.includes('/dp/') || url.includes('/gp/product/')
    const isSearchResults = url.includes('/s?') || url.includes('/s/')
    const isCategoryPage = url.includes('/b?') || url.includes('/gp/browse')

    if (isProductPage) {
      const product = this.extractProduct(doc, url)
      return {
        type: 'product-page',
        products: product ? [product] : [],
        primaryProduct: product || undefined,
        retailer: 'Amazon',
        pageTitle: doc.title,
        timestamp: Date.now(),
      }
    }

    if (isSearchResults || isCategoryPage) {
      const products = this.extractSearchResults(doc, url)
      return {
        type: 'search-results',
        products,
        searchQuery: this.extractSearchQuery(url) || undefined,
        retailer: 'Amazon',
        pageTitle: doc.title,
        timestamp: Date.now(),
      }
    }

    return { type: 'other', products: [], retailer: 'Amazon', pageTitle: doc.title, timestamp: Date.now() }
  },
}

function detectCurrencyFromHost(url: string): string {
  if (url.includes('.ae')) return 'AED'
  if (url.includes('.co.uk') || url.includes('.co.uk')) return 'GBP'
  if (url.includes('.de')) return 'EUR'
  if (url.includes('.fr')) return 'EUR'
  if (url.includes('.in')) return 'INR'
  if (url.includes('.ca')) return 'CAD'
  if (url.includes('.com.au')) return 'AUD'
  if (url.includes('.co.jp')) return 'JPY'
  return 'USD'
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

function extractSustainabilityClaims(text: string): string[] {
  const claims: string[] = []
  const patterns = [
    /eco[- ]?friendly/gi,
    /sustainable/gi,
    /green/gi,
    /environmentally/gi,
    /recycled/gi,
    /biodegradable/gi,
    /compostable/gi,
    /organic/gi,
    /carbon neutral/gi,
    /zero waste/gi,
    /plant[- ]?based/gi,
    /renewable/gi,
    /reusable/gi,
    /100%\s*(eco|green|natural|sustainable)/gi,
  ]
  for (const pattern of patterns) {
    const matches = text.match(pattern)
    if (matches) {
      matches.forEach(m => {
        if (!claims.includes(m)) claims.push(m)
      })
    }
  }
  return claims.slice(0, 5)
}

function extractShippingInfo(doc: Document): string {
  const deliveryEl = doc.querySelector('#mir-layout-DELIVERY_BLOCK') || doc.querySelector('#deliveryMessageMirId')
  return deliveryEl?.textContent?.trim()?.slice(0, 200) || ''
}

function guessCategory(name: string, description: string, breadcrumb?: string): ProductCategory {
  const text = (name + ' ' + description + ' ' + (breadcrumb || '')).toLowerCase()

  if (/\b(bottle|cup|mug|tumbler|flask|water|drink|beverage|soda|juice)\b/.test(text)) return 'beverages'
  if (/\b(container|wrap|foil|bowl|plate|utensil|cutlery|food storage|lunch box|lunchbox|kitchen)\b/.test(text)) return 'kitchen'
  if (/\b(clean|detergent|soap|sponge|mop|broom|wipe|trash bag|laundry)\b/.test(text)) return 'cleaning'
  if (/\b(pen|pencil|notebook|paper|eraser|marker|crayon|school|stapler|folder)\b/.test(text)) return 'school-supplies'
  if (/\b(phone|laptop|tablet|headphone|earbuds|charger|battery|cable|speaker|keyboard|mouse|monitor)\b/.test(text)) return 'electronics'
  if (/\b(shirt|pants|shoes|dress|jacket|hat|sock|underwear|clothing|apparel|fashion|t-shirt|jeans)\b/.test(text)) return 'clothing'
  if (/\b(toothbrush|shampoo|lotion|razor|deodorant|skincare|makeup|cosmetic|personal care|dental)\b/.test(text)) return 'personal-care'
  if (/\b(light|bulb|furniture|pillow|blanket|curtain|rug|home decor|storage bin)\b/.test(text)) return 'home'
  if (/\b(food|snack|granola|coffee|tea|spice|oil|sauce|protein)\b/.test(text)) return 'food'
  if (/\b(suitcase|luggage|travel|passport|neck pillow|toiletry)\b/.test(text)) return 'travel'
  if (/\b(gym|fitness|yoga|dumbbell|resistance|workout|sport)\b/.test(text)) return 'fitness'
  if (/\b(office|desk|printer|staple|clip|tape|binder)\b/.test(text)) return 'office'

  return 'other'
}
