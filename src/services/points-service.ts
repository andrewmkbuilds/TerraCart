import type {
  Achievement,
  Challenge,
  ChallengeWeek,
  LevelInfo,
  PointsEvent,
  PointsState,
  PointAction,
} from '../types'
import { createDefaultPoints, storage } from './storage-service'
import { todayKey } from '../utils/format'

export const LEVELS = [
  { name: 'Seedling', min: 0 },
  { name: 'Sprout', min: 40 },
  { name: 'Sapling', min: 100 },
  { name: 'Young Tree', min: 200 },
  { name: 'Evergreen', min: 350 },
  { name: 'Canopy', min: 550 },
  { name: 'Grove', min: 800 },
  { name: 'Forest', min: 1100 },
  { name: 'Rainforest', min: 1500 },
  { name: 'Guardian', min: 2000 },
]

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-analysis', title: 'First Look', description: 'Analyse your first product', icon: 'Sparkles' },
  { id: 'five-analyses', title: 'Curious Shopper', description: 'Analyse 5 products', icon: 'Search' },
  { id: 'twenty-analyses', title: 'Label Reader', description: 'Analyse 20 products', icon: 'ScanLine' },
  { id: 'first-reusable', title: 'Reuse Starter', description: 'Add a reusable product to your checklist', icon: 'RefreshCw' },
  { id: 'reusable-five', title: 'Reuse Habit', description: 'Add 5 reusable products', icon: 'Repeat' },
  { id: 'first-plastic-free', title: 'Plastic-Free Purchase', description: 'Record a plastic-free purchase', icon: 'Leaf' },
  { id: 'plastic-free-five', title: 'Plastic-Free Streak', description: 'Record 5 plastic-free purchases', icon: 'Sprout' },
  { id: 'alternative-explorer', title: 'Better Options', description: 'Open 3 greener alternatives', icon: 'Compass' },
  { id: 'checklist-ten', title: 'Planner', description: 'Keep 10 items on your checklist', icon: 'ClipboardList' },
  { id: 'streak-three', title: 'Consistent', description: 'Stay active 3 days in a row', icon: 'Flame' },
  { id: 'challenge-complete', title: 'Challenge Crusher', description: 'Complete a weekly challenge', icon: 'Trophy' },
  { id: 'all-features', title: 'Full Toolkit', description: 'Use every TerraCart feature once', icon: 'LayoutGrid' },
]

const CHALLENGE_POOL: Omit<Challenge, 'progress' | 'claimed'>[] = [
  { id: 'analyses', label: 'Analyse 4 products', target: 4, reward: 30 },
  { id: 'alternatives', label: 'Explore 3 greener alternatives', target: 3, reward: 20 },
  { id: 'plastic-free', label: 'Record 2 plastic-free purchases', target: 2, reward: 40 },
  { id: 'reusable', label: 'Add 2 reusable products', target: 2, reward: 25 },
  { id: 'checklist', label: 'Plan 3 items in your checklist', target: 3, reward: 20 },
]

function weekId(date = new Date()): string {
  const target = new Date(date)
  const dayNumber = (target.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNumber)
  return todayKey(target)
}

function pickChallenges(id: string): Challenge[] {
  // Deterministic per week so the set stays stable across contexts.
  const seed = id.split('-').reduce((sum, part) => sum + Number(part), 0)
  const start = seed % CHALLENGE_POOL.length
  const picked = [0, 1, 2].map((offset) => CHALLENGE_POOL[(start + offset) % CHALLENGE_POOL.length])
  return picked.map((challenge) => ({ ...challenge, progress: 0, claimed: false }))
}

export function ensureWeek(state: PointsState): PointsState {
  const id = weekId()
  if (state.challengeWeek?.weekId === id) return state
  return { ...state, challengeWeek: { weekId: id, items: pickChallenges(id) } }
}

export function levelFor(points: number): LevelInfo {
  let index = 0
  LEVELS.forEach((level, i) => {
    if (points >= level.min) index = i
  })
  const current = LEVELS[index]
  const next = LEVELS[index + 1]
  const progress = next
    ? Math.min(100, Math.round(((points - current.min) / (next.min - current.min)) * 100))
    : 100
  return { level: index + 1, name: current.name, min: current.min, next: next ? next.min : null, progress }
}

function bumpStreak(state: PointsState): PointsState['streak'] {
  const today = todayKey()
  const last = state.streak.lastActiveDate
  if (last === today) return state.streak
  const yesterday = todayKey(new Date(Date.now() - 86400000))
  const current = last === yesterday ? state.streak.current + 1 : 1
  return {
    current,
    longest: Math.max(state.streak.longest, current),
    lastActiveDate: today,
  }
}

function unlockedAchievements(state: PointsState, checklistCount: number): PointsState['achievements'] {
  const unlocked = { ...state.achievements }
  const now = Date.now()
  const c = state.counters
  const grant = (id: string, condition: boolean) => {
    if (condition && !unlocked[id]) unlocked[id] = now
  }
  grant('first-analysis', c.analyses >= 1)
  grant('five-analyses', c.analyses >= 5)
  grant('twenty-analyses', c.analyses >= 20)
  grant('first-reusable', c.reusableItemsAdded >= 1)
  grant('reusable-five', c.reusableItemsAdded >= 5)
  grant('first-plastic-free', c.plasticFreePurchases >= 1)
  grant('plastic-free-five', c.plasticFreePurchases >= 5)
  grant('alternative-explorer', c.alternativesOpened >= 3)
  grant('checklist-ten', checklistCount >= 10)
  grant('streak-three', state.streak.current >= 3)
  grant('challenge-complete', state.challengeWeek.items.some((item) => item.claimed))
  grant('all-features', c.featuresUsed.length >= 6)
  return unlocked
}

export interface RecordActionInput {
  action: PointAction
  label: string
  points: number
  /** When set, the action only awards once per key. */
  dedupeKey?: string
  /** Increments the matching weekly challenge. */
  challengeId?: 'analyses' | 'alternatives' | 'plastic-free' | 'reusable' | 'checklist'
  feature?: string
  analysisProductId?: string
  checklistCount?: number
}

export async function recordAction(input: RecordActionInput): Promise<PointsState> {
  let state = ensureWeek(await storage.getPoints())
  const counters = { ...state.counters }

  if (input.analysisProductId) {
    const today = todayKey()
    const analysedToday = counters.dailyAnalyses[today] || []
    if (!analysedToday.includes(input.analysisProductId)) {
      counters.analyses += 1
      counters.dailyAnalyses = {
        ...counters.dailyAnalyses,
        [today]: [...analysedToday, input.analysisProductId].slice(-40),
      }
    }
  }

  if (input.feature && !counters.featuresUsed.includes(input.feature)) {
    counters.featuresUsed = [...counters.featuresUsed, input.feature]
  }

  const alreadyAwarded = input.dedupeKey ? counters.awardedKeys[input.dedupeKey] : undefined
  const newEvents: PointsEvent[] = []

  if (!alreadyAwarded) {
    state = {
      ...state,
      points: state.points + input.points,
      streak: bumpStreak(state),
      counters: {
        ...counters,
        awardedKeys: input.dedupeKey ? { ...counters.awardedKeys, [input.dedupeKey]: Date.now() } : counters.awardedKeys,
      },
    }
    newEvents.push({
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action: input.action,
      label: input.label,
      points: input.points,
      timestamp: Date.now(),
    })
  } else if (input.analysisProductId) {
    state = { ...state, counters }
  }

  // Weekly challenge progress + completion rewards
  if (input.challengeId) {
    const items = state.challengeWeek.items.map((challenge) => {
      if (challenge.id !== input.challengeId || challenge.claimed) return challenge
      return { ...challenge, progress: Math.min(challenge.target, challenge.progress + 1) }
    })
    const completed = items.filter((item) => !item.claimed && item.progress >= item.target)
    const claimedItems = items.map((item) =>
      completed.some((done) => done.id === item.id) ? { ...item, claimed: true } : item
    )
    state = { ...state, challengeWeek: { ...state.challengeWeek, items: claimedItems } }
    for (const done of completed) {
      state = { ...state, points: state.points + done.reward }
      newEvents.push({
        id: `ev_ch_${done.id}_${Date.now()}`,
        action: 'challenge-complete',
        label: `Challenge complete — ${done.label}`,
        points: done.reward,
        timestamp: Date.now(),
      })
    }
  }

  state = {
    ...state,
    events: [...newEvents, ...state.events].slice(0, 40),
    achievements: unlockedAchievements(state, input.checklistCount ?? 0),
  }

  await storage.setPoints(state)
  return state
}

export async function bumpPlasticFreePurchase(): Promise<PointsState> {
  let state = await storage.getPoints()
  state = { ...state, counters: { ...state.counters, plasticFreePurchases: state.counters.plasticFreePurchases + 1 } }
  await storage.setPoints(state)
  return state
}

export async function bumpReusableAdded(): Promise<PointsState> {
  let state = await storage.getPoints()
  state = { ...state, counters: { ...state.counters, reusableItemsAdded: state.counters.reusableItemsAdded + 1 } }
  await storage.setPoints(state)
  return state
}

export async function bumpAlternativeOpened(): Promise<PointsState> {
  let state = await storage.getPoints()
  state = { ...state, counters: { ...state.counters, alternativesOpened: state.counters.alternativesOpened + 1 } }
  await storage.setPoints(state)
  return state
}

export async function grantAchievement(id: string): Promise<PointsState> {
  const state = ensureWeek(await storage.getPoints())
  if (state.achievements[id]) return state
  const achievement = ACHIEVEMENTS.find((item) => item.id === id)
  if (!achievement) return state
  const next: PointsState = {
    ...state,
    achievements: { ...state.achievements, [id]: Date.now() },
    events: [
      {
        id: `ev_ach_${id}`,
        action: 'achievement',
        label: `Achievement unlocked — ${achievement.title}`,
        points: 0,
        timestamp: Date.now(),
      },
      ...state.events,
    ].slice(0, 40),
  }
  await storage.setPoints(next)
  return next
}

export async function resetPoints(): Promise<PointsState> {
  const fresh = ensureWeek(createDefaultPoints())
  await storage.setPoints(fresh)
  return fresh
}

export function progressFor(state: PointsState): { done: number; total: number } {
  const items = state.challengeWeek.items
  return { done: items.filter((item) => item.achieved || item.progress >= item.target).length, total: items.length }
}

export type { ChallengeWeek }