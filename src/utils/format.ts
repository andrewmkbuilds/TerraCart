import type { Classification, Confidence } from '../types'

export function formatPrice(price?: number, currency?: string): string | null {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null
  const safeCurrency = (currency || 'USD').toUpperCase().slice(0, 3)
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: safeCurrency,
      maximumFractionDigits: price % 1 === 0 ? 0 : 2,
    }).format(price)
  } catch {
    return `${safeCurrency} ${price.toFixed(2)}`
  }
}

export function hostLabel(hostname: string): string {
  if (!hostname) return 'Unknown store'
  const clean = hostname.replace(/^www\./, '')
  const [first] = clean.split('.')
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  excellent: 'Excellent',
  good: 'Good',
  moderate: 'Moderate',
  poor: 'Poor',
  'very-poor': 'Very Poor',
  unknown: 'Not enough info',
}

export const CLASSIFICATION_COLOR: Record<Classification, string> = {
  excellent: '#1F7A4D',
  good: '#3F8F5F',
  moderate: '#B5822A',
  poor: '#C2653B',
  'very-poor': '#A63A32',
  unknown: '#8A9490',
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
}

export function classificationFor(score: number | null): Classification {
  if (score === null) return 'unknown'
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'moderate'
  if (score >= 20) return 'poor'
  return 'very-poor'
}

export function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

export function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function truncate(text: string, max = 120): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}