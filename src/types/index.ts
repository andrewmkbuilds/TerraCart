// ============================================================
// TerraCart Core Data Models
// ============================================================

// ---- Product ----
export interface Product {
  id: string
  name: string
  category: ProductCategory
  price: number
  currency: string
  image: string
  images?: string[]
  description: string
  materials: string[]
  durability?: 'low' | 'medium' | 'high'
  reusability?: 'single-use' | 'limited' | 'reusable' | 'highly-reusable'
  repairability?: 'not-repairable' | 'limited' | 'repairable' | 'highly-repairable'
  packaging: PackagingInfo
  retailer: string
  rating: number
  reviewCount: number
  availability: 'in-stock' | 'out-of-stock' | 'limited' | 'unknown'
  url: string
  brand?: string
  size?: string
  weight?: string
  certifications?: string[]
  sustainabilityClaims?: string[]
  features?: string[]
  alternatives?: string[] // IDs of alternative products
  seller?: string
  shippingInfo?: string
  warranty?: string
  categorySpecific?: Record<string, any>
}

export type ProductCategory =
  | 'electronics'
  | 'clothing'
  | 'food'
  | 'school-supplies'
  | 'home'
  | 'cleaning'
  | 'personal-care'
  | 'travel'
  | 'kitchen'
  | 'beverages'
  | 'office'
  | 'fitness'
  | 'other'

// ---- Packaging ----
export interface PackagingInfo {
  type: PackagingType[]
  estimatedWeight: 'minimal' | 'light' | 'moderate' | 'heavy'
  recyclable: boolean | 'unknown'
  recyclableDetails?: string
  description?: string
  layers?: number
  containsPlastic: boolean | 'unknown'
  refillable: boolean | 'unknown'
  bulkAvailable?: boolean
}

export type PackagingType =
  | 'cardboard'
  | 'paper'
  | 'plastic-wrap'
  | 'plastic-container'
  | 'plastic-bag'
  | 'glass'
  | 'metal'
  | 'compostable'
  | 'none'
  | 'mixed'
  | 'unknown'

// ---- Eco Score ----
export interface EcoScore {
  overall: number // 0-10
  breakdown: {
    reusability: number // 0-10
    durability: number // 0-10
    packaging: number // 0-10
    repairability: number // 0-10
    materialConsiderations: number // 0-10
  }
  confidence: 'high' | 'medium' | 'low'
  reasoning: string[]
  sources: ResearchSource[]
  aiGenerated: boolean
  disclaimer: string
}

// ---- AI Verdict ----
export interface AIVerdict {
  level: 'great-choice' | 'good-choice' | 'consider-alternatives' | 'limited-info'
  label: string
  emoji: string
  explanation: string
  confidence: 'high' | 'medium' | 'low'
  factors?: string[]
}

// ---- Alternative ----
export interface Alternative {
  productId: string
  product?: Product
  reason: string
  improvementAreas: string[]
  scoreComparison: {
    original: number
    alternative: number
  }
  priceComparison?: {
    original: number
    alternative: number
    currency: string
  }
  type: 'reusable' | 'refillable' | 'durable' | 'minimal-packaging' | 'better-materials' | 'longer-lasting' | 'similar'
  priority: 'high' | 'medium' | 'low'
}

// ---- Research ----
export interface ResearchSource {
  name: string
  url?: string
  type: 'verified' | 'ai-inference' | 'estimated' | 'manufacturer' | 'retailer' | 'independent'
  reliability: 'high' | 'medium' | 'low'
}

export interface ResearchResult {
  query: string
  sources: ResearchSource[]
  findings: string[]
  confidence: 'high' | 'medium' | 'low'
  timestamp: number
}

export interface ResearchStep {
  label: string
  status: 'pending' | 'in-progress' | 'complete' | 'error'
  detail?: string
}

// ---- Checklist ----
export interface ChecklistItem {
  id: string
  text: string
  category: ChecklistCategory
  checked: boolean
  dynamic: boolean
}

export type ChecklistCategory =
  | 'general'
  | 'before-you-buy'
  | 'electronics'
  | 'clothing'
  | 'food'
  | 'school-supplies'
  | 'cleaning'
  | 'home'
  | 'personal-care'

// ---- User Preferences ----
export interface UserPreferences {
  sustainabilityPriorities: SustainabilityPriority[]
  recommendationStyle: RecommendationStyle
  budgetRange?: { min: number; max: number }
  preferredBrands: string[]
  preferredRetailers: string[]
  sizePreferences: string[]
  notificationsEnabled: boolean
  pauseOnWebsite?: string[]
  enableFloatingButton: boolean
  enableAutoOpenPanel: boolean
  autoOpenDelay: number // seconds before auto-open (0 = instant)
  autoOpenNotification: boolean // show notification when panel auto-opens
  autoOpenProductPagesOnly: boolean // only auto-open on product pages (not search/category)
  chimeVolume: 'off' | 'soft' | 'loud' // auto-open chime sound volume
  enableHistory: boolean
  enablePatternDetection: boolean
  reducedMotion: boolean
}

export type SustainabilityPriority =
  | 'reduce-plastic'
  | 'reduce-packaging'
  | 'buy-reusable'
  | 'buy-durable'
  | 'prefer-repairable'
  | 'reduce-unnecessary-purchases'
  | 'prefer-refillable'
  | 'prefer-recyclable-packaging'
  | 'lower-carbon-footprint'
  | 'ethical-sourcing'

export type RecommendationStyle =
  | 'most-sustainable'
  | 'best-value'
  | 'balanced'
  | 'lowest-price'
  | 'longest-lasting'

// ---- Shopping History ----
export interface HistoryEntry {
  id: string
  productId: string
  product: Partial<Product>
  timestamp: number
  action: 'viewed' | 'analyzed' | 'saved' | 'compared' | 'recommended'
  ecoScore?: number
  category: ProductCategory
}

export interface ShoppingPattern {
  category: ProductCategory
  frequency: number
  lastSeen: number
  products: string[] // product IDs
  type: 'disposable-repeated' | 'durable-repeated' | 'category-frequent'
  suggestion?: string
}

// ---- Saved Products ----
export interface SavedProduct {
  id: string
  product: Product
  savedAt: number
  ecoScore?: number
  notes?: string
  tags?: string[]
}

// ---- Analysis ----
export interface ProductAnalysis {
  productId: string
  product: Product
  ecoScore: EcoScore
  verdict: AIVerdict
  alternatives: Alternative[]
  checklist: ChecklistItem[]
  packagingAnalysis: PackagingAnalysis
  greenwashingDetection?: GreenwashingAlert
  researchSteps: ResearchStep[]
  confidence: 'high' | 'medium' | 'low'
  timestamp: number
  personalizedInsight?: string
}

export interface PackagingAnalysis {
  currentPackaging: PackagingInfo
  packagingScore: number // 0-10
  issues: string[]
  improvements: PackagingImprovement[]
  lessPackagingAlternative?: { description: string; url?: string }
}

export interface PackagingImprovement {
  type: 'refill' | 'bulk' | 'less-packaging' | 'reusable-container' | 'consolidated-shipping' | 'package-free'
  available: boolean
  description: string
  source?: string
}

export interface GreenwashingAlert {
  detected: boolean
  claims: string[]
  warning: string
  confidence: 'high' | 'medium' | 'low'
}

// ---- Comparison ----
export interface ProductComparison {
  products: Product[]
  scores: EcoScore[]
  verdicts: AIVerdict[]
  rankings: ProductRanking[]
  recommendation: string
}

export interface ProductRanking {
  productId: string
  rank: number
  ecoScore: number
  label: string // "Best overall", "Best value", "Lower price"
  reason: string
}

// ---- Impulse Detection ----
export interface ImpulseCheck {
  message: string
  productCategory: ProductCategory
  relatedToCurrentBrowsing: boolean
  userResponse?: 'need-it' | 'just-browsing' | 'remind-later'
}

// ---- Page Scan Result ----
export interface PageScanResult {
  type: 'product-page' | 'search-results' | 'category-page' | 'cart-page' | 'other'
  products: Product[]
  primaryProduct?: Product
  searchQuery?: string
  retailer: string
  pageTitle: string
  timestamp: number
}

// ---- Message Types (Chrome Extension Messaging) ----
export interface ExtensionMessage {
  type: string
  payload: any
  tabId?: number
  timestamp: number
}

// ---- Recommendations ----
export interface RecommendationResult {
  type: 'reusable-alternative' | 'better-packaging' | 'durability' | 'pattern-warning' | 'impulse-check' | 'price-vs-sustainability' | 'long-term-value' | 'do-i-own-this' | 'purchase-timing'
  title: string
  description: string
  products?: Product[]
  product?: Product
  reason: string
  priority: 'high' | 'medium' | 'low'
  dismissed?: boolean
}

// ---- Learning Loop ----
export interface UserInteraction {
  type: 'accepted-recommendation' | 'dismissed-recommendation' | 'chose-price-over-sustainability' | 'chose-sustainability-over-price' | 'asked-for-alternative' | 'saved-product' | 'used-checklist'
  timestamp: number
  productId?: string
  recommendationId?: string
  metadata?: Record<string, any>
}

export interface PreferenceUpdate {
  timestamp: number
  message: string
  previousValue: any
  newValue: any
  reason: string
}
