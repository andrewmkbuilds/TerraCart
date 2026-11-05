import type { DetectionSource, DetectedProduct } from '../types'
import {
  findCertificationLabels,
  findMaterialLabels,
  findPackagingSignals,
} from '../services/sustainability-engine'
import { productIdFromUrl } from '../services/product-service'

interface Draft {
  name?: string
  brand?: string
  price?: number
  currency?: string
  image?: string
  description?: string
  materials?: string[]
  packaging?: string
  certifications?: string[]
  features?: string[]
  specs?: Record<string, string>
  source?: DetectionSource
  adapter?: string | null
}

const MAX_TEXT = 4000

function clean(value?: string | null): string | undefined {
  if (!value) return undefined
  const text = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, MAX_TEXT) : undefined
}

function toPrice(value?: string | number | null): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 0 ? value : undefined
  if (!value) return undefined
  const match = String(value).replace(/,/g, '').match(/(\d+(?:\.\d{1,2})?)/)
  if (!match) return undefined
  const parsed = Number(match[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function textOf(root: ParentNode, selector: string): string | undefined {
  const el = root.querySelector(selector)
  return clean(el?.textContent)
}

function attrOf(root: ParentNode, selector: string, attr: string): string | undefined {
  const el = root.querySelector(selector)
  const value = el?.getAttribute(attr)
  return value ? value : undefined
}

// ---------------------------------------------------------------- JSON-LD

function collectJsonLd(): unknown[] {
  const nodes: unknown[] = []
  document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    try {
      const parsed = JSON.parse(script.textContent || 'null')
      if (!parsed) return
      if (Array.isArray(parsed)) nodes.push(...parsed)
      else if (parsed['@graph'] && Array.isArray(parsed['@graph'])) nodes.push(...parsed['@graph'])
      else nodes.push(parsed)
    } catch {
      /* malformed JSON-LD is common — ignore */
    }
  })
  return nodes
}

function hasType(node: any, type: string): boolean {
  if (!node || typeof node !== 'object') return false
  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']]
  return types.filter(Boolean).some((value: string) => String(value).toLowerCase() === type.toLowerCase())
}

function nameOf(value: any): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return clean(value)
  if (Array.isArray(value)) return nameOf(value[0])
  return clean(value.name)
}

function fromJsonLd(): Draft | null {
  const nodes = collectJsonLd()
  const product = nodes.find((node) => hasType(node, 'Product') || hasType(node, 'ProductGroup'))
  if (!product) return null
  const node = product as any
  const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers
  const specs: Record<string, string> = {}
  const properties: any[] = Array.isArray(node.additionalProperty) ? node.additionalProperty : []

  properties.forEach((property) => {
    const key = clean(property?.name)
    const value = clean(property?.value)
    if (key && value) specs[key] = value
  })

  if (node.size) specs.Size = clean(String(node.size)) || ''
  if (node.color) specs.Colour = nameOf(node.color) || ''
  if (node.material) specs.Material = nameOf(node.material) || ''

  const declaredMaterials = node.material
    ? (Array.isArray(node.material) ? node.material : [node.material])
        .map((entry: any) => nameOf(entry))
        .filter(Boolean)
    : []

  const images = Array.isArray(node.image) ? node.image : [node.image]
  const image = images.map((entry: any) => (typeof entry === 'string' ? entry : entry?.url)).filter(Boolean)[0]

  return {
    name: clean(node.name),
    brand: nameOf(node.brand),
    price: toPrice(offer?.price ?? offer?.lowPrice ?? node.price),
    currency: clean(offer?.priceCurrency) || undefined,
    image,
    description: clean(node.description),
    materials: declaredMaterials as string[],
    specs,
    source: 'json-ld',
  }
}

// ---------------------------------------------------------------- DOM adapters

const ADAPTERS: { host: RegExp; label: string; read: () => Draft | null }[] = [
  {
    host: /(^|\.)amazon\./,
    label: 'amazon',
    read: () => {
      const specs: Record<string, string> = {}
      document
        .querySelectorAll('#productOverview_feature_div tr, #productDetails_techSpec_section_1 tr, #detailBullets_feature_div li')
        .forEach((row) => {
          const cells = row.querySelectorAll('td, span')
          if (cells.length >= 2) {
            const key = clean(cells[0].textContent)
            const value = clean(cells[1].textContent)
            if (key && value && key.length < 60) specs[key.replace(/:$/, '')] = value
          } else {
            const text = clean(row.textContent)
            const split = text?.split(':')
            if (split && split.length > 1 && split[0].length < 40) specs[split[0].trim()] = split.slice(1).join(':').trim()
          }
        })

      const features = Array.from(document.querySelectorAll('#feature-bullets li, #productFactsDesktopExpander li'))
        .map((li) => clean(li.textContent))
        .filter((value): value is string => !!value)
        .slice(0, 8)

      return {
        name: textOf(document, '#productTitle') || textOf(document, 'h1#title'),
        brand: textOf(document, '#bylineInfo')?.replace(/^(Visit the |Brand: )/, '').replace(/ Store$/, ''),
        price: toPrice(textOf(document, '.a-price .a-offscreen') || textOf(document, '#corePrice_feature_div .a-offscreen')),
        currency: textOf(document, '.a-price .a-offscreen')?.includes('£') ? 'GBP' : textOf(document, '.a-price .a-offscreen')?.includes('€') ? 'EUR' : 'USD',
        image: attrOf(document, '#landingImage', 'src') || attrOf(document, 'img#imgTagWrapperId', 'src'),
        description: features.join(' · ') || textOf(document, '#productDescription'),
        features,
        specs,
        source: 'adapter',
        adapter: 'amazon',
      }
    },
  },
  {
    host: /(^|\.)ebay\./,
    label: 'ebay',
    read: () => {
      const specs: Record<string, string> = {}
      document.querySelectorAll('.ux-labels-values').forEach((row) => {
        const key = clean(row.querySelector('.ux-labels-values__labels')?.textContent)
        const value = clean(row.querySelector('.ux-labels-values__values')?.textContent)
        if (key && value) specs[key.replace(/:$/, '')] = value
      })
      return {
        name: textOf(document, '.x-item-title__mainTitle') || textOf(document, 'h1'),
        price: toPrice(textOf(document, '.x-price-primary')),
        image: attrOf(document, '.ux-image-carousel-item img', 'src'),
        description: textOf(document, '[data-testid="ux-item-description"]') || textOf(document, '.d-item-description'),
        specs,
        source: 'adapter',
        adapter: 'ebay',
      }
    },
  },
  {
    host: /(^|\.)etsy\./,
    label: 'etsy',
    read: () => ({
      name: textOf(document, 'h1[data-buy-box-listing-title]') || textOf(document, 'h1'),
      price: toPrice(textOf(document, '[data-buy-box-region="price"]')),
      image: attrOf(document, '.image-carousel-container img, [data-palette-listing-image] img', 'src'),
      description: textOf(document, '[data-product-details-description-text-content]'),
      source: 'adapter',
      adapter: 'etsy',
    }),
  },
  {
    host: /(^|\.)walmart\./,
    label: 'walmart',
    read: () => ({
      name: textOf(document, 'h1[itemprop="name"]') || textOf(document, 'h1'),
      price: toPrice(textOf(document, '[itemprop="price"]') || attrOf(document, '[itemprop="price"]', 'content')),
      image: attrOf(document, '[data-testid="hero-image"] img, img.prod-hero-image', 'src'),
      description: textOf(document, '[data-testid="product-description-content"]'),
      source: 'adapter',
      adapter: 'walmart',
    }),
  },
  {
    host: /(^|\.)noon\./,
    label: 'noon',
    read: () => ({
      name: textOf(document, 'h1') || textOf(document, '[class*="productTitle"]'),
      price: toPrice(textOf(document, '[class*="priceNow"]') || textOf(document, '[class*="Price"]')),
      image: attrOf(document, '[class*="productImage"] img, img', 'src'),
      description: textOf(document, '[class*="productDescription"]') || textOf(document, '[class*="description"]'),
      source: 'adapter',
      adapter: 'noon',
    }),
  },
]

// ---------------------------------------------------------------- generic fallbacks

function fromMicrodata(): Draft | null {
  const root = document.querySelector('[itemtype*="Product"]')
  if (!root) return null
  return {
    name: clean(root.querySelector('[itemprop="name"]')?.textContent),
    brand: clean(root.querySelector('[itemprop="brand"]')?.textContent),
    price: toPrice(
      root.querySelector('[itemprop="price"]')?.getAttribute('content') ||
        root.querySelector('[itemprop="price"]')?.textContent
    ),
    currency: clean(root.querySelector('[itemprop="priceCurrency"]')?.getAttribute('content')),
    image: root.querySelector('[itemprop="image"]')?.getAttribute('src') || undefined,
    description: clean(root.querySelector('[itemprop="description"]')?.textContent),
    source: 'microdata',
  }
}

function fromOpenGraph(): Draft | null {
  const meta = (name: string) =>
    document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute('content') || undefined

  const title = meta('og:title') || clean(document.title)
  if (!title) return null
  return {
    name: title,
    price: toPrice(meta('product:price:amount') || meta('og:price:amount')),
    currency: meta('product:price:currency') || meta('og:price:currency'),
    image: meta('og:image'),
    description: meta('og:description') || meta('description'),
    source: 'opengraph',
  }
}

const PRICE_SELECTORS = [
  '[itemprop="price"]',
  '[data-testid*="price"]',
  '[class*="price" i]',
  '[id*="price" i]',
]

function fromHeuristic(): Draft {
  const h1 = document.querySelector('h1')
  let price: number | undefined
  for (const selector of PRICE_SELECTORS) {
    const el = document.querySelector(selector)
    const parsed = toPrice(el?.getAttribute('content') || el?.textContent)
    if (parsed) {
      price = parsed
      break
    }
  }
  return {
    name: clean(h1?.textContent) || clean(document.title) || undefined,
    price,
    image: attrOf(document, 'img[srcset], img[src]', 'src'),
    description: clean(
      document.querySelector('main p, [class*="description" i] p, [id*="description" i] p')?.textContent
    ),
    source: 'heuristic',
  }
}

// ---------------------------------------------------------------- merge + category

function mergeDrafts(base: Draft | null, extra: Draft | null): Draft {
  if (!base) return { ...(extra || {}) }
  if (!extra) return { ...base }
  const merged: Draft = { ...base }
  Object.entries(extra).forEach(([key, value]) => {
    const current = (merged as Record<string, unknown>)[key]
    const empty =
      current === undefined ||
      current === null ||
      (typeof current === 'string' && current.trim() === '') ||
      (Array.isArray(current) && current.length === 0)
    if (empty && value !== undefined && value !== null) {
      ;(merged as Record<string, unknown>)[key] = value
    }
  })
  if (base.specs || extra.specs) merged.specs = { ...(extra.specs || {}), ...(base.specs || {}) }
  return merged
}

const CATEGORY_RULES: { category: string; pattern: RegExp }[] = [
  { category: 'kitchen', pattern: /bottle|mug|cup|cutlery|straw|kitchen|plate|bowl|pan|kettle|coffee|tea/ },
  { category: 'food-storage', pattern: /container|lunch|food storage|wrap|cling|jar|tupperware|bento/ },
  { category: 'personal-care', pattern: /soap|shampoo|toothbrush|toothpaste|razor|deodorant|skincare|cream|serum|period|tampon|wipes|cosmetic/ },
  { category: 'household', pattern: /detergent|cleaner|cleaning|sponge|laundry|bag|towel|bin|storage box/ },
  { category: 'clothing', pattern: /shirt|t-shirt|dress|jeans|trouser|jacket|hoodie|sock|shoe|apparel|clothing|linen|cotton/ },
  { category: 'stationery', pattern: /pen|pencil|notebook|notepad|paper|stationery|marker|planner/ },
  { category: 'electronics', pattern: /cable|charger|headphone|earbud|keyboard|mouse|power bank|phone case|usb|speaker/ },
]

function inferCategory(text: string, specs: Record<string, string>): string {
  const haystack = `${text} ${Object.values(specs).join(' ')}`.toLowerCase()
  const match = CATEGORY_RULES.find((rule) => rule.pattern.test(haystack))
  return match ? match.category : 'household'
}

// ---------------------------------------------------------------- public

export function detectProduct(): DetectedProduct | null {
  const adapter = ADAPTERS.find((entry) => entry.host.test(location.hostname))
  const adapterDraft = adapter ? adapter.read() : null
  const jsonLd = fromJsonLd()
  const microdata = fromMicrodata()
  const openGraph = fromOpenGraph()

  // Adapter data wins, then JSON-LD, then microdata, then OpenGraph.
  let draft = mergeDrafts(jsonLd, microdata)
  draft = mergeDrafts(draft, openGraph)
  draft = mergeDrafts(draft, adapterDraft)

  const heuristic = fromHeuristic()
  draft = mergeDrafts(draft, heuristic)

  if (!draft.name || draft.name.trim().length < 3) return null
  // Guard against pages whose <title> is just the store name.
  const hostWord = location.hostname.replace(/^www\./, '').split('.')[0]
  if (draft.name.trim().toLowerCase() === hostWord.toLowerCase()) return null

  const specs = draft.specs || {}
  const featureText = (draft.features || []).join(' ')
  const specText = Object.entries(specs)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' ')
  const pageText = [draft.name, draft.brand, draft.description, featureText, specText].filter(Boolean).join(' ')

  const declaredText = [
    ...(draft.materials || []),
    specText,
  ].join(' ')

  const inferredMaterials = findMaterialLabels(pageText)
  const materials = Array.from(
    new Set([...(draft.materials || []).map((value) => value.toLowerCase()), ...inferredMaterials])
  ).slice(0, 6)

  const packagingSignals = findPackagingSignals(pageText)
  const packaging =
    draft.packaging ||
    (packagingSignals.plasticFree[0]
      ? packagingSignals.plasticFree[0]
      : packagingSignals.plastic[0]
        ? packagingSignals.plastic[0]
        : undefined)

  const certifications = Array.from(
    new Set([...(draft.certifications || []), ...findCertificationLabels(pageText)])
  )

  const missing: string[] = []
  if (!draft.price) missing.push('price')
  if (!draft.brand) missing.push('brand')
  if (!draft.description) missing.push('description')
  if (!materials.length) missing.push('materials')
  if (!packaging) missing.push('packaging')
  if (!certifications.length) missing.push('certifications')

  const confidence = Math.max(
    10,
    Math.round(((6 - missing.length) / 6) * 100)
  )

  const product: DetectedProduct = {
    id: productIdFromUrl(location.href),
    name: draft.name.trim().slice(0, 200),
    brand: draft.brand?.slice(0, 80),
    price: draft.price,
    currency: draft.currency,
    image: draft.image,
    description: draft.description,
    category: inferCategory(pageText, specs),
    url: location.href,
    hostname: location.hostname,
    retailer: location.hostname.replace(/^www\./, ''),
    materials,
    packaging,
    certifications,
    features: (draft.features || []).slice(0, 8),
    specs,
    detection: {
      source: draft.source || 'heuristic',
      adapter: draft.adapter || adapter?.label || null,
      confidence,
      missing,
    },
    detectedAt: Date.now(),
  }

  // Keep the declared material text available to the scoring engine.
  if (declaredText.trim()) product.specs.Material = declaredText.slice(0, 400)

  return product
}

export function siteIsSupported(): boolean {
  return !!detectProduct()
}