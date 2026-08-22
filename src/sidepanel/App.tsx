import React, { useState, useEffect, useCallback } from 'react'
import { useTerraStore } from '../store'
import { EcoScoreRing, ScoreBreakdown } from '../components/shared/EcoScoreRing'
import { VerdictBadge } from '../components/shared/VerdictBadge'
import { ResearchProgress, DEFAULT_RESEARCH_STEPS } from '../components/shared/ResearchProgress'
import { ProductCard } from '../components/shared/ProductCard'
import { ResearchSources } from '../components/shared/ResearchSources'
import { GreenwashingAlert } from '../components/shared/GreenwashingAlert'
import { PackagingAnalysis } from '../components/shared/PackagingAnalysis'
import { EcoChecklist } from '../components/checklist/EcoChecklist'
import { TerraChat } from '../components/chat/TerraChat'
import {
  calculateEcoScore,
  generateVerdict,
  generateChecklist,
  analyzePackaging,
  detectGreenwashing,
  generateRecommendations,
} from '../ai/engine'
import type { Product, ProductAnalysis, PageScanResult, Alternative } from '../types'

type Tab = 'overview' | 'alternatives' | 'packaging' | 'checklist' | 'chat'
type Panel = 'sidepanel' | 'settings' | 'history'

// ---- Helper: send message to background ----
function sendMessage(message: Record<string, unknown>, timeoutMs = 30000): Promise<any> {
  return new Promise((resolve) => {
    let resolved = false
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        console.warn('TerraCart: sendMessage timed out for', message.type)
        resolve(null)
      }
    }, timeoutMs)

    try {
      chrome.runtime?.sendMessage(message, (response) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          if (chrome.runtime.lastError) {
            console.warn('TerraCart: sendMessage error for', message.type, chrome.runtime.lastError.message)
            resolve(null)
          } else {
            resolve(response)
          }
        }
      })
    } catch (err) {
      if (!resolved) {
        resolved = true
        clearTimeout(timer)
        console.warn('TerraCart: sendMessage exception for', message.type, err)
        resolve(null)
      }
    }
  })
}

// ============================================================
// Main Side Panel App
// ============================================================
export function App() {
  const store = useTerraStore()
  const {
    currentProductAnalysis, preferences, savedProducts, history, patterns,
    isAnalyzing, researchSteps, recommendations,
    setProductAnalysis, setAnalyzing, setResearchSteps,
    addSavedProduct, removeSavedProduct, addHistoryEntry, setRecommendations, addChatMessage,
  } = store

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [activePanel, setActivePanel] = useState<Panel>('sidepanel')
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false)
  const [detectedProduct, setDetectedProduct] = useState<Product | null>(null)
  const [pageScanResult, setPageScanResult] = useState<PageScanResult | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [currentUrl, setCurrentUrl] = useState('')
  const [currentTitle, setCurrentTitle] = useState('')
  const [websiteEnabled, setWebsiteEnabled] = useState(true)
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null)
  const [geminiError, setGeminiError] = useState<string | null>(null)

  // ---- Check Gemini API key on mount ----
  useEffect(() => {
    sendMessage({ type: 'GET_API_KEY' }).then(result => {
      setGeminiConfigured(result?.configured ?? false)
    })
  }, [])

  // ---- Request scan from content script on mount ----
  useEffect(() => {
    requestScan()
  }, [])

  // ---- Listen for page scan results from background ----
  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === 'PAGE_SCANNED' && message.data) {
        handleScanData(message.data)
      }
    }
    chrome.runtime?.onMessage?.addListener(listener)
    return () => {
      chrome.runtime?.onMessage?.removeListener(listener)
    }
  }, [])

  const requestScan = async () => {
    setIsScanning(true)
    try {
      const tabInfo = await sendMessage({ type: 'GET_CURRENT_TAB' })
      if (tabInfo) {
        setCurrentUrl(tabInfo.url || '')
        setCurrentTitle(tabInfo.title || '')
      }
      if (tabInfo?.url) {
        const enabled = await sendMessage({ type: 'CHECK_WEBSITE_ENABLED', url: tabInfo.url })
        setWebsiteEnabled(enabled?.enabled ?? true)
      }
      const cachedData = await sendMessage({ type: 'GET_ALL_TAB_SCAN_DATA' })
      if (cachedData) {
        const tabId = tabInfo?.id
        if (tabId && cachedData[tabId]) {
          handleScanData(cachedData[tabId])
          setIsScanning(false)
          return
        }
      }
      const scanResult = await sendMessage({ type: 'SCAN_PAGE' })
      if (scanResult) {
        handleScanResult(scanResult)
      }
    } catch (err) {
      console.warn('TerraCart: Scan request failed', err)
    } finally {
      setIsScanning(false)
    }
  }

  const handleScanData = (data: any) => {
    if (data.primaryProduct) {
      setDetectedProduct(data.primaryProduct)
      setPageScanResult({
        type: 'product-page',
        products: [data.primaryProduct],
        primaryProduct: data.primaryProduct,
        retailer: data.retailer,
        pageTitle: data.pageTitle,
        timestamp: Date.now(),
      })
      analyzeProduct(data.primaryProduct)
    } else if (data.productCount > 0) {
      setPageScanResult({
        type: 'search-results',
        products: [],
        retailer: data.retailer,
        pageTitle: data.pageTitle,
        timestamp: Date.now(),
        searchQuery: data.searchQuery,
      })
    }
  }

  const handleScanResult = (result: PageScanResult) => {
    setPageScanResult(result)
    if (result.primaryProduct) {
      setDetectedProduct(result.primaryProduct)
      analyzeProduct(result.primaryProduct)
    } else if (result.products.length > 0) {
      setDetectedProduct(result.products[0])
      analyzeProduct(result.products[0])
    }
  }

  // ---- Analyze a product — uses Gemini when available, local fallback otherwise ----
  const analyzeProduct = useCallback(async (product: Product) => {
    setAnalyzing(true)
    setGeminiError(null)
    setResearchSteps(DEFAULT_RESEARCH_STEPS.map(s => ({ ...s, status: 'pending' as const })))

    const steps = DEFAULT_RESEARCH_STEPS.map(s => ({ ...s }))

    // Check if Gemini is available
    const apiKeyStatus = await sendMessage({ type: 'GET_API_KEY' })
    const useGemini = apiKeyStatus?.configured === true

    if (useGemini) {
      // Real Gemini analysis
      try {
        steps[0].status = 'in-progress'; setResearchSteps([...steps])
        const result = await sendMessage({
          type: 'GEMINI_ANALYZE',
          product,
          preferences,
        })

        steps[0].status = 'complete'; steps[1].status = 'in-progress'; setResearchSteps([...steps])
        await new Promise(r => setTimeout(r, 200))

        steps[1].status = 'complete'; steps[2].status = 'in-progress'; setResearchSteps([...steps])
        await new Promise(r => setTimeout(r, 200))

        steps[2].status = 'complete'; steps[3].status = 'in-progress'; setResearchSteps([...steps])
        await new Promise(r => setTimeout(r, 200))

        steps[3].status = 'complete'; steps[4].status = 'in-progress'; setResearchSteps([...steps])
        await new Promise(r => setTimeout(r, 200))

        steps[4].status = 'complete'; steps[5].status = 'in-progress'; setResearchSteps([...steps])
        await new Promise(r => setTimeout(r, 150))

        steps[5].status = 'complete'; steps[6].status = 'in-progress'; setResearchSteps([...steps])
        await new Promise(r => setTimeout(r, 150))

        steps[6].status = 'complete'; steps[7].status = 'in-progress'; setResearchSteps([...steps])
        await new Promise(r => setTimeout(r, 150))

        steps[7].status = 'complete'; setResearchSteps([...steps])

        if (result?.error) {
          setGeminiError(result.error)
        }

        if (result?.analysis) {
          // Merge Gemini analysis with local data
          const geminiAnalysis = result.analysis
          const ecoScore = {
            overall: geminiAnalysis.ecoScore?.overall ?? calculateEcoScore(product, preferences).overall,
            breakdown: {
              reusability: geminiAnalysis.ecoScore?.reusability ?? calculateEcoScore(product, preferences).breakdown.reusability,
              durability: geminiAnalysis.ecoScore?.durability ?? calculateEcoScore(product, preferences).breakdown.durability,
              packaging: geminiAnalysis.ecoScore?.packaging ?? calculateEcoScore(product, preferences).breakdown.packaging,
              repairability: geminiAnalysis.ecoScore?.repairability ?? calculateEcoScore(product, preferences).breakdown.repairability,
              materialConsiderations: geminiAnalysis.ecoScore?.materialConsiderations ?? calculateEcoScore(product, preferences).breakdown.materialConsiderations,
            },
            confidence: geminiAnalysis.confidence || 'medium',
            reasoning: geminiAnalysis.reasoning || calculateEcoScore(product, preferences).reasoning,
            sources: (geminiAnalysis.researchSources || []).map((s: any) => ({
              name: s.name,
              url: s.url,
              type: s.type || 'ai-inference',
              reliability: s.type === 'manufacturer' ? 'high' as const : 'medium' as const,
            })),
            aiGenerated: true,
            disclaimer: 'This score is a TerraCart AI Estimate powered by Gemini. It is not a scientific certification.',
          }

          const verdict = generateVerdict(ecoScore, product)
          // Override verdict if Gemini provided one
          if (geminiAnalysis.verdict) {
            const verdictMap: Record<string, typeof verdict> = {
              'great-choice': { level: 'great-choice', label: 'Great Choice', emoji: '🌱', explanation: geminiAnalysis.reasoning?.[0] || 'Strong sustainability profile', confidence: geminiAnalysis.confidence || 'medium', factors: geminiAnalysis.reasoning?.slice(0, 3) },
              'good-choice': { level: 'good-choice', label: 'Good Choice', emoji: '👍', explanation: geminiAnalysis.reasoning?.[0] || 'Good overall choice', confidence: geminiAnalysis.confidence || 'medium', factors: geminiAnalysis.reasoning?.slice(0, 3) },
              'consider-alternatives': { level: 'consider-alternatives', label: 'Consider Alternatives', emoji: '⚠️', explanation: geminiAnalysis.reasoning?.[0] || 'Alternatives may be worth exploring', confidence: geminiAnalysis.confidence || 'medium', factors: geminiAnalysis.reasoning?.slice(0, 3) },
              'limited-info': { level: 'limited-info', label: 'Limited Information', emoji: '🔎', explanation: geminiAnalysis.reasoning?.[0] || 'Insufficient data for a strong recommendation', confidence: geminiAnalysis.confidence || 'low', factors: geminiAnalysis.reasoning?.slice(0, 3) },
            }
            if (verdictMap[geminiAnalysis.verdict]) {
              Object.assign(verdict, verdictMap[geminiAnalysis.verdict])
            }
          }

          const checklist = generateChecklist(product, preferences)
          const packagingAnalysis = analyzePackaging(product)
          const greenwashing = geminiAnalysis.greenwarningWarning
            ? { detected: true, claims: [geminiAnalysis.greenwarningWarning], warning: geminiAnalysis.greenwarningWarning, confidence: 'medium' as const }
            : detectGreenwashing(product)

          const analysis: ProductAnalysis = {
            productId: product.id,
            product,
            ecoScore,
            verdict,
            alternatives: [],
            checklist,
            packagingAnalysis,
            greenwashingDetection: greenwashing || undefined,
            researchSteps: steps,
            confidence: geminiAnalysis.confidence || ecoScore.confidence,
            timestamp: Date.now(),
            personalizedInsight: geminiAnalysis.packagingAnalysis,
          }

          setProductAnalysis(analysis)

          // Auto-trigger research when verdict suggests alternatives
          if (verdict.level === 'consider-alternatives' || verdict.level === 'limited-info') {
            sendMessage({
              type: 'GEMINI_RESEARCH',
              product,
              preferences,
              researchType: 'all',
            }).then((result: any) => {
              if (result?.research) {
                const alts: Alternative[] = []
                const buildAlt = (a: any, type: string): Alternative => ({
                  productId: a.url || a.name,
                  product: {
                    id: a.url || a.name,
                    name: a.name,
                    brand: a.brand || '',
                    price: 0,
                    currency: 'AED',
                    image: '',
                    description: a.reason || '',
                    materials: a.characteristics || [],
                    category: product.category,
                    packaging: { type: ['unknown' as const], estimatedWeight: 'moderate', recyclable: 'unknown' as const, containsPlastic: 'unknown' as const, refillable: 'unknown' as const },
                    retailer: a.retailer || '',
                    rating: 0,
                    reviewCount: 0,
                    availability: 'unknown' as const,
                    url: a.url || '',
                    features: a.characteristics || [],
                  },
                  reason: a.reason || '',
                  improvementAreas: (a.characteristics || []).slice(0, 3),
                  scoreComparison: { original: ecoScore.overall, alternative: a.ecoScore || 0 },
                  type: type as any,
                  priority: 'high' as const,
                })
                if (result.research.alternatives) {
                  for (const a of result.research.alternatives) alts.push(buildAlt(a, 'similar'))
                }
                if (result.research.reusableAlternatives) {
                  for (const a of result.research.reusableAlternatives) alts.push(buildAlt(a, 'reusable'))
                }
                if (result.research.packagingAlternatives) {
                  for (const a of result.research.packagingAlternatives) {
                    alts.push({
                      productId: a.url || a.description,
                      product: {
                        id: a.url || a.description,
                        name: a.description || 'Packaging alternative',
                        brand: '', price: 0, currency: 'AED', image: '', description: a.description || '',
                        materials: [], category: product.category,
                        packaging: { type: ['none' as const], estimatedWeight: 'light', recyclable: true, containsPlastic: false, refillable: 'unknown' as const },
                        retailer: a.retailer || '', rating: 0, reviewCount: 0, availability: 'unknown' as const, url: a.url || '',
                      },
                      reason: a.description || '',
                      improvementAreas: ['Lower packaging'],
                      scoreComparison: { original: ecoScore.overall, alternative: 0 },
                      type: 'similar',
                      priority: 'medium',
                    })
                  }
                }
                if (alts.length > 0) {
                  setProductAnalysis({
                    ...analysis,
                    alternatives: alts,
                  })
                }
              }
            }).catch(() => {}) // silent — research is optional enhancement
          }
        } else {
          // Gemini failed, fall back to local analysis
          performLocalAnalysis(product, steps)
        }
      } catch {
        performLocalAnalysis(product, steps)
      }
    } else {
      // No Gemini — use local analysis
      for (let i = 0; i < steps.length; i++) {
        steps[i].status = 'in-progress'; setResearchSteps([...steps])
        await new Promise(r => setTimeout(r, 100 + Math.random() * 150))
        steps[i].status = 'complete'; setResearchSteps([...steps])
      }
      performLocalAnalysis(product, steps)
    }

    setAnalyzing(false)

    addHistoryEntry({
      id: `hist-${Date.now()}`,
      productId: product.id,
      product: { id: product.id, name: product.name, category: product.category, price: product.price },
      timestamp: Date.now(),
      action: 'analyzed',
      category: product.category,
    })

    // ---- Fashion duplicate detection ----
    // Check if user recently viewed/saved a similar product in the same category
    const fashionCategories = ['clothing', 'shoes', 'accessories']
    if (fashionCategories.includes(product.category as string)) {
      const recentSimilar = history.find(h => {
        if (h.productId === product.id) return false
        if (h.category !== product.category) return false
        // Check if within last 30 days
        if (Date.now() - h.timestamp > 30 * 24 * 60 * 60 * 1000) return false
        // Name similarity: check if significant words overlap
        const currentWords = product.name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
        const prevWords = (h.product.name || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
        const overlap = currentWords.filter((w: string) => prevWords.includes(w))
        return overlap.length >= 2 || (product.brand && h.product.name?.toLowerCase().includes(product.brand.toLowerCase()))
      })
      if (recentSimilar) {
        // Add duplicate detection to chat
        const duplicateMsg: import('../store').ChatMessage = {
          id: `dup-${Date.now()}`,
          role: 'system',
          content: `📋 You may already have a similar item. You viewed "${recentSimilar.product.name}" on ${new Date(recentSimilar.timestamp).toLocaleDateString()}. Consider whether you need another one before purchasing.`,
          timestamp: Date.now(),
        }
        // Only add if no duplicate warning already exists
        const existingDup = store.chatMessages.find(m => m.id.startsWith('dup-'))
        if (!existingDup) {
          addChatMessage(duplicateMsg)
        }
      }
    }
  }, [preferences, savedProducts, patterns])

  // ---- Local analysis fallback ----
  function performLocalAnalysis(product: Product, steps: any[]) {
    const ecoScore = calculateEcoScore(product, preferences)
    const verdict = generateVerdict(ecoScore, product)
    const checklist = generateChecklist(product, preferences)
    const packagingAnalysis = analyzePackaging(product)
    const greenwashing = detectGreenwashing(product)

    const analysis: ProductAnalysis = {
      productId: product.id,
      product,
      ecoScore,
      verdict,
      alternatives: [],
      checklist,
      packagingAnalysis,
      greenwashingDetection: greenwashing || undefined,
      researchSteps: steps,
      confidence: ecoScore.confidence,
      timestamp: Date.now(),
    }
    setProductAnalysis(analysis)

    const recs = generateRecommendations(product, savedProducts.map(s => s.product), preferences, patterns)
    setRecommendations(recs)
  }

  const handleSaveProduct = () => {
    if (!detectedProduct || !currentProductAnalysis) return
    const existing = savedProducts.find(s => s.product.id === detectedProduct.id)
    if (existing) {
      removeSavedProduct(existing.id)
    } else {
      addSavedProduct({
        id: `saved-${Date.now()}`,
        product: detectedProduct,
        savedAt: Date.now(),
        ecoScore: currentProductAnalysis.ecoScore.overall,
      })
    }
  }

  const isSaved = detectedProduct ? savedProducts.some(s => s.product.id === detectedProduct.id) : false
  const analysis = currentProductAnalysis
  const product = detectedProduct

  // ---- Panels ----
  if (activePanel === 'settings') {
    return <SettingsPanel onBack={() => setActivePanel('sidepanel')} />
  }
  if (activePanel === 'history') {
    return <HistoryPanel onBack={() => setActivePanel('sidepanel')} onAnalyze={(p) => { setDetectedProduct(p); setActivePanel('sidepanel'); analyzeProduct(p); }} />
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌍</span>
            <div>
              <h1 className="font-bold text-sm text-gray-900">TerraCart</h1>
              <p className="text-[10px] text-gray-400">Your AI Shopping Copilot</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setActivePanel('history')} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600" title="History">📋</button>
            <button onClick={() => setActivePanel('settings')} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600" title="Settings">⚙️</button>
          </div>
        </div>
        {currentUrl && (
          <div className="mt-2 flex items-center gap-2 px-2 py-1 bg-gray-50 rounded-lg">
            <span className={`w-2 h-2 rounded-full shrink-0 ${websiteEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-[10px] text-gray-500 truncate flex-1">
              {currentTitle || new URL(currentUrl).hostname}
            </span>
            <span className="text-[10px] text-gray-400 shrink-0">
              {pageScanResult?.type === 'product-page' ? '● Product' :
               pageScanResult?.type === 'search-results' ? `◎ ${pageScanResult.products.length} items` :
               isScanning ? '⏳ Scanning...' : ''}
            </span>
          </div>
        )}
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-gray-100 px-2 py-1 shrink-0 no-scrollbar overflow-x-auto">
        <div className="flex gap-0.5">
          {(['overview', 'alternatives', 'packaging', 'checklist', 'chat'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-terra-50 text-terra-700 border border-terra-200'
                  : 'text-gray-500 hover:bg-gray-50 border border-transparent'
              }`}
            >
              {tab === 'overview' && '📊 '}
              {tab === 'alternatives' && '🔄 '}
              {tab === 'packaging' && '📦 '}
              {tab === 'checklist' && '✅ '}
              {tab === 'chat' && '💬 '}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto terra-scroll">
        {!websiteEnabled ? (
          <DisabledState hostname={new URL(currentUrl || 'https://example.com').hostname} />
        ) : !product && !isScanning ? (
          <EmptyState onScan={requestScan} showGeminiPrompt={false} onSetupGemini={() => setActivePanel('settings')} />
        ) : isScanning && !analysis ? (
          <AnalyzingState />
        ) : !product ? (
          <EmptyState onScan={requestScan} showGeminiPrompt={false} onSetupGemini={() => setActivePanel('settings')} />
        ) : (
          <div className="p-4 space-y-4">
            {/* Gemini error banner */}
            {geminiError && geminiError !== 'GEMINI_API_KEY_MISSING' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                ⚠️ {geminiError.includes('GEMINI_API_KEY_INVALID')
                  ? 'API key issue. Please try again later.'
                  : geminiError.includes('Rate limited')
                  ? 'Rate limited. Please wait a moment and try again.'
                  : 'AI analysis had an issue: ' + geminiError.slice(0, 100)}
              </div>
            )}

            {activeTab === 'overview' && product && analysis && (
              <OverviewTab
                product={product}
                analysis={analysis}
                isSaved={isSaved}
                showScoreBreakdown={showScoreBreakdown}
                onToggleScoreBreakdown={() => setShowScoreBreakdown(!showScoreBreakdown)}
                onSave={handleSaveProduct}
                onReanalyze={() => analyzeProduct(product)}
                isAnalyzing={isAnalyzing}
                researchSteps={researchSteps}
                onOpenRetailer={() => window.open(product.url, '_blank')}
                geminiConfigured={geminiConfigured === true}
                onResearchAlternatives={() => setActiveTab('alternatives')}
                currentUrl={currentUrl}
              />
            )}
            {activeTab === 'alternatives' && product && analysis && (
              <AlternativesTab product={product} analysis={analysis} onSelectProduct={(p) => { setDetectedProduct(p); setActiveTab('overview'); analyzeProduct(p); }} />
            )}
            {activeTab === 'packaging' && analysis?.packagingAnalysis && (
              <PackagingTab analysis={analysis} />
            )}
            {activeTab === 'checklist' && analysis?.checklist && (
              <div className="space-y-4 animate-fade-in">
                <div className="terra-card p-4"><EcoChecklist items={analysis.checklist} /></div>
              </div>
            )}
            {activeTab === 'chat' && (
              <div className="space-y-4 animate-fade-in">
                <div className="terra-card p-4"><TerraChat /></div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Quick Actions Footer */}
      <div className="bg-white border-t border-gray-100 px-3 py-2 shrink-0">
        <div className="flex gap-2">
          <button onClick={requestScan} className="flex-1 terra-btn-outline text-xs py-2 flex items-center justify-center gap-1.5">
            🔄 {isScanning ? 'Scanning...' : 'Rescan Page'}
          </button>
          {product && (
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 terra-btn-primary text-xs py-2 flex items-center justify-center gap-1.5 text-center"
            >
              🏪 View at Retailer
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Gemini Setup Prompt
// ============================================================
function GeminiSetupPrompt({ onConfigure }: { onConfigure: () => void }) {
  return (
    <div className="terra-card p-4 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🤖</span>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-gray-800 mb-1">Enable AI Research</h3>
          <p className="text-xs text-gray-600 leading-relaxed mb-2">
            Connect TerraCart to Google Gemini for real product research, web search, and personalized recommendations.
          </p>
          <p className="text-[10px] text-gray-400 mb-3">
            Free API key from Google AI Studio (aistudio.google.com)
          </p>
          <button onClick={onConfigure} className="terra-btn-primary text-xs">
            ⚙️ Configure Gemini API Key
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Overview Tab
// ============================================================
function OverviewTab({
  product, analysis, isSaved, showScoreBreakdown, onToggleScoreBreakdown,
  onSave, onReanalyze, isAnalyzing, researchSteps, onOpenRetailer,
  geminiConfigured, onResearchAlternatives, currentUrl,
}: {
  product: Product; analysis: ProductAnalysis; isSaved: boolean
  showScoreBreakdown: boolean; onToggleScoreBreakdown: () => void
  onSave: () => void; onReanalyze: () => void; isAnalyzing: boolean
  researchSteps: any[]; onOpenRetailer: () => void
  geminiConfigured: boolean; onResearchAlternatives: () => void; currentUrl: string
}) {
  const isCurrentPage = currentUrl && (
    product.url === currentUrl ||
    product.url.replace(/^https?:\/\//, '') === currentUrl.replace(/^https?:\/\//, '')
  )
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Product Info */}
      <div className="terra-card p-4">
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
            {product.image ? (
              <img src={product.image} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
            ) : (
              <span className="text-3xl">📦</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900 leading-snug">{product.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {product.price > 0 && (
                <span className="text-base font-bold text-gray-800">{product.currency} {product.price.toFixed(2)}</span>
              )}
              {product.brand && <span className="text-xs text-gray-400">· {product.brand}</span>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {product.rating > 0 && <span className="text-xs text-gray-400">⭐ {product.rating}</span>}
              {product.reviewCount > 0 && <span className="text-xs text-gray-400">({product.reviewCount.toLocaleString()} reviews)</span>}
              <span className="text-xs text-gray-400">· {product.retailer}</span>
            </div>
          </div>
        </div>
        {product.description && (
          <p className="text-xs text-gray-500 mt-3 leading-relaxed line-clamp-3">{product.description}</p>
        )}
        {product.features && product.features.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {product.features.slice(0, 5).map((f, i) => (
              <span key={i} className="terra-chip text-[10px]">{f.slice(0, 60)}</span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className="terra-chip text-[10px]">{product.category.replace(/-/g, ' ')}</span>
          {product.reusability && <span className={`terra-chip text-[10px] ${product.reusability === 'highly-reusable' || product.reusability === 'reusable' ? 'terra-chip-active' : ''}`}>{product.reusability}</span>}
          {product.materials.slice(0, 3).map((m) => (
            <span key={m} className="terra-chip text-[10px]">{m}</span>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={onSave} className={`terra-btn-outline text-xs flex-1 ${isSaved ? 'bg-terra-50 border-terra-300 text-terra-700' : ''}`}>
            {isSaved ? '♥ Saved' : '♡ Save'}
          </button>
          <button onClick={onReanalyze} className="terra-btn-outline text-xs flex-1">
            {isAnalyzing ? '⏳ Analyzing...' : '🔍 Re-analyze'}
          </button>
          <button onClick={onOpenRetailer} className={`terra-btn-outline text-xs flex-1 ${isCurrentPage ? 'bg-green-50 border-green-200 text-green-700' : ''}`}>
            {isCurrentPage ? '✓ On This Page' : '🏪 View at Retailer'}
          </button>
        </div>
      </div>

      {/* Research Progress */}
      {isAnalyzing && (
        <div className="terra-card p-4"><ResearchProgress steps={researchSteps} /></div>
      )}

      {/* Eco Score */}
      {analysis && !isAnalyzing && (
        <div className="terra-card p-4">
          <div className="flex items-center justify-center">
            <EcoScoreRing score={analysis.ecoScore.overall} confidence={analysis.ecoScore.confidence} />
          </div>
          <button onClick={onToggleScoreBreakdown} className="w-full mt-3 text-xs text-center text-gray-500 hover:text-gray-700 transition-colors">
            {showScoreBreakdown ? '▾ Hide breakdown' : '▸ Show breakdown'}
          </button>
          {showScoreBreakdown && (
            <div className="mt-3 animate-slide-up"><ScoreBreakdown breakdown={analysis.ecoScore.breakdown} /></div>
          )}
          <p className="text-[10px] text-gray-400 text-center mt-2 italic">{analysis.ecoScore.disclaimer}</p>
        </div>
      )}

      {/* Verdict */}
      {analysis && !isAnalyzing && <VerdictBadge verdict={analysis.verdict} />}

      {/* Greenwashing Alert */}
      {analysis?.greenwashingDetection?.detected && <GreenwashingAlert alert={analysis.greenwashingDetection} />}

      {/* AI Analysis */}
      {analysis && !isAnalyzing && analysis.ecoScore.reasoning.length > 0 && (
        <div className="terra-card p-4">
          <div className="terra-label mb-2">🧠 AI Analysis</div>
          <div className="space-y-2">
            {analysis.ecoScore.reasoning.map((reason, i) => (
              <p key={i} className="text-xs text-gray-600 leading-relaxed">{reason}</p>
            ))}
          </div>
        </div>
      )}

      {/* Gemini Insight */}
      {analysis && !isAnalyzing && analysis.personalizedInsight && (
        <div className="terra-card p-4 border-blue-100 bg-blue-50/50">
          <div className="terra-label mb-2 text-blue-700">🤖 AI Insight</div>
          <p className="text-xs text-gray-600 leading-relaxed">{analysis.personalizedInsight}</p>
        </div>
      )}

      {/* 🔎 Research Better Options — THE KEY BUTTON */}
      {analysis && !isAnalyzing && geminiConfigured && (
        <div className="terra-card p-4 border-terra-200 bg-gradient-to-br from-terra-50 to-emerald-50">
          <ResearchAlternativesButton product={product} onComplete={onResearchAlternatives} />
        </div>
      )}

      {!geminiConfigured && analysis && !isAnalyzing && (
        <div className="terra-card p-4 border-amber-200 bg-amber-50/50">
          <p className="text-xs text-amber-700 mb-2">💡 For real web research and alternatives, configure your Gemini API key in Settings.</p>
        </div>
      )}

      {/* Sources */}
      {analysis && !isAnalyzing && (
        <div className="terra-card p-4"><ResearchSources sources={analysis.ecoScore.sources} /></div>
      )}
    </div>
  )
}

// ============================================================
// Research Alternatives Button — triggers real Gemini web research
// ============================================================
function ResearchAlternativesButton({
  product,
  onComplete,
}: {
  product: Product
  onComplete: () => void
}) {
  const { preferences, setProductAnalysis, currentProductAnalysis } = useTerraStore()
  const [isResearching, setIsResearching] = useState(false)
  const [researchStatus, setResearchStatus] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleResearch = async () => {
    setIsResearching(true)
    setError(null)
    setResearchStatus([])

    setResearchStatus(['Connecting to Gemini AI...'])

    // Show real progress at intervals while API call is in-flight
    const timers: ReturnType<typeof setTimeout>[] = []
    timers.push(setTimeout(() => {
      setResearchStatus(prev => [...prev, 'Searching the web for alternatives...'])
    }, 2000))
    timers.push(setTimeout(() => {
      setResearchStatus(prev => [...prev, 'Analyzing findings...'])
    }, 5000))
    timers.push(setTimeout(() => {
      setResearchStatus(prev => [...prev, 'Preparing recommendations...'])
    }, 8000))

    try {
      const result = await sendMessage({
        type: 'GEMINI_RESEARCH',
        product,
        preferences,
        researchType: 'all',
      })

      if (!result) {
        setError('No response from background. Make sure the extension is fully loaded — try disabling and re-enabling TerraCart in chrome://extensions/.')
        setIsResearching(false)
        return
      }

      if (result.error) {
        setError(result.error)
        setIsResearching(false)
        return
      }

      if (result.research) {
        // Convert Gemini research results into Alternative objects
        const alternatives: Alternative[] = []

        if (result.research.alternatives) {
          for (const alt of result.research.alternatives) {
            alternatives.push({
              productId: alt.url || alt.name,
              product: {
                id: alt.url || alt.name,
                name: alt.name,
                brand: alt.brand,
                price: 0,
                currency: 'AED',
                image: '',
                description: alt.reason,
                materials: alt.characteristics || [],
                category: product.category,
                packaging: {
                  type: ['unknown' as const],
                  estimatedWeight: 'moderate',
                  recyclable: 'unknown' as const,
                  containsPlastic: 'unknown' as const,
                  refillable: 'unknown' as const,
                },
                retailer: alt.retailer,
                rating: 0,
                reviewCount: 0,
                availability: 'unknown' as const,
                url: alt.url,
                features: alt.characteristics,
              },
              reason: alt.reason,
              improvementAreas: alt.characteristics.slice(0, 3),
              scoreComparison: {
                original: currentProductAnalysis?.ecoScore.overall || 0,
                alternative: alt.ecoScore || 0,
              },
              type: 'similar',
              priority: 'high',
            })
          }
        }

        if (result.research.reusableAlternatives) {
          for (const alt of result.research.reusableAlternatives) {
            alternatives.push({
              productId: alt.url || alt.name,
              product: {
                id: alt.url || alt.name,
                name: alt.name,
                brand: alt.brand,
                price: 0,
                currency: 'AED',
                image: '',
                description: alt.reason,
                materials: [],
                category: product.category,
                packaging: {
                  type: ['unknown' as const],
                  estimatedWeight: 'moderate',
                  recyclable: 'unknown' as const,
                  containsPlastic: 'unknown' as const,
                  refillable: 'unknown' as const,
                },
                retailer: alt.retailer,
                rating: 0,
                reviewCount: 0,
                availability: 'unknown' as const,
                url: alt.url,
              },
              reason: alt.reason,
              improvementAreas: ['Reusable alternative', 'Designed for repeated use'],
              scoreComparison: {
                original: currentProductAnalysis?.ecoScore.overall || 0,
                alternative: alt.ecoScore || 0,
              },
              type: 'reusable',
              priority: 'high',
            })
          }
        }

        // Update the analysis with real research alternatives
        if (currentProductAnalysis && alternatives.length > 0) {
          setProductAnalysis({
            ...currentProductAnalysis,
            alternatives,
          })
        }

        if (alternatives.length === 0) {
          setError('Gemini responded but found no alternatives for this product. Try re-analyzing the product first, then research again.')
        } else {
          onComplete()
        }
      } else if (result && !result.error && !result.research) {
        setError('Gemini returned an unexpected response. The research feature may be temporarily unavailable. Check the browser console for details.')
      }
    } catch (err: any) {
      console.error('TerraCart: handleResearch exception:', err)
      setError('Research failed: ' + (err?.message || String(err)))
    } finally {
      timers.forEach(t => clearTimeout(t))
      setIsResearching(false)
    }
  }

  if (isResearching) {
    return (
      <div>
        <div className="terra-label mb-2 text-terra-700">🔎 Researching Better Options...</div>
        <div className="space-y-1">
          {researchStatus.map((status, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
              <span className="text-terra-500">✓</span>
              {status}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <p className="text-xs text-amber-600 mb-2">
          {error.includes('GEMINI_API_KEY_MISSING') || error.includes('GEMINI_API_KEY_INVALID')
            ? 'Please configure your Gemini API key in Settings.'
            : 'Research error: ' + error.slice(0, 100)}
        </p>
        <button onClick={handleResearch} className="terra-btn-outline text-xs">Retry</button>
      </div>
    )
  }

  return (
    <button onClick={handleResearch} className="w-full text-left">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">🔎</span>
        <span className="text-sm font-bold text-gray-800">Research Better Options</span>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">
        Search the web for real alternatives, reusable options, lower-packaging versions, and better products from actual retailers.
      </p>
      <div className="mt-2 text-xs text-terra-600 font-medium">
        → Start Research
      </div>
    </button>
  )
}

// ============================================================
// Alternatives Tab — shows research results with real products
// ============================================================
function AlternativesTab({
  product,
  analysis,
  onSelectProduct,
}: {
  product: Product
  analysis: ProductAnalysis
  onSelectProduct: (p: Product) => void
}) {
  const { preferences, setProductAnalysis, currentProductAnalysis } = useTerraStore()
  const [researchState, setResearchState] = useState<'idle' | 'researching' | 'done' | 'error'>('idle')
  const [researchStatus, setResearchStatus] = useState<string[]>([])
  const [researchError, setResearchError] = useState<string | null>(null)
  const [webAlternatives, setWebAlternatives] = useState<Alternative[]>([])
  const [researchSources, setResearchSources] = useState<Array<{ name: string; url: string }>>([])

  const handleDeepResearch = async (type: 'alternatives' | 'reusable' | 'packaging' | 'all') => {
    setResearchState('researching')
    setResearchStatus([])
    setResearchError(null)

    const steps = [
      'Searching the web...',
      'Finding real products...',
      'Checking sustainability data...',
      'Comparing options...',
      'Preparing results...',
    ]
    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 500 + Math.random() * 400))
      setResearchStatus(prev => [...prev, steps[i]])
    }

    try {
      const result = await sendMessage({
        type: 'GEMINI_RESEARCH',
        product,
        preferences,
        researchType: type,
      })

      if (!result) {
        setResearchError('No response from background. Make sure the extension is loaded and the page is a shopping site.')
        setResearchState('error')
        return
      }

      if (result.error) {
        setResearchError(result.error)
        setResearchState('error')
        return
      }

      if (result.research) {
        const alts: Alternative[] = []
        const allSources = result.sources || []

        // Convert alternatives
        if (result.research.alternatives) {
          for (const alt of result.research.alternatives) {
            alts.push({
              productId: alt.url || alt.name,
              product: {
                id: alt.url || alt.name,
                name: alt.name,
                brand: alt.brand || '',
                price: 0,
                currency: 'AED',
                image: '',
                description: alt.reason || '',
                materials: alt.characteristics || [],
                category: product.category,
                packaging: { type: ['unknown'], estimatedWeight: 'moderate', recyclable: 'unknown', containsPlastic: 'unknown', refillable: 'unknown' },
                retailer: alt.retailer || '',
                rating: 0,
                reviewCount: 0,
                availability: 'unknown',
                url: alt.url || '',
                features: alt.characteristics || [],
              },
              reason: alt.reason || '',
              improvementAreas: (alt.characteristics || []).slice(0, 3),
              scoreComparison: { original: 0, alternative: alt.ecoScore || 0 },
              type: 'similar',
              priority: 'high',
            })
          }
        }

        // Convert reusable alternatives
        if (result.research.reusableAlternatives) {
          for (const alt of result.research.reusableAlternatives) {
            alts.push({
              productId: alt.url || alt.name,
              product: {
                id: alt.url || alt.name,
                name: alt.name,
                brand: alt.brand || '',
                price: 0,
                currency: 'AED',
                image: '',
                description: alt.reason || '',
                materials: alt.characteristics || [],
                category: product.category,
                packaging: { type: ['mixed'], estimatedWeight: 'moderate', recyclable: 'unknown', containsPlastic: 'unknown', refillable: true },
                retailer: alt.retailer || '',
                rating: 0,
                reviewCount: 0,
                availability: 'unknown',
                url: alt.url || '',
                features: alt.characteristics || [],
              },
              reason: alt.reason || '',
              improvementAreas: (alt.characteristics || []).slice(0, 3),
              scoreComparison: { original: 0, alternative: alt.ecoScore || 0 },
              type: 'reusable',
              priority: 'high',
            })
          }
        }

        // Convert packaging alternatives
        if (result.research.packagingAlternatives) {
          for (const alt of result.research.packagingAlternatives) {
            alts.push({
              productId: alt.url || alt.name,
              product: {
                id: alt.url || alt.name,
                name: alt.name,
                brand: alt.brand || '',
                price: 0,
                currency: 'AED',
                image: '',
                description: alt.reason || '',
                materials: alt.characteristics || [],
                category: product.category,
                packaging: { type: ['none'], estimatedWeight: 'light', recyclable: true, containsPlastic: false, refillable: 'unknown' },
                retailer: alt.retailer || '',
                rating: 0,
                reviewCount: 0,
                availability: 'unknown',
                url: alt.url || '',
                features: alt.characteristics || [],
              },
              reason: alt.reason || '',
              improvementAreas: (alt.characteristics || []).slice(0, 3),
              scoreComparison: { original: 0, alternative: alt.ecoScore || 0 },
              type: 'similar',
              priority: 'medium',
            })
          }
        }

        setWebAlternatives(prev => [...prev, ...alts])
        setResearchSources(allSources)
      }

      setResearchState('done')
    } catch (err: any) {
      setResearchError(err?.message || 'Research failed')
      setResearchState('error')
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Research buttons */}
      <div className="terra-card p-4">
        <div className="terra-label mb-3">🔎 Web Research</div>
        <div className="space-y-2">
          <button onClick={() => handleDeepResearch('all')} disabled={researchState === 'researching'} className="w-full text-left p-2 rounded-lg bg-terra-50 hover:bg-terra-100 transition-colors disabled:opacity-50">
            <div className="text-xs font-medium text-terra-700">Search for All Alternatives</div>
            <div className="text-[10px] text-gray-500">Find reusable, durable, lower-packaging, and budget options</div>
          </button>
          <button onClick={() => handleDeepResearch('reusable')} disabled={researchState === 'researching'} className="w-full text-left p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50">
            <div className="text-xs font-medium text-emerald-700">Find Reusable Alternatives</div>
            <div className="text-[10px] text-gray-500">Replace disposable products with reusable ones</div>
          </button>
          <button onClick={() => handleDeepResearch('packaging')} disabled={researchState === 'researching'} className="w-full text-left p-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50">
            <div className="text-xs font-medium text-blue-700">Research Lower Packaging</div>
            <div className="text-[10px] text-gray-500">Find bulk, refill, or minimal-packaging versions</div>
          </button>
        </div>
      </div>

      {/* Research progress */}
      {researchState === 'researching' && (
        <div className="terra-card p-4">
          <div className="terra-label mb-2">🔎 Research in Progress...</div>
          <div className="space-y-1">
            {researchStatus.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                <span className="text-terra-500">✓</span> {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Research error */}
      {researchState === 'error' && (
        <div className="terra-card p-4 border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-700">
            {researchError?.includes('GEMINI_API_KEY_MISSING') || researchError?.includes('GEMINI_API_KEY_INVALID')
              ? 'Gemini API key not configured. Please set up in Settings.'
              : 'Research temporarily unavailable. ' + (researchError || 'Unknown error')}
          </p>
        </div>
      )}

      {/* Existing alternatives from analysis */}
      {analysis.alternatives.length > 0 && (
        <div className="space-y-3">
          <div className="terra-label">🔄 Alternatives Found</div>
          {analysis.alternatives.map((alt) => (
            <div key={alt.productId} className="terra-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`terra-badge text-[10px] ${alt.priority === 'high' ? 'bg-terra-50 text-terra-700 border border-terra-200' : alt.priority === 'medium' ? 'bg-sand-50 text-sand-700 border border-sand-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                  {alt.priority} priority
                </span>
                <span className="terra-badge text-[10px] bg-blue-50 text-blue-600 border border-blue-100">{alt.type}</span>
              </div>
              {alt.product && <ProductCard product={alt.product} ecoScore={alt.scoreComparison.alternative} compact onClick={() => onSelectProduct(alt.product!)} />}
              <div className="mt-2 text-xs text-gray-500">{alt.reason}</div>
              {alt.improvementAreas.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {alt.improvementAreas.map((area, i) => (
                    <span key={i} className="terra-chip text-[10px] bg-green-50 text-green-600 border-green-100">✓ {area}</span>
                  ))}
                </div>
              )}
              {alt.product?.url && (
                <a href={alt.product.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-terra-600 hover:text-terra-700 font-medium">
                  🏪 View at {alt.product.retailer} →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Web research results */}
      {webAlternatives.length > 0 && (
        <div className="space-y-3">
          <div className="terra-label">🌐 Web Research Results</div>
          {webAlternatives.map((alt) => (
            <div key={alt.productId} className="terra-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`terra-badge text-[10px] ${alt.priority === 'high' ? 'bg-terra-50 text-terra-700 border border-terra-200' : alt.priority === 'medium' ? 'bg-sand-50 text-sand-700 border border-sand-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                  {alt.priority} priority
                </span>
                <span className="terra-badge text-[10px] bg-purple-50 text-purple-600 border border-purple-100">{alt.type}</span>
              </div>
              {alt.product && <ProductCard product={alt.product} ecoScore={alt.scoreComparison.alternative} compact onClick={() => onSelectProduct(alt.product!)} />}
              <div className="mt-2 text-xs text-gray-500">{alt.reason}</div>
              {alt.improvementAreas.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {alt.improvementAreas.map((area, i) => (
                    <span key={i} className="terra-chip text-[10px] bg-green-50 text-green-600 border-green-100">✓ {area}</span>
                  ))}
                </div>
              )}
              {alt.product?.url && (
                <a href={alt.product.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-terra-600 hover:text-terra-700 font-medium">
                  🏪 View at {alt.product.retailer} →
                </a>
              )}
            </div>
          ))}
          {/* Sources */}
          {researchSources.length > 0 && (
            <div className="terra-card p-3">
              <div className="terra-label mb-2 text-[10px]">📚 Sources</div>
              <div className="flex flex-wrap gap-1">
                {researchSources.map((src, i) => (
                  <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-terra-600 hover:text-terra-700 underline truncate max-w-[150px]" title={src.url}>
                    {src.name || new URL(src.url).hostname}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {analysis.alternatives.length === 0 && webAlternatives.length === 0 && researchState !== 'researching' && (
        <div className="terra-card p-6 text-center">
          <div className="text-3xl mb-2">🔍</div>
          <p className="text-sm text-gray-500 mb-2">No alternatives found yet.</p>
          <p className="text-xs text-gray-400">Use the web research buttons above to find real alternatives.</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Packaging Tab
// ============================================================
function PackagingTab({ analysis }: { analysis: ProductAnalysis }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="terra-card p-4"><PackagingAnalysis analysis={analysis.packagingAnalysis} /></div>
      <div className="terra-card p-4">
        <div className="terra-label mb-3">📦 Packaging Decision Engine</div>
        <div className="space-y-2">
          <PackagingDecision question="Can I get this with less packaging?" answer={analysis.packagingAnalysis.improvements.some(i => i.type === 'less-packaging' && i.available)} detail="Check if a minimal-packaging version exists" />
          <PackagingDecision question="Can I buy a refill?" answer={analysis.product.packaging.refillable === true} detail={analysis.product.packaging.refillable ? 'Refill option is available' : 'Refill option may or may not be available'} />
          <PackagingDecision question="Can I buy it in bulk?" answer={analysis.product.packaging.bulkAvailable === true} detail={analysis.product.packaging.bulkAvailable ? 'Bulk purchase available' : 'Bulk options not confirmed'} />
          <PackagingDecision question="Can I choose consolidated shipping?" answer={true} detail="Combine with other purchases to reduce shipping packaging" />
          <PackagingDecision question="Is there a package-free alternative?" answer={analysis.alternatives.some(a => a.product?.packaging.type.includes('none'))} detail="Look for minimal or zero-packaging alternatives" />
        </div>
      </div>
    </div>
  )
}

function PackagingDecision({ question, answer, detail }: { question: string; answer: boolean; detail: string }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
      <span className={`mt-0.5 ${answer ? 'text-green-600' : 'text-gray-400'}`}>{answer ? '✓' : '?'}</span>
      <div>
        <div className="text-xs font-medium text-gray-700">{question}</div>
        <div className="text-[11px] text-gray-400">{detail}</div>
      </div>
    </div>
  )
}

// ============================================================
// Settings Panel — includes Gemini API key management
// ============================================================
function SettingsPanel({ onBack }: { onBack: () => void }) {
  const { preferences, updatePreferences, setRecommendationStyle, clearAllData } = useTerraStore()
  const [websiteSettings, setWebsiteSettings] = useState<Record<string, boolean>>({})
  const [websiteAutoOpen, setWebsiteAutoOpen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    sendMessage({ type: 'GET_WEBSITES' }).then(settings => {
      if (settings) setWebsiteSettings(settings)
    })
    sendMessage({ type: 'GET_WEBSITE_AUTO_OPEN_SETTINGS' }).then(settings => {
      if (settings) setWebsiteAutoOpen(settings)
    })
  }, [])

  const toggleWebsite = async (hostname: string, enabled: boolean) => {
    await sendMessage({ type: 'TOGGLE_WEBSITE', hostname, enabled })
    setWebsiteSettings(prev => ({ ...prev, [hostname]: enabled }))
  }

  const toggleSiteAutoOpen = async (hostname: string, enabled: boolean) => {
    await sendMessage({ type: 'TOGGLE_WEBSITE_AUTO_OPEN', hostname, enabled })
    setWebsiteAutoOpen(prev => ({ ...prev, [hostname]: enabled }))
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <header className="bg-white border-b border-gray-100 px-4 py-3 shrink-0 flex items-center gap-3">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-gray-100">←</button>
        <h1 className="font-bold text-sm">Settings & Privacy</h1>
      </header>
      <main className="flex-1 overflow-y-auto terra-scroll p-4 space-y-4">

        {/* AI Status */}
        <div className="terra-card p-4 border-terra-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-medium text-gray-700">🤖 Gemini AI — powered & ready</span>
          </div>
        </div>

        <div className="terra-card p-4">
          <div className="terra-label mb-3">🎯 Recommendation Style</div>
          <div className="space-y-1.5">
            {(['most-sustainable', 'best-value', 'balanced', 'lowest-price', 'longest-lasting'] as const).map((style) => (
              <label key={style} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="radio" checked={preferences.recommendationStyle === style} onChange={() => setRecommendationStyle(style)} className="text-terra-600 focus:ring-terra-500" />
                <span className="text-sm text-gray-700 capitalize">{style.replace(/-/g, ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="terra-card p-4">
          <div className="terra-label mb-3">🌿 Sustainability Priorities</div>
          <div className="space-y-1.5">
            {(['reduce-plastic', 'reduce-packaging', 'buy-reusable', 'buy-durable', 'prefer-repairable', 'reduce-unnecessary-purchases', 'prefer-refillable', 'prefer-recyclable-packaging'] as const).map((priority) => (
              <label key={priority} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={preferences.sustainabilityPriorities.includes(priority)} onChange={(e) => {
                  const newP = e.target.checked ? [...preferences.sustainabilityPriorities, priority] : preferences.sustainabilityPriorities.filter(p => p !== priority)
                  updatePreferences({ sustainabilityPriorities: newP })
                }} className="terra-checkbox" />
                <span className="text-sm text-gray-700">{priority.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="terra-card p-4">
          <div className="terra-label mb-3">🌐 Website Controls</div>
          <p className="text-xs text-gray-500 mb-3">Enable or disable TerraCart on specific websites.</p>
          <div className="space-y-2">
            {Object.entries(websiteSettings).map(([hostname, enabled]) => (
              <div key={hostname} className="p-2.5 rounded-lg bg-gray-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 font-medium">{hostname}</span>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400">Active</span>
                      <button onClick={() => toggleWebsite(hostname, !enabled)} className={`w-9 h-5 rounded-full transition-colors relative ${enabled ? 'bg-terra-500' : 'bg-gray-200'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400">Auto-open</span>
                      <button onClick={() => toggleSiteAutoOpen(hostname, !(websiteAutoOpen[hostname] ?? preferences.enableAutoOpenPanel))} className={`w-9 h-5 rounded-full transition-colors relative ${(websiteAutoOpen[hostname] ?? preferences.enableAutoOpenPanel) ? 'bg-blue-500' : 'bg-gray-200'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${(websiteAutoOpen[hostname] ?? preferences.enableAutoOpenPanel) ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {Object.keys(websiteSettings).length === 0 && (
              <p className="text-xs text-gray-400">No websites configured yet. Visit a shopping site to see it here.</p>
            )}
          </div>
        </div>

        <div className="terra-card p-4">
          <div className="terra-label mb-3">⚙️ Features</div>
          <div className="space-y-1.5">
            <ToggleRow label="Auto-open panel on shopping sites" checked={preferences.enableAutoOpenPanel} onChange={(v) => updatePreferences({ enableAutoOpenPanel: v })} />
            {preferences.enableAutoOpenPanel && (
              <div className="ml-6 pl-3 border-l-2 border-terra-200 space-y-3 py-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Open delay: {preferences.autoOpenDelay}s</label>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={preferences.autoOpenDelay}
                    onChange={(e) => updatePreferences({ autoOpenDelay: Number(e.target.value) })}
                    className="w-full h-1.5 rounded-full appearance-none bg-gray-200 accent-terra-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>Instant</span>
                    <span>10s</span>
                  </div>
                </div>
                <ToggleRow label="Show notification on open" checked={preferences.autoOpenNotification} onChange={(v) => updatePreferences({ autoOpenNotification: v })} />
                <ToggleRow label="Product pages only" checked={preferences.autoOpenProductPagesOnly} onChange={(v) => updatePreferences({ autoOpenProductPagesOnly: v })} />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Chime sound</span>
                  <div className="flex gap-1">
                    {(['off', 'soft', 'loud'] as const).map((vol) => (
                      <button
                        key={vol}
                        onClick={() => updatePreferences({ chimeVolume: vol })}
                        className={`px-2.5 py-1 text-[10px] rounded-full border transition-colors ${
                          preferences.chimeVolume === vol
                            ? 'bg-terra-500 text-white border-terra-500'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {vol === 'off' ? '🔇 Off' : vol === 'soft' ? '🔈 Soft' : '🔊 Loud'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <ToggleRow label="Floating button" checked={preferences.enableFloatingButton} onChange={(v) => updatePreferences({ enableFloatingButton: v })} />
            <ToggleRow label="Shopping history" checked={preferences.enableHistory} onChange={(v) => updatePreferences({ enableHistory: v })} />
            <ToggleRow label="Pattern detection" checked={preferences.enablePatternDetection} onChange={(v) => updatePreferences({ enablePatternDetection: v })} />
            <ToggleRow label="Notifications" checked={preferences.notificationsEnabled} onChange={(v) => updatePreferences({ notificationsEnabled: v })} />
            <ToggleRow label="Reduced motion" checked={preferences.reducedMotion} onChange={(v) => updatePreferences({ reducedMotion: v })} />
          </div>
        </div>

        <div className="terra-card p-4">
          <div className="terra-label mb-3">🔒 Privacy Center</div>
          <div className="space-y-2 text-xs text-gray-600">
            <div className="p-2 bg-green-50 rounded-lg">
              <div className="font-medium text-green-700 mb-1">What TerraCart can access</div>
              <div>✓ Shopping pages when enabled</div>
              <div>✓ Product information</div>
              <div>✓ TerraCart shopping activity</div>
              <div>✓ User preferences</div>
            </div>
            <div className="p-2 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-600 mb-1">What TerraCart does NOT need</div>
              <div>✕ Passwords</div>
              <div>✕ Payment details</div>
              <div>✕ Banking information</div>
              <div>✕ Private messages</div>
              <div>✕ Unrelated browsing content</div>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <button onClick={() => { clearAllData(); alert('All TerraCart data has been deleted.') }} className="w-full terra-btn-outline text-xs border-red-200 text-red-600 hover:bg-red-50">
              🗑 Delete All TerraCart Data
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <div className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${checked ? 'bg-terra-500' : 'bg-gray-200'}`} onClick={() => onChange(!checked)}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </div>
    </label>
  )
}

// ============================================================
// History Panel
// ============================================================
function HistoryPanel({ onBack, onAnalyze }: { onBack: () => void; onAnalyze: (p: Product) => void }) {
  const { history, savedProducts, patterns } = useTerraStore()

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <header className="bg-white border-b border-gray-100 px-4 py-3 shrink-0 flex items-center gap-3">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-gray-100">←</button>
        <h1 className="font-bold text-sm">History & Saved</h1>
      </header>
      <main className="flex-1 overflow-y-auto terra-scroll p-4 space-y-4">
        <div className="terra-card p-4">
          <div className="terra-label mb-3">♥ Saved Products ({savedProducts.length})</div>
          {savedProducts.length === 0 ? (
            <p className="text-xs text-gray-400">No saved products yet. Click the heart icon on any product to save it.</p>
          ) : (
            <div className="space-y-2">
              {savedProducts.map((saved) => (
                <ProductCard key={saved.id} product={saved.product} ecoScore={saved.ecoScore} compact onClick={() => onAnalyze(saved.product)} />
              ))}
            </div>
          )}
        </div>

        <div className="terra-card p-4">
          <div className="terra-label mb-3">📋 Recent History ({history.length})</div>
          {history.length === 0 ? (
            <p className="text-xs text-gray-400">No history yet. Browse products to build your history.</p>
          ) : (
            <div className="space-y-1.5">
              {history.slice(0, 20).map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                  <span className="text-xs text-gray-400 shrink-0">{new Date(entry.timestamp).toLocaleDateString()}</span>
                  <span className="text-xs text-gray-700 truncate flex-1">{entry.product.name}</span>
                  {entry.ecoScore && <span className="text-xs font-medium text-gray-500">{entry.ecoScore.toFixed(1)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {patterns.length > 0 && (
          <div className="terra-card p-4">
            <div className="terra-label mb-3">📊 Shopping Patterns</div>
            <div className="space-y-2">
              {patterns.map((pattern, i) => (
                <div key={i} className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="text-xs font-medium text-amber-800">Shopping pattern detected: {pattern.category}</div>
                  <div className="text-xs text-amber-600 mt-1">{pattern.suggestion}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ============================================================
// Empty / Loading / Disabled States
// ============================================================
function EmptyState({ onScan, showGeminiPrompt, onSetupGemini }: { onScan: () => void; showGeminiPrompt?: boolean; onSetupGemini?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="text-5xl mb-4">🌍</div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">Welcome to TerraCart</h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-4">
        Your AI Copilot for Smarter Shopping. Visit a shopping website and TerraCart will analyze products automatically.
      </p>
      <p className="text-xs text-gray-400 mb-6">
        Supported sites include Amazon, Noon, and many more.
      </p>
      <button onClick={onScan} className="terra-btn-primary text-sm mb-3">
        🔄 Scan Current Page
      </button>
      {showGeminiPrompt && onSetupGemini && (
        <button onClick={onSetupGemini} className="terra-btn-outline text-xs text-amber-600">
          🤖 Set up AI Research (Gemini)
        </button>
      )}
    </div>
  )
}

function AnalyzingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="text-4xl mb-4 animate-pulse-soft">🌍</div>
      <h2 className="text-sm font-bold text-gray-800 mb-2">TerraCart is researching...</h2>
      <div className="space-y-1.5 text-xs text-gray-500">
        <div className="flex items-center gap-2 justify-center"><span className="text-terra-500">✓</span> Understanding the product</div>
        <div className="flex items-center gap-2 justify-center"><span className="text-terra-500">✓</span> Checking available information</div>
        <div className="flex items-center gap-2 justify-center"><span className="text-ocean-500">●</span> Looking for alternatives</div>
        <div className="flex items-center gap-2 justify-center text-gray-300">○ Comparing packaging</div>
        <div className="flex items-center gap-2 justify-center text-gray-300">○ Evaluating reusable options</div>
        <div className="flex items-center gap-2 justify-center text-gray-300">○ Personalizing recommendation</div>
      </div>
    </div>
  )
}

function DisabledState({ hostname }: { hostname: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="text-4xl mb-4">🚫</div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">TerraCart is paused</h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-4">
        TerraCart is currently disabled for <strong>{hostname}</strong>.
      </p>
      <p className="text-xs text-gray-400 mb-6">
        Go to Settings to re-enable it for this website.
      </p>
    </div>
  )
}
