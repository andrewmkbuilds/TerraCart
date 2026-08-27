import { tavily } from '@tavily/core'

const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash'

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
  if (!product || typeof product.name !== 'string' || !product.name.trim() || typeof product.url !== 'string' || !/^https?:\/\//i.test(product.url) || typeof product.retailer !== 'string' || !product.retailer.trim()) {
    return { success: false, error: 'No product detected. Scan the current shopping page first.' }
  }
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

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const isExtensionOrigin = origin.startsWith('chrome-extension://')
  res.setHeader('Access-Control-Allow-Origin', isExtensionOrigin ? origin : '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(404).json({ success: false, error: 'Not found' })
    return
  }

  try {
    let body = ''
    for await (const chunk of req) body += chunk
    const payload = JSON.parse(body)
    const result = await runGeminiAnalysis(payload.product)
    res.status(result.success ? 200 : 400).json(result)
  } catch (error) {
    console.error('TerraCart analyze error:', error)
    res.status(502).json({ success: false, error: error instanceof Error ? error.message : 'Analysis failed. Please try again.' })
  }
}
