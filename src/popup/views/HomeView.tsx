import { useState } from 'react'
import {
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardList,
  Compass,
  Flame,
  Leaf,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react'
import type { PopupData } from '../../hooks/usePopupData'
import type { View } from '../types'
import ScoreRing from '../../components/analysis/ScoreRing'
import ProductHeadline from '../../components/analysis/ProductHeadline'
import { CLASSIFICATION_COLOR, CLASSIFICATION_LABEL, CONFIDENCE_LABEL, greeting, timeAgo } from '../../utils/format'
import { MSG } from '../../utils/messages'
import { send } from '../../utils/messaging'
import { progressFor } from '../../services/points-service'

interface Props {
  data: PopupData
  onNavigate: (view: View) => void
}

export default function HomeView({ data, onNavigate }: Props) {
  const { context, status, points, level, checklist, summary, analyse } = data
  const analysis = context?.analysis || null
  const [saving, setSaving] = useState(false)
  const [added, setAdded] = useState(false)
  const challenge = progressFor(points)

  const addToChecklist = async () => {
    if (!analysis || saving) return
    setSaving(true)
    try {
      await send(MSG.ADD_TO_CHECKLIST, { analysis })
      setAdded(true)
      await data.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-5 pt-1">
      <div>
        <p className="eyebrow">{greeting()}</p>
        <h1 className="mt-0.5 text-[17px] font-semibold leading-tight tracking-tight">
          Shop smarter, live greener
        </h1>
      </div>

      {/* Current page analysis */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-3.5 py-2">
          <span className="eyebrow">Current page</span>
          <button
            onClick={() => void analyse()}
            className="btn-ghost h-6 gap-1 px-1.5 text-[10px] font-semibold text-muted"
          >
            <RefreshCw className={`h-3 w-3 ${status === 'loading' ? 'animate-spin' : ''}`} />
            Re-scan
          </button>
        </div>

        <div className="p-3.5">
          {status === 'loading' && (
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 animate-pulse rounded-xl bg-sand" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-3/4 animate-pulse rounded-full bg-sand" />
                <div className="h-2 w-1/2 animate-pulse rounded-full bg-sand" />
              </div>
            </div>
          )}

          {status !== 'loading' && analysis && (
            <div className="animate-fade-in space-y-3">
              <ProductHeadline product={analysis.product} />
              <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-alt/60 p-2.5">
                <ScoreRing
                  score={analysis.score.overall}
                  classification={analysis.score.classification}
                  size={60}
                  label="score"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[12.5px] font-semibold"
                    style={{ color: CLASSIFICATION_COLOR[analysis.score.classification] }}
                  >
                    {CLASSIFICATION_LABEL[analysis.score.classification]}
                  </p>
                  <p className="text-[10px] leading-snug text-muted">
                    {CONFIDENCE_LABEL[analysis.score.confidence]} · {analysis.score.coverage}% evidenced
                  </p>
                  <p className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-muted">
                    {analysis.score.concerns[0] || analysis.score.positives[0] || 'Not enough detail on this page.'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onNavigate('breakdown')} className="btn-primary flex-1">
                  Full breakdown
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button onClick={addToChecklist} disabled={saving || added} className="btn-secondary flex-1">
                  {added ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Added
                    </>
                  ) : (
                    'Add to list'
                  )}
                </button>
              </div>
            </div>
          )}

          {status !== 'loading' && !analysis && (
            <div className="space-y-2 py-2 text-center">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-forest-tint text-forest-soft">
                <Search className="h-4 w-4" strokeWidth={1.8} />
              </div>
              <p className="text-[12.5px] font-semibold">No product detected here</p>
              <p className="mx-auto max-w-[250px] text-[11px] leading-relaxed text-muted">
                Open a product page on any online store. TerraCart reads the listing and scores what the page
                actually states.
              </p>
              <button onClick={() => void analyse()} className="btn-secondary mt-1">
                Analyse this page
              </button>
            </div>
          )}
        </div>
      </section>

      {/* TerraPoints */}
      <button onClick={() => onNavigate('achievements')} className="card w-full p-3.5 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-forest text-canvas">
              <Leaf className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-[12.5px] font-semibold leading-none">{points.points} TerraPoints</p>
              <p className="mt-1 text-[10px] text-muted">
                Level {level.level} · {level.name}
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted" />
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-forest-soft transition-all" style={{ width: `${level.progress}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <Flame className="h-3 w-3" /> {points.streak.current} day streak
          </span>
          <span>
            {challenge.done}/{challenge.total} weekly challenges
          </span>
        </div>
      </button>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { id: 'alternatives' as View, icon: Compass, label: 'Greener options', meta: 'Compare directions' },
          { id: 'plastic-free' as View, icon: Sparkles, label: 'Plastic-free finder', meta: 'Browse by category' },
          {
            id: 'checklist' as View,
            icon: ClipboardList,
            label: 'Shopping checklist',
            meta: `${summary.count} item${summary.count === 1 ? '' : 's'}`,
          },
          { id: 'reminders' as View, icon: RefreshCw, label: 'Reminders', meta: 'Reusable essentials' },
        ].map((action) => (
          <button
            key={action.id}
            onClick={() => onNavigate(action.id)}
            className="card flex flex-col items-start gap-1.5 p-3 text-left transition-colors hover:border-forest-soft"
          >
            <action.icon className="h-4 w-4 text-forest-soft" strokeWidth={1.8} />
            <span className="text-[11.5px] font-semibold leading-tight">{action.label}</span>
            <span className="text-[10px] text-muted">{action.meta}</span>
          </button>
        ))}
      </div>

      {/* Activity */}
      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="eyebrow">Recent activity</span>
          {checklist.length > 0 && (
            <button
              onClick={() => onNavigate('checklist')}
              className="text-[10px] font-semibold text-forest-soft"
            >
              View list
            </button>
          )}
        </div>
        {points.events.length === 0 ? (
          <p className="card p-3 text-[11px] leading-relaxed text-muted">
            Your analyses, saved products and checklist actions will appear here.
          </p>
        ) : (
          <ul className="card divide-y divide-line">
            {points.events.slice(0, 4).map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium">{event.label}</p>
                  <p className="text-[9.5px] text-muted">{timeAgo(event.timestamp)}</p>
                </div>
                {event.points > 0 && (
                  <span className="chip bg-forest-tint text-forest-soft">+{event.points}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}