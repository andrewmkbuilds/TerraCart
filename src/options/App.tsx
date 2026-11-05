import { useEffect, useState } from 'react'
import {
  Bell,
  Database,
  Info,
  Leaf,
  Palette,
  Sliders,
  Cloud,
} from 'lucide-react'
import type { Preferences, SyncState } from '../types'
import { DEFAULT_PREFERENCES, storage } from '../services/storage-service'
import { applyAppearance } from '../utils/theme'
import { MSG } from '../utils/messages'
import { send } from '../utils/messaging'
import GeneralSection from './sections/GeneralSection'
import AppearanceSection from './sections/AppearanceSection'
import PrioritiesSection from './sections/PrioritiesSection'
import NotificationsSection from './sections/NotificationsSection'
import DataSection from './sections/DataSection'
import SyncSection from './sections/SyncSection'
import AboutSection from './sections/AboutSection'

type SectionId = 'general' | 'appearance' | 'priorities' | 'notifications' | 'data' | 'sync' | 'about'

const SECTIONS: { id: SectionId; label: string; icon: typeof Bell }[] = [
  { id: 'general', label: 'General', icon: Sliders },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'priorities', label: 'Priorities', icon: Leaf },
  { id: 'notifications', label: 'Reminders', icon: Bell },
  { id: 'data', label: 'Your data', icon: Database },
  { id: 'sync', label: 'Cloud sync', icon: Cloud },
  { id: 'about', label: 'About', icon: Info },
]

export default function OptionsApp() {
  const [section, setSection] = useState<SectionId>('general')
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [sync, setSync] = useState<SyncState>({ status: 'unconfigured' })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void (async () => {
      const [nextPreferences, nextSync] = await Promise.all([storage.getPreferences(), storage.getSync()])
      setPreferences(nextPreferences)
      setSync(nextSync)
      applyAppearance(nextPreferences)
      setReady(true)
    })()
  }, [])

  const save = async (patch: Partial<Preferences>) => {
    const next = { ...preferences, ...patch }
    setPreferences(next)
    applyAppearance(next)
    await send(MSG.SAVE_PREFERENCES, { preferences: next })
  }

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-forest" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-6 py-4">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-forest text-canvas">
            <Leaf className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13.5px] font-semibold leading-none tracking-tight">TerraCart settings</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">Sustainability copilot</p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-6 py-6 md:flex-row">
        <nav className="flex gap-1.5 overflow-x-auto pb-1 md:w-48 md:shrink-0 md:flex-col md:overflow-visible md:pb-0">
          {SECTIONS.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setSection(entry.id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-[11.5px] font-medium transition-colors ${
                section === entry.id ? 'bg-forest text-canvas' : 'text-muted hover:bg-sand hover:text-ink'
              }`}
            >
              <entry.icon className="h-3.5 w-3.5" strokeWidth={1.9} />
              {entry.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-4">
          {section === 'general' && <GeneralSection preferences={preferences} save={save} />}
          {section === 'appearance' && <AppearanceSection preferences={preferences} save={save} />}
          {section === 'priorities' && <PrioritiesSection preferences={preferences} save={save} />}
          {section === 'notifications' && (
            <NotificationsSection
              preferences={preferences}
              save={save}
              onPreferencesChange={(patch) => setPreferences((current) => ({ ...current, ...patch }))}
            />
          )}
          {section === 'data' && <DataSection />}
          {section === 'sync' && <SyncSection preferences={preferences} save={save} sync={sync} setSync={setSync} />}
          {section === 'about' && <AboutSection />}
        </div>
      </div>
    </div>
  )
}