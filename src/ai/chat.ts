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
// processUserMessage — sends real request to Gemini via background
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

  // Check if Gemini API key is configured
  const apiKeyStatus = await sendMessageToBackground({ type: 'GET_API_KEY' })

  if (!apiKeyStatus?.configured) {
    // No API key — provide helpful local fallback
    return getLocalFallback(message, currentProduct, store)
  }

  // Send real request to Gemini through background
  try {
    const result = await sendMessageToBackground({
      type: 'GEMINI_CHAT',
      message,
      product: currentProduct,
      preferences,
      chatHistory,
    })

    if (result?.content) {
      return {
        content: result.content,
        metadata: {
          productId: currentProduct?.id,
          type: 'gemini-chat',
          sources: result.sources || [],
        },
      }
    }

    return {
      content: "I received an empty response. Please try again.",
      metadata: { productId: currentProduct?.id },
    }
  } catch (err) {
    return {
      content: "I couldn't reach the AI service. Please check your internet connection and try again.",
      metadata: { productId: currentProduct?.id },
    }
  }
}

// ============================================================
// Local fallback when Gemini API is not configured
// ============================================================
function getLocalFallback(
  message: string,
  product: Product | null,
  store: ReturnType<typeof useTerraStore.getState>,
): ChatResponse {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('api key') || lowerMessage.includes('gemini') || lowerMessage.includes('setup') || lowerMessage.includes('configure')) {
    return {
      content: [
        '⚙️ **Gemini AI Setup Required**',
        '',
        'TerraCart uses Google Gemini AI for real product research and web search.',
        '',
        'To enable full AI functionality:',
        '1. Get a free API key from Google AI Studio (aistudio.google.com)',
        '2. Open TerraCart Settings (⚙️ in the header)',
        '3. Paste your API key',
        '',
        'Without an API key, I can still provide basic local analysis, but I cannot search the web for alternatives.',
      ].join('\n'),
    }
  }

  if (!product) {
    return {
      content: [
        "I'm ready to help you shop smarter! 🌍",
        '',
        'Visit a shopping website like Amazon, Noon, or Walmart, and TerraCart will analyze products automatically.',
        '',
        'For full AI-powered research with web search, please configure your Gemini API key in Settings.',
      ].join('\n'),
    }
  }

  // Provide basic local analysis without Gemini
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
          '_For deeper AI analysis with web research, configure your Gemini API key in Settings._',
        ].join('\n'),
        metadata: { productId: product.id },
      }
    }
    return {
      content: [
        'I detected **' + product.name + '**.',
        '',
        'Basic local analysis is available, but for full AI-powered research, please configure your Gemini API key in Settings.',
        '',
        'To set up: Click ⚙️ in the header → Add your Google AI API key.',
      ].join('\n'),
      metadata: { productId: product.id },
    }
  }

  if (lowerMessage.includes('alternative') || lowerMessage.includes('reusable') || lowerMessage.includes('better option')) {
    return {
      content: [
        '🔍 **Web Research Requires Gemini AI**',
        '',
        'Finding real alternatives requires web search, which needs a Gemini API key.',
        '',
        'To find real alternatives:',
        '1. Get a free API key from Google AI Studio',
        '2. Open Settings (⚙️) and add your key',
        '3. Then ask me again',
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
      'Please configure your Gemini API key in Settings (⚙️).',
      '',
      'It\'s free from Google AI Studio (aistudio.google.com).',
    ].join('\n'),
    metadata: { productId: product.id },
  }
}

// ============================================================
// researchAlternatives — trigger Gemini research via background
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
  const apiKeyStatus = await sendMessageToBackground({ type: 'GET_API_KEY' })
  if (!apiKeyStatus?.configured) {
    return {
      research: null,
      sources: [],
      searchQueries: [],
      error: 'GEMINI_API_KEY_MISSING',
    }
  }

  try {
    const result = await sendMessageToBackground({
      type: 'GEMINI_RESEARCH',
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
