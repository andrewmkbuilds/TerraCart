import type { DetectedProduct, Preferences, ProductAnalysis } from '../types'
import { createAnalysis } from './product-service'

/**
 * Sample page used only when TerraCart UI is rendered outside Chrome
 * (the hosted preview). The extension itself always analyses the real tab.
 */
const SAMPLE_PRODUCT: DetectedProduct = {
  id: 'p_demo_travel_mug',
  name: 'Northwind Insulated Travel Mug 500ml — Stainless Steel',
  brand: 'Northwind',
  price: 24.95,
  currency: 'USD',
  image: '',
  description:
    'Double-walled 18/8 stainless steel travel mug with a leak-proof lid. Keeps drinks hot for 6 hours. Plastic lid and silicone seal. Packed in recycled cardboard packaging, and the lid arrives in a plastic bag. BPA-free, eco-friendly and reusable for years. 5 year warranty.',
  category: 'kitchen',
  url: 'https://demo.terracart.app/products/northwind-travel-mug',
  hostname: 'demo.terracart.app',
  retailer: 'demo.terracart.app',
  materials: ['stainless steel', 'polypropylene', 'silicone'],
  packaging: 'recycled cardboard box with a plastic bag around the lid',
  certifications: [],
  features: ['5 year warranty', 'Reusable', 'BPA-free lid', 'Keeps drinks hot for 6 hours'],
  specs: {
    Material: '18/8 stainless steel body, polypropylene lid, silicone seal',
    Capacity: '500 ml',
    Warranty: '5 year warranty',
  },
  detection: {
    source: 'json-ld',
    adapter: null,
    confidence: 84,
    missing: ['certifications'],
  },
  detectedAt: Date.now(),
}

export async function demoAnalysis(preferences?: Preferences): Promise<ProductAnalysis> {
  return createAnalysis({ ...SAMPLE_PRODUCT, detectedAt: Date.now() }, preferences)
}

export function demoProduct(): DetectedProduct {
  return { ...SAMPLE_PRODUCT, detectedAt: Date.now() }
}