import { useState } from 'react'
import { Compass } from 'lucide-react'
import type { PopupData } from '../../hooks/usePopupData'
import type { AlternativeFilter, AlternativeSuggestion } from '../../types'
import type { View } from '../types'
import ViewHeader from '../components/ViewHeader'
import EmptyState from '../components/EmptyState'
import AlternativeCard from '../components/AlternativeCard'
import { ALL_FILTERS, ALTERNATIVES_DISCLAIMER, sortAlternatives } from '../../services/alternatives-service'
import { MSG } from '../../utils/messages'
import { send } from '../../utils/messaging'

interface Props {
  data: PopupData
  onBack: () => void
  onNavigate: (view: View) => void
}

export default function AlternativesView({ data, onBack, onNavigate }: Props) {
  const [filter, setFilter] = useState<AlternativeFilter>('highest-score')
  const analysis = data.context?.analysis || null
  const items = analysis ? sortAlternatives(analysis.alternatives, filter) : []

  const open = (item: AlternativeSuggestion) => {
    void send(MSG.RECORD_ALTERNATIVE_OPEN, { title: item.title }).catch(() => {})
    window.open(item.searchUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div>
      <ViewHeader
        title="Greener options"
        subtitle={analysis ? `Based on ${analysis.product.name.slice(0, 34)}…` : 'Nothing analysed yet'}
        onBack={onBack}
      />

      {!analysis ? (
        <EmptyState
          icon={Compass}
          title="No product analysed"
          body="Open a product page first and TerraCart will suggest lower-impact directions for that kind of item."
          action={
            <button onClick={() => onNavigate('plastic-free')} className="btn-secondary mt-1">
              Browse plastic-free finder
            </button>
          }
        />
      ) : (
        <div className="px-4 pb-5">
          <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
            {ALL_FILTERS.map((entry) => (
              <button
                key={entry.key}
                onClick={() => setFilter(entry.key)}
                className={`chip shrink-0 border px-2.5 py-1 ${
                  filter === entry.key
                    ? 'border-forest bg-forest text-canvas'
                    : 'border-line bg-surface text-muted'
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {items.length === 0 && (
              <p className="card p-3 text-[11px] leading-relaxed text-muted">
                No suggestions match this filter. Try another one.
              </p>
            )}
            {items.map((item) => (
              <AlternativeCard key={item.id} item={item} onOpen={open} />
            ))}
          </div>

          <p className="mt-3 px-1 text-[9.5px] leading-relaxed text-muted">{ALTERNATIVES_DISCLAIMER}</p>
        </div>
      )}
    </div>
  )
}