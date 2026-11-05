import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  body: string
  action?: ReactNode
}

export default function EmptyState({ icon: Icon, title, body, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-forest-tint text-forest-soft">
        <Icon className="h-5 w-5" strokeWidth={1.7} />
      </div>
      <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
      <p className="max-w-[250px] text-[11.5px] leading-relaxed text-muted">{body}</p>
      {action}
    </div>
  )
}