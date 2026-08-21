// ============================================================
// Gemini API Client — runs in background service worker only
// Uses Google Search grounding for real web research
// ============================================================

import type {
  GeminiRequest,
  GeminiResponse,
  GeminiGroundingMetadata,
  GeminiGroundingChunk,
} from './gemini-types'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MODEL = 'gemini-2.5-flash'

// ---- Storage key for API key ----
const API_KEY_STORAGE = 'terracart_gemini_api_key'

// ---- Build-time API key (injected by Vite from .env) ----
declare const __GEMINI_API_KEY__: string
const EMBEDDED_API_KEY = typeof __GEMINI_API_KEY__ !== 'undefined' ? __GEMINI_API_KEY__ : ''

// ---- Get API key from Chrome storage (fallback to embedded) ----
export async function getApiKey(): Promise<string | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const result = await chrome.storage.local.get(API_KEY_STORAGE)
    const stored = result[API_KEY_STORAGE]
    if (stored) return stored
  }
  return EMBEDDED_API_KEY || null
}

// ---- Save API key to Chrome storage ----
export async function saveApiKey(key: string): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [API_KEY_STORAGE]: key })
  }
}

// ---- Check if API key is configured ----
export async function isApiKeyConfigured(): Promise<boolean> {
  const key = await getApiKey()
  return !!key && key.length > 5
}

// ============================================================
// Core Gemini API Call
// ============================================================
export async function callGemini(
  request: GeminiRequest,
  apiKeyOverride?: string,
): Promise<GeminiResponse> {
  const apiKey = apiKeyOverride || (await getApiKey())
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING')
  }

  const url = `${GEMINI_API_BASE}/models/${MODEL}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    if (response.status === 400) throw new Error('GEMINI_BAD_REQUEST: ' + errorBody)
    if (response.status === 403) throw new Error('GEMINI_API_KEY_INVALID')
    if (response.status === 429) throw new Error('GEMINI_RATE_LIMITED')
    throw new Error('GEMINI_ERROR_' + response.status + ': ' + errorBody)
  }

  const data: GeminiResponse = await response.json()

  if (data.promptFeedback?.blockReason) {
    throw new Error('GEMINI_BLOCKED: ' + data.promptFeedback.blockReason)
  }

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('GEMINI_NO_CANDIDATES')
  }

  return data
}

// ============================================================
// Extract text from Gemini response
// ============================================================
export function extractText(response: GeminiResponse): string {
  const candidate = response.candidates?.[0]
  if (!candidate?.content?.parts) return ''

  return candidate.content.parts
    .filter((p): p is { text: string } => 'text' in p)
    .map(p => p.text)
    .join('')
}

// ============================================================
// Extract grounding sources from Gemini response
// ============================================================
export function extractSources(
  response: GeminiResponse,
): Array<{ name: string; url: string }> {
  const metadata: GeminiGroundingMetadata | undefined =
    response.candidates?.[0]?.groundingMetadata
  if (!metadata?.groundingChunks) return []

  return metadata.groundingChunks
    .filter((c): c is GeminiGroundingChunk & { web: NonNullable<GeminiGroundingChunk['web']> } => !!c.web)
    .map(c => ({
      name: c.web.title || c.web.uri,
      url: c.web.uri,
    }))
}

// ============================================================
// Extract web search queries used
// ============================================================
export function extractSearchQueries(response: GeminiResponse): string[] {
  return response.candidates?.[0]?.groundingMetadata?.webSearchQueries || []
}

// ============================================================
// Build a Gemini request with Google Search grounding
// ============================================================
export function buildSearchGroundedRequest(
  systemPrompt: string,
  userMessage: string,
): GeminiRequest {
  return {
    systemInstruction: {
      role: 'user',
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage }],
      },
    ],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  }
}

// ============================================================
// Build a Gemini request WITHOUT search (for simple analysis)
// ============================================================
export function buildAnalysisRequest(
  systemPrompt: string,
  userMessage: string,
): GeminiRequest {
  return {
    systemInstruction: {
      role: 'user',
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage }],
      },
    ],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 4096,
    },
  }
}

// ============================================================
// Build a multi-turn conversation request with search grounding
// ============================================================
export function buildConversationalRequest(
  systemPrompt: string,
  history: Array<{ role: 'user' | 'model'; content: string }>,
  latestMessage: string,
): GeminiRequest {
  const contents = history.map(h => ({
    role: h.role as 'user' | 'model',
    parts: [{ text: h.content }],
  }))

  contents.push({
    role: 'user' as const,
    parts: [{ text: latestMessage }],
  })

  return {
    systemInstruction: {
      role: 'user',
      parts: [{ text: systemPrompt }],
    },
    contents,
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  }
}
