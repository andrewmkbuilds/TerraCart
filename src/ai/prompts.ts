// ============================================================
// System Prompts and Prompt Builders for TerraCart AI
// ============================================================

import type { Product, UserPreferences } from '../types'

// ============================================================
// SYSTEM PROMPTS
// ============================================================

export const ANALYSIS_SYSTEM_PROMPT = `You are TerraCart, an expert AI shopping researcher. Your job is to analyze products and help users make smarter, more sustainable purchasing decisions.

CRITICAL RULES:
- NEVER fabricate product names, brands, prices, URLs, or any information.
- NEVER invent sustainability certifications or claims.
- If information is unavailable, say "Information unavailable."
- Distinguish between FACTS (directly found), AI INFERENCE (your conclusion), and ESTIMATES (calculated approximation).
- Use Google Search to find real information about products and alternatives.
- Every alternative you recommend MUST be a real product that exists.
- Every URL you provide MUST be a real URL.
- When uncertain, say "I'm not certain" rather than guessing.

Your analysis should cover:
1. Whether this product is a good choice based on available information
2. Eco score assessment (0-10) based on reusability, durability, packaging, repairability, materials
3. Packaging analysis
4. Whether sustainability claims appear credible
5. Any greenwashing concerns

Always be transparent about confidence levels.`

export const RESEARCH_SYSTEM_PROMPT = `You are TerraCart, an expert AI shopping researcher with real-time web search capability.

CRITICAL RULES:
- NEVER fabricate product names, brands, prices, URLs, or any information.
- NEVER invent alternatives that don't exist.
- Use Google Search to find REAL products that actually exist.
- Every alternative MUST have a real product name, real brand, and real URL when available.
- If you cannot find a verified alternative, say "No verified alternative found."
- Every source you cite MUST be from your actual search results.
- If price information is unavailable, say "Price unavailable."
- Do NOT recommend products far outside the user's budget range.

Your task is to research real alternatives to the product described. For each alternative found:
- Product name (exact, as listed by the retailer)
- Brand
- Retailer/website
- Price (if found in search results)
- Product URL (the actual retailer product page URL from a grounded search result)
- Source URL (the grounded page where the product was found; keep this separate)
- Why it might be better
- Eco-relevant characteristics

Research categories:
- Reusable alternatives (if current product is disposable/single-use)
- Refillable alternatives
- More durable alternatives
- Lower-packaging alternatives
- Better material alternatives
- Similar products from different retailers
- Budget-friendly alternatives

Use the user's preferences to prioritize results.`

export const CHAT_SYSTEM_PROMPT = `You are TerraCart, a friendly and knowledgeable AI shopping assistant. You help users make better purchasing decisions.

RULES:
- NEVER fabricate product information, names, brands, or URLs.
- If information is unavailable, honestly say so.
- When the user says "this" or "it", they are referring to the product currently being analyzed.
- Be helpful, concise, and transparent.
- Use Google Search when the user asks for alternatives, comparisons, or product research.
- Distinguish between verified facts and your analysis/inference.
- Never shame users for their shopping choices.
- Be practical — if a sustainable alternative costs 10x more and the user has a budget, acknowledge the trade-off.`

// ============================================================
// PROMPT BUILDERS
// ============================================================

export function buildProductContext(product: Product): string {
  const parts: string[] = []
  parts.push('CURRENT PRODUCT:')
  parts.push('Name: ' + (product.name || 'Unknown'))
  if (product.brand) parts.push('Brand: ' + product.brand)
  if (product.price > 0) parts.push('Price: ' + product.currency + ' ' + product.price.toFixed(2))
  parts.push('Retailer: ' + (product.retailer || 'Unknown'))
  parts.push('Category: ' + (product.category || 'Unknown'))
  parts.push('URL: ' + (product.url || 'Unknown'))
  if (product.description) parts.push('Description: ' + product.description.slice(0, 500))
  if (product.materials.length > 0) parts.push('Materials: ' + product.materials.join(', '))
  if (product.features && product.features.length > 0) parts.push('Features: ' + product.features.slice(0, 5).join(', '))
  if (product.rating > 0) parts.push('Rating: ' + product.rating + '/5 (' + product.reviewCount + ' reviews)')
  if (product.reusability) parts.push('Reusability: ' + product.reusability)
  if (product.durability) parts.push('Durability: ' + product.durability)
  if (product.repairability) parts.push('Repairability: ' + product.repairability)
  if (product.packaging) {
    const pkg = product.packaging
    parts.push('Packaging: ' + pkg.type.join(', ') + (pkg.containsPlastic ? ' [contains plastic]' : '') + (pkg.recyclable === true ? ' [recyclable]' : ''))
  }
  if (product.sustainabilityClaims && product.sustainabilityClaims.length > 0) parts.push('Sustainability claims: ' + product.sustainabilityClaims.join('; '))
  if (product.certifications && product.certifications.length > 0) parts.push('Certifications: ' + product.certifications.join(', '))

  return parts.join('\n')
}

export function buildPreferencesContext(preferences: UserPreferences): string {
  const parts: string[] = []
  parts.push('USER PREFERENCES:')
  parts.push('Recommendation style: ' + preferences.recommendationStyle)
  parts.push('Sustainability priorities: ' + preferences.sustainabilityPriorities.join(', '))
  if (preferences.budgetRange) {
    parts.push('Budget: ' + preferences.budgetRange.min + ' - ' + preferences.budgetRange.max)
  }
  if (preferences.preferredBrands.length > 0) {
    parts.push('Preferred brands: ' + preferences.preferredBrands.join(', '))
  }
  if (preferences.preferredRetailers.length > 0) {
    parts.push('Preferred retailers: ' + preferences.preferredRetailers.join(', '))
  }
  return parts.join('\n')
}

export function buildAnalysisPrompt(product: Product, preferences: UserPreferences): string {
  const context = buildProductContext(product)
  const prefs = buildPreferencesContext(preferences)

  return `Analyze this product for sustainability and smart shopping.

${context}

${prefs}

Respond with a JSON object ONLY (no markdown, no code blocks) with this structure:
{
  "verdict": "great-choice" | "good-choice" | "consider-alternatives" | "limited-info",
  "ecoScore": {
    "overall": <number 0-10>,
    "reusability": <number 0-10>,
    "durability": <number 0-10>,
    "packaging": <number 0-10>,
    "repairability": <number 0-10>,
    "materialConsiderations": <number 0-10>
  },
  "confidence": "high" | "medium" | "low",
  "reasoning": ["<reason 1>", "<reason 2>", ...],
  "packagingAnalysis": "<brief packaging assessment>",
  "greenwashingWarning": null or "<warning if claims seem unsubstantiated>",
  "researchSources": [{"name": "<source name>", "url": "<url if available>", "type": "manufacturer"|"retailer"|"independent"|"ai-inference"}]
}

Base your analysis ONLY on information available from the product data and search results. If information is missing, note it in your reasoning and lower confidence accordingly.`
}

export function buildResearchPrompt(
  product: Product,
  preferences: UserPreferences,
  researchType: 'alternatives' | 'reusable' | 'packaging' | 'all' = 'all',
): string {
  const context = buildProductContext(product)
  const prefs = buildPreferencesContext(preferences)

  let focusArea = ''
  switch (researchType) {
    case 'reusable':
      focusArea = 'Focus specifically on reusable, refillable, or longer-lasting alternatives that could replace this disposable/single-use product.'
      break
    case 'packaging':
      focusArea = 'Focus on finding versions of this product with less packaging, bulk options, refill pouches, or package-free alternatives.'
      break
    case 'alternatives':
      focusArea = 'Find better alternatives in the same product category that improve on sustainability, durability, or overall value.'
      break
    case 'all':
      focusArea = 'Research reusable alternatives, refillable options, lower-packaging versions, and similar products with better sustainability profiles.'
      break
  }

  return `Research real alternatives for this product.

${context}

${prefs}

${focusArea}

IMPORTANT: Search the web for REAL products that actually exist. For each alternative found, provide the exact product name, brand, retailer, and URL as found in search results.

Respond with a JSON object ONLY (no markdown, no code blocks) with this structure:
{
  "alternatives": [
    {
      "name": "<exact product name as listed>",
      "brand": "<brand name>",
      "retailer": "<where it's sold>",
      "price": "<price if found, otherwise 'Price unavailable'>",
      "productUrl": "<actual retailer product page URL from search results, or null>",
      "sourceUrl": "<grounded source URL>",
      "reason": "<why this might be better>",
      "ecoScore": <number 0-10 or null if uncertain>,
      "characteristics": ["<key feature 1>", "<key feature 2>"]
    }
  ],
  "packagingAlternatives": [
    {
      "description": "<description of packaging alternative>",
      "productUrl": "<actual retailer product page URL from search results, or null>",
      "sourceUrl": "<grounded source URL>",
      "retailer": "<retailer name>"
    }
  ],
  "reusableAlternatives": [
    {
      "name": "<product name>",
      "brand": "<brand>",
      "retailer": "<retailer>",
      "price": "<price>",
      "productUrl": "<actual retailer product page URL from search results, or null>",
      "sourceUrl": "<grounded source URL>",
      "reason": "<why reusable alternative>"
    }
  ],
  "summary": "<brief summary of findings>",
  "confidence": "high" | "medium" | "low",
  "sources": [{"name": "<source name>", "url": "<source URL>", "type": "manufacturer"|"retailer"|"independent"}]
}

Only include alternatives you found through search. If the actual retailer product page URL is not present in the grounded search results, set productUrl to null and do not guess or construct one. If no alternatives were found for a category, return an empty array. Never fabricate products.`
}

export function buildChatPrompt(
  userMessage: string,
  productContext: string,
  preferencesContext: string,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): string {
  let prompt = ''

  if (chatHistory.length > 0) {
    prompt += 'Previous conversation:\n'
    for (const msg of chatHistory.slice(-10)) {
      prompt += (msg.role === 'user' ? 'User' : 'TerraCart') + ': ' + msg.content + '\n'
    }
    prompt += '\n'
  }

  prompt += productContext + '\n\n'
  prompt += preferencesContext + '\n\n'
  prompt += 'User question: ' + userMessage + '\n\n'
  prompt += 'Respond naturally and helpfully. If the user is asking about alternatives, packaging, or comparisons, use Google Search to find real information. Be concise but thorough. If you cannot find information, say so honestly.'

  return prompt
}
