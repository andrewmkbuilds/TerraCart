import type { DetectedProduct, ProductAnalysis, Preferences } from '../types'
import { assessPlastic, computeTerraScore, scoreInsights } from './sustainability-engine'
import { suggestAlternatives } from './alternatives-service'

export const ANALYSIS_DISCLAIMER =
  'TerraScore is an estimate built only from information on the product page. It is not a life-cycle assessment, and missing data is never treated as a negative.'

export function createAnalysis(product: DetectedProduct, preferences?: Preferences): ProductAnalysis {
  const score = computeTerraScore(product)
  const plastic = assessPlastic(product)
  const alternatives = suggestAlternatives(product)
  const insights = scoreInsights(score, plastic, preferences?.priorities || [])

  return {
    product,
    score,
    plastic,
    alternatives,
    insights,
    disclaimer: ANALYSIS_DISCLAIMER,
    analysedAt: Date.now(),
  }
}

export function productIdFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const cleanUrl = `${parsed.hostname}${parsed.pathname}`.toLowerCase()
    let hash = 0
    for (let i = 0; i < cleanUrl.length; i += 1) {
      hash = (hash << 5) - hash + cleanUrl.charCodeAt(i)
      hash |= 0
    }
    return `p_${Math.abs(hash).toString(36)}`
  } catch {
    return `p_${Date.now().toString(36)}`
  }
}

export function analyseProduct(product: DetectedProduct, preferences?: Preferences): ProductAnalysis {
  return createAnalysis(product, preferences)
}