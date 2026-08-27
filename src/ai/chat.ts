import { useTerraStore } from '../store'
import type { Product } from '../types'

interface ChatResponse {
  content: string
  metadata?: {
    productId?: string
    type?: string
    sources?: Array<{ name: string; url: string }>
  }
}

// ---- Helper: send message to background ----
function sendMessageToBackground(message: Record<string, unknown>): Promise<any> {
  return new Promise((resolve) => {
    try {
      chrome.runtime?.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null)
        } else {
          resolve(response)
        }
      })
    } catch {
      resolve(null)
    }
  })
}

// ============================================================
// processUserMessage — provides local guidance without inventing web results
// ============================================================
export async function processUserMessage(message: string): Promise<ChatResponse> {
  const store = useTerraStore.getState()
  const currentAnalysis = store.currentProductAnalysis
  const currentProduct: Product | null = currentAnalysis?.product || store.currentPageScan?.primaryProduct || null
  const preferences = store.preferences

  // Build chat history from existing messages
  const chatHistory = store.chatMessages.slice(-10).map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }))

  return getLocalFallback(message, currentProduct, store)
}

// ============================================================
// Local responses never claim to be web research results.
// ============================================================
function getLocalFallback(
  message: string,
  product: Product | null,
  store: ReturnType<typeof useTerraStore.getState>,
): ChatResponse {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('api key') || lowerMessage.includes('setup') || lowerMessage.includes('configure')) {
    return {
      content: [
        '⚙️ **Web research runs through TerraCart**',
        '',
        'Tavily web research is available from the Alternatives tab.',
        '',
        'To enable full AI functionality:',
        'Start the research action there to search for source-backed alternatives.',
      ].join('\n'),
    }
  }

  if (!product) {
    return {
      content: [
        "I'm ready to help you shop smarter!",
        '',
        'Visit a shopping website like Amazon, Noon, or Walmart, and TerraCart will analyze products automatically.',
        '',
        'Open a supported shopping product to start source-backed web research.',
      ].join('\n'),
    }
  }

  // Provide basic local analysis without web claims
  if (lowerMessage.includes('should i buy') || lowerMessage.includes('worth it') || lowerMessage.includes('worth buying')) {
    const analysis = store.currentProductAnalysis
    if (analysis) {
      return {
        content: [
          analysis.verdict.emoji + ' **' + analysis.verdict.label + '**',
          '',
          analysis.verdict.explanation,
          '',
          'Eco Score: **' + analysis.ecoScore.overall + '/10** (' + analysis.ecoScore.confidence + ' confidence)',
          '',
          '_Use the Alternatives tab for source-backed web research._',
        ].join('\n'),
        metadata: { productId: product.id },
      }
    }
    return {
      content: [
        'I detected **' + product.name + '**.',
        '',
        'Basic local analysis is available. Use the Alternatives tab for web research.',
        '',
        'To research alternatives, open the Alternatives tab.',
      ].join('\n'),
      metadata: { productId: product.id },
    }
  }

  if (lowerMessage.includes('alternative') || lowerMessage.includes('reusable') || lowerMessage.includes('better option')) {
    return {
      content: [
        '🔍 **Use the Alternatives tab for web research**',
        '',
        'Finding real alternatives requires the Tavily-backed research action.',
        '',
        'To find real alternatives:',
        'Open Alternatives and choose the research type you need.',
        '',
        'I found the product **' + product.name + '** on ' + product.retailer + '.',
      ].join('\n'),
      metadata: { productId: product.id },
    }
  }

  // Generic helpful response
  return {
    content: [
      "I can see you're looking at **" + product.name + '**.',
      '',
      'For basic analysis, I can work with the information available on this page.',
      '',
      'For full AI research including:',
      '• Real alternative products',
      '• Packaging analysis',
      '• Web search for better options',
      '• Personalized recommendations',
      '',
      'Open the Alternatives tab to run source-backed web research.',
      '',
      'Research results include the original source URL.',
    ].join('\n'),
    metadata: { productId: product.id },
  }
}

// ============================================================
// researchAlternatives — trigger Tavily research via the background proxy
// ============================================================
export async function researchAlternatives(
  product: Product,
  preferences: ReturnType<typeof useTerraStore.getState>['preferences'],
  researchType: 'alternatives' | 'reusable' | 'packaging' | 'all' = 'all',
): Promise<{
  research: any
  sources: Array<{ name: string; url: string }>
  searchQueries: string[]
  error?: string
}> {
  try {
    const result = await sendMessageToBackground({
      type: 'TAVILY_RESEARCH',
      product,
      preferences,
      researchType,
    })
    return result || { research: null, sources: [], searchQueries: [], error: 'No response from background' }
  } catch (err) {
    return {
      research: null,
      sources: [],
      searchQueries: [],
      error: String(err),
    }
  }
}
