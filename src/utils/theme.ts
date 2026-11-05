import type { Preferences } from '../types'

export function applyAppearance(preferences: Pick<Preferences, 'theme' | 'reduceMotion'>): void {
  if (typeof document === 'undefined') return
  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  const dark = preferences.theme === 'dark' || (preferences.theme === 'system' && prefersDark)
  document.documentElement.classList.toggle('theme-dark', dark)
  document.documentElement.classList.toggle('reduce-motion', !!preferences.reduceMotion)
}

export function watchSystemTheme(preferences: Preferences, onChange: () => void): () => void {
  if (preferences.theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return () => {}
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = () => onChange()
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}