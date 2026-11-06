import { describe, expect, it } from 'vitest'
import { assessPlastic, CATEGORY_META, computeTerraScore } from '../sustainability-engine'
import { makeProduct } from './fixtures'

const category = (score: ReturnType<typeof computeTerraScore>, key: string) =>
  score.categories.find((entry) => entry.key === key)!

describe('computeTerraScore', () => {
  it('keeps every category weight positive and the total at 100%', () => {
    const total = Object.values(CATEGORY_META).reduce((sum, meta) => sum + meta.weight, 0)
    expect(total).toBeCloseTo(1, 5)
    Object.values(CATEGORY_META).forEach((meta) => expect(meta.weight).toBeGreaterThan(0))
  })

  it('leaves categories without evidence unscored instead of guessing', () => {
    const score = computeTerraScore(makeProduct({ name: 'Ceramic dinner plate' }))

    expect(category(score, 'certifications').score).toBeNull()
    expect(category(score, 'certifications').evidenceKind).toBe('unknown')
    expect(score.unknowns.length).toBeGreaterThan(0)
    expect(score.confidence).toBe('low')
  })

  it('scores evidence-backed categories and stays within their range', () => {
    const score = computeTerraScore(
      makeProduct({
        name: 'Stainless steel lunch box',
        description:
          '18/8 stainless steel body with a silicone seal. Shipped in recycled cardboard packaging with no plastic. Reusable for years, dishwasher safe.',
        materials: ['stainless steel', 'silicone'],
        features: ['Reusable'],
        specs: { Material: 'stainless steel' },
      }),
    )

    expect(score.overall).not.toBeNull()
    expect(category(score, 'materials').score).not.toBeNull()
    expect(category(score, 'packaging').score).not.toBeNull()
    expect(score.overall!).toBeGreaterThanOrEqual(0)
    expect(score.overall!).toBeLessThanOrEqual(100)
    expect(score.coverage).toBeGreaterThan(0)
    expect(score.coverage).toBeLessThanOrEqual(100)
  })

  it('reports plastic packaging when the listing mentions it', () => {
    const plastic = assessPlastic(
      makeProduct({
        name: 'Bamboo cutlery set',
        description: 'Packed in a plastic bag with a polypropylene sleeve.',
      }),
    )

    expect(plastic.packaging.status).toBe('contains-plastic')
    expect(plastic.packaging.evidence.length).toBeGreaterThan(0)
  })

  it('does not credit certifications that were never stated', () => {
    const score = computeTerraScore(
      makeProduct({
        name: 'Recycled cotton tote bag',
        description: 'Made from 100% recycled cotton, reusable and machine washable.',
        materials: ['recycled cotton'],
      }),
    )

    expect(category(score, 'certifications').score).toBeNull()
    expect(category(score, 'certifications').evidence).toHaveLength(0)
  })
})