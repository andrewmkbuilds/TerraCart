import { ArrowUpRight, RefreshCw, Leaf } from 'lucide-react'
import type { AlternativeSuggestion } from '../../types'

interface Props {
  item: AlternativeSuggestion
  onOpen: (item: AlternativeSuggestion) => void
}

export default function AlternativeCard({ item, onOpen }: Props) {
  return (
    <button
      onClick={() => onOpen(item)}
      className="card w-full p-3 text-left transition-colors hover:border-forest-soft"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold leading-snug tracking-tight">{item.title}</p>
          <p className="mt-0.5 text-[10px] text-muted">{item.material}</p>
        </div>
        <span className="chip shrink-0 bg-forest-tint text-forest-soft">{item.materialScore}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[10.5px] leading-relaxed text-muted">{item.reason}</p>
      <div className="mt-2 flex items-center gap-1.5">
        {item.reusable && (
          <span className="chip bg-sand text-muted">
            <RefreshCw className="h-2.5 w-2.5" /> Reusable
          </span>
        )}
        {item.plasticFree && (
          <span className="chip bg-forest-tint text-forest-soft">
            <Leaf className="h-2.5 w-2.5" /> Plastic-free
          </span>
        )}
        <span className="ml-auto flex items-center gap-0.5 text-[10px] font-semibold text-forest-soft">
          Search <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
    </button>
  )
}