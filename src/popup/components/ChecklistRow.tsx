import { Check, Trash2 } from 'lucide-react'
import type { ChecklistItem } from '../../types'
import { prettyCategory } from '../../services/checklist-service'

interface Props {
  item: ChecklistItem
  onToggle: (item: ChecklistItem) => void
  onDelete: (item: ChecklistItem) => void
}

export default function ChecklistRow({ item, onToggle, onDelete }: Props) {
  return (
    <li className="flex items-start gap-2.5 px-3 py-2.5">
      <button
        onClick={() => onToggle(item)}
        aria-label={item.purchased ? 'Mark as not purchased' : 'Mark as purchased'}
        className={`mt-0.5 grid shrink-0 place-items-center rounded-md border transition-colors ${
          item.purchased ? 'border-forest bg-forest text-canvas' : 'border-line text-transparent hover:border-forest-soft'
        }`}
        style={{ height: 18, width: 18 }}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        <p className={`text-[11.5px] font-medium leading-snug ${item.purchased ? 'text-muted line-through' : ''}`}>
          {item.name}
          {item.quantity > 1 && <span className="ml-1 text-[10px] text-muted">×{item.quantity}</span>}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[9.5px] text-muted">
          <span>{prettyCategory(item.category)}</span>
          {item.reusable && <span className="text-forest-soft">· reusable</span>}
          {item.plasticPackaging === true && <span className="text-clay">· plastic packaging</span>}
          {!item.hasEnvironmentalInfo && <span className="text-amber">· no eco info</span>}
        </p>
        {item.note && <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted">{item.note}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {item.score !== null && (
          <span className="chip bg-surface-alt text-[9.5px] text-muted">{item.score}</span>
        )}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-[9.5px] font-semibold text-forest-soft ${item.url ? '' : 'hidden'}`}
        >
          open
        </a>
        <button onClick={() => onDelete(item)} className="btn-ghost h-6 w-6 text-muted" aria-label="Delete item">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </li>
  )
}