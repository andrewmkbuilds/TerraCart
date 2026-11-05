import type { ChecklistItem, ChecklistSummary, ProductAnalysis } from '../types'
import { storage } from './storage-service'
import { bumpPlasticFreePurchase, bumpReusableAdded, recordAction } from './points-service'

export const CHECKLIST_CATEGORIES = [
  'Kitchen',
  'Food storage',
  'Personal care',
  'Household',
  'Clothing',
  'Stationery',
  'Electronics',
  'Other',
]

function makeId(): string {
  return `ci_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

export function summaryOf(items: ChecklistItem[]): ChecklistSummary {
  const scored = items.filter((item) => typeof item.score === 'number') as (ChecklistItem & { score: number })[]
  return {
    count: items.length,
    averageScore: scored.length
      ? Math.round(scored.reduce((sum, item) => sum + item.score, 0) / scored.length)
      : null,
    reusableCount: items.filter((item) => item.reusable).length,
    plasticPackagingCount: items.filter((item) => item.plasticPackaging === true).length,
    missingInfoCount: items.filter((item) => !item.hasEnvironmentalInfo).length,
  }
}

export function itemFromAnalysis(analysis: ProductAnalysis, category?: string): ChecklistItem {
  const { product, score, plastic } = analysis
  const circularity = score.categories.find((c) => c.key === 'circularity')
  const reusable =
    /reusable|refill/i.test(product.name) ||
    (circularity?.evidence || []).some((evidence) => /reusable|refill/i.test(evidence))

  return {
    id: makeId(),
    name: product.name,
    category: category || prettyCategory(product.category),
    quantity: 1,
    note: '',
    purchased: false,
    url: product.url,
    image: product.image,
    price: product.price,
    currency: product.currency,
    score: score.overall,
    reusable,
    plasticPackaging: plastic.packaging.status === 'contains-plastic' ? true : plastic.packaging.status === 'plastic-free' ? false : 'unknown',
    hasEnvironmentalInfo: score.coverage > 0,
    addedAt: Date.now(),
  }
}

const CATEGORY_LABEL: Record<string, string> = {
  kitchen: 'Kitchen',
  'food-storage': 'Food storage',
  'personal-care': 'Personal care',
  household: 'Household',
  clothing: 'Clothing',
  stationery: 'Stationery',
  electronics: 'Electronics',
}

export function prettyCategory(category: string): string {
  return CATEGORY_LABEL[category] || (category ? category.replace(/[-_]/g, ' ') : 'Other')
}

export async function addAnalysisToChecklist(
  analysis: ProductAnalysis
): Promise<{ items: ChecklistItem[]; added: boolean }> {
  const items = await storage.getChecklist()
  const existing = items.find(
    (item) => (item.url && item.url === analysis.product.url) || item.name === analysis.product.name
  )
  if (existing) return { items, added: false }

  const item = itemFromAnalysis(analysis)
  const next = [item, ...items]
  await storage.setChecklist(next)

  if (item.reusable) {
    await bumpReusableAdded()
    await recordAction({
      action: 'add-reusable-item',
      label: `Added reusable item — ${item.name}`,
      points: 8,
      dedupeKey: `reusable:${item.url || item.name}`,
      challengeId: 'reusable',
      feature: 'checklist',
      checklistCount: next.length,
    })
  } else {
    await recordAction({
      action: 'analyse-product',
      label: `Added to checklist — ${item.name}`,
      points: 2,
      dedupeKey: `checklist:${item.url || item.name}`,
      challengeId: 'checklist',
      feature: 'checklist',
      checklistCount: next.length,
    })
  }

  return { items: next, added: true }
}

export interface ManualItemInput {
  name: string
  category: string
  quantity: number
  note?: string
  reusable?: boolean
}

export async function addManualItem(input: ManualItemInput): Promise<ChecklistItem[]> {
  const items = await storage.getChecklist()
  const item: ChecklistItem = {
    id: makeId(),
    name: input.name.trim(),
    category: input.category,
    quantity: Math.max(1, Math.round(input.quantity || 1)),
    note: input.note?.trim() || '',
    purchased: false,
    score: null,
    reusable: !!input.reusable,
    plasticPackaging: 'unknown',
    hasEnvironmentalInfo: false,
    addedAt: Date.now(),
  }
  const next = [item, ...items]
  await storage.setChecklist(next)

  if (item.reusable) {
    await bumpReusableAdded()
    await recordAction({
      action: 'add-reusable-item',
      label: `Added reusable item — ${item.name}`,
      points: 8,
      dedupeKey: `reusable-manual:${item.id}`,
      challengeId: 'reusable',
      feature: 'checklist',
      checklistCount: next.length,
    })
  } else {
    await recordAction({
      action: 'analyse-product',
      label: `Added to checklist — ${item.name}`,
      points: 2,
      dedupeKey: `checklist-manual:${item.id}`,
      challengeId: 'checklist',
      feature: 'checklist',
      checklistCount: next.length,
    })
  }

  return next
}

export async function updateChecklistItem(
  id: string,
  patch: Partial<ChecklistItem>
): Promise<ChecklistItem[]> {
  const items = await storage.getChecklist()
  const previous = items.find((item) => item.id === id)
  const next = items.map((item) =>
    item.id === id
      ? {
          ...item,
          ...patch,
          purchasedAt: patch.purchased && !item.purchased ? Date.now() : patch.purchased === false ? undefined : item.purchasedAt,
        }
      : item
  )
  await storage.setChecklist(next)

  if (previous && !previous.purchased && next.find((i) => i.id === id)?.purchased) {
    const item = next.find((i) => i.id === id) as ChecklistItem
    if (item.plasticPackaging !== true) {
      await bumpPlasticFreePurchase()
      await recordAction({
        action: 'plastic-free-purchase',
        label: `Plastic-free purchase — ${item.name}`,
        points: 10,
        dedupeKey: `purchase:${item.id}`,
        challengeId: 'plastic-free',
        feature: 'checklist',
        checklistCount: next.length,
      })
    }
  }

  return next
}

export async function deleteChecklistItem(id: string): Promise<ChecklistItem[]> {
  const items = await storage.getChecklist()
  const next = items.filter((item) => item.id !== id)
  await storage.setChecklist(next)
  return next
}