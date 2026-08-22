// ============================================================
// Gemini API Types
// ============================================================

// ---- Request ----
export interface GeminiRequest {
  contents: GeminiContent[]
  tools?: GeminiTool[]
  generationConfig?: GeminiGenerationConfig
  systemInstruction?: GeminiContent
}

export interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }

export interface GeminiTool {
  googleSearch?: Record<string, never>
  google_search?: Record<string, never>
}

export interface GeminiGenerationConfig {
  temperature?: number
  maxOutputTokens?: number
  topP?: number
  topK?: number
  responseMimeType?: string
}

// ---- Response ----
export interface GeminiResponse {
  candidates?: GeminiCandidate[]
  promptFeedback?: {
    blockReason?: string
    safetyRatings?: any[]
  }
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
}

export interface GeminiCandidate {
  content: GeminiContent
  finishReason?: string
  safetyRatings?: any[]
  groundingMetadata?: GeminiGroundingMetadata
}

export interface GeminiGroundingMetadata {
  groundingChunks?: GeminiGroundingChunk[]
  groundingSupports?: GeminiGroundingSupport[]
  searchEntryPoint?: {
    renderedContent: string
  }
  webSearchQueries?: string[]
}

export interface GeminiGroundingChunk {
  web?: {
    uri: string
    title: string
  }
}

export interface GeminiGroundingSupport {
  segment: {
    startIndex: number
    endIndex: number
    text: string
  }
  confidenceScores: number[]
  groundingChunkIndices: number[]
}

// ---- Parsed structured output from Gemini ----
export interface GeminiProductAnalysis {
  verdict: 'great-choice' | 'good-choice' | 'consider-alternatives' | 'limited-info'
  ecoScore: {
    overall: number
    reusability: number
    durability: number
    packaging: number
    repairability: number
    materialConsiderations: number
  }
  confidence: 'high' | 'medium' | 'low'
  reasoning: string[]
  packagingAnalysis: string
  greenwashingWarning: string | null
  researchSources: Array<{ name: string; url: string; type: string }>
}

export interface GeminiResearchResult {
  alternatives: Array<{
    name: string
    brand: string
    retailer: string
    price: string
    url: string
    reason: string
    ecoScore: number | null
    characteristics: string[]
  }>
  packagingAlternatives: Array<{
    description: string
    url: string
    retailer: string
  }>
  reusableAlternatives: Array<{
    name: string
    brand: string
    retailer: string
    price: string
    url: string
    reason: string
  }>
  summary: string
  confidence: 'high' | 'medium' | 'low'
  sources: Array<{ name: string; url: string; type: string }>
}

export interface GeminiChatResponse {
  content: string
  sources: Array<{ name: string; url: string }>
}
