// ============================================================
// Gemini Service Layer — runs in background service worker
// Orchestrates AI analysis, research, and chat with real web search
// ============================================================

import {
  callGemini,
  extractText,
  extractSources,
  buildSearchGroundedRequest,
  buildAnalysisRequest,
} from './gemini-client'
import {
  ANALYSIS_SYSTEM_PROMPT,
  RESEARCH_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
  buildAnalysisPrompt,
  buildResearchPrompt,
  buildChatPrompt,
  buildProductContext,
  buildPreferencesContext,
} from './prompts'
import type { Product, UserPreferences } from '../types'
import type { GeminiProductAnalysis, GeminiResearchResult, GeminiChatResponse } from './gemini-types'

// ============================================================
// Product Analysis via Gemini
// ============================================================
export async function analyzeProductWithGemini(
  product: Product,
  preferences: UserPreferences,
): Promise<{
  analysis: GeminiProductAnalysis | null
  sources: Array<{ name: string; url: string }>
  error?: string
}> {
  try {
    const prompt = buildAnalysisPrompt(product, preferences)
    const request = buildAnalysisRequest(ANALYSIS_SYSTEM_PROMPT, prompt)
    const response = await callGemini(request)
    const text = extractText(response)
    const sources = extractSources(response)

    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = extractJsonFromText(text)
    if (!jsonStr) {
      return { analysis: null, sources, error: 'Could not parse AI response' }
    }

    const parsed = JSON.parse(jsonStr) as GeminiProductAnalysis
    return { analysis: parsed, sources }
  } catch (err: any) {
    const msg = err?.message || String(err)
    if (msg.includes('GEMINI_API_KEY_MISSING')) {
      return { analysis: null, sources: [], error: 'GEMINI_API_KEY_MISSING' }
    }
    if (msg.includes('GEMINI_API_KEY_INVALID')) {
      return { analysis: null, sources: [], error: 'GEMINI_API_KEY_INVALID' }
    }
    if (msg.includes('GEMINI_RATE_LIMITED')) {
      return { analysis: null, sources: [], error: 'Rate limited. Please wait a moment and try again.' }
    }
    return { analysis: null, sources: [], error: 'AI analysis failed: ' + msg.slice(0, 200) }
  }
}

// ============================================================
// Research Alternatives via Gemini with Web Search
// ============================================================
export async function researchAlternativesWithGemini(
  product: Product,
  preferences: UserPreferences,
  researchType: 'alternatives' | 'reusable' | 'packaging' | 'all' = 'all',
): Promise<{
  research: GeminiResearchResult | null
  sources: Array<{ name: string; url: string }>
  searchQueries: string[]
  error?: string
}> {
  try {
    const prompt = buildResearchPrompt(product, preferences, researchType)
    const request = buildSearchGroundedRequest(RESEARCH_SYSTEM_PROMPT, prompt)
    const response = await callGemini(request)
    const text = extractText(response)
    const sources = extractSources(response)
    const searchQueries = response.candidates?.[0]?.groundingMetadata?.webSearchQueries || []

    const jsonStr = extractJsonFromText(text)
    if (!jsonStr) {
      return { research: null, sources, searchQueries, error: 'Could not parse research response' }
    }

    const parsed = JSON.parse(jsonStr) as GeminiResearchResult
    return { research: parsed, sources, searchQueries }
  } catch (err: any) {
    const msg = err?.message || String(err)
    if (msg.includes('GEMINI_API_KEY_MISSING')) {
      return { research: null, sources: [], searchQueries: [], error: 'GEMINI_API_KEY_MISSING' }
    }
    if (msg.includes('GEMINI_API_KEY_INVALID')) {
      return { research: null, sources: [], searchQueries: [], error: 'GEMINI_API_KEY_INVALID' }
    }
    if (msg.includes('GEMINI_RATE_LIMITED')) {
      return { research: null, sources: [], searchQueries: [], error: 'Rate limited. Please wait and try again.' }
    }
    return { research: null, sources: [], searchQueries: [], error: 'Research failed: ' + msg.slice(0, 200) }
  }
}

// ============================================================
// Chat via Gemini with Web Search
// ============================================================
export async function chatWithGemini(
  userMessage: string,
  product: Product | null,
  preferences: UserPreferences,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): Promise<GeminiChatResponse> {
  try {
    const productContext = product
      ? buildProductContext(product)
      : 'No product currently being analyzed. The user may be browsing.'
    const prefsContext = buildPreferencesContext(preferences)
    const prompt = buildChatPrompt(userMessage, productContext, prefsContext, chatHistory)
    const request = buildSearchGroundedRequest(CHAT_SYSTEM_PROMPT, prompt)
    const response = await callGemini(request)
    const text = extractText(response)
    const sources = extractSources(response)

    return { content: text, sources }
  } catch (err: any) {
    const msg = err?.message || String(err)
    if (msg.includes('GEMINI_API_KEY_MISSING')) {
      return { content: 'Gemini API key not configured. Go to Settings to add your Google AI API key.', sources: [] }
    }
    if (msg.includes('GEMINI_API_KEY_INVALID')) {
      return { content: 'The Gemini API key appears to be invalid. Please check your key in Settings.', sources: [] }
    }
    if (msg.includes('GEMINI_RATE_LIMITED')) {
      return { content: 'Too many requests. Please wait a moment and try again.', sources: [] }
    }
    return { content: 'Sorry, I encountered an error: ' + msg.slice(0, 200) + '. Please try again.', sources: [] }
  }
}

// ============================================================
// Helper: Extract JSON from text that may contain markdown
// ============================================================
function extractJsonFromText(text: string): string | null {
  // Try direct parse first
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    try {
      JSON.parse(trimmed)
      return trimmed
    } catch { /* try removing markdown */ }
  }

  // Try extracting from code blocks
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    const inner = codeBlockMatch[1].trim()
    try {
      JSON.parse(inner)
      return inner
    } catch { /* continue */ }
  }

  // Try finding first { to last }
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1)
    try {
      JSON.parse(candidate)
      return candidate
    } catch { /* continue */ }
  }

  return null
}
