import type { ReactNode } from 'react'

interface Props {
  title: string
  description?: string
  children: ReactNode
}

export default function Panel({ title, description, children }: Props) {
  return (
    <section className="card p-5">
      <header className="mb-4">
        <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{description}</p>}
      </header>
      {children}
    </section>
  )
}

export function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-line py-3 last:border-0 last:pb-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-[12px] font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}