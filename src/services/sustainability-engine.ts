import type {
  Classification,
  Confidence,
  DetectedProduct,
  EvidenceKind,
  PlasticAssessment,
  ScoreCategoryKey,
  ScoreCategoryResult,
  TerraScore,
} from '../types'
import { classificationFor } from '../utils/format'

/**
 * TerraScore — a transparent, evidence-led sustainability estimate.
 *
 * Rules that keep it honest:
 *  - A category with no evidence scores `null` and is excluded from the weighted
 *    average (the remaining weights are re-normalised). Missing data is never
 *    treated as harm.
 *  - Only text present on the product page is used. Nothing is invented.
 *  - `coverage` reports how much of the model had evidence, and drives confidence.
 */

export const CATEGORY_META: Record<ScoreCategoryKey, { label: string; weight: number }> = {
  materials: { label: 'Materials & composition', weight: 0.25 },
  packaging: { label: 'Packaging sustainability', weight: 0.2 },
  durability: { label: 'Durability & lifespan', weight: 0.2 },
  circularity: { label: 'Reusability & recyclability', weight: 0.15 },
  certifications: { label: 'Certifications & evidence', weight: 0.1 },
  sourcing: { label: 'Transport & sourcing', weight: 0.1 },
}

interface Rule {
  pattern: RegExp
  label: string
  score: number
  plastic?: boolean
  note?: string
}

const MATERIAL_RULES: Rule[] = [
  { pattern: /recycled (stainless )?steel/, label: 'recycled steel', score: 88 },
  { pattern: /stainless steel|18\/8|18\/10/, label: 'stainless steel', score: 80 },
  { pattern: /recycled aluminium|recycled aluminum/, label: 'recycled aluminium', score: 82 },
  { pattern: /aluminium|aluminum/, label: 'aluminium', score: 68 },
  { pattern: /borosilicate|tempered glass|glass/, label: 'glass', score: 78 },
  { pattern: /ceramic|stoneware|porcelain/, label: 'ceramic', score: 72 },
  { pattern: /cast iron/, label: 'cast iron', score: 86 },
  { pattern: /\bsteel\b|\bbrass\b|\bcopper\b/, label: 'metal', score: 76 },
  { pattern: /bamboo/, label: 'bamboo', score: 58, note: 'Fast-growing, but durability and sourcing vary.' },
  { pattern: /cork/, label: 'cork', score: 70 },
  { pattern: /organic cotton/, label: 'organic cotton', score: 74 },
  { pattern: /\blinen\b|\bhemp\b/, label: 'linen / hemp', score: 72 },
  { pattern: /\bwool\b/, label: 'wool', score: 68 },
  { pattern: /recycled (paper|cardboard|card)/, label: 'recycled paper', score: 74 },
  { pattern: /\bpaper\b|\bcardboard\b/, label: 'paper / cardboard', score: 60 },
  { pattern: /fsc[- ]certified wood|\bwood\b|timber/, label: 'wood', score: 64 },
  { pattern: /recycled polyester|rpet/, label: 'recycled polyester', score: 52 },
  { pattern: /\bsilicone\b/, label: 'silicone', score: 48 },
  { pattern: /\bleather\b/, label: 'leather', score: 42, note: 'Durable but sourcing and tanning matter.' },
  { pattern: /polyurethane|\bpu\b|vegan leather/, label: 'PU / vegan leather', score: 30, plastic: true },
  { pattern: /polyester/, label: 'polyester', score: 30, plastic: true },
  { pattern: /nylon|polyamide/, label: 'nylon', score: 30, plastic: true },
  { pattern: /acrylic/, label: 'acrylic', score: 25, plastic: true },
  { pattern: /polycarbonate/, label: 'polycarbonate', score: 34, plastic: true },
  { pattern: /\bpvc\b|vinyl/, label: 'PVC', score: 14, plastic: true },
  { pattern: /polystyrene|styrofoam/, label: 'polystyrene', score: 14, plastic: true },
  { pattern: /\beva\b/, label: 'EVA foam', score: 28, plastic: true },
  { pattern: /\bplastic\b/, label: 'plastic', score: 34, plastic: true },
]

const PLASTIC_FREE_PACKAGING_RULES: Rule[] = [
  { pattern: /plastic[- ]free packaging|packaging is plastic[- ]free|zero plastic packaging|no plastic (in|packaging|wrap)/, label: 'plastic-free packaging stated', score: 88 },
  { pattern: /recycled (cardboard|paper) packaging|recycled packaging/, label: 'recycled packaging', score: 78 },
  { pattern: /paper (bag|packaging|wrap)|cardboard (box|packaging)|packed in cardboard|kraft/, label: 'paper / cardboard packaging', score: 74 },
  { pattern: /compostable packaging/, label: 'compostable packaging', score: 60 },
  { pattern: /glass (jar|bottle)|metal tin|\btin\b|aluminium (can|tin)/, label: 'glass or metal container', score: 74 },
  { pattern: /refill (pouch|pack|packaging)/, label: 'refill packaging', score: 58 },
]

const PLASTIC_PACKAGING_RULES: Rule[] = [
  { pattern: /plastic bag|poly ?bag|poly ?mailer/, label: 'plastic bag / mailer', score: 24 },
  { pattern: /blister (pack|packaging)/, label: 'blister pack', score: 22 },
  { pattern: /shrink ?wrap|plastic wrap|cling film/, label: 'shrink wrap', score: 22 },
  { pattern: /bubble wrap/, label: 'bubble wrap', score: 26 },
  { pattern: /clamshell/, label: 'plastic clamshell', score: 20 },
  { pattern: /plastic packaging|plastic film|packed in plastic|plastic container/, label: 'plastic packaging', score: 28 },
]

const CERTIFICATION_RULES: { pattern: RegExp; label: string }[] = [
  { pattern: /\bfsc\b|forest stewardship council/, label: 'FSC' },
  { pattern: /\bgots\b|global organic textile/, label: 'GOTS' },
  { pattern: /oeko[- ]tex/, label: 'OEKO-TEX' },
  { pattern: /fair ?trade|fairtrade/, label: 'Fairtrade' },
  { pattern: /b[- ]?corp|b corporation/, label: 'B Corp' },
  { pattern: /cradle to cradle/, label: 'Cradle to Cradle' },
  { pattern: /eu ecolabel|ecolabel/, label: 'EU Ecolabel' },
  { pattern: /nordic swan/, label: 'Nordic Swan' },
  { pattern: /\bbluesign\b/, label: 'bluesign' },
  { pattern: /global recycled standard|\bgrs\b/, label: 'Global Recycled Standard' },
  { pattern: /rainforest alliance/, label: 'Rainforest Alliance' },
  { pattern: /usda organic|soil association/, label: 'Organic certification' },
  { pattern: /leaping bunny|cruelty[- ]free/, label: 'Leaping Bunny' },
  { pattern: /energy star/, label: 'Energy Star' },
  { pattern: /\bepeat\b/, label: 'EPEAT' },
  { pattern: /tco certified/, label: 'TCO Certified' },
  { pattern: /climate neutral certified/, label: 'Climate Neutral Certified' },
  { pattern: /1% for the planet/, label: '1% for the Planet' },
]

const UNVERIFIED_CLAIM_RULES: RegExp[] = [
  /eco[- ]friendly/,
  /environmentally friendly/,
  /earth[- ]friendly/,
  /green(?:er)? choice/,
  /100% sustainable/,
  /carbon neutral/,
  /climate positive/,
  /planet[- ]friendly/,
]

function buildHaystack(product: DetectedProduct): string {
  const specText = Object.entries(product.specs || {})
    .map(([key, value]) => `${key}: ${value}`)
    .join(' ')
  return [
    product.name,
    product.brand || '',
    product.description || '',
    product.materials.join(' '),
    product.packaging || '',
    product.certifications.join(' '),
    product.features.join(' '),
    specText,
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function matchRules(haystack: string, rules: Rule[]): Rule[] {
  const seen = new Set<string>()
  const matched: Rule[] = []
  for (const rule of rules) {
    if (rule.pattern.test(haystack) && !seen.has(rule.label)) {
      seen.add(rule.label)
      matched.push(rule)
    }
  }
  return matched
}

function average(values: number[]): number {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function materialFieldText(product: DetectedProduct): string {
  const specMaterials = Object.entries(product.specs || {})
    .filter(([key]) => /material|composition|fabric|made of/i.test(key))
    .map(([, value]) => value)
    .join(' ')
  return [product.materials.join(' '), specMaterials].join(' ')
}

function scoreMaterials(product: DetectedProduct, haystack: string): ScoreCategoryResult {
  const base = CATEGORY_META.materials
  const fieldText = materialFieldText(product).toLowerCase()
  const fromField = fieldText.trim().length > 0
  const matches = matchRules(fromField ? fieldText : haystack, MATERIAL_RULES)

  if (!matches.length) {
    return {
      ...base,
      key: 'materials',
      score: null,
      evidenceKind: 'unknown',
      note: 'No material information was found on the product page.',
      evidence: [],
    }
  }

  const score = average(matches.map((rule) => rule.score))
  const evidence = matches.map((rule) => `${rule.label} (~${rule.score}/100)`)
  return {
    key: 'materials',
    label: base.label,
    weight: base.weight,
    score,
    evidenceKind: fromField ? 'verified' : 'inferred',
    note: fromField
      ? 'Scored from the material information stated on the product page.'
      : 'Inferred from material words in the product name or description.',
    evidence,
  }
}

function scorePackaging(product: DetectedProduct, haystack: string): ScoreCategoryResult {
  const base = CATEGORY_META.packaging
  const positive = matchRules(haystack, PLASTIC_FREE_PACKAGING_RULES)
  const negative = matchRules(haystack, PLASTIC_PACKAGING_RULES)
  const explicitField = (product.packaging || '').trim()
  const fieldHits = explicitField ? matchRules(explicitField.toLowerCase(), [...PLASTIC_FREE_PACKAGING_RULES, ...PLASTIC_PACKAGING_RULES]) : []

  if (!positive.length && !negative.length && !explicitField) {
    return {
      key: 'packaging',
      label: base.label,
      weight: base.weight,
      score: null,
      evidenceKind: 'unknown',
      note: 'Packaging is not described on this page.',
      evidence: [],
    }
  }

  if (negative.length && !positive.length) {
    return {
      key: 'packaging',
      label: base.label,
      weight: base.weight,
      score: average(negative.map((rule) => rule.score)),
      evidenceKind: fieldHits.length ? 'verified' : 'inferred',
      note: 'Plastic packaging signals were found in the product details.',
      evidence: negative.map((rule) => rule.label),
    }
  }

  const scored = positive.length ? positive : negative
  return {
    key: 'packaging',
    label: base.label,
    weight: base.weight,
    score: average(scored.map((rule) => rule.score)),
    evidenceKind: explicitField ? 'verified' : 'inferred',
    note: positive.length
      ? 'Lower-impact packaging is described on the product page.'
      : 'Packaging information is limited.',
    evidence: [...positive.map((rule) => rule.label), ...negative.map((rule) => `also mentions ${rule.label}`)],
  }
}

function scoreDurability(product: DetectedProduct, haystack: string): ScoreCategoryResult {
  const base = CATEGORY_META.durability
  const evidence: string[] = []
  const scores: number[] = []
  let verified = false

  const warranty = haystack.match(/(\d{1,2})[- ]?(?:year|yr)s? (?:warranty|guarantee)/)
  if (/lifetime (warranty|guarantee)/.test(haystack)) {
    scores.push(92)
    evidence.push('lifetime warranty stated')
    verified = true
  } else if (warranty) {
    const years = Number(warranty[1])
    scores.push(Math.min(92, 68 + years * 3))
    evidence.push(`${years}-year warranty stated`)
    verified = true
  }

  if (/disposable|single[- ]use|one[- ]time use|throwaway|use once/.test(haystack)) {
    scores.push(14)
    evidence.push('described as disposable / single-use')
    verified = true
  }

  if (/flimsy|thin gauge|lightweight disposable/.test(haystack)) {
    scores.push(30)
    evidence.push('described as flimsy')
  }

  const durableMaterials = matchRules(haystack, [
    { pattern: /cast iron|lifetime/, label: 'cast iron', score: 86 },
    { pattern: /stainless steel|solid steel|brass|copper/, label: 'metal construction', score: 80 },
    { pattern: /borosilicate|tempered glass/, label: 'tempered glass', score: 78 },
    { pattern: /solid wood|hardwood|oak|walnut/, label: 'solid wood', score: 74 },
  ])
  if (durableMaterials.length && !scores.length) {
    scores.push(average(durableMaterials.map((rule) => rule.score)))
    evidence.push(...durableMaterials.map((rule) => `${rule.label} construction`))
  }

  if (!scores.length) {
    return {
      key: 'durability',
      label: base.label,
      weight: base.weight,
      score: null,
      evidenceKind: 'unknown',
      note: 'No durability indicators (warranty, construction, lifespan) were found.',
      evidence: [],
    }
  }

  return {
    key: 'durability',
    label: base.label,
    weight: base.weight,
    score: average(scores),
    evidenceKind: verified ? 'verified' : 'inferred',
    note: 'Based on warranty, construction and lifespan wording on the page.',
    evidence,
  }
}

function scoreCircularity(product: DetectedProduct, haystack: string): ScoreCategoryResult {
  const base = CATEGORY_META.circularity
  const hits: { label: string; score: number }[] = []

  if (/reusable|refillable|refill|re-?usable/.test(haystack)) hits.push({ label: 'reusable / refillable', score: 88 })
  if (/recyclable/.test(haystack)) hits.push({ label: 'recyclable claim', score: 72 })
  if (/compostable/.test(haystack)) hits.push({ label: 'compostable claim', score: 62 })
  if (/single[- ]use|disposable|one[- ]time use/.test(haystack)) hits.push({ label: 'single-use', score: 15 })
  if (/recycled content|made from recycled/.test(haystack)) hits.push({ label: 'recycled content', score: 74 })

  if (hits.length) {
    return {
      key: 'circularity',
      label: base.label,
      weight: base.weight,
      score: average(hits.map((hit) => hit.score)),
      evidenceKind: 'verified',
      note: 'Based on reuse, refill and recycling wording on the product page.',
      evidence: hits.map((hit) => hit.label),
    }
  }

  // Material inference only — clearly labelled.
  const materialText = materialFieldText(product).toLowerCase()
  if (/glass|steel|aluminium|aluminum|tin|metal/.test(materialText)) {
    return {
      key: 'circularity',
      label: base.label,
      weight: base.weight,
      score: 66,
      evidenceKind: 'inferred',
      note: 'No reuse or recycling claim was found; metal and glass are commonly recycled.',
      evidence: ['glass / metal material'],
    }
  }
  if (/pet\b|hdpe|plastic/.test(materialText)) {
    return {
      key: 'circularity',
      label: base.label,
      weight: base.weight,
      score: 46,
      evidenceKind: 'inferred',
      note: 'No reuse claim was found; plastic recyclability varies by local facilities.',
      evidence: ['plastic material'],
    }
  }

  return {
    key: 'circularity',
    label: base.label,
    weight: base.weight,
    score: null,
    evidenceKind: 'unknown',
    note: 'No reuse, refill or recycling information was found.',
    evidence: [],
  }
}

function scoreCertifications(product: DetectedProduct, haystack: string): ScoreCategoryResult {
  const base = CATEGORY_META.certifications
  const found = CERTIFICATION_RULES.filter((rule) => rule.pattern.test(haystack))
  const declared = (product.certifications || []).filter(Boolean)

  if (!found.length && !declared.length) {
    return {
      key: 'certifications',
      label: base.label,
      weight: base.weight,
      score: null,
      evidenceKind: 'unknown',
      note: 'No certification was found on the page. That is not evidence of harm.',
      evidence: [],
    }
  }

  const labels = Array.from(new Set([...found.map((rule) => rule.label), ...declared]))
  return {
    key: 'certifications',
    label: base.label,
    weight: base.weight,
    score: Math.min(95, 70 + (labels.length - 1) * 7),
    evidenceKind: 'verified',
    note: 'Certifications named on the product page. TerraCart does not verify them independently.',
    evidence: labels,
  }
}

function scoreSourcing(haystack: string): ScoreCategoryResult {
  const base = CATEGORY_META.sourcing
  const positive = [
    { pattern: /fair ?trade|fairtrade/, label: 'Fairtrade sourcing' },
    { pattern: /ethically sourced|ethical sourcing|living wage/, label: 'ethical sourcing stated' },
    { pattern: /traceable|supply chain transparency/, label: 'traceable supply chain' },
    { pattern: /locally (made|sourced)|made in (the )?(uk|usa|eu|europe)/, label: 'local / regional production' },
  ].filter((item) => item.pattern.test(haystack))

  const origin = haystack.match(/made in ([a-z ]{3,24})/)

  if (!positive.length) {
    return {
      key: 'sourcing',
      label: base.label,
      weight: base.weight,
      score: null,
      evidenceKind: origin ? 'inferred' : 'unknown',
      note: origin
        ? `Origin stated (${origin[1].trim()}) but transport is not disclosed.`
        : 'Transport and sourcing are not described on this page.',
      evidence: origin ? [`made in ${origin[1].trim()}`] : [],
    }
  }

  return {
    key: 'sourcing',
    label: base.label,
    weight: base.weight,
    score: Math.min(88, 68 + (positive.length - 1) * 6),
    evidenceKind: 'verified',
    note: 'Based on sourcing statements on the product page.',
    evidence: positive.map((item) => item.label),
  }
}

export function computeTerraScore(product: DetectedProduct): TerraScore {
  const haystack = buildHaystack(product)
  const categories: ScoreCategoryResult[] = [
    scoreMaterials(product, haystack),
    scorePackaging(product, haystack),
    scoreDurability(product, haystack),
    scoreCircularity(product, haystack),
    scoreCertifications(product, haystack),
    scoreSourcing(haystack),
  ]

  const known = categories.filter((category) => category.score !== null)
  const knownWeight = known.reduce((sum, category) => sum + category.weight, 0)
  const coverage = Math.round(knownWeight * 100)

  const overall =
    known.length === 0
      ? null
      : Math.round(
          known.reduce((sum, category) => sum + (category.score as number) * category.weight, 0) / knownWeight
        )

  const verifiedCount = known.filter((category) => category.evidenceKind === 'verified').length
  let confidence: Confidence = 'low'
  if (coverage >= 60 && verifiedCount >= 3) confidence = 'high'
  else if (coverage >= 35 && verifiedCount >= 1) confidence = 'medium'

  // An estimate built mostly on keyword inference should never read as high confidence.
  if (verifiedCount === 0 && confidence === 'high') confidence = 'medium'

  const positives = known
    .filter((category) => (category.score as number) >= 70)
    .flatMap((category) => category.evidence.map((item) => `${category.label}: ${item}`))

  const concerns = categories
    .filter((category) => category.score !== null && (category.score as number) <= 45)
    .flatMap((category) => category.evidence.map((item) => `${category.label}: ${item}`))

  const unknowns = categories
    .filter((category) => category.score === null)
    .map((category) => category.label)

  const unverifiedClaims = UNVERIFIED_CLAIM_RULES.filter((pattern) => pattern.test(haystack)).map((pattern) =>
    (haystack.match(pattern)?.[0] || '').trim()
  )

  const classification: Classification = classificationFor(overall)

  return {
    overall,
    classification,
    confidence,
    coverage,
    categories,
    positives: Array.from(new Set(positives)).slice(0, 6),
    concerns: Array.from(new Set(concerns)).slice(0, 6),
    unknowns,
    unverifiedClaims: Array.from(new Set(unverifiedClaims.filter(Boolean))),
  }
}

export function assessPlastic(product: DetectedProduct): PlasticAssessment {
  const haystack = buildHaystack(product)
  const materialText = materialFieldText(product).toLowerCase()

  const plasticClaims = /plastic[- ]free|zero plastic|no plastic/.test(haystack)
  const plasticMaterials = MATERIAL_RULES.filter((rule) => rule.plastic && rule.pattern.test(materialText || haystack))

  const productSignal = plasticMaterials.length
    ? {
        status: 'contains-plastic' as const,
        kind: 'verified' as EvidenceKind,
        evidence: plasticMaterials.map((rule) => rule.label),
      }
    : plasticClaims
      ? {
          status: 'plastic-free' as const,
          kind: 'verified' as const,
          evidence: ['plastic-free claim on the product page'],
        }
      : { status: 'unknown' as const, kind: 'unknown' as EvidenceKind, evidence: [] }

  const packagingNegative = matchRules(haystack, PLASTIC_PACKAGING_RULES)
  const packagingPositive = matchRules(haystack, PLASTIC_FREE_PACKAGING_RULES)
  const packagingSignal = packagingNegative.length
    ? {
        status: 'contains-plastic' as const,
        kind: 'verified' as const,
        evidence: packagingNegative.map((rule) => rule.label),
      }
    : packagingPositive.length
      ? {
          status: 'plastic-free' as const,
          kind: 'verified' as const,
          evidence: packagingPositive.map((rule) => rule.label),
        }
      : { status: 'unknown' as const, kind: 'unknown' as EvidenceKind, evidence: [] }

  const knownSignals = [productSignal, packagingSignal].filter((signal) => signal.status !== 'unknown')
  const confidence: Confidence = knownSignals.length === 2 ? 'high' : knownSignals.length === 1 ? 'medium' : 'low'

  return { product: productSignal, packaging: packagingSignal, confidence }
}

export function scoreInsights(
  score: TerraScore,
  plastic: PlasticAssessment,
  priorities: string[]
): string[] {
  const insights: string[] = []

  if (priorities.includes('plastic-reduction')) {
    if (plastic.packaging.status === 'contains-plastic') {
      insights.push('Plastic packaging was identified — this conflicts with your plastic-reduction priority.')
    } else if (plastic.packaging.status === 'plastic-free') {
      insights.push('Packaging is described as plastic-free, matching your plastic-reduction priority.')
    } else {
      insights.push('Packaging is unknown, so your plastic-reduction priority cannot be confirmed here.')
    }
  }

  const weakest = score.categories
    .filter((category) => category.score !== null)
    .sort((a, b) => (a.score as number) - (b.score as number))[0]

  if (weakest) {
    insights.push(`Weakest area: ${weakest.label.toLowerCase()} (${weakest.score}/100).`)
  }

  if (score.coverage < 40) {
    insights.push('Most of the sustainability model had no evidence, so treat this score as a partial signal.')
  }

  if (score.unverifiedClaims.length) {
    insights.push(`Unverified marketing claim${score.unverifiedClaims.length > 1 ? 's' : ''}: ${score.unverifiedClaims.join(', ')}.`)
  }

  return insights.slice(0, 4)
}