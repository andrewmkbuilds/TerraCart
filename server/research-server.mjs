import http from 'node:http'
import { tavily } from '@tavily/core'

const port = Number(process.env.PORT || 8787)
const allowedOrigins = (process.env.TERRACART_EXTENSION_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean)
const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
const categoryTerms = {
  electronics: ['phone', 'smartphone', 'laptop', 'tablet', 'computer', 'device', 'electronics', 'battery'],
  clothing: ['shirt', 'clothing', 'dress', 'jeans', 'jacket', 'shoes', 'apparel', 'fashion'],
  cleaning: ['cleaner', 'detergent', 'soap', 'laundry', 'dishwasher', 'cleaning'],
  food: ['food', 'snack', 'coffee', 'tea', 'grocery'],
  beverages: ['water', 'drink', 'beverage', 'bottle'],
}

const functionalTerms = {
  electronics: ['phone', 'smartphone', 'laptop', 'tablet', 'computer', 'device', 'electronics'],
  clothing: ['shirt', 'clothing', 'dress', 'jeans', 'jacket', 'shoes', 'apparel', 'fashion'],
  cleaning: ['cleaner', 'detergent', 'soap', 'laundry', 'dishwasher', 'cleaning'],
  food: ['food', 'snack', 'coffee', 'tea', 'grocery'],
  beverages: ['water', 'drink', 'beverage', 'bottle'],
}

const leverDefinitions = {
  material: { terms: ['recycled', 'reclaimed', 'stainless steel', 'glass', 'organic cotton', 'recycled material', 'recycled fiber'], weight: 20, type: 'better-materials' },
  reusable: { terms: ['reusable', 'designed for repeated use', 'multi-use', 'refillable bottle'], weight: 20, type: 'reusable' },
  refill: { terms: ['refill', 'concentrate', 'bulk', 'tablet', 'refill system'], weight: 20, type: 'refillable' },
  durable: { terms: ['durable', 'long-lasting', 'built to last', 'lifetime', 'extended life'], weight: 15, type: 'longer-lasting' },
  packaging: { terms: ['minimal packaging', 'less packaging', 'plastic-free packaging', 'packaging-free', 'reduced packaging', 'bulk packaging'], weight: 15, type: 'minimal-packaging' },
  repair: { terms: ['repairable', 'replaceable parts', 'repair program', 'modular', 'right to repair'], weight: 15, type: 'durable' },
  refurbished: { terms: ['refurbished', 'renewed', 'reconditioned', 'pre-owned'], weight: 20, type: 'longer-lasting' },
  efficient: { terms: ['energy efficient', 'energy star', 'low energy', 'energy-saving'], weight: 15, type: 'better-materials' },
}

const nonProductHosts = new Set(['instagram.com', 'facebook.com', 'x.com', 'twitter.com', 'pinterest.com', 'youtube.com', 'reddit.com', 'wikipedia.org'])

function productText(product) {
  return [product.name, product.category, product.description, ...(product.materials || []), ...(product.features || []), ...(product.sustainabilityClaims || []), product.reusability, product.durability, product.repairability, product.packaging?.type?.join(' ')].filter(Boolean).join(' ').toLowerCase()
}

function classifyProduct(product) {
  const text = productText(product)
  const category = String(product.category || 'other').toLowerCase()
  const opportunities = []
  const add = (key) => { if (!opportunities.includes(key)) opportunities.push(key) }

  if (/single[- ]use|disposable|one[- ]time|throwaway/.test(text) || ['beverages', 'cleaning', 'food'].includes(category)) add('reusable')
  if (/plastic|packaging|bottle|container|wrapper|box|bag/.test(text) || ['food', 'beverages', 'cleaning', 'personal-care'].includes(category)) add('material')
  if (['cleaning', 'personal-care', 'food', 'beverages'].includes(category) || /cartridge|pod|consumable|liquid|detergent|coffee/.test(text)) add('refill')
  if (['electronics', 'clothing', 'home', 'furniture', 'fitness'].includes(category)) {
    add('durable')
    add('repair')
  }
  if (category === 'electronics') {
    add('refurbished')
    add('efficient')
  }
  if (product.packaging?.estimatedWeight === 'heavy' || (product.packaging?.layers || 0) > 1) add('packaging')
  if (opportunities.length === 0) add('durable')
  return { category, opportunities }
}

function researchQueries(product, type) {
  const { category, opportunities } = classifyProduct(product)
  const location = product.retailer?.toLowerCase().includes('uae') || product.currency === 'AED' ? ' UAE' : ''
  const subject = `${product.name} ${category}`
  const queries = []
  const add = (query) => { if (!queries.includes(query)) queries.push(query) }
  const active = type === 'reusable' ? ['reusable', 'refill'].filter(key => opportunities.includes(key)) : type === 'packaging' ? ['refill', 'packaging'].filter(key => opportunities.includes(key)) : opportunities
  for (const key of active) {
    if (key === 'reusable') add(`reusable ${category} alternative to ${subject}${location}`)
    if (key === 'refill') add(`refill bulk concentrate ${subject} lower packaging${location}`)
    if (key === 'material') add(`${category} recycled material stainless steel glass sustainable product${location}`)
    if (key === 'durable') add(`durable long-lasting ${category} alternative repairable product${location}`)
    if (key === 'repair') add(`repairable ${category} replaceable parts sustainable product${location}`)
    if (key === 'refurbished') add(`refurbished renewed ${category} environmental benefit product${location}`)
    if (key === 'efficient') add(`energy efficient ${category} product environmental evidence${location}`)
    if (key === 'packaging') add(`${subject} minimal reduced packaging alternative retailer${location}`)
  }
  return { queries: queries.slice(0, type === 'all' ? 5 : 4), opportunities, category }
}

function json(res, status, body, origin) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  })
  res.end(JSON.stringify(body))
}

function responseOrigin(origin) {
  if (!origin) return '*'
  if (origin.startsWith('chrome-extension://') && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))) return origin
  return ''
}

function validProduct(product) {
  return product && typeof product.name === 'string' && product.name.trim() &&
    typeof product.url === 'string' && /^https?:\/\//i.test(product.url) &&
    typeof product.retailer === 'string' && product.retailer.trim()
}

function analysisProductPayload(product) {
  return {
    name: product.name, brand: product.brand || null, retailer: product.retailer,
    url: product.url, category: product.category, price: product.price, currency: product.currency,
    description: product.description || null, materials: product.materials || [],
    specifications: product.categorySpecific || null, packaging: product.packaging || null,
    sustainabilityClaims: product.sustainabilityClaims || [], features: product.features || [],
    durability: product.durability || null, reusability: product.reusability || null,
    repairability: product.repairability || null, certifications: product.certifications || [],
  }
}

function validateGeminiAnalysis(value) {
  if (!value || typeof value !== 'object') throw new Error('Gemini returned an invalid analysis')
  const ecoScore = Number(value.ecoScore)
  const confidence = Number(value.confidence)
  if (!Number.isFinite(ecoScore) || ecoScore < 0 || ecoScore > 10) throw new Error('Gemini returned an invalid eco score')
  if (!Number.isInteger(confidence) || confidence < 0 || confidence > 100) throw new Error('Gemini returned an invalid confidence')
  if (typeof value.scoreExplanation !== 'string' || !Array.isArray(value.strengths) || !Array.isArray(value.weaknesses)) throw new Error('Gemini returned incomplete analysis')
  const quality = ['high', 'medium', 'low'].includes(value.informationQuality) ? value.informationQuality : 'low'
  return {
    ecoScore: Math.round(ecoScore * 10) / 10,
    scoreExplanation: value.scoreExplanation,
    strengths: value.strengths.filter(item => typeof item === 'string').slice(0, 6),
    weaknesses: value.weaknesses.filter(item => typeof item === 'string').slice(0, 6),
    confidence,
    informationQuality: quality,
    dimensions: value.dimensions && typeof value.dimensions === 'object' ? value.dimensions : {},
  }
}

async function runGeminiAnalysis(product) {
  if (!validProduct(product)) return { success: false, error: 'No product detected. Scan the current shopping page first.' }
  if (!process.env.GEMINI_API_KEY) return { success: false, error: 'Gemini scoring is temporarily unavailable.' }

  let evidence = []
  if (process.env.TAVILY_API_KEY) {
    try {
      const evidenceClient = tavily({ apiKey: process.env.TAVILY_API_KEY })
      const evidenceResponse = await evidenceClient.search(`${product.name} ${product.category} materials durability repairability packaging environmental evidence`, {
        searchDepth: 'advanced', includeAnswer: false, includeRawContent: true, maxResults: 5, topic: 'general',
      })
      evidence = (evidenceResponse.results || []).filter(item => item?.title && item?.url && item?.content).slice(0, 5).map(item => ({ title: item.title, url: item.url, content: item.content.slice(0, 1500) }))
    } catch (error) {
      console.error('Gemini evidence search failed:', error instanceof Error ? error.message : String(error))
    }
  }

  const prompt = `You are TerraCart's environmental product analyst. Analyze the specific product and available evidence below. Estimate environmental sustainability from 0.0 to 10.0. Evaluate only dimensions relevant to the product category: materials, durability/lifespan, reusability, repairability, packaging, energy/resource use where relevant, end-of-life, and verified claims. Do not use retailer, price, brand reputation, or the existence of alternatives as scoring factors. Do not invent missing facts. Mark unknowns in weaknesses and reduce confidence when information is missing. Distinguish verified facts from inference in the explanation. Return JSON only with this shape: {"ecoScore":0.0,"scoreExplanation":"...","strengths":["..."],"weaknesses":["..."],"confidence":0,"informationQuality":"high|medium|low","dimensions":{"materials":0.0,"durability":0.0,"reusability":0.0,"packaging":0.0,"repairability":0.0,"endOfLife":0.0,"energy":0.0}}. Scores must describe this product itself, not alternatives.\n\nPRODUCT DATA:\n${JSON.stringify(analysisProductPayload(product), null, 2)}\n\nTAVILY EVIDENCE (may be empty; treat sources critically):\n${JSON.stringify(evidence, null, 2)}`
  console.log('Gemini analysis request started', { productName: product.name, evidenceCount: evidence.length, model: geminiModel })
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } }),
  })
  const responseBody = await response.text()
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}: ${responseBody.slice(0, 300)}`)
  const payload = JSON.parse(responseBody)
  const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || ''
  const analysis = validateGeminiAnalysis(JSON.parse(text))
  console.log('Gemini analysis response received', { ecoScore: analysis.ecoScore, confidence: analysis.confidence, informationQuality: analysis.informationQuality })
  return { success: true, analysis, evidence: evidence.map(source => ({ name: source.title, url: source.url, type: 'verified', reliability: 'medium' })) }
}

function validUrl(value, currentUrl) {
  try {
    const url = new URL(value)
    const current = new URL(currentUrl)
    return ['http:', 'https:'].includes(url.protocol) && url.href !== current.href
  } catch {
    return false
  }
}

function isProductResult(result, currentUrl, product, category) {
  if (!result || !validUrl(result.url, currentUrl)) return false
  let hostname = ''
  try { hostname = new URL(result.url).hostname.replace(/^www\./, '') } catch { return false }
  if ([...nonProductHosts].some(host => hostname === host || hostname.endsWith(`.${host}`))) return false
  if (/\/(blog|news|article|articles|guide|guides|story|stories|insights|solutions|services|supplier|suppliers)\//i.test(result.url)) return false
  if (/\/refurbished-(electronics|phones|laptops)(?:[/?#]|$)/i.test(result.url)) return false
  const text = `${result.title || ''} ${result.content || ''}`.toLowerCase()
  if (/\b(save up to|shop all|category|collection|supplier|wholesale|marketplace|used electronics)\b/i.test(result.title || '')) return false
  const terms = categoryTerms[category] || category.split('-')
  const related = terms.some(term => text.includes(term)) || product.name.toLowerCase().split(/\s+/).filter(word => word.length > 3).some(word => text.includes(word))
  const productPage = /\/products?\/|\/p\/|\/dp\/|\/item\/|\/shop\/|\/collections?\/|\/buy\//i.test(result.url) || /price|add to cart|in stock|buy now/.test(text)
  return related && productPage
}

function isAllowedEvidence(result) {
  if (!result || typeof result.url !== 'string') return false
  try {
    const hostname = new URL(result.url).hostname.replace(/^www\./, '')
    if ([...nonProductHosts].some(host => hostname === host || hostname.endsWith(`.${host}`))) return false
  } catch { return false }
  return !/\/(blog|news|article|articles|guide|guides|story|stories|insights|solutions|services|supplier|suppliers)\//i.test(result.url)
}

function retailerFromUrl(value) {
  try { return new URL(value).hostname.replace(/^www\./, '') } catch { return '' }
}

function scoreCandidate(result, verificationResults, product, opportunities, category) {
  const candidateText = `${result.title || ''} ${result.content || ''}`.toLowerCase()
  const text = `${candidateText} ${verificationResults.map(item => item.content || '').join(' ')}`.toLowerCase()
  const categoryMatch = (functionalTerms[category] || categoryTerms[category] || category.split('-')).some(term => candidateText.includes(term))
  if (!categoryMatch) return null
  const currentNameTokens = product.name.toLowerCase().split(/\s+/).filter(word => word.length > 3)
  const currentBrand = product.brand?.toLowerCase() || currentNameTokens[0]
  if (currentBrand && candidateText.includes(currentBrand) && currentNameTokens.some(token => token !== currentBrand && candidateText.includes(token))) return null
  let score = 25
  const improvements = []
  for (const key of opportunities) {
    const lever = leverDefinitions[key]
    if (lever.terms.some(term => candidateText.includes(term))) {
      score += lever.weight
      improvements.push(key)
    }
  }
  const evidenceResults = verificationResults.filter(item => item.url !== result.url && isAllowedEvidence(item) && leverDefinitions[opportunities.find(key => leverDefinitions[key].terms.some(term => `${item.title} ${item.content}`.toLowerCase().includes(term)))])
  if (evidenceResults.length) score += 15
  if (score < 60 || improvements.length === 0) return null
  const productSource = { title: result.title.trim(), url: result.url, kind: 'product' }
  const evidenceSources = evidenceResults.slice(0, 3).map(item => ({ title: item.title.trim(), url: item.url, kind: 'sustainability-evidence' }))
  return { score, improvements, productSource, evidenceSources, text }
}

function normalizeResults(candidates, product, researchType) {
  const seen = new Set()
  return candidates
    .filter(candidate => candidate && !seen.has(candidate.result.url) && seen.add(candidate.result.url))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(candidate => ({
      name: candidate.result.title.trim(),
      brand: null,
      retailer: retailerFromUrl(candidate.result.url),
      price: null,
      currency: null,
      productUrl: candidate.result.url,
      sourceUrl: candidate.result.url,
      reason: `Recommended because the source provides evidence of ${candidate.improvements.join(', ')} improvement relevant to this product.`,
      type: researchType === 'reusable' ? 'reusable' : researchType === 'packaging' ? 'minimal-packaging' : leverDefinitions[candidate.improvements[0]]?.type || 'durable',
      ecoRelevanceScore: candidate.score,
      sources: [candidate.productSource, ...candidate.evidenceSources],
    }))
}

async function runTerraCartResearch(product, researchType) {
  console.log('Research request received', { researchType, productName: product?.name || '', retailer: product?.retailer || '' })
  if (!validProduct(product)) {
    return { success: false, error: 'No product detected. Scan the current shopping page first.' }
  }
  if (!process.env.TAVILY_API_KEY) {
    return { success: false, error: 'TAVILY_API_KEY is not configured.' }
  }

  const type = researchType === 'reusable' || researchType === 'packaging' ? researchType : 'all'
  const client = tavily({ apiKey: process.env.TAVILY_API_KEY })
  const plan = researchQueries(product, type)
  const queries = plan.queries
  console.log('Research type:', type)
  console.log('Product name:', product.name)
  console.log('Retailer:', product.retailer)
  const responses = await Promise.all(queries.map(query => {
    console.log('Tavily request started')
    return client.search(query, {
    searchDepth: 'advanced',
    includeAnswer: false,
    includeRawContent: true,
    maxResults: 5,
    topic: 'general',
    }).then(response => {
      console.log('Tavily response received')
      return response
    })
  }))
  const results = responses.flatMap(response => Array.isArray(response?.results) ? response.results : [])
  console.log('Number of Tavily results:', results.length)
  if (results.some(result => !result || typeof result.title !== 'string' || typeof result.url !== 'string' || typeof result.content !== 'string')) {
    throw new Error('Malformed Tavily response')
  }
  const discoveryResults = results
    .filter(result => isProductResult(result, product.url, product, plan.category))
    .filter((result, index, all) => all.findIndex(item => item.url === result.url) === index)
    .slice(0, 8)
  console.log('Candidate products:', discoveryResults.length)
  const candidateChecks = await Promise.all(discoveryResults.map(async result => {
    const query = `${result.title} ${plan.category} sustainability evidence ${plan.opportunities.join(' ')}`
    console.log('Tavily verification request started')
    const response = await client.search(query, {
      searchDepth: 'advanced',
      includeAnswer: false,
      includeRawContent: true,
      maxResults: 3,
      topic: 'general',
    })
    console.log('Tavily verification response received')
    return { result, verificationResults: Array.isArray(response?.results) ? response.results : [] }
  }))
  const qualified = candidateChecks.map(({ result, verificationResults }) => {
    const scored = scoreCandidate(result, verificationResults, product, plan.opportunities, plan.category)
    return scored ? { ...scored, result } : null
  }).filter(Boolean)
  const alternatives = normalizeResults(qualified, product, type)
  console.log('Number of validated alternatives:', alternatives.length)
  const sources = results.filter(result => result?.url).map(result => ({ name: result.title || result.url, title: result.title || result.url, url: result.url }))
  const hasEcoAlternative = alternatives.length > 0
  const productAnalysis = { category: plan.category, ecoOpportunities: plan.opportunities }
  const reason = hasEcoAlternative ? undefined : type === 'reusable'
    ? 'No meaningful reusable alternative with a verified sustainability advantage was identified for this product.'
    : 'No compatible alternative with a sufficiently strong, source-backed sustainability advantage was identified for this product.'
  console.log('Research completed')
  return {
    success: true,
    hasEcoAlternative,
    productAnalysis,
    researchType: type,
    searchQueries: queries,
    alternatives,
    reason,
    summary: alternatives.length ? `Found ${alternatives.length} source-backed alternatives after verification.` : type === 'reusable' ? 'No meaningful reusable alternative found.' : 'No meaningful eco-friendly alternatives were found for this product.',
    sources,
  }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '*'
  const corsOrigin = responseOrigin(origin === '*' ? '' : origin)
  if (origin !== '*' && !corsOrigin) return json(res, 403, { success: false, error: 'Origin not allowed' }, '')
  if (req.method === 'OPTIONS') return json(res, 204, {}, corsOrigin)
  if (req.method !== 'POST' || !['/api/research', '/api/analyze'].includes(req.url)) return json(res, 404, { success: false, error: 'Not found' }, corsOrigin)

  try {
    let body = ''
    for await (const chunk of req) body += chunk
    const payload = JSON.parse(body)
    const result = req.url === '/api/analyze' ? await runGeminiAnalysis(payload.product) : await runTerraCartResearch(payload.product, payload.researchType)
    json(res, result.success ? 200 : 400, result, corsOrigin)
  } catch (error) {
    console.error('TerraCart research error:', error)
    json(res, 502, { success: false, error: error instanceof Error ? error.message : 'Research failed. Please try again.' }, corsOrigin)
  }
})

if (!process.env.TAVILY_API_KEY) {
  console.error('TAVILY_API_KEY detected: false')
  console.error('TAVILY_API_KEY is not configured.')
  process.exitCode = 1
} else {
  console.log('TAVILY_API_KEY detected: true')
  console.log('GEMINI_API_KEY detected:', Boolean(process.env.GEMINI_API_KEY))
  server.listen(port, () => console.log(`TerraCart research backend listening on ${port}`))
}
