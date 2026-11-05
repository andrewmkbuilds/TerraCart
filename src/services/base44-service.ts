import type { SyncSnapshot, SyncState } from '../types'
import { storage } from './storage-service'

/**
 * Optional Base44 sync.
 *
 * Everything in TerraCart works locally. Sync only becomes active when the build
 * has a Base44 app id (VITE_BASE44_APP_ID) and the user signs in from Settings.
 */

const APP_ID = (import.meta.env.VITE_BASE44_APP_ID || '').trim()
const APP_BASE_URL = (import.meta.env.VITE_BASE44_APP_BASE_URL || '').trim()
const TOKEN_KEY = 'terracart_base44_token'
const ENTITY = 'TerraCartSync'

interface SdkUser {
  id?: string
  email?: string
}

interface SdkClient {
  auth: {
    me: () => Promise<SdkUser>
    loginViaEmailPassword: (email: string, password: string) => Promise<{ access_token: string; user?: SdkUser }>
    logout: () => void
  }
  entities: Record<string, {
    list: (sort?: string, limit?: number) => Promise<Record<string, unknown>[]>
    create: (data: Record<string, unknown>) => Promise<unknown>
    update: (id: string, data: Record<string, unknown>) => Promise<unknown>
  }>
}

let cachedClient: SdkClient | null = null

export function isConfigured(): boolean {
  return APP_ID.length > 0
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable */
  }
}

async function getClient(): Promise<SdkClient | null> {
  if (!isConfigured()) return null
  if (cachedClient) return cachedClient
  const { createClient } = await import('@base44/sdk')
  const token = readToken()
  cachedClient = createClient({
    appId: APP_ID,
    ...(APP_BASE_URL ? { appBaseUrl: APP_BASE_URL } : {}),
    ...(token ? { token } : {}),
  }) as unknown as SdkClient
  return cachedClient
}

export async function getSyncState(): Promise<SyncState> {
  if (!isConfigured()) {
    return {
      status: 'unconfigured',
      message: 'This build has no Base44 app id, so everything stays on this device.',
    }
  }
  const token = readToken()
  if (!token) return { status: 'signed-out' }
  try {
    const client = await getClient()
    if (!client) return { status: 'unconfigured' }
    const user = await client.auth.me()
    return { status: 'connected', email: user?.email }
  } catch {
    writeToken(null)
    cachedClient = null
    return { status: 'signed-out', message: 'The saved session expired. Please sign in again.' }
  }
}

export async function connect(email: string, password: string): Promise<SyncState> {
  const client = await getClient()
  if (!client) {
    return { status: 'unconfigured', message: 'Cloud sync is not configured in this build.' }
  }
  const response = await client.auth.loginViaEmailPassword(email.trim(), password)
  if (!response?.access_token) throw new Error('Sign-in did not return a session.')
  writeToken(response.access_token)
  cachedClient = null
  const next = await getClient()
  const user = await next?.auth.me()
  const state: SyncState = { status: 'connected', email: user?.email || email.trim() }
  await storage.setSync(state)
  return state
}

export async function disconnect(): Promise<SyncState> {
  const client = await getClient()
  try {
    client?.auth.logout()
  } catch {
    /* ignore */
  }
  writeToken(null)
  cachedClient = null
  const state: SyncState = { status: 'signed-out' }
  await storage.setSync(state)
  return state
}

export async function pushSnapshot(snapshot: SyncSnapshot): Promise<SyncState> {
  const client = await getClient()
  if (!client) throw new Error('Cloud sync is not configured in this build.')
  const existing = await client.entities[ENTITY].list('-updated_date', 5)
  const payload = JSON.stringify(snapshot)
  const record = existing[0] as { id?: string; created_by_id?: string } | undefined

  if (record?.id) {
    await client.entities[ENTITY].update(record.id, { payload, updated_at: snapshot.updatedAt })
  } else {
    await client.entities[ENTITY].create({ payload, updated_at: snapshot.updatedAt })
  }

  const state: SyncState = {
    status: 'connected',
    lastSyncedAt: Date.now(),
  }
  await storage.setSync(state)
  return state
}

export async function pullSnapshot(): Promise<SyncSnapshot | null> {
  const client = await getClient()
  if (!client) return null
  const rows = await client.entities[ENTITY].list('-updated_date', 1)
  const row = rows[0] as { payload?: string } | undefined
  if (!row?.payload) return null
  try {
    return JSON.parse(row.payload) as SyncSnapshot
  } catch {
    return null
  }
}

export async function buildSnapshot(): Promise<SyncSnapshot> {
  const [checklist, saved, points, preferences, reminders] = await Promise.all([
    storage.getChecklist(),
    storage.getSaved(),
    storage.getPoints(),
    storage.getPreferences(),
    storage.getReminders(),
  ])
  return { checklist, saved, points, preferences, reminders, updatedAt: Date.now() }
}