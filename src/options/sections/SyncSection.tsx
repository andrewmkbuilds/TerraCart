import { useState } from 'react'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import type { Preferences, SyncState } from '../../types'
import Panel, { Row } from '../components/Panel'
import Toggle from '../components/Toggle'
import { buildSnapshot, connect, disconnect, isConfigured, pullSnapshot, pushSnapshot } from '../../services/base44-service'
import { timeAgo } from '../../utils/format'

interface Props {
  preferences: Preferences
  save: (patch: Partial<Preferences>) => Promise<void>
  sync: SyncState
  setSync: (value: SyncState) => void
}

export default function SyncSection({ preferences, save, sync, setSync }: Props) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const configured = isConfigured()

  const signIn = async () => {
    if (!form.email || !form.password) return
    setBusy(true)
    setMessage(null)
    try {
      const next = await connect(form.email, form.password)
      setSync(next)
      await save({ cloudSync: true })
      setForm({ email: '', password: '' })
    } catch (error) {
      setMessage((error as Error)?.message || 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    setSync(await disconnect())
    await save({ cloudSync: false })
  }

  const push = async () => {
    setBusy(true)
    try {
      const snapshot = await buildSnapshot()
      setSync(await pushSnapshot(snapshot))
      setMessage('Snapshot uploaded.')
    } catch (error) {
      setMessage((error as Error)?.message || 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const pull = async () => {
    setBusy(true)
    try {
      const snapshot = await pullSnapshot()
      setMessage(snapshot ? 'Cloud snapshot found — data merged locally.' : 'No cloud snapshot yet.')
    } catch (error) {
      setMessage((error as Error)?.message || 'Restore failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel
      title="Cloud sync (optional)"
      description="TerraCart works fully offline. Sign in only if you want your checklist and points backed up to your Base44 account."
    >
      {!configured && (
        <p className="mb-3 rounded-xl bg-amber/10 px-3 py-2 text-[10.5px] leading-relaxed text-amber">
          This build has no Base44 app id, so cloud sync stays off. Local storage is fully functional.
        </p>
      )}

      {sync.status !== 'connected' ? (
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold text-muted">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="field"
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold text-muted">Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="field"
              autoComplete="current-password"
            />
          </label>
          <button onClick={() => void signIn()} disabled={busy || !configured} className="btn-primary w-full">
            <Cloud className="h-3.5 w-3.5" /> {busy ? 'Signing in…' : 'Sign in to sync'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-line p-3">
            <div>
              <p className="text-[12px] font-medium">{sync.email}</p>
              <p className="text-[10px] text-muted">
                {sync.lastSyncedAt ? `Last synced ${timeAgo(sync.lastSyncedAt)}` : 'Connected'}
              </p>
            </div>
            <button onClick={() => void signOut()} className="btn-secondary">
              <CloudOff className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void push()} disabled={busy} className="btn-primary flex-1">
              <RefreshCw className="h-3.5 w-3.5" /> Back up now
            </button>
            <button onClick={() => void pull()} disabled={busy} className="btn-secondary flex-1">
              Restore
            </button>
          </div>
        </div>
      )}

      <div className="mt-3">
        <Row label="Automatic backup" hint="Uploads a snapshot whenever your local data changes.">
          <Toggle
            label="Automatic backup"
            checked={preferences.cloudSync}
            onChange={(value) => void save({ cloudSync: value })}
          />
        </Row>
      </div>

      {message && <p className="mt-2 text-[10.5px] text-muted">{message}</p>}
      {sync.message && <p className="mt-2 text-[10.5px] text-clay">{sync.message}</p>}
    </Panel>
  )
}