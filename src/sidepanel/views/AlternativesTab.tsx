import { useMemo, useState } from 'react'
import { Check, Compass, Plus } from 'lucide-react'
import type { AlternativeFilter, AlternativeSuggestion, ProductAnalysis } from '../../types'
import AlternativeCard from '../../components/analysis/AlternativeCard'
import { ALL_FILTERS, ALTERNATIVES_DISCLAIMER, sortAlternatives } from '../../services/alternatives-service'
import { MSG } from '../../utils/messages'
import { send } from '../../utils/messaging'

interface Props {
  analysis: ProductAnalysis
  checklistNames: string[]
}

export default function AlternativesTab({ analysis, checklistNames }: Props) {
  const [filter, setFilter] = useState<AlternativeFilter>('highest-score')
  const [pending, setPending] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<string[]>([])

  const items = useMemo(() => sortAlternatives(analysis.alternatives, filter), [analysis.alternatives, filter])
  const normalised = checklistNames.map((name) => name.trim().toLowerCase())

  const isOnList = (item: AlternativeSuggestion) =>
    addedIds.includes(item.id) || normalised.includes(item.title.trim().toLowerCase())

  const open = (item: AlternativeSuggestion) => {
    void send(MSG.RECORD_ALTERNATIVE_OPEN, { title: item.title }).catch(() => {})
    window.open(item.searchUrl, '_blank', 'noopener,noreferrer')
  }

  const addToList = async (item: AlternativeSuggestion) => {
    if (isOnList(item) || pending === item.id) return
    setPending(item.id)
    try {
      await send(MSG.ADD_CHECKLIST_ITEM, {
        name: item.title,
        category: item.category,
        quantity: 1,
        reusable: item.reusable,
      })
      setAddedIds((ids) => [...ids, item.id])
    } finally {
      setPending(null)
    }
  }

  if (analysis.alternatives.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 p-6 text-center">
        <Compass className="h-5 w-5 text-muted" />
        <p className="text-[12.5px] font-semibold">No lower-impact directions found</p>
        <p className="max-w-[320px] text-[11px] leading-relaxed text-muted">
          TerraCart could not match this product to a category it knows. Try the plastic-free finder in the popup
          for a browse-by-category view.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {ALL_FILTERS.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setFilter(entry.key)}
            className={`chip border px-2.5 py-1 ${
              filter === entry.key ? 'border-forest bg-forest text-canvas' : 'border-line bg-surface text-muted'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2.5 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-1.5">
            <AlternativeCard item={item} onOpen={open} />
            <button
              onClick={() => void addToList(item)}
              disabled={isOnList(item) || pending === item.id}
              className="btn-secondary w-full"
            >
              {isOnList(item) ? (
                <>
                  <Check className="h-3.5 w-3.5" /> On your checklist
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" /> {pending === item.id ? 'Adding…' : 'Add to shopping list'}
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <p className="card p-3 text-[11px] leading-relaxed text-muted">
          Nothing matches this filter — try “Highest TerraScore”.
        </p>
      )}

      <p className="px-1 text-[9.5px] leading-relaxed text-muted">{ALTERNATIVES_DISCLAIMER}</p>
    </div>
  )
}