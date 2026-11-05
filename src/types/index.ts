// ============================================================
// TerraCart — shared domain types
// ============================================================

export type EvidenceKind = 'verified' | 'inferred' | 'unknown'
export type Confidence = 'high' | 'medium' | 'low'

export type ScoreCategoryKey =
  | 'materials'
  | 'packaging'
  | 'durability'
  | 'circularity'
  | 'certifications'
  | 'sourcing'

export type Classification = 'excellent' | 'good' | 'moderate' | 'poor' | 'very-poor' | 'unknown'

export type DetectionSource =
  | 'json-ld'
  | 'microdata'
  | 'opengraph'
  | 'adapter'
  | 'heuristic'
  | 'manual'

export interface ProductDetectionMeta {
  source: DetectionSource
  adapter: string | null
  confidence: number // 0-100, completeness of detected fields
  missing: string[]
}

export interface DetectedProduct {
  id: string
  name: string
  brand?: string
  price?: number
  currency?: string
  image?: string
  description?: string
  category: string
  url: string
  hostname: string
  retailer: string
  materials: string[]
  packaging?: string
  certifications: string[]
  features: string[]
  specs: Record<string, string>
  detection: ProductDetectionMeta
  detectedAt: number
}

export interface ScoreCategoryResult {
  key: ScoreCategoryKey
  label: string
  weight: number
  /** 0-100, or null when there is no evidence for this category. */
  score: number | null
  evidenceKind: EvidenceKind
  note: string
  evidence: string[]
}

export interface TerraScore {
  /** null when no category could be scored — never faked. */
  overall: number | null
  classification: Classification
  confidence: Confidence
  /** Share of the total weight backed by evidence, 0-100. */
  coverage: number
  categories: ScoreCategoryResult[]
  positives: string[]
  concerns: string[]
  unknowns: string[]
  unverifiedClaims: string[]
}

export interface PlasticSignal {
  status: 'plastic-free' | 'contains-plastic' | 'unknown'
  kind: EvidenceKind
  evidence: string[]
}

export interface PlasticAssessment {
  product: PlasticSignal
  packaging: PlasticSignal
  confidence: Confidence
}

export interface AlternativeSuggestion {
  id: string
  title: string
  material: string
  category: string
  reason: string
  reusable: boolean
  plasticFree: boolean
  /** TerraScore the material profile would typically reach, used for sorting only. */
  materialScore: number
  searchQuery: string
  searchUrl: string
  sourceLabel: string
}

export interface ProductAnalysis {
  product: DetectedProduct
  score: TerraScore
  plastic: PlasticAssessment
  alternatives: AlternativeSuggestion[]
  insights: string[]
  disclaimer: string
  analysedAt: number
}

export type AlternativeFilter =
  | 'highest-score'
  | 'most-reusable'
  | 'plastic-free'
  | 'best-value'

// ---- Checklist ----
export interface ChecklistItem {
  id: string
  name: string
  category: string
  quantity: number
  note: string
  purchased: boolean
  url?: string
  image?: string
  price?: number
  currency?: string
  score: number | null
  reusable: boolean
  plasticPackaging: boolean | 'unknown'
  hasEnvironmentalInfo: boolean
  addedAt: number
  purchasedAt?: number
}

export interface ChecklistSummary {
  count: number
  averageScore: number | null
  reusableCount: number
  plasticPackagingCount: number
  missingInfoCount: number
}

// ---- Reminders ----
export interface Reminder {
  id: string
  label: string
  enabled: boolean
  time: string // "HH:MM", 24h
  days: number[] // 0 = Sunday … 6 = Saturday
  custom: boolean
  lastNotified?: number
}

// ---- Points / gamification ----
export type PointAction =
  | 'analyse-product'
  | 'save-product'
  | 'add-reusable-item'
  | 'open-alternative'
  | 'plastic-free-purchase'
  | 'challenge-complete'

export interface PointsEvent {
  id: string
  action: PointAction | 'achievement'
  label: string
  points: number
  timestamp: number
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlockedAt?: number
}

export interface Challenge {
  id: string
  label: string
  target: number
  progress: number
  reward: number
  claimed: boolean
}

export interface ChallengeWeek {
  weekId: string
  items: Challenge[]
}

export interface PointsState {
  points: number
  events: PointsEvent[]
  achievements: Record<string, number> // achievement id → unlocked timestamp
  challengeWeek: ChallengeWeek
  streak: {
    current: number
    longest: number
    lastActiveDate: string | null
  }
  counters: {
    analyses: number
    reusableItemsAdded: number
    plasticFreePurchases: number
    alternativesOpened: number
    featuresUsed: string[]
    dailyAnalyses: Record<string, string[]> // yyyy-mm-dd → product ids
    awardedKeys: Record<string, number>
  }
}

export interface LevelInfo {
  level: number
  name: string
  min: number
  next: number | null
  progress: number
}

// ---- Preferences ----
export type PriorityKey =
  | 'plastic-reduction'
  | 'reusability'
  | 'recyclability'
  | 'durability'
  | 'ethical-sourcing'
  | 'low-impact'

export interface Preferences {
  priorities: PriorityKey[]
  preferredCategories: string[]
  notificationsEnabled: boolean
  floatingLauncher: boolean
  reduceMotion: boolean
  compactMode: boolean
  saveHistory: boolean
  cloudSync: boolean
  onboarded: boolean
}

// ---- History ----
export interface AnalysisRecord {
  id: string
  productId: string
  name: string
  brand?: string
  image?: string
  price?: number
  currency?: string
  hostname: string
  url: string
  score: number | null
  classification: Classification
  analysedAt: number
}

export interface SavedProduct {
  id: string
  productId: string
  name: string
  brand?: string
  image?: string
  url: string
  hostname: string
  score: number | null
  savedAt: number
}

// ---- Tab context passed between content script, background and popup ----
export interface TabContext {
  tabId: number | null
  url: string
  hostname: string
  title: string
  supported: boolean
  analysis: ProductAnalysis | null
  detectedAt?: number
}

// ---- Base44 sync ----
export type SyncStatus = 'unconfigured' | 'signed-out' | 'connected' | 'error'

export interface SyncSnapshot {
  checklist: ChecklistItem[]
  saved: SavedProduct[]
  points: PointsState
  preferences: Preferences
  reminders: Reminder[]
  updatedAt: number
}

export interface SyncState {
  status: SyncStatus
  email?: string
  lastSyncedAt?: number
  message?: string
}