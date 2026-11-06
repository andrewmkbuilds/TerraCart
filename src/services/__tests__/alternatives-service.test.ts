import { describe, expect, it } from 'vitest'
import { sortAlternatives, suggestAlternatives } from '../alternatives-service'
import { makeProduct } from './fixtures'

describe('suggestAlternatives', () => {
  it('suggests drinkware for a travel mug, not clothing', () => {
    const titles = suggestAlternatives(
      makeProduct({
        name: 'Insulated Travel Mug 500ml',
        description:
          'Double-walled stainless steel body with a plastic lid, packed in recycled cardboard with a plastic bag.',
        materials: ['stainless steel'],
      }),
    )
      .map((suggestion) => suggestion.title)
      .join(' / ')

    expect(titles).toMatch(/mug|tumbler/i)
    expect(titles).not.toMatch(/cotton|linen|garment/i)
  })

  it('matches the product archetype for a toothbrush', () => {
    const titles = suggestAlternatives(makeProduct({ name: 'Bamboo Toothbrush' })).map(
      (suggestion) => suggestion.title,
    )
    expect(titles.join(' / ')).toMatch(/bamboo toothbrush/i)
  })

  it('always returns searchable, explained suggestions', () => {
    const suggestions = suggestAlternatives(makeProduct({ name: 'Reusable shopping bag' }))

    expect(suggestions.length).toBeGreaterThan(0)
    suggestions.forEach((suggestion) => {
      expect(suggestion.searchUrl).toMatch(/^https?:\/\//)
      expect(suggestion.searchQuery.length).toBeGreaterThan(0)
      expect(suggestion.reason.length).toBeGreaterThan(0)
    })
  })

  it('sorts plastic-free suggestions first when asked', () => {
    const suggestions = suggestAlternatives(makeProduct({ name: 'Paper coffee cup' }))
    const sorted = sortAlternatives(suggestions, 'plastic-free')
    const firstNonPlasticFree = sorted.findIndex((suggestion) => !suggestion.plasticFree)
    const lastPlasticFree = sorted.map((s) => s.plasticFree).lastIndexOf(true)

    if (firstNonPlasticFree !== -1) expect(firstNonPlasticFree).toBeGreaterThan(lastPlasticFree)
  })
})