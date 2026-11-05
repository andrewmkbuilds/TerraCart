import type {
  ChecklistItem,
  DetectedProduct,
  Preferences,
  ProductAnalysis,
  Reminder,
  SavedProduct,
} from '../types'
import { storage } from './storage-service'
import { createAnalysis } from './product-service'
import {
  addAnalysisToChecklist,
  addManualItem,
  deleteChecklistItem,
  updateChecklistItem,
} from './checklist-service'
import { recordAction, resetPoints } from './points-service'
import { syncAlarms } from './reminders-service'
import { todayKey } from '../utils/format'

/** Records an analysis in history and awards TerraPoints. */
export async function recordAnalysis(analysis: ProductAnalysis): Promise<ProductAnalysis> {
  const preferences = await storage.getPreferences()

  if (preferences.saveHistory) {
    const history = await storage.getHistory()
    const record = {
      id: `h_${Date.now()}`,
      productId: analysis.product.id,
      name: analysis.product.name,
      brand: analysis.product.brand,
      image: analysis.product.image,
      price: analysis.product.price,
      currency: analysis.product.currency,
      hostname: analysis.product.hostname,
      url: analysis.product.url,
      score: analysis.score.overall,
      classification: analysis.score.classification,
      analysedAt: analysis.analysedAt,
    }
    const withoutDuplicate = history.filter((entry) => entry.productId !== record.productId)
    await storage.setHistory([record, ...withoutDuplicate])
  }

  await recordAction({
    action: 'analyse-product',
    label: `Analysed ${analysis.product.name}`,
    points: 5,
    dedupeKey: `analyse:${analysis.product.id}:${todayKey()}`,
    analysisProductId: analysis.product.id,
    challengeId: 'analyses',
    feature: 'analyse',
  })

  return analysis
}

export async function analyseProduct(product: DetectedProduct): Promise<ProductAnalysis> {
  const preferences = await storage.getPreferences()
  return recordAnalysis(createAnalysis(product, preferences))
}

export async function addToChecklist(analysis: ProductAnalysis) {
  return addAnalysisToChecklist(analysis)
}

export async function saveProduct(analysis: ProductAnalysis): Promise<{ saved: SavedProduct[]; added: boolean }> {
  const saved = await storage.getSaved()
  if (saved.some((item) => item.productId === analysis.product.id)) {
    return { saved, added: false }
  }
  const entry: SavedProduct = {
    id: `s_${Date.now()}`,
    productId: analysis.product.id,
    name: analysis.product.name,
    brand: analysis.product.brand,
    image: analysis.product.image,
    url: analysis.product.url,
    hostname: analysis.product.hostname,
    score: analysis.score.overall,
    savedAt: Date.now(),
  }
  const next = [entry, ...saved].slice(0, 100)
  await storage.setSaved(next)

  await recordAction({
    action: 'save-product',
    label: `Saved ${analysis.product.name}`,
    points: 3,
    dedupeKey: `save:${analysis.product.id}`,
    feature: 'save',
  })

  return { saved: next, added: true }
}

export async function recordAlternativeOpen(title: string): Promise<void> {
  await recordAction({
    action: 'open-alternative',
    label: `Explored a greener option — ${title}`,
    points: 6,
    dedupeKey: `alt:${title}:${todayKey()}`,
    challengeId: 'alternatives',
    feature: 'alternatives',
  })
}

export async function updateItem(id: string, patch: Partial<ChecklistItem>): Promise<ChecklistItem[]> {
  return updateChecklistItem(id, patch)
}

export async function removeItem(id: string): Promise<ChecklistItem[]> {
  return deleteChecklistItem(id)
}

export async function addManualChecklistItem(input: {
  name: string
  category: string
  quantity: number
  note?: string
  reusable?: boolean
}): Promise<ChecklistItem[]> {
  const items = await addManualItem(input)
  await recordAction({
    action: 'analyse-product',
    label: 'Added a checklist item',
    points: 0,
    dedupeKey: `manual-challenge:${items[0]?.id}`,
    challengeId: 'checklist',
    feature: 'checklist',
    checklistCount: items.length,
  })
  return items
}

export async function savePreferences(preferences: Preferences): Promise<Preferences> {
  await storage.setPreferences(preferences)
  if (!preferences.notificationsEnabled) {
    await syncAlarms()
  }
  return preferences
}

export async function saveReminders(reminders: Reminder[]): Promise<Reminder[]> {
  await storage.setReminders(reminders)
  await syncAlarms(reminders)
  return reminders
}

export async function resetTerraPoints() {
  return resetPoints()
}

export async function clearActivity() {
  await storage.clearActivity()
}