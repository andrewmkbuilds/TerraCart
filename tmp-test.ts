import { createAnalysis } from '/app/src/services/product-service'
import type { DetectedProduct } from '/app/src/types'

const base = {
  url: 'https://example.com/p/1', hostname: 'example.com', retailer: 'example.com',
  certifications: [] as string[], features: [] as string[], specs: {} as Record<string, string>,
  detectedAt: Date.now(),
  detection: { source: 'heuristic' as const, adapter: null, confidence: 20, missing: [] as string[] },
}

const sparse: DetectedProduct = {
  ...base, id: 'p_sparse', name: 'Eco Friendly Bamboo Toothbrush', category: 'personal-care', materials: [],
}
const mug: DetectedProduct = {
  ...base, id: 'p_mug', name: 'Insulated Travel Mug 500ml', brand: 'Northwind', price: 24.95, currency: 'USD',
  category: 'kitchen', materials: ['stainless steel', 'polypropylene'],
  description: 'Double-walled stainless steel body, plastic lid. Packed in recycled cardboard with a plastic bag. Reusable. 5 year warranty.',
  specs: { Material: '18/8 stainless steel, polypropylene lid' },
}

const s = createAnalysis(sparse)
console.log('SPARSE overall:', s.score.overall, s.score.classification, 'conf:', s.score.confidence, 'coverage:', s.score.coverage)
console.log('SPARSE cats:', s.score.categories.map(c => c.key + ':' + c.score).join(','))
console.log('SPARSE unknowns:', s.score.unknowns.length, '| alts:', s.alternatives.map(a => a.title).join(' / '))
const m = createAnalysis(mug)
console.log('MUG score:', m.score.overall, m.score.classification, '| pkg:', m.plastic.packaging.status)
console.log('MUG alts:', m.alternatives.map(a => a.title).join(' / '))
