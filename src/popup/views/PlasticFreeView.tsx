import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { PopupData } from '../../hooks/usePopupData'
import type { AlternativeSuggestion } from '../../types'
import ViewHeader from '../components/ViewHeader'
import AlternativeCard from '../../components/analysis/AlternativeCard'
import {
  ALTERNATIVES_DISCLAIMER,
  PLASTIC_FREE_CATEGORIES,
  plasticFreeCatalogue,
  sortAlternatives,
  type PlasticFreeCategoryKey,
} from '../../services/alternatives-service'
import { MSG } from '../../utils/messages'
import { send } from '../../utils/messaging'

interface Props {
  data: PopupData
  onBack: () => void
}

export default function PlasticFreeView({ data, onBack }: Props) {
  const detected = data.context?.analysis?.product.category as PlasticFreeCategoryKey | undefined
  const [category, setCategory] = useState<PlasticFreeCategoryKey>(
    PLASTIC_FREE_CATEGORIES.some((entry) => entry.key === detected) ? (detected as PlasticFreeCategoryKey) : 'kitchen'
  )

  const items = useMemo(() => sortAlternatives(plasticFreeCatalogue(category), 'highest-score'), [category])

  const open = (item: AlternativeSuggestion) => {
    void send(MSG.RECORD_ALTERNATIVE_OPEN, { title: item.title }).catch(() => {})
    window.open(item.searchUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div>
      <ViewHeader title="Plastic-free finder" subtitle="Swaps by category" onBack={onBack} />
      <div className="px-4 pb-5">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {PLASTIC_FREE_CATEGORIES.map((entry) => (
            <button
              key={entry.key}
              onClick={() => setCategory(entry.key)}
              className={`chip border px-2.5 py-1 ${
                category === entry.key ? 'border-forest bg-forest text-canvas' : 'border-line bg-surface text-muted'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="mb-2 flex items-center gap-1.5 text-[10px] text-muted">
          <Sparkles className="h-3 w-3 text-forest-soft" />
          {items.length} plastic-free directions in {PLASTIC_FREE_CATEGORIES.find((entry) => entry.key === category)?.label}
        </div>

        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <AlternativeCard key={item.id} item={item} onOpen={open} />
          ))}
        </div>

        <p className="mt-3 px-1 text-[9.5px] leading-relaxed text-muted">{ALTERNATIVES_DISCLAIMER}</p>
      </div>
    </div>
  )
}