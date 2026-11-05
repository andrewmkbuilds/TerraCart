import type { Preferences } from '../../types'
import Panel, { Row } from '../components/Panel'
import Toggle from '../components/Toggle'

interface Props {
  preferences: Preferences
  save: (patch: Partial<Preferences>) => Promise<void>
}

const THEMES: { id: Preferences['theme']; label: string; hint: string }[] = [
  { id: 'light', label: 'Light', hint: 'Warm paper canvas' },
  { id: 'dark', label: 'Dark', hint: 'Deep forest canvas' },
  { id: 'system', label: 'System', hint: 'Match your OS' },
]

export default function AppearanceSection({ preferences, save }: Props) {
  return (
    <>
      <Panel title="Theme" description="Applied across the popup, side panel and this settings page.">
        <div className="grid gap-2 sm:grid-cols-3">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => void save({ theme: theme.id })}
              className={`rounded-xl border p-3 text-left transition-colors ${
                preferences.theme === theme.id ? 'border-forest bg-forest-tint/50' : 'border-line hover:border-forest-soft'
              }`}
            >
              <p className="text-[12px] font-semibold">{theme.label}</p>
              <p className="mt-0.5 text-[10px] text-muted">{theme.hint}</p>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Motion" description="TerraCart keeps animation subtle; you can switch it off entirely.">
        <Row label="Reduce motion" hint="Removes panel transitions and progress animations.">
          <Toggle
            label="Reduce motion"
            checked={preferences.reduceMotion}
            onChange={(value) => void save({ reduceMotion: value })}
          />
        </Row>
      </Panel>
    </>
  )
}