import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

interface Props {
  title: string
  subtitle?: string
  onBack: () => void
  action?: ReactNode
}

export default function ViewHeader({ title, subtitle, onBack, action }: Props) {
  return (
    <div className="flex items-center gap-2.5 px-4 pb-2 pt-3">
      <button
        onClick={onBack}
        className="btn-ghost h-7 w-7 shrink-0 border border-line"
        aria-label="Back"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[13.5px] font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="truncate text-[10.5px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}