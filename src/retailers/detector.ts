import { isHardBlockedHost, isKnownShoppingHost, looksLikeProductUrl } from './site-gate'

// ============================================================
// E-Commerce Detection Engine
// Detects whether a webpage is an e-commerce/shopping site
// using multiple independent signals and produces a confidence score.
// ============================================================

export interface ECommerceDetection {
  isECommerce: boolean
  confidence: number // 0-100
  signals: DetectionSignal[]
  platform: ECommercePlatform | null
  shopifyStore: boolean
  retailerName: string
  category: string
}

export interface DetectionSignal {
  name: string
  detected: boolean
  weight: number // How much this contributes to confidence
  evidence?: string
}

export type ECommercePlatform =
  | 'shopify' | 'woocommerce' | 'magento' | 'bigcommerce'
  | 'salesforce-commerce' | 'prestashop' | 'wix' | 'squarespace'
  | 'ecwid' | 'shopware' | 'opencart' | 'custom'

// Confidence threshold to consider a site as e-commerce
const CONFIDENCE_THRESHOLD = 55

function isBlocklistedDomain(url: string): boolean {
  return isHardBlockedHost(url)
}

/**
 * Detect if a page is an e-commerce/shopping site.
 * Runs in content script context with full DOM access.
 */
export function detectECommerce(doc: Document, url: string): ECommerceDetection {
  // Fast reject: blocklisted domains are never e-commerce
  if (isBlocklistedDomain(url)) {
    return {
      isECommerce: false,
      confidence: 0,
      signals: [{ name: 'Blocklisted Domain', detected: false, weight: 100 }],
      platform: null,
      shopifyStore: false,
      retailerName: '',
      category: 'other',
    }
  }

  const signals: DetectionSignal[] = []
  let totalWeight = 0
  let detectedWeight = 0

  // ---- Signal 1: JSON-LD Structured Data ----
  const jsonLdSignal = detectJsonLd(doc)
  signals.push(jsonLdSignal)
  totalWeight += jsonLdSignal.weight
  if (jsonLdSignal.detected) detectedWeight += jsonLdSignal.weight

  // ---- Signal 2: Open Graph Product Meta ----
  const ogSignal = detectOpenGraph(doc)
  signals.push(ogSignal)
  totalWeight += ogSignal.weight
  if (ogSignal.detected) detectedWeight += ogSignal.weight

  // ---- Signal 3: Add-to-Cart / Buy Buttons ----
  const cartSignal = detectCartElements(doc)
  signals.push(cartSignal)
  totalWeight += cartSignal.weight
  if (cartSignal.detected) detectedWeight += cartSignal.weight

  // ---- Signal 4: Price Elements ----
  const priceSignal = detectPriceElements(doc)
  signals.push(priceSignal)
  totalWeight += priceSignal.weight
  if (priceSignal.detected) detectedWeight += priceSignal.weight

  // ---- Signal 5: Product Detail Structure ----
  const productSignal = detectProductStructure(doc)
  signals.push(productSignal)
  totalWeight += productSignal.weight
  if (productSignal.detected) detectedWeight += productSignal.weight

  // ---- Signal 6: E-commerce Framework ----
  const frameworkSignal = detectECommerceFramework(doc, url)
  signals.push(frameworkSignal)
  totalWeight += frameworkSignal.weight
  if (frameworkSignal.detected) detectedWeight += frameworkSignal.weight

  // ---- Signal 7: Cart/Checkout URLs ----
  const checkoutSignal = detectCheckoutUrls(doc, url)
  signals.push(checkoutSignal)
  totalWeight += checkoutSignal.weight
  if (checkoutSignal.detected) detectedWeight += checkoutSignal.weight

  // ---- Signal 8: Product Grid / Listing ----
  const gridSignal = detectProductGrid(doc)
  signals.push(gridSignal)
  totalWeight += gridSignal.weight
  if (gridSignal.detected) detectedWeight += gridSignal.weight

  // ---- Signal 9: SKU / Variant selectors ----
  const variantSignal = detectVariants(doc)
  signals.push(variantSignal)
  totalWeight += variantSignal.weight
  if (variantSignal.detected) detectedWeight += variantSignal.weight

  // ---- Signal 10: Known shopping domain ----
  const domainSignal = detectKnownShoppingDomain(url)
  signals.push(domainSignal)
  totalWeight += domainSignal.weight
  if (domainSignal.detected) detectedWeight += domainSignal.weight

  // ---- Calculate confidence ----
  const confidence = totalWeight > 0 ? Math.round((detectedWeight / totalWeight) * 100) : 0

  // ---- Detect platform ----
  const platform = detectPlatform(doc, url)
  const shopifyStore = platform === 'shopify'

  // ---- Determine retailer name ----
  const retailerName = shopifyStore
    ? getShopifyStoreName(doc) || getDomainDisplayName(url)
    : getDomainDisplayName(url)

  // ---- Detect category ----
  const category = detectPageCategory(doc, url)

  const commerceSignals = jsonLdSignal.detected || ogSignal.detected || cartSignal.detected
    || priceSignal.detected || productSignal.detected || gridSignal.detected || checkoutSignal.detected
  // Platform alone (e.g. Shopify CDN on a blog) is not enough to activate TerraCart.
  let isECommerce = confidence >= CONFIDENCE_THRESHOLD
  if (shopifyStore && !commerceSignals && !isKnownShoppingHost(url)) {
    isECommerce = false
  }

  return {
    isECommerce,
    confidence,
    signals,
    platform,
    shopifyStore,
    retailerName,
    category,
  }
}

/** Product page vs shopping site (category/search/home). */
export function isProductPage(doc: Document, url: string): boolean {
  if (isHardBlockedHost(url)) return false
  if (looksLikeProductUrl(url) && isKnownShoppingHost(url)) return true
  const ogType = doc.querySelector('meta[property="og:type"]')?.getAttribute('content') || ''
  if (ogType.toLowerCase().includes('product')) return true
  const jsonLd = detectJsonLd(doc)
  if (jsonLd.detected) return true
  const cart = detectCartElements(doc)
  const price = detectPriceElements(doc)
  const structure = detectProductStructure(doc)
  return cart.detected && price.detected && structure.detected
}

// ============================================================
// Individual Signal Detectors
// ============================================================

function detectJsonLd(doc: Document): DetectionSignal {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
  let hasProduct = false
  let hasOffer = false

  for (const script of scripts) {
    try {
      let data = JSON.parse(script.textContent || '')
      if (Array.isArray(data)) data = data[0]
      if (data['@graph']) data = data['@graph'][0]

      if (data['@type'] === 'Product' || data['@type'] === 'IndividualProduct') {
        hasProduct = true
        if (data.offers) hasOffer = true
      }
      if (data['@type'] === 'Product' && data['@type'] === 'ItemList') {
        hasProduct = true
      }
      if (data['@type'] === 'ItemList' && data.itemListElement?.length > 0) {
        hasProduct = true
      }
    } catch { continue }
  }

  return {
    name: 'JSON-LD Structured Data',
    detected: hasProduct,
    weight: 25,
    evidence: hasProduct ? (hasOffer ? 'Product with offers' : 'Product schema found') : undefined,
  }
}

function detectOpenGraph(doc: Document): DetectionSignal {
  const ogType = doc.querySelector('meta[property="og:type"]')?.getAttribute('content') || ''
  const hasPrice = !!doc.querySelector('meta[property="product:price:amount"]')
  const isProduct = ogType.includes('product')

  return {
    name: 'Open Graph Product Meta',
    detected: isProduct || hasPrice,
    weight: 15,
    evidence: isProduct ? 'og:type=product' : hasPrice ? 'product:price found' : undefined,
  }
}

function detectCartElements(doc: Document): DetectionSignal {
  const cartSelectors = [
    'button[class*="add-to-cart"]',
    'button[class*="addToCart"]',
    'button[class*="add_to_cart"]',
    'input[value="Add to Cart"]',
    'button[data-action="add-to-cart"]',
    '[id="add-to-cart"]',
    '[id="addToCart"]',
    'button[class*="buy-now"]',
    'button[class*="buyNow"]',
  ]

  for (const sel of cartSelectors) {
    if (doc.querySelector(sel)) {
      return {
        name: 'Cart/Buy Elements',
        detected: true,
        weight: 20,
        evidence: `Found: ${sel}`,
      }
    }
  }

  // Also check for button text content
  const buttons = doc.querySelectorAll('button, input[type="submit"]')
  for (const btn of buttons) {
    const text = (btn.textContent || btn.getAttribute('value') || '').toLowerCase()
    if (text.includes('add to cart') || text.includes('buy now') || text.includes('add to bag') || text.includes('أضف إلى السلة')) {
      return {
        name: 'Cart/Buy Elements',
        detected: true,
        weight: 20,
        evidence: `Button text: "${text.trim().slice(0, 40)}"`,
      }
    }
  }

  return { name: 'Cart/Buy Elements', detected: false, weight: 20 }
}

function detectPriceElements(doc: Document): DetectionSignal {
  const priceSelectors = [
    '[data-price]',
    '[itemprop="price"]',
    '[class*="product-price"]',
    '[class*="product_price"]',
    '[class*="item-price"]',
    '[class*="sale-price"]',
    '[class*="current-price"]',
    'span[class*="price-value"]',
    'span[class*="priceAmount"]',
  ]

  let priceFound = false
  let priceText = ''

  for (const sel of priceSelectors) {
    const els = doc.querySelectorAll(sel)
    for (const el of els) {
      const text = el.textContent?.trim() || ''
      // Check if it contains a numeric price pattern
      if (/\d+[.,]\d{2}/.test(text) || /\d{2,}/.test(text)) {
        priceFound = true
        priceText = text.slice(0, 50)
        break
      }
    }
    if (priceFound) break
  }

  // Also check for currency symbols
  if (!priceFound) {
    const bodyText = doc.body?.textContent || ''
    if (/\$\s*\d+|€\s*\d+|£\s*\d+|AED\s*\d+|د\.إ\s*\d+|₹\s*\d+|¥\s*\d+/.test(bodyText)) {
      priceFound = true
      priceText = 'currency symbol in body'
    }
  }

  return {
    name: 'Price Elements',
    detected: priceFound,
    weight: 15,
    evidence: priceFound ? priceText : undefined,
  }
}

function detectProductStructure(doc: Document): DetectionSignal {
  const signals = [
    // Product title (must be specific)
    doc.querySelector('h1[class*="product-title"], h1[class*="product-title"], [class*="ProductName"], [itemprop="name"][class*="product"]'),
    // Product image gallery (must be specific to product, not any gallery)
    doc.querySelector('[class*="product-gallery"], [class*="productGallery"], [class*="product-images"], [class*="productImages"]'),
    // Variant/size/color selectors (specific to e-commerce)
    doc.querySelector('[class*="size-selector"], [class*="color-selector"], [class*="variant-selector"], select[class*="option"][name*="option"]'),
    // Quantity selector
    doc.querySelector('input[type="number"][class*="qty"], input[name="quantity"], [class*="quantity-selector"]'),
  ]

  const found = signals.filter(Boolean).length

  return {
    name: 'Product Detail Structure',
    detected: found >= 3,
    weight: 15,
    evidence: found >= 3 ? `${found} product structure elements found` : undefined,
  }
}

function detectECommerceFramework(doc: Document, url: string): DetectionSignal {
  // Check for Shopify
  if (detectShopify(doc, url)) {
    return { name: 'E-commerce Framework', detected: true, weight: 20, evidence: 'Shopify detected' }
  }

  // Check for WooCommerce
  if (doc.querySelector('body[class*="woocommerce"], .wc-block-grid, script[src*="woocommerce"], #wc-settings')) {
    return { name: 'E-commerce Framework', detected: true, weight: 20, evidence: 'WooCommerce detected' }
  }

  // Check for Magento / Adobe Commerce
  if (doc.querySelector('[class*="mage-"], script[src*="mage/"], body[class*="catalog-product"], script[src*="Magento"], [data-mage-init]')) {
    return { name: 'E-commerce Framework', detected: true, weight: 20, evidence: 'Magento detected' }
  }

  // Check for BigCommerce
  if (doc.querySelector('[class*="bc-product"], script[src*="bigcommerce"], body[class*="bigcommerce"]')) {
    return { name: 'E-commerce Framework', detected: true, weight: 20, evidence: 'BigCommerce detected' }
  }

  // Check for Salesforce Commerce Cloud (Demandware)
  if (doc.querySelector('script[src*="demandware"], [class*="dw-"], script[src*="sfcc"]')) {
    return { name: 'E-commerce Framework', detected: true, weight: 20, evidence: 'Salesforce Commerce detected' }
  }

  // Check for PrestaShop
  if (doc.querySelector('body[class*="prestashop"], script[src*="prestashop"], [id*="prestashop"]')) {
    return { name: 'E-commerce Framework', detected: true, weight: 20, evidence: 'PrestaShop detected' }
  }

  // Check for OpenCart
  if (doc.querySelector('body[class*="opencart"], script[src*="opencart"], #content[class*="opencart"]')) {
    return { name: 'E-commerce Framework', detected: true, weight: 20, evidence: 'OpenCart detected' }
  }

  // Check for Ecwid
  if (doc.querySelector('[class*="ec-"], script[src*="ecwid"], #ecwid')) {
    return { name: 'E-commerce Framework', detected: true, weight: 20, evidence: 'Ecwid detected' }
  }

  // Check for Wix Stores
  if (doc.querySelector('body[class*="wix"], wix-store, [data-testid*="product"]')) {
    return { name: 'E-commerce Framework', detected: true, weight: 20, evidence: 'Wix detected' }
  }

  // Check for Squarespace Commerce
  if (doc.querySelector('body[class*="squarespace"], .sqs-product, [data-product-id]')) {
    return { name: 'E-commerce Framework', detected: true, weight: 20, evidence: 'Squarespace detected' }
  }

  // Check for Shopware
  if (doc.querySelector('[class*="sw-"], script[src*="shopware"]')) {
    return { name: 'E-commerce Framework', detected: true, weight: 20, evidence: 'Shopware detected' }
  }

  // Check for generic e-commerce scripts
  const scripts = doc.querySelectorAll('script[src]')
  for (const script of scripts) {
    const src = script.getAttribute('src') || ''
    if (/shopify|woocommerce|magento|bigcommerce|prestashop|opencart|ecwid|shopware|demandware|sfcc/i.test(src)) {
      return { name: 'E-commerce Framework', detected: true, weight: 20, evidence: `Framework script: ${src.slice(0, 60)}` }
    }
  }

  return { name: 'E-commerce Framework', detected: false, weight: 20 }
}

function detectCheckoutUrls(doc: Document, url: string): DetectionSignal {
  // Check current URL
  if (/\/cart|\/checkout|\/basket|\/bag|\/carrinho/i.test(url)) {
    return { name: 'Cart/Checkout URLs', detected: true, weight: 10, evidence: 'Current page is cart/checkout' }
  }

  // Check for cart/checkout links in the page
  const links = doc.querySelectorAll('a[href*="/cart"], a[href*="/checkout"], a[href*="/basket"], a[href*="/bag"]')
  if (links.length > 0) {
    return { name: 'Cart/Checkout URLs', detected: true, weight: 10, evidence: `${links.length} cart/checkout links found` }
  }

  return { name: 'Cart/Checkout URLs', detected: false, weight: 10 }
}

function detectProductGrid(doc: Document): DetectionSignal {
  const gridSelectors = [
    '[class*="product-grid"]',
    '[class*="productGrid"]',
    '[class*="product-list"]',
    '[class*="productList"]',
    '[data-product-id]',
    '[data-product]',
    '.product-card',
    '.product-item',
    '.product-tile',
    '[class*="ProductCard"]',
    '[class*="product-card"]',
  ]

  for (const sel of gridSelectors) {
    const items = doc.querySelectorAll(sel)
    if (items.length >= 3) {
      return {
        name: 'Product Grid/Listing',
        detected: true,
        weight: 10,
        evidence: `${items.length} products via "${sel}"`,
      }
    }
  }

  return { name: 'Product Grid/Listing', detected: false, weight: 10 }
}

function detectVariants(doc: Document): DetectionSignal {
  const variantSelectors = [
    '[class*="swatch"]',
    '[class*="Swatch"]',
    '[class*="color-option"]',
    '[class*="size-option"]',
    '[class*="variant-selector"]',
    'select[name*="option"]',
    'input[type="radio"][name*="option"]',
    '[data-option]',
    '[class*="size-selector"]',
    '[class*="SizeSelector"]',
  ]

  for (const sel of variantSelectors) {
    if (doc.querySelector(sel)) {
      return { name: 'Product Variants', detected: true, weight: 5, evidence: `Found: ${sel}` }
    }
  }

  return { name: 'Product Variants', detected: false, weight: 5 }
}

function detectKnownShoppingDomain(url: string): DetectionSignal {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    const knownDomains = [
      // Global
      'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.co.jp',
      'amazon.in', 'amazon.ca', 'amazon.com.au', 'amazon.ae',
      'walmart.com', 'target.com', 'bestbuy.com', 'ebay.com', 'etsy.com',
      'aliexpress.com', 'shopify.com',
      // UAE/GCC
      'noon.com', 'namshi.com', 'souq.com', 'carrefouruae.com',
      'centrepoint.com', 'maxfashion.com', 'zara.com', 'hm.com',
      'shein.com', 'ounass.com', '6thstreet.com', 'splashfashion.com',
      'marksandspencer.com', 'nextuae.com', 'adidas.ae', 'nike.com',
      'puma.com', 'newbalance.com', 'asos.com', 'pullandbear.com',
      'bershka.com', 'stradivarius.com', 'massimodutti.com',
      'virginmegastore.me', 'sharafdg.com', 'jumbo.ae', 'emax.ae',
      'danubehome.com', 'ikea.ae', 'aceuae.com', 'luluhypermarket.com',
      'spinneys.com', 'waitrose.ae', 'boots.ae', 'lifepharmacy.com',
      'mumzworld.com', 'firstcry.ae', 'sivvi.com', 'levelshoes.com',
      'bloomingdales.ae', 'harveynichols.com', 'faces.ae',
      'sephora.ae', 'thebodyshop.com', 'bathandbodyworks.com',
      'lookfantastic.com', 'iherb.com',
      // More global
      'jd.com', 'coupang.com', 'mercadolibre.com', 'olx.com',
      'flipkart.com', 'myntra.com', 'tatacliq.com', 'nykaa.com',
    ]

    const isKnown = knownDomains.some(d => hostname === d || hostname.endsWith('.' + d))

    return {
      name: 'Known Shopping Domain',
      detected: isKnown,
      weight: 10,
      evidence: isKnown ? hostname : undefined,
    }
  } catch {
    return { name: 'Known Shopping Domain', detected: false, weight: 10 }
  }
}

// ============================================================
// Shopify Detection
// ============================================================

function detectShopify(doc: Document, url: string): boolean {
  // Signal 1: Shopify global object
  if (typeof (window as any).Shopify === 'object') return true

  // Signal 2: Shopify CDN references in scripts
  const scripts = doc.querySelectorAll('script[src]')
  for (const script of scripts) {
    const src = script.getAttribute('src') || ''
    if (src.includes('shopifycdn.com') || src.includes('shopify.com/s') || src.includes('/cdn/shopify/')) {
      return true
    }
  }

  // Signal 3: Shopify meta tags
  const shopifyMeta = doc.querySelector('meta[name="shopify-checkout-api-token"]')
  if (shopifyMeta) return true

  // Signal 4: Shopify-specific link/canonical
  const links = doc.querySelectorAll('link[href*="shopify"]')
  for (const link of links) {
    const href = link.getAttribute('href') || ''
    if (href.includes('shopify.com') || href.includes('shopifycdn.com')) return true
  }

  // Signal 5: Shopify theme indicators in body/html classes
  const bodyClasses = doc.body?.className || ''
  const htmlClasses = doc.documentElement?.className || ''
  if (/shopify|shopify-theme/i.test(bodyClasses + ' ' + htmlClasses)) return true

  // Signal 6: Shopify product JSON in page source
  const bodyText = doc.body?.innerHTML?.slice(0, 50000) || ''
  if (bodyText.includes('"Shopify"') && bodyText.includes('shopify.com')) return true
  if (/cdn\.shopify\.com/.test(bodyText)) return true

  // Signal 7: Shopify checkout/cart endpoints in forms
  const forms = doc.querySelectorAll('form[action*="cart"], form[action*="checkout"]')
  for (const form of forms) {
    const action = form.getAttribute('action') || ''
    if (action.includes('/cart/') || action.includes('/checkout')) return true
  }

  // Signal 8: Shopify-specific JS globals
  try {
    if ((window as any).ShopifyAnalytics?.meta?.product) return true
    if ((window as any).meta?.product) return true
  } catch { /* ignore */ }

  return false
}

function getShopifyStoreName(doc: Document): string | null {
  // Try Shopify global
  try {
    const shopify = (window as any).Shopify
    if (shopify?.shop) {
      // shop is like "mystore.myshopify.com"
      return shopify.shop.replace('.myshopify.com', '').replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
    }
  } catch { /* ignore */ }

  // Try meta tags
  const title = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content')
  if (title) return title

  // Try the store name from page
  const storeEl = doc.querySelector('[class*="store-name"], [class*="shop-name"], [class*="brand-name"]')
  if (storeEl) return storeEl.textContent?.trim() || null

  return null
}

// ============================================================
// Platform Detection
// ============================================================

function detectPlatform(doc: Document, url: string): ECommercePlatform | null {
  if (detectShopify(doc, url)) return 'shopify'

  if (doc.querySelector('body[class*="woocommerce"], .woocommerce, script[src*="woocommerce"]')) return 'woocommerce'
  if (doc.querySelector('[class*="mage-"], script[src*="mage/"], body[class*="catalog-product"]')) return 'magento'
  if (doc.querySelector('[class*="bc-product"], script[src*="bigcommerce"]')) return 'bigcommerce'
  if (doc.querySelector('script[src*="demandware"], [class*="dw-"]')) return 'salesforce-commerce'
  if (doc.querySelector('script[src*="prestashop"], body[class*="prestashop"]')) return 'prestashop'
  if (doc.querySelector('script[src*="wix"], body[class*="wix"]')) return 'wix'
  if (doc.querySelector('script[src*="squarespace"], body[class*="squarespace"]')) return 'squarespace'

  return null
}

// ============================================================
// Category Detection
// ============================================================

function detectPageCategory(doc: Document, url: string): string {
  const titleText = doc.title.toLowerCase()
  const bodyText = (doc.body?.textContent || '').slice(0, 5000).toLowerCase()
  const urlLower = url.toLowerCase()

  const combined = titleText + ' ' + urlLower + ' ' + bodyText.slice(0, 2000)

  const categoryMap: [RegExp, string][] = [
    // Shoes
    [/\b(shoe|sneaker|boot|sandal|footwear|trainer|loafer|flip.?flop|slipper)\b/, 'shoes'],
    // Clothing
    [/\b(shirt|pants|dress|jacket|hoodie|jeans|t-shirt|sweater|coat|clothing|apparel|fashion|wear|blouse|trousers|shorts|skirt|cardigan|polo|jumpsuit|romper|legging|thermal|underwear|swimwear)\b/, 'clothing'],
    // Beauty / Personal Care
    [/\b(face|skin|hair|makeup|cosmetic|beauty|lotion|serum|moisturizer|perfume|fragrance|skincare|lipstick|mascara|foundation|concealer|blush)\b/, 'personal-care'],
    // Electronics
    [/\b(phone|laptop|tablet|headphone|earbuds|charger|battery|cable|speaker|keyboard|mouse|monitor|tv|camera|gadget|electronics|computer|macbook|ipad|iphone|samsung|galaxy|airpod)\b/, 'electronics'],
    // Food / Grocery
    [/\b(grocery|food|snack|coffee|tea|spice|oil|sauce|protein|organic|supermarket|fresh|meat|dairy|fruit|vegetable|bread|cereal|rice|pasta|nut|chocolate|candy)\b/, 'food'],
    // Furniture / Home Decor
    [/\b(furniture|sofa|table|chair|bed|mattress|rug|curtain|home decor|lighting|lamp|shelf|cabinet|couch|bookcase|wardrobe|dresser|nightstand)\b/, 'furniture'],
    // Home / Kitchen / Cleaning
    [/\b(clean|detergent|soap|sponge|mop|broom|wipe|trash|laundry|kitchen|cookware|pan|pot|utensil|blender|mixer|toaster|oven|microwave|dishes|towel)\b/, 'home'],
    // Personal Care / Health
    [/\b(toothbrush|shampoo|lotion|razor|deodorant|dental|personal care|hygiene|vitamin|supplement|medicine|pharmacy|drug|cream|ointment|bandage)\b/, 'personal-care'],
    // Sports / Fitness
    [/\b(gym|fitness|yoga|dumbbell|resistance|workout|sport|running|training|athletic|tennis|basketball|football|soccer|cycling|swimming)\b/, 'fitness'],
    // Baby / Kids
    [/\b(baby|infant|toddler|stroller|car seat|diaper|nappy|feeding bottle|pacifier|crib|bassinet|playpen)\b/, 'baby'],
    // Accessories / Bags
    [/\b(bag|handbag|backpack|wallet|belt|hat|sunglasses|watch|accessori|scarf|glove|purse|clutch|tote|luggage|suitcase)\b/, 'accessories'],
    // Jewelry
    [/\b(jewelry|ring|necklace|bracelet|earring|pendant|diamond|gold|silver|platinum|gem|pearl|chain|bangle)\b/, 'jewelry'],
    // Pet
    [/\b(pet|dog|cat|animal|kibble|aquarium|fish tank|bird cage|hamster)\b/, 'pet'],
    // Toys / Kids
    [/\b(toy|game|puzzle|lego|play|kids|children|doll|action figure|board game|building block)\b/, 'toys'],
    // School / Office / Stationery
    [/\b(book|notebook|pen|pencil|school|stationery|office|printer|paper|eraser|marker|crayon|folder|binder|calculator|scissors|tape|glue)\b/, 'office'],
    // Phone accessories
    [/\b(phone case|screen protector|cover|protector|cable|charger|adapter|earphone|headset|stand|mount)\b/, 'accessories'],
    // Grocery delivery / Supermarket
    [/\b(delivery|supermarket|hypermarket|grocery store|corner shop|convenience)\b/, 'food'],
    // Pharmacy
    [/\b(pharmacy|chemist|drugstore|boots|life pharmacy|medicines?|prescription)\b/, 'personal-care'],
    // Luxury
    [/\b(luxury|designer|boutique|couture|prada|gucci|louis vuitton|chanel|hermes|dior|balenciaga|versace)\b/, 'other'],
    // Travel
    [/\b(travel|luggage|suitcase|passport|travel adapter|travel pillow|carry.?on|trolley)\b/, 'travel'],
  ]

  for (const [pattern, category] of categoryMap) {
    if (pattern.test(combined)) return category
  }

  return 'other'
}

// ============================================================
// Helpers
// ============================================================

function getDomainDisplayName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    // Convert domain to readable name
    const parts = hostname.split('.')
    if (parts.length >= 2) {
      const name = parts[parts.length - 2]
      return name.charAt(0).toUpperCase() + name.slice(1)
    }
    return hostname
  } catch {
    return 'Unknown Store'
  }
}
