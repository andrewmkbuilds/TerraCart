import { create } from 'zustand'
import type {
  Product,
  ProductAnalysis,
  UserPreferences,
  HistoryEntry,
  SavedProduct,
  ShoppingPattern,
  PageScanResult,
  ResearchStep,
  RecommendationResult,
  UserInteraction,
  PreferenceUpdate,
} from '../types'

interface TerraCartState {
  // Extension state
  isExtensionActive: boolean
  isPaused: boolean
  currentTabId: number | null
  currentUrl: string | null
  isSidePanelOpen: boolean
  isFirstRun: boolean

  // Current analysis
  currentPageScan: PageScanResult | null
  currentProductAnalysis: ProductAnalysis | null
  isAnalyzing: boolean
  researchSteps: ResearchStep[]
  isResearching: boolean

  // User
  preferences: UserPreferences
  history: HistoryEntry[]
  savedProducts: SavedProduct[]
  patterns: ShoppingPattern[]
  interactions: UserInteraction[]
  preferenceUpdates: PreferenceUpdate[]

  // Recommendations
  recommendations: RecommendationResult[]
  dismissedRecommendations: Set<string>

  // Chat
  chatMessages: ChatMessage[]
  isChatLoading: boolean

  // Actions - Extension
  setExtensionActive: (active: boolean) => void
  setPaused: (paused: boolean) => void
  setCurrentTab: (tabId: number, url: string) => void
  setSidePanelOpen: (open: boolean) => void
  setFirstRun: (firstRun: boolean) => void

  // Actions - Analysis
  setPageScan: (scan: PageScanResult | null) => void
  setProductAnalysis: (analysis: ProductAnalysis | null) => void
  setAnalyzing: (analyzing: boolean) => void
  setResearchSteps: (steps: ResearchStep[]) => void
  updateResearchStep: (index: number, step: Partial<ResearchStep>) => void
  setResearching: (researching: boolean) => void

  // Actions - Preferences
  updatePreferences: (prefs: Partial<UserPreferences>) => void
  setRecommendationStyle: (style: UserPreferences['recommendationStyle']) => void

  // Actions - History & Saved
  addHistoryEntry: (entry: HistoryEntry) => void
  addSavedProduct: (product: SavedProduct) => void
  removeSavedProduct: (id: string) => void
  updatePatterns: (patterns: ShoppingPattern[]) => void
  recordInteraction: (interaction: UserInteraction) => void

  // Actions - Recommendations
  setRecommendations: (recs: RecommendationResult[]) => void
  dismissRecommendation: (id: string) => void

  // Actions - Chat
  addChatMessage: (message: ChatMessage) => void
  setChatLoading: (loading: boolean) => void
  clearChat: () => void

  // Actions - Reset
  clearAllData: () => void
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: {
    productId?: string
    type?: string
    sources?: any[]
  }
}

const defaultPreferences: UserPreferences = {
  sustainabilityPriorities: ['reduce-plastic', 'buy-reusable'],
  recommendationStyle: 'balanced',
  preferredBrands: [],
  preferredRetailers: [],
  sizePreferences: [],
  notificationsEnabled: true,
  enableFloatingButton: true,
  enableAutoOpenPanel: true,
  autoOpenDelay: 2,
  autoOpenNotification: true,
  autoOpenProductPagesOnly: false,
  chimeVolume: 'soft' as const,
  enableHistory: true,
  enablePatternDetection: true,
  reducedMotion: false,
}

export const useTerraStore = create<TerraCartState>((set) => ({
  // Extension state
  isExtensionActive: true,
  isPaused: false,
  currentTabId: null,
  currentUrl: null,
  isSidePanelOpen: false,
  isFirstRun: true,

  // Current analysis
  currentPageScan: null,
  currentProductAnalysis: null,
  isAnalyzing: false,
  researchSteps: [],
  isResearching: false,

  // User
  preferences: defaultPreferences,
  history: [],
  savedProducts: [],
  patterns: [],
  interactions: [],
  preferenceUpdates: [],

  // Recommendations
  recommendations: [],
  dismissedRecommendations: new Set(),

  // Chat
  chatMessages: [],
  isChatLoading: false,

  // Actions - Extension
  setExtensionActive: (active) => set({ isExtensionActive: active }),
  setPaused: (paused) => set({ isPaused: paused }),
  setCurrentTab: (tabId, url) => set({ currentTabId: tabId, currentUrl: url }),
  setSidePanelOpen: (open) => set({ isSidePanelOpen: open }),
  setFirstRun: (firstRun) => set({ isFirstRun: firstRun }),

  // Actions - Analysis
  setPageScan: (scan) => set({ currentPageScan: scan }),
  setProductAnalysis: (analysis) => set({ currentProductAnalysis: analysis }),
  setAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
  setResearchSteps: (steps) => set({ researchSteps: steps }),
  updateResearchStep: (index, step) =>
    set((state) => {
      const newSteps = [...state.researchSteps]
      newSteps[index] = { ...newSteps[index], ...step }
      return { researchSteps: newSteps }
    }),
  setResearching: (researching) => set({ isResearching: researching }),

  // Actions - Preferences
  updatePreferences: (prefs) =>
    set((state) => ({
      preferences: { ...state.preferences, ...prefs },
    })),
  setRecommendationStyle: (style) =>
    set((state) => ({
      preferences: { ...state.preferences, recommendationStyle: style },
    })),

  // Actions - History & Saved
  addHistoryEntry: (entry) =>
    set((state) => ({
      history: [entry, ...state.history].slice(0, 200),
    })),
  addSavedProduct: (product) =>
    set((state) => ({
      savedProducts: [product, ...state.savedProducts],
    })),
  removeSavedProduct: (id) =>
    set((state) => ({
      savedProducts: state.savedProducts.filter((p) => p.id !== id),
    })),
  updatePatterns: (patterns) => set({ patterns }),
  recordInteraction: (interaction) =>
    set((state) => ({
      interactions: [interaction, ...state.interactions].slice(0, 500),
    })),

  // Actions - Recommendations
  setRecommendations: (recs) => set({ recommendations: recs }),
  dismissRecommendation: (id) =>
    set((state) => ({
      dismissedRecommendations: new Set([...state.dismissedRecommendations, id]),
      recommendations: state.recommendations.filter((r) => r.title !== id),
    })),

  // Actions - Chat
  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),
  setChatLoading: (loading) => set({ isChatLoading: loading }),
  clearChat: () => set({ chatMessages: [] }),

  // Actions - Reset
  clearAllData: () =>
    set({
      preferences: defaultPreferences,
      history: [],
      savedProducts: [],
      patterns: [],
      interactions: [],
      preferenceUpdates: [],
      recommendations: [],
      dismissedRecommendations: new Set(),
      chatMessages: [],
      currentProductAnalysis: null,
      currentPageScan: null,
    }),
}))
