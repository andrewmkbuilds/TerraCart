import type { Product, PageScanResult, ProductCategory } from '../types'

export interface RetailerAdapter {
  name: string
  hostname: string
  canHandle(url: string): boolean
  extractProduct(document: Document, url: string): Product | null
  extractSearchResults(document: Document, url: string): Product[]
  extractSearchQuery(url: string): string | null
  scanPage(document: Document, url: string): PageScanResult
}

export interface RetailerConfig {
  adapter: RetailerAdapter
  enabled: boolean
}
