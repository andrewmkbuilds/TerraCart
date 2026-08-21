import type {
  Product,
  ProductAnalysis,
  EcoScore,
  AIVerdict,
  Alternative,
  ChecklistItem,
  PackagingAnalysis,
  GreenwashingAlert,
  ResearchStep,
  UserPreferences,
  ProductRanking,
  RecommendationResult,
  ShoppingPattern,
  ProductCategory,
} from '../types'

// ============================================================
// Eco Score Engine
// ============================================================

export function calculateEcoScore(product: Product, preferences: UserPreferences): EcoScore {
  const reusabilityScore = getReusabilityScore(product)
  const durabilityScore = getDurabilityScore(product)
  const packagingScore = getPackagingScore(product)
  const repairabilityScore = getRepairabilityScore(product)
  const materialScore = getMaterialScore(product)

  // Weighted based on user preferences
  const weights = getPreferenceWeights(preferences)
  
  const weightedSum =
    reusabilityScore * weights.reusability +
    durabilityScore * weights.durability +
    packagingScore * weights.packaging +
    repairabilityScore * weights.repairability +
    materialScore * weights.material

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
  const overall = Math.round((weightedSum / totalWeight) * 10) / 10

  const confidence = getConfidence(product)
  const reasoning = generateScoreReasoning(product, {
    reusability: reusabilityScore,
    durability: durabilityScore,
    packaging: packagingScore,
    repairability: repairabilityScore,
    material: materialScore,
  })

  return {
    overall: Math.min(10, Math.max(0, overall)),
    breakdown: {
      reusability: reusabilityScore,
      durability: durabilityScore,
      packaging: packagingScore,
      repairability: repairabilityScore,
      materialConsiderations: materialScore,
    },
    confidence,
    reasoning,
    sources: [
      { name: 'Product information analysis', type: 'ai-inference', reliability: 'medium' },
      { name: 'Material and packaging assessment', type: 'ai-inference', reliability: 'medium' },
    ],
    aiGenerated: true,
    disclaimer: 'This score is a TerraCart AI Estimate based on available product information. It is not a scientific certification.',
  }
}

function getReusabilityScore(product: Product): number {
  switch (product.reusability) {
    case 'highly-reusable': return 9.5
    case 'reusable': return 8
    case 'limited': return 5
    case 'single-use': return 2
    default: return 5
  }
}

function getDurabilityScore(product: Product): number {
  switch (product.durability) {
    case 'high': return 9
    case 'medium': return 6
    case 'low': return 3
    default: return 5
  }
}

function getPackagingScore(product: Product): number {
  let score = 5
  const pkg = product.packaging
  
  if (pkg.type.includes('none')) score += 3
  else if (pkg.type.includes('compostable')) score += 2
  else if (pkg.type.includes('cardboard') || pkg.type.includes('paper')) score += 1
  else if (pkg.type.includes('plastic-wrap') || pkg.type.includes('plastic-bag')) score -= 2
  
  if (pkg.layers && pkg.layers > 2) score -= 1
  if (pkg.estimatedWeight === 'minimal') score += 1
  else if (pkg.estimatedWeight === 'heavy') score -= 1
  if (pkg.recyclable === true) score += 1
  if (pkg.refillable === true) score += 1
  if (pkg.containsPlastic === true) score -= 0.5

  return Math.min(10, Math.max(0, score))
}

function getRepairabilityScore(product: Product): number {
  switch (product.repairability) {
    case 'highly-repairable': return 9
    case 'repairable': return 7
    case 'limited': return 4
    case 'not-repairable': return 2
    default: return 5
  }
}

function getMaterialScore(product: Product): number {
  let score = 5
  const materials = product.materials.map(m => m.toLowerCase())
  
  if (materials.some(m => m.includes('recycled') || m.includes('recyclable'))) score += 2
  if (materials.some(m => m.includes('bamboo') || m.includes('organic') || m.includes('hemp'))) score += 1.5
  if (materials.some(m => m.includes('plastic') && !m.includes('recycled'))) score -= 1.5
  if (materials.some(m => m.includes('stainless') || m.includes('glass'))) score += 1
  if (materials.some(m => m.includes('biodegradable') || m.includes('compostable'))) score += 1

  return Math.min(10, Math.max(0, score))
}

function getPreferenceWeights(prefs: UserPreferences) {
  const base = { reusability: 1, durability: 1, packaging: 1, repairability: 1, material: 1 }
  
  for (const priority of prefs.sustainabilityPriorities) {
    switch (priority) {
      case 'buy-reusable': base.reusability += 0.5; break
      case 'buy-durable': base.durability += 0.5; break
      case 'reduce-packaging': base.packaging += 0.5; break
      case 'prefer-repairable': base.repairability += 0.5; break
      case 'reduce-plastic': base.material += 0.5; break
      case 'prefer-refillable': base.reusability += 0.3; break
      case 'prefer-recyclable-packaging': base.packaging += 0.3; break
    }
  }
  
  return base
}

function getConfidence(product: Product): 'high' | 'medium' | 'low' {
  let knownFields = 0
  let totalFields = 8
  
  if (product.materials.length > 0) knownFields++
  if (product.durability) knownFields++
  if (product.reusability) knownFields++
  if (product.repairability) knownFields++
  if (product.packaging.type.length > 0 && !product.packaging.type.includes('unknown')) knownFields++
  if (product.packaging.layers) knownFields++
  if (product.certifications && product.certifications.length > 0) knownFields++
  if (product.rating > 0) knownFields++

  const ratio = knownFields / totalFields
  if (ratio >= 0.75) return 'high'
  if (ratio >= 0.4) return 'medium'
  return 'low'
}

function generateScoreReasoning(product: Product, scores: Record<string, number>): string[] {
  const reasons: string[] = []
  
  if (scores.reusability >= 8) reasons.push('This product is designed for repeated use, reducing waste over time.')
  else if (scores.reusability <= 3) reasons.push('This appears to be a single-use product with limited reusability.')
  
  if (scores.durability >= 8) reasons.push('Built with durability in mind, this product should last through extended use.')
  else if (scores.durability <= 3) reasons.push('Durability information suggests this product may need frequent replacement.')
  
  if (scores.packaging >= 7) reasons.push('Packaging appears minimal and environmentally conscious.')
  else if (scores.packaging <= 3) reasons.push('Packaging uses multiple layers or materials that may be difficult to recycle.')
  
  if (scores.repairability >= 7) reasons.push('This product can be repaired or has replaceable components.')
  else if (scores.repairability <= 3) reasons.push('Limited repair options available for this product.')
  
  if (scores.material >= 7) reasons.push('Materials appear to be sustainably sourced or recyclable.')
  else if (scores.material <= 3) reasons.push('Material composition includes items that may have higher environmental impact.')
  
  return reasons
}

// ============================================================
// AI Verdict Engine
// ============================================================

export function generateVerdict(score: EcoScore, product: Product): AIVerdict {
  const overall = score.overall
  const confidence = score.confidence
  
  if (overall >= 8) {
    return {
      level: 'great-choice',
      label: 'Great Choice',
      emoji: '🌱',
      explanation: generateGreatChoiceExplanation(product, score),
      confidence,
      factors: score.reasoning.slice(0, 3),
    }
  } else if (overall >= 6) {
    return {
      level: 'good-choice',
      label: 'Good Choice',
      emoji: '👍',
      explanation: generateGoodChoiceExplanation(product, score),
      confidence,
      factors: score.reasoning.slice(0, 3),
    }
  } else if (overall >= 4) {
    return {
      level: 'consider-alternatives',
      label: 'Consider Alternatives',
      emoji: '⚠️',
      explanation: generateConsiderAlternativesExplanation(product, score),
      confidence,
      factors: score.reasoning.slice(0, 3),
    }
  } else {
    return {
      level: 'limited-info',
      label: 'Limited Information',
      emoji: '🔎',
      explanation: generateLimitedInfoExplanation(product, score),
      confidence,
      factors: score.reasoning.slice(0, 3),
    }
  }
}

function generateGreatChoiceExplanation(product: Product, score: EcoScore): string {
  const strengths: string[] = []
  if (score.breakdown.reusability >= 8) strengths.push('reusable design')
  if (score.breakdown.durability >= 8) strengths.push('durable construction')
  if (score.breakdown.packaging >= 7) strengths.push('minimal packaging')
  if (score.breakdown.materialConsiderations >= 7) strengths.push('sustainable materials')
  
  const strengthText = strengths.length > 0 ? strengths.join(', ') : 'strong overall performance'
  return `This product scores well across multiple sustainability metrics, particularly in ${strengthText}. A solid eco-conscious choice.`
}

function generateGoodChoiceExplanation(product: Product, score: EcoScore): string {
  const notes: string[] = []
  if (score.breakdown.packaging < 5) notes.push('packaging information was limited')
  if (score.breakdown.repairability < 5) notes.push('repair options may be limited')
  if (score.confidence === 'low') notes.push('some information was inferred rather than verified')
  
  const noteText = notes.length > 0 ? ` However, ${notes.join(' and ')}.` : ''
  return `This product has good sustainability characteristics overall.${noteText} It's a reasonable choice with some room for improvement.`
}

function generateConsiderAlternativesExplanation(product: Product, score: EcoScore): string {
  return `This product has some sustainability limitations. ${score.reasoning[0] || 'There may be alternatives worth considering that better align with eco-conscious shopping.'} Click "Research Alternatives" to explore options.`
}

function generateLimitedInfoExplanation(product: Product, score: EcoScore): string {
  return `I couldn't find enough reliable information to make a strong recommendation. The available data suggests some areas of concern, but more product information would help improve this assessment.`
}

// ============================================================
// Checklist Generator
// ============================================================

export function generateChecklist(product: Product, preferences: UserPreferences): ChecklistItem[] {
  const items: ChecklistItem[] = []
  let id = 0

  // General items
  items.push({ id: `c${++id}`, text: 'Do I already own something that can do this?', category: 'before-you-buy', checked: false, dynamic: true })
  items.push({ id: `c${++id}`, text: 'Is there a reusable alternative?', category: 'before-you-buy', checked: false, dynamic: true })
  items.push({ id: `c${++id}`, text: 'Is the product durable?', category: 'before-you-buy', checked: false, dynamic: true })
  items.push({ id: `c${++id}`, text: 'Is this something I will use regularly?', category: 'before-you-buy', checked: false, dynamic: true })

  // Packaging items
  if (product.packaging.containsPlastic) {
    items.push({ id: `c${++id}`, text: 'Is there a version with less plastic packaging?', category: 'before-you-buy', checked: false, dynamic: true })
  }
  if (product.packaging.refillable === 'unknown' || product.packaging.refillable) {
    items.push({ id: `c${++id}`, text: 'Is there a refill option available?', category: 'before-you-buy', checked: false, dynamic: true })
  }
  items.push({ id: `c${++id}`, text: 'Can I combine this delivery with another purchase?', category: 'before-you-buy', checked: false, dynamic: true })

  // Category-specific
  const categoryItems = getCategoryChecklist(product.category, id)
  items.push(...categoryItems)

  // Pattern-based
  if (product.reusability === 'single-use') {
    items.push({ id: `c${++id}`, text: 'Could a reusable version serve the same purpose?', category: 'before-you-buy', checked: false, dynamic: true })
  }

  return items
}

function getCategoryChecklist(category: ProductCategory, startId: number): ChecklistItem[] {
  const items: ChecklistItem[] = []
  let id = startId

  switch (category) {
    case 'electronics':
      items.push(
        { id: `c${++id}`, text: 'Does it have a long warranty?', category: 'electronics', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Is it repairable?', category: 'electronics', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Does it have a replaceable battery?', category: 'electronics', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Is it energy efficient?', category: 'electronics', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Is it upgradeable?', category: 'electronics', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Are replacement parts available?', category: 'electronics', checked: false, dynamic: false },
      )
      break
    case 'clothing':
      items.push(
        { id: `c${++id}`, text: 'Is it durable?', category: 'clothing', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Is it versatile enough for multiple outfits?', category: 'clothing', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Can it be repaired if damaged?', category: 'clothing', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Is it easy to care for?', category: 'clothing', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Do I already own something similar?', category: 'clothing', checked: false, dynamic: false },
      )
      break
    case 'food':
    case 'beverages':
      items.push(
        { id: `c${++id}`, text: 'Is the packaging minimal?', category: 'food', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Is there a refill or bulk option?', category: 'food', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Can I use a reusable container?', category: 'food', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Is this the appropriate quantity?', category: 'food', checked: false, dynamic: false },
      )
      break
    case 'cleaning':
      items.push(
        { id: `c${++id}`, text: 'Is there a refillable option?', category: 'cleaning', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Does it use a concentrated formula?', category: 'cleaning', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Can I use a reusable bottle and refill?', category: 'cleaning', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Are the cleaning tools reusable?', category: 'cleaning', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Is the packaging minimal?', category: 'cleaning', checked: false, dynamic: false },
      )
      break
    case 'school-supplies':
      items.push(
        { id: `c${++id}`, text: 'Is it reusable or refillable?', category: 'school-supplies', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Is it durable enough for daily use?', category: 'school-supplies', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Is the packaging minimal?', category: 'school-supplies', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Do I already have a similar item?', category: 'school-supplies', checked: false, dynamic: false },
      )
      break
    default:
      items.push(
        { id: `c${++id}`, text: 'Is there unnecessary packaging?', category: 'general', checked: false, dynamic: false },
        { id: `c${++id}`, text: 'Can I buy a lower-packaging version?', category: 'general', checked: false, dynamic: false },
      )
  }

  return items
}

// ============================================================
// Packaging Analysis
// ============================================================

export function analyzePackaging(product: Product): PackagingAnalysis {
  const issues: string[] = []
  const improvements: PackagingAnalysis['improvements'] = []
  
  // Analyze issues
  if (product.packaging.containsPlastic) {
    issues.push('Contains plastic packaging which may not be recyclable locally')
  }
  if (product.packaging.layers && product.packaging.layers > 2) {
    issues.push(`Multiple packaging layers (${product.packaging.layers}) increase waste`)
  }
  if (product.packaging.estimatedWeight === 'heavy') {
    issues.push('Heavy packaging adds to shipping emissions')
  }
  if (product.packaging.type.includes('plastic-wrap') && product.packaging.type.includes('plastic-container')) {
    issues.push('Multiple types of plastic packaging detected')
  }

  // Score
  let pkgScore = 5
  if (product.packaging.estimatedWeight === 'minimal') pkgScore += 2
  else if (product.packaging.estimatedWeight === 'light') pkgScore += 1
  else if (product.packaging.estimatedWeight === 'heavy') pkgScore -= 2
  
  if (product.packaging.recyclable === true) pkgScore += 1
  if (product.packaging.refillable === true) pkgScore += 1
  if (product.packaging.type.includes('compostable')) pkgScore += 1
  if (product.packaging.type.includes('none')) pkgScore += 2

  // Improvements
  if (product.packaging.refillable === true || product.packaging.refillable === 'unknown') {
    improvements.push({
      type: 'refill',
      available: product.packaging.refillable === true,
      description: product.packaging.refillable === true
        ? 'A refill option is available for this product'
        : 'A refill option may be available — check with the retailer',
    })
  }
  improvements.push({
    type: 'bulk',
    available: product.packaging.bulkAvailable ?? false,
    description: product.packaging.bulkAvailable
      ? 'Bulk purchase option available to reduce per-unit packaging'
      : 'Buying in bulk when possible can reduce overall packaging',
  })
  improvements.push({
    type: 'consolidated-shipping',
    available: true,
    description: 'Combining this with other purchases in a single delivery reduces shipping packaging',
  })

  return {
    currentPackaging: product.packaging,
    packagingScore: Math.min(10, Math.max(0, pkgScore)),
    issues,
    improvements,
  }
}

// ============================================================
// Greenwashing Detection
// ============================================================

export function detectGreenwashing(product: Product): GreenwashingAlert | undefined {
  const claims = product.sustainabilityClaims || []
  if (claims.length === 0) return undefined

  const vagueClaims = claims.filter(claim => {
    const lower = claim.toLowerCase()
    return (
      lower.includes('eco-friendly') ||
      lower.includes('green') ||
      lower.includes('natural') ||
      lower.includes('100% sustainable') ||
      lower.includes('planet friendly') ||
      lower.includes('earth friendly') ||
      lower.includes('eco-conscious') ||
      (lower.includes('100%') && lower.includes('natural'))
    )
  })

  if (vagueClaims.length > 0 && !product.certifications?.length) {
    return {
      detected: true,
      claims: vagueClaims,
      warning: `The product description uses broad sustainability language ("${vagueClaims[0]}"), but I couldn't find specific certifications or verified data to back up the claim. This doesn't mean the product isn't sustainable — just that the claim isn't independently verified.`,
      confidence: 'medium',
    }
  }

  return undefined
}

// ============================================================
// Alternative Finder
// ============================================================

export function generateAlternatives(
  product: Product,
  allProducts: Product[],
  preferences: UserPreferences
): Alternative[] {
  const alternatives: Alternative[] = []

  for (const candidate of allProducts) {
    if (candidate.id === product.id) continue
    if (candidate.category !== product.category) continue

    const improvementAreas: string[] = []
    let isBetter = false

    // Check reusability
    const reusabilityOrder = { 'single-use': 0, 'limited': 1, 'reusable': 2, 'highly-reusable': 3 }
    const prodReusability = reusabilityOrder[product.reusability || 'single-use']
    const candReusability = reusabilityOrder[candidate.reusability || 'single-use']
    if (candReusability > prodReusability) {
      improvementAreas.push('Higher reusability')
      isBetter = true
    }

    // Check durability
    const durabilityOrder = { low: 0, medium: 1, high: 2 }
    const prodDurability = durabilityOrder[product.durability || 'medium']
    const candDurability = durabilityOrder[candidate.durability || 'medium']
    if (candDurability > prodDurability) {
      improvementAreas.push('Better durability')
      isBetter = true
    }

    // Check repairability
    const repairOrder = { 'not-repairable': 0, limited: 1, repairable: 2, 'highly-repairable': 3 }
    const prodRepair = repairOrder[product.repairability || 'not-repairable']
    const candRepair = repairOrder[candidate.repairability || 'not-repairable']
    if (candRepair > prodRepair) {
      improvementAreas.push('More repairable')
      isBetter = true
    }

    // Check packaging
    const prodPkgScore = product.packaging.type.includes('none') ? 3 : product.packaging.recyclable ? 2 : 0
    const candPkgScore = candidate.packaging.type.includes('none') ? 3 : candidate.packaging.recyclable ? 2 : 0
    if (candPkgScore > prodPkgScore) {
      improvementAreas.push('Better packaging')
      isBetter = true
    }

    if (!isBetter) continue

    const altType = determineAlternativeType(product, candidate)
    const prodScore = calculateEcoScore(product, preferences)
    const candScore = calculateEcoScore(candidate, preferences)

    alternatives.push({
      productId: candidate.id,
      product: candidate,
      reason: improvementAreas.join(', ') + ' make this a potentially better choice',
      improvementAreas,
      scoreComparison: {
        original: prodScore.overall,
        alternative: candScore.overall,
      },
      priceComparison: {
        original: product.price,
        alternative: candidate.price,
        currency: product.currency,
      },
      type: altType,
      priority: improvementAreas.length >= 3 ? 'high' : improvementAreas.length >= 2 ? 'medium' : 'low',
    })
  }

  return alternatives.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  }).slice(0, 5)
}

function determineAlternativeType(original: Product, alternative: Product): Alternative['type'] {
  if (original.reusability === 'single-use' && alternative.reusability !== 'single-use') return 'reusable'
  if (alternative.packaging.refillable) return 'refillable'
  if (alternative.durability === 'high' && original.durability !== 'high') return 'durable'
  if (alternative.packaging.estimatedWeight === 'minimal' && original.packaging.estimatedWeight !== 'minimal') return 'minimal-packaging'
  return 'similar'
}

// ============================================================
// Recommendation Engine
// ============================================================

export function generateRecommendations(
  product: Product,
  allProducts: Product[],
  preferences: UserPreferences,
  patterns: ShoppingPattern[],
): RecommendationResult[] {
  const recommendations: RecommendationResult[] = []

  // Reusable alternative
  if (product.reusability === 'single-use') {
    const reusableAlts = allProducts.filter(
      p => p.category === product.category && (p.reusability === 'reusable' || p.reusability === 'highly-reusable')
    )
    if (reusableAlts.length > 0) {
      recommendations.push({
        type: 'reusable-alternative',
        title: 'Reusable Alternative Available',
        description: `A reusable version of this product exists. Given regular use, it could save money and reduce waste over time.`,
        product: reusableAlts[0],
        reason: 'This product is single-use, but reusable alternatives exist in the same category',
        priority: 'high',
      })
    }
  }

  // Packaging improvement
  if (product.packaging.containsPlastic || (product.packaging.layers && product.packaging.layers > 1)) {
    recommendations.push({
      type: 'better-packaging',
      title: 'Packaging Improvement Available',
      description: 'This product uses multiple packaging layers or plastic packaging. A less-packaged version or refill may be available.',
      reason: 'Packaging analysis indicates room for improvement',
      priority: 'medium',
    })
  }

  // Pattern-based
  for (const pattern of patterns) {
    if (pattern.type === 'disposable-repeated' && pattern.category === product.category) {
      recommendations.push({
        type: 'pattern-warning',
        title: 'Shopping Pattern Detected',
        description: `You've looked at or purchased disposable ${pattern.category} products several times. Would you like me to find a reusable alternative?`,
        reason: 'Repeated disposable purchases detected in this category',
        priority: 'high',
      })
    }
  }

  // Price vs Sustainability
  const similarProducts = allProducts.filter(
    p => p.category === product.category && p.id !== product.id
  )
  if (similarProducts.length > 0) {
    const cheaper = similarProducts.find(p => p.price < product.price)
    const moreSustainable = similarProducts.find(p => {
      const s = calculateEcoScore(p, preferences)
      return s.overall > calculateEcoScore(product, preferences).overall
    })
    if (cheaper && moreSustainable && cheaper.id !== moreSustainable.id) {
      recommendations.push({
        type: 'price-vs-sustainability',
        title: 'Price vs Sustainability Options',
        description: `There are different options available at various price and sustainability levels.`,
        reason: 'Trade-offs exist between price and sustainability for similar products',
        priority: 'medium',
      })
    }
  }

  return recommendations
}

// ============================================================
// Pattern Detection
// ============================================================

export function detectPatterns(history: { category: ProductCategory; timestamp: number }[]): ShoppingPattern[] {
  const patterns: ShoppingPattern[] = []
  const categoryCounts: Record<string, { count: number; timestamps: number[]; ids: string[] }> = {}

  for (const entry of history) {
    if (!categoryCounts[entry.category]) {
      categoryCounts[entry.category] = { count: 0, timestamps: [], ids: [] }
    }
    categoryCounts[entry.category].count++
    categoryCounts[entry.category].timestamps.push(entry.timestamp)
  }

  for (const [category, data] of Object.entries(categoryCounts)) {
    if (data.count >= 3) {
      const recentCount = data.timestamps.filter(
        t => Date.now() - t < 30 * 24 * 60 * 60 * 1000 // last 30 days
      ).length

      patterns.push({
        category: category as ProductCategory,
        frequency: data.count,
        lastSeen: Math.max(...data.timestamps),
        products: data.ids,
        type: 'category-frequent',
        suggestion: `You've been shopping for ${category} products frequently. Would you like personalized recommendations for this category?`,
      })
    }
  }

  return patterns
}

// ============================================================
// Price vs Sustainability Recommendation
// ============================================================

export function generatePriceVsSustainability(
  products: Product[],
  preferences: UserPreferences
): { bestValue: Product; mostSustainable: Product; balanced: Product } | null {
  if (products.length < 2) return null

  const scored = products.map(p => ({
    product: p,
    ecoScore: calculateEcoScore(p, preferences),
  }))

  const bestValue = scored.reduce((best, curr) => {
    const valueA = best.ecoScore.overall / (best.product.price || 1)
    const valueB = curr.ecoScore.overall / (curr.product.price || 1)
    return valueB > valueA ? curr : best
  })

  const mostSustainable = scored.reduce((best, curr) =>
    curr.ecoScore.overall > best.ecoScore.overall ? curr : best
  )

  const balanced = scored.reduce((best, curr) => {
    const balanceA = best.ecoScore.overall * 0.5 + (1 / (best.product.price || 1)) * 5
    const balanceB = curr.ecoScore.overall * 0.5 + (1 / (curr.product.price || 1)) * 5
    return balanceB > balanceA ? curr : best
  })

  return {
    bestValue: bestValue.product,
    mostSustainable: mostSustainable.product,
    balanced: balanced.product,
  }
}
