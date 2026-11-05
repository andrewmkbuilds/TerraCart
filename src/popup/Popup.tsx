import { useState } from 'react'
import { ClipboardList, Home, Leaf, Settings, Trophy } from 'lucide-react'
import type { View } from './types'
import { usePopupData } from '../hooks/usePopupData'
import { openSettings } from '../utils/messaging'
import HomeView from './views/HomeView'
import BreakdownView from './views/BreakdownView'
import AlternativesView from './views/AlternativesView'
import PlasticFreeView from './views/PlasticFreeView'
import ChecklistView from './views/ChecklistView'
import RemindersView from './views/RemindersView'
import AchievementsView from './views/AchievementsView'

const TABS: { id: View; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'checklist', label: 'List', icon: ClipboardList },
  { id: 'achievements', label: 'Points', icon: Trophy },
]

export default function Popup() {
  const data = usePopupData(true)
  const [view, setView] = useState<View>('home')
  const back = () => setView('home')

  return (
    <div className="flex min-h-[420px] flex-col bg-canvas">
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <button onClick={back} className="flex items-center gap-2 text-left">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-forest text-canvas">
            <Leaf className="h-3.5 w-3.5" />
          </span>
          <span>
            <span className="block text-[12.5px] font-semibold leading-none tracking-tight">TerraCart</span>
            <span className="mt-0.5 block text-[8.5px] font-semibold uppercase tracking-[0.14em] text-muted">
              Sustainable shopping
            </span>
          </span>
        </button>
        <div className="flex items-center gap-1">
          {data.points.points > 0 && (
            <button
              onClick={() => setView('achievements')}
              className="chip bg-forest-tint text-forest-soft"
              aria-label="TerraPoints"
            >
              <Leaf className="h-2.5 w-2.5" /> {data.points.points}
            </button>
          )}
          <button
            onClick={openSettings}
            className="btn-ghost h-7 w-7 text-muted"
            aria-label="TerraCart settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <main className="popup-scroll max-h-[540px] flex-1 overflow-y-auto">
        {view === 'home' && <HomeView data={data} onNavigate={setView} />}
        {view === 'breakdown' && <BreakdownView data={data} onBack={back} onNavigate={setView} />}
        {view === 'alternatives' && <AlternativesView data={data} onBack={back} onNavigate={setView} />}
        {view === 'plastic-free' && <PlasticFreeView data={data} onBack={back} />}
        {view === 'checklist' && <ChecklistView data={data} onBack={back} />}
        {view === 'reminders' && <RemindersView data={data} onBack={back} />}
        {view === 'achievements' && <AchievementsView data={data} onBack={back} />}
      </main>

      <nav className="grid grid-cols-4 border-t border-line bg-surface">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`flex flex-col items-center gap-1 py-2 text-[9px] font-semibold transition-colors ${
              view === tab.id ? 'text-forest-soft' : 'text-muted'
            }`}
          >
            <tab.icon className="h-4 w-4" strokeWidth={view === tab.id ? 2.1 : 1.8} />
            {tab.label}
          </button>
        ))}
        <button
          onClick={openSettings}
          className="flex flex-col items-center gap-1 py-2 text-[9px] font-semibold text-muted"
        >
          <Settings className="h-4 w-4" strokeWidth={1.8} />
          Settings
        </button>
      </nav>
    </div>
  )
}