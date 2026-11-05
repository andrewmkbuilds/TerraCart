import type { Preferences, PriorityKey } from '../../types'
import Panel from '../components/Panel'

interface Props {
  preferences: Preferences
  save: (patch: Partial<Preferences>) => Promise<void>
}

const PRIORITIES: { id: PriorityKey; label: string; hint: string }[] = [
  { id: 'plastic-reduction', label: 'Plastic reduction', hint: 'Flag plastic packaging and single-use parts' },
  { id: 'reusability', label: 'Reusability', hint: 'Prefer items you can use again and again' },
  { id: 'recyclability', label: 'Recyclability', hint: 'Favour materials with real recycling streams' },
  { id: 'durability', label: 'Durability', hint: 'Longer warranties and repairable design' },
  { id: 'ethical-sourcing', label: 'Ethical sourcing', hint: 'Certifications and supply-chain claims' },
  { id: 'low-impact', label: 'Low impact materials', hint: 'Plant fibres, recycled content, low processing' },
]

export default function PrioritiesSection({ preferences, save }: Props) {
  const toggle = (id: PriorityKey) => {
    const has = preferences.priorities.includes(id)
    const next = has ? preferences.priorities.filter((value) => value !== id) : [...preferences.priorities, id]
    void save({ priorities: next })
  }

  return (
    <Panel
      title="What matters most to you"
      description="Priorities never change the TerraScore itself — they shape the notes you see on each product, so the score stays comparable between items."
    >
      <ul className="space-y-2">
        {PRIORITIES.map((priority) => {
          const active = preferences.priorities.includes(priority.id)
          return (
            <li key={priority.id}>
              <button
                onClick={() => toggle(priority.id)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                  active ? 'border-forest bg-forest-tint/40' : 'border-line hover:border-forest-soft'
                }`}
              >
                <span
                  className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-md border ${
                    active ? 'border-forest bg-forest text-canvas' : 'border-line'
                  }`}
                >
                  {active && (
                    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="4">
                      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span>
                  <span className="block text-[12px] font-semibold">{priority.label}</span>
                  <span className="mt-0.5 block text-[10.5px] leading-relaxed text-muted">{priority.hint}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}