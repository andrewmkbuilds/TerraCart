import type { DetectedProduct } from '../../types'

/** Builds a detection result with sensible defaults so each test only states what it cares about. */
export function makeProduct(overrides: Partial<DetectedProduct> = {}): DetectedProduct {
  return {
    id: 'test-product',
    name: 'Test product',
    category: 'general',
    url: 'https://shop.example.com/p/test-product',
    hostname: 'shop.example.com',
    retailer: 'shop.example.com',
    materials: [],
    certifications: [],
    features: [],
    specs: {},
    detection: { source: 'heuristic', adapter: null, confidence: 40, missing: [] },
    detectedAt: Date.now(),
    ...overrides,
  }
}