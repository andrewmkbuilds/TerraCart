import type { AlternativeFilter, AlternativeSuggestion, DetectedProduct } from '../types'

interface SuggestionTemplate {
  title: string
  material: string
  reason: string
  reusable: boolean
  plasticFree: boolean
  materialScore: number
  query: string
}

interface Archetype {
  id: string
  category: PlasticFreeCategoryKey
  match: RegExp
  suggestions: SuggestionTemplate[]
}

export const PLASTIC_FREE_CATEGORIES = [
  { key: 'kitchen', label: 'Kitchen', icon: 'UtensilsCrossed' },
  { key: 'personal-care', label: 'Personal care', icon: 'Sparkles' },
  { key: 'stationery', label: 'Stationery', icon: 'Pencil' },
  { key: 'clothing', label: 'Clothing', icon: 'Shirt' },
  { key: 'electronics', label: 'Electronics accessories', icon: 'Cable' },
  { key: 'household', label: 'Household', icon: 'Home' },
  { key: 'food-storage', label: 'Food storage', icon: 'Container' },
] as const

export type PlasticFreeCategoryKey = (typeof PLASTIC_FREE_CATEGORIES)[number]['key']

const SEARCH_NOTE = 'Live product search opens in a new tab — TerraCart never shows invented products or prices.'

function shopSearch(query: string): string {
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`
}

function build(template: SuggestionTemplate, category: string, archetypeId: string): AlternativeSuggestion {
  return {
    id: `${archetypeId}:${template.query}`,
    title: template.title,
    material: template.material,
    category,
    reason: template.reason,
    reusable: template.reusable,
    plasticFree: template.plasticFree,
    materialScore: template.materialScore,
    searchQuery: template.query,
    searchUrl: shopSearch(template.query),
    sourceLabel: 'Google Shopping search',
  }
}

const ARCHETYPES: Archetype[] = [
  {
    id: 'bottle',
    category: 'kitchen',
    match: /water bottle|drink bottle|hydration|bottled water|mineral water/,
    suggestions: [
      { title: 'Insulated stainless steel bottle', material: 'Stainless steel', reason: 'Reusable for years and avoids single-use plastic bottles entirely.', reusable: true, plasticFree: true, materialScore: 84, query: 'insulated stainless steel water bottle' },
      { title: 'Glass bottle with silicone sleeve', material: 'Borosilicate glass', reason: 'Glass does not leach and is widely recyclable; the sleeve protects it.', reusable: true, plasticFree: true, materialScore: 80, query: 'glass water bottle silicone sleeve' },
      { title: 'Bottle brush + refill cleaning kit', material: 'Wood / natural bristle', reason: 'Keeps a reusable bottle hygienic so it lasts longer.', reusable: true, plasticFree: true, materialScore: 70, query: 'wooden bottle brush natural bristle' },
    ],
  },
  {
    id: 'cutlery',
    category: 'kitchen',
    match: /cutlery|fork|spoon|knife set|disposable tableware|plastic plate|party plates/,
    suggestions: [
      { title: 'Reusable stainless steel cutlery set', material: 'Stainless steel', reason: 'Replaces repeated disposable cutlery purchases.', reusable: true, plasticFree: true, materialScore: 84, query: 'reusable stainless steel cutlery set' },
      { title: 'Bamboo travel cutlery', material: 'Bamboo', reason: 'Lightweight alternative; check sourcing and lifespan before choosing it.', reusable: true, plasticFree: true, materialScore: 60, query: 'bamboo travel cutlery set' },
      { title: 'Reusable food container for takeaway', material: 'Stainless steel / glass', reason: 'Avoids the packaging that usually comes with takeaway meals.', reusable: true, plasticFree: true, materialScore: 80, query: 'stainless steel takeaway food container' },
    ],
  },
  {
    id: 'coffee-cup',
    category: 'kitchen',
    match: /coffee cup|paper cup|tea cup disposable|takeaway cup/,
    suggestions: [
      { title: 'Insulated reusable coffee cup', material: 'Stainless steel', reason: 'Replaces hundreds of disposable cups over its life.', reusable: true, plasticFree: true, materialScore: 82, query: 'insulated reusable coffee cup' },
      { title: 'Ceramic travel mug', material: 'Ceramic', reason: 'Durable and free of plastic liners.', reusable: true, plasticFree: true, materialScore: 74, query: 'ceramic travel mug with lid' },
    ],
  },
  {
    id: 'straw',
    category: 'kitchen',
    match: /straw/,
    suggestions: [
      { title: 'Stainless steel straws', material: 'Stainless steel', reason: 'Reusable and does not break down into microplastics.', reusable: true, plasticFree: true, materialScore: 82, query: 'reusable stainless steel straws' },
      { title: 'Glass straws', material: 'Borosilicate glass', reason: 'Reusable and recyclable; handle with care.', reusable: true, plasticFree: true, materialScore: 78, query: 'reusable glass straws' },
    ],
  },
  {
    id: 'bags',
    category: 'household',
    match: /shopping bag|carrier bag|tote bag|grocery bag|reusable bag|produce bag/,
    suggestions: [
      { title: 'Organic cotton tote bag', material: 'Organic cotton', reason: 'Reusable for years if you actually carry it every trip.', reusable: true, plasticFree: true, materialScore: 72, query: 'organic cotton reusable shopping bag' },
      { title: 'Recycled cotton mesh produce bags', material: 'Recycled cotton', reason: 'Replaces thin single-use produce bags.', reusable: true, plasticFree: true, materialScore: 74, query: 'reusable cotton produce bags' },
    ],
  },
  {
    id: 'food-storage',
    category: 'food-storage',
    match: /food storage|container|tupperware|lunch box|cling film|food wrap|ziplock|sandwich bag/,
    suggestions: [
      { title: 'Glass food containers with steel lids', material: 'Glass / stainless steel', reason: 'Reusable, does not stain and avoids plastic contact with food.', reusable: true, plasticFree: true, materialScore: 80, query: 'glass food storage containers steel lids' },
      { title: 'Stainless steel lunch box', material: 'Stainless steel', reason: 'Durable and free of plastic liners.', reusable: true, plasticFree: true, materialScore: 82, query: 'stainless steel lunch box' },
      { title: 'Beeswax food wraps', material: 'Cotton / beeswax', reason: 'Reusable alternative to cling film; needs periodic refreshing.', reusable: true, plasticFree: true, materialScore: 64, query: 'beeswax food wraps' },
    ],
  },
  {
    id: 'razor',
    category: 'personal-care',
    match: /razor|shav(e|ing)/,
    suggestions: [
      { title: 'Safety razor with steel blades', material: 'Stainless steel', reason: 'Replaces disposable plastic razors; blades are metal and recyclable.', reusable: true, plasticFree: true, materialScore: 82, query: 'stainless steel safety razor' },
      { title: 'Safety razor blade recycling tin', material: 'Metal', reason: 'Keeps used blades out of general waste.', reusable: true, plasticFree: true, materialScore: 76, query: 'razor blade recycling tin' },
    ],
  },
  {
    id: 'toothbrush',
    category: 'personal-care',
    match: /toothbrush|toothpaste|dental floss/,
    suggestions: [
      { title: 'Bamboo toothbrush with castor-oil bristles', material: 'Bamboo', reason: 'Handle composts where facilities exist; check bristle material.', reusable: false, plasticFree: true, materialScore: 58, query: 'bamboo toothbrush castor oil bristles' },
      { title: 'Electric toothbrush with replaceable heads', material: 'Mixed', reason: 'A durable body with only heads replaced can produce less waste over time.', reusable: true, plasticFree: false, materialScore: 62, query: 'electric toothbrush replaceable heads' },
      { title: 'Toothpaste tablets in a refillable jar', material: 'Glass jar', reason: 'Avoids the plastic tube that cannot usually be recycled.', reusable: true, plasticFree: true, materialScore: 70, query: 'toothpaste tablets refillable glass jar' },
    ],
  },
  {
    id: 'period-care',
    category: 'personal-care',
    match: /tampon|sanitary|pad|menstrual|period/,
    suggestions: [
      { title: 'Reusable menstrual cup', material: 'Medical-grade silicone', reason: 'Reusable for years, replacing hundreds of disposable products.', reusable: true, plasticFree: true, materialScore: 76, query: 'reusable menstrual cup' },
      { title: 'Reusable cloth pads', material: 'Cotton', reason: 'Washable and reusable; lifespan depends on care.', reusable: true, plasticFree: true, materialScore: 68, query: 'reusable cloth menstrual pads' },
    ],
  },
  {
    id: 'sponge',
    category: 'household',
    match: /sponge|scrubber|dish cloth|cleaning cloth/,
    suggestions: [
      { title: 'Natural loofah or cellulose sponge', material: 'Plant fibre', reason: 'Compostable alternative to plastic sponges.', reusable: true, plasticFree: true, materialScore: 62, query: 'natural loofah sponge compostable' },
      { title: 'Walnut scrub pad', material: 'Walnut shell / cotton', reason: 'Plastic-free scouring pad that can be composted.', reusable: true, plasticFree: true, materialScore: 64, query: 'walnut shell scrub pad' },
    ],
  },
  {
    id: 'laundry',
    category: 'household',
    match: /detergent|laundry|fabric softener|cleaning spray|dish soap/,
    suggestions: [
      { title: 'Refillable detergent concentrate', material: 'Concentrate + refill', reason: 'Concentrates cut packaging and shipping weight.', reusable: true, plasticFree: false, materialScore: 66, query: 'laundry detergent refill concentrate' },
      { title: 'Soap nuts or detergent sheets', material: 'Plant-based', reason: 'Usually sold in cardboard with no liquid plastic bottle.', reusable: false, plasticFree: true, materialScore: 62, query: 'laundry detergent sheets plastic free' },
    ],
  },
  {
    id: 'wipes',
    category: 'household',
    match: /wet wipes|baby wipes|cleaning wipes|makeup wipes|cotton pads/,
    suggestions: [
      { title: 'Reusable bamboo cotton rounds', material: 'Bamboo / cotton', reason: 'Washable and replaces single-use pads or wipes.', reusable: true, plasticFree: true, materialScore: 66, query: 'reusable bamboo cotton rounds' },
      { title: 'Reusable microfibre cleaning cloths', material: 'Recycled microfibre', reason: 'Replaces disposable wipes for most household cleaning.', reusable: true, plasticFree: true, materialScore: 58, query: 'reusable cleaning cloths multipack' },
    ],
  },
  {
    id: 'stationery',
    category: 'stationery',
    match: /\b(pens?|pencils?|notebook|notepad|markers?|highlighter|stationery)\b/,
    suggestions: [
      { title: 'Refillable fountain or rollerball pen', material: 'Metal / refillable', reason: 'A refillable body replaces many disposable pens.', reusable: true, plasticFree: true, materialScore: 74, query: 'refillable metal fountain pen' },
      { title: 'Recycled paper notebook', material: 'Recycled paper', reason: 'Recycled content with paper binding instead of plastic.', reusable: false, plasticFree: true, materialScore: 68, query: 'recycled paper notebook' },
      { title: 'Woodless graphite pencil', material: 'Graphite / recycled paper', reason: 'Avoids painted wood casings and plastic barrels.', reusable: false, plasticFree: true, materialScore: 62, query: 'woodless graphite pencil' },
    ],
  },
  {
    id: 'clothing',
    category: 'clothing',
    match: /\b(shirts?|t-shirts?|tees?|dress|jeans|trousers?|jackets?|hoodies?|leggings|socks?|clothing|apparel)\b/,
    suggestions: [
      { title: 'Organic cotton basics', material: 'Organic cotton', reason: 'Certified organic fibre with clearer supply chains.', reusable: true, plasticFree: true, materialScore: 72, query: 'organic cotton gots certified t-shirt' },
      { title: 'Linen or hemp garment', material: 'Linen / hemp', reason: 'Lower-input fibres that last many seasons.', reusable: true, plasticFree: true, materialScore: 74, query: 'linen hemp clothing' },
      { title: 'Repair and mending kit', material: 'Cotton thread / metal needles', reason: 'Extends the life of clothes you already own.', reusable: true, plasticFree: true, materialScore: 70, query: 'clothing repair mending kit' },
    ],
  },
  {
    id: 'electronics',
    category: 'electronics',
    match: /cable|charger|earbuds|headphone|keyboard|mouse|usb|power bank|phone case/,
    suggestions: [
      { title: 'Braided recycled-fibre USB-C cable', material: 'Recycled fibre / metal', reason: 'Braided cables tend to outlast thin plastic-sheathed ones.', reusable: true, plasticFree: true, materialScore: 68, query: 'braided recycled usb c cable' },
      { title: 'Repairable headphones with replaceable pads', material: 'Mixed, repairable', reason: 'Replaceable parts extend the product life significantly.', reusable: true, plasticFree: false, materialScore: 70, query: 'repairable headphones replaceable ear pads' },
      { title: 'Compostable or recycled phone case', material: 'Plant-based / recycled', reason: 'Avoids virgin plastic; check the compostability claim.', reusable: true, plasticFree: true, materialScore: 62, query: 'compostable phone case' },
    ],
  },
  {
    id: 'drinkware',
    category: 'kitchen',
    match: /\b(mugs?|tumblers?|cups?|glass set|flasks?)\b/,
    suggestions: [
      { title: 'Ceramic mug', material: 'Ceramic', reason: 'Durable, plastic-free and long-lived with care.', reusable: true, plasticFree: true, materialScore: 74, query: 'ceramic mug handmade' },
      { title: 'Double-walled glass tumbler', material: 'Borosilicate glass', reason: 'Recyclable and free of plastic lining.', reusable: true, plasticFree: true, materialScore: 78, query: 'double walled glass tumbler' },
    ],
  },
]

const CATEGORY_FALLBACK: Record<PlasticFreeCategoryKey, SuggestionTemplate[]> = {
  kitchen: [
    { title: 'Reusable stainless steel bottle', material: 'Stainless steel', reason: 'Covers most drink-on-the-go needs without single-use plastic.', reusable: true, plasticFree: true, materialScore: 84, query: 'reusable stainless steel water bottle' },
    { title: 'Glass food containers', material: 'Glass', reason: 'Reusable storage that avoids plastic contact with food.', reusable: true, plasticFree: true, materialScore: 80, query: 'glass food storage containers' },
  ],
  'personal-care': [
    { title: 'Bar soap in paper wrap', material: 'Saponified oils', reason: 'Avoids the plastic bottle of liquid soap.', reusable: false, plasticFree: true, materialScore: 70, query: 'bar soap paper packaging' },
    { title: 'Refillable deodorant', material: 'Refillable case', reason: 'Refill cases reduce repeated plastic packaging.', reusable: true, plasticFree: true, materialScore: 68, query: 'refillable deodorant case' },
  ],
  stationery: [
    { title: 'Recycled paper notebooks', material: 'Recycled paper', reason: 'Recycled content with paper binding.', reusable: false, plasticFree: true, materialScore: 68, query: 'recycled paper notebook' },
    { title: 'Refillable pen', material: 'Metal / refillable', reason: 'Refills instead of replacing the whole pen.', reusable: true, plasticFree: true, materialScore: 74, query: 'refillable metal pen' },
  ],
  clothing: [
    { title: 'Organic cotton basics', material: 'Organic cotton', reason: 'Certified fibre with clearer supply chain.', reusable: true, plasticFree: true, materialScore: 72, query: 'organic cotton basics' },
    { title: 'Mending kit', material: 'Cotton / metal', reason: 'Keeps existing clothes in use longer.', reusable: true, plasticFree: true, materialScore: 70, query: 'mending repair kit' },
  ],
  electronics: [
    { title: 'Repairable accessories', material: 'Repairable mixed', reason: 'Replaceable parts extend product life.', reusable: true, plasticFree: false, materialScore: 68, query: 'repairable electronics accessories' },
    { title: 'Recycled-fibre cables', material: 'Recycled fibre', reason: 'Braided, longer-lasting cable sheath.', reusable: true, plasticFree: true, materialScore: 66, query: 'recycled braided usb cable' },
  ],
  household: [
    { title: 'Reusable cleaning cloths', material: 'Cotton', reason: 'Washable alternative to disposable wipes.', reusable: true, plasticFree: true, materialScore: 64, query: 'reusable cotton cleaning cloths' },
    { title: 'Refillable cleaning concentrate', material: 'Concentrate', reason: 'Cuts packaging and shipping weight.', reusable: true, plasticFree: false, materialScore: 64, query: 'refillable cleaning concentrate' },
  ],
  'food-storage': [
    { title: 'Stainless steel lunch box', material: 'Stainless steel', reason: 'Durable, plastic-free food storage.', reusable: true, plasticFree: true, materialScore: 82, query: 'stainless steel lunch box' },
    { title: 'Beeswax wraps', material: 'Cotton / beeswax', reason: 'Reusable alternative to cling film.', reusable: true, plasticFree: true, materialScore: 64, query: 'beeswax food wraps' },
  ],
}

function findArchetypes(product: DetectedProduct): Archetype[] {
  const text = `${product.name} ${product.description || ''} ${product.features.join(' ')}`.toLowerCase()
  return ARCHETYPES.filter((archetype) => archetype.match.test(text))
}

export function suggestAlternatives(product: DetectedProduct, limit = 6): AlternativeSuggestion[] {
  const matches = findArchetypes(product)
  const suggestions: AlternativeSuggestion[] = []
  const seen = new Set<string>()

  for (const archetype of matches) {
    for (const template of archetype.suggestions) {
      if (seen.has(template.query)) continue
      seen.add(template.query)
      suggestions.push(build(template, archetype.category, archetype.id))
    }
  }

  if (!suggestions.length) {
    const fallbackCategory = (product.category || 'household') as PlasticFreeCategoryKey
    const templates = CATEGORY_FALLBACK[fallbackCategory] || CATEGORY_FALLBACK.household
    templates.forEach((template) => suggestions.push(build(template, fallbackCategory, 'fallback')))
  }

  return suggestions.slice(0, limit)
}

export function plasticFreeCatalogue(category: PlasticFreeCategoryKey): AlternativeSuggestion[] {
  const items: AlternativeSuggestion[] = []
  const seen = new Set<string>()
  for (const archetype of ARCHETYPES) {
    if (archetype.category !== category) continue
    for (const template of archetype.suggestions) {
      if (!template.plasticFree || seen.has(template.query)) continue
      seen.add(template.query)
      items.push(build(template, category, archetype.id))
    }
  }
  if (!items.length) {
    CATEGORY_FALLBACK[category].forEach((template) => items.push(build(template, category, 'fallback')))
  }
  return items
}

export const PRICE_FILTERS: AlternativeFilter[] = ['highest-score', 'most-reusable', 'plastic-free', 'best-value']
export const ALL_FILTERS: { key: AlternativeFilter; label: string }[] = [
  { key: 'highest-score', label: 'Highest TerraScore' },
  { key: 'most-reusable', label: 'Most reusable' },
  { key: 'plastic-free', label: 'Plastic-free' },
  { key: 'best-value', label: 'Best value' },
]

export function sortAlternatives(
  items: AlternativeSuggestion[],
  filter: AlternativeFilter
): AlternativeSuggestion[] {
  const copy = [...items]
  switch (filter) {
    case 'most-reusable':
      return copy.sort((a, b) => Number(b.reusable) - Number(a.reusable) || b.materialScore - a.materialScore)
    case 'plastic-free':
      return copy.filter((item) => item.plasticFree).sort((a, b) => b.materialScore - a.materialScore)
    case 'best-value':
    case 'highest-score':
    default:
      return copy.sort((a, b) => b.materialScore - a.materialScore)
  }
}

export const ALTERNATIVES_DISCLAIMER = SEARCH_NOTE