import { ArrowUpRight, Package, Recycle, Leaf, TriangleAlert } from 'lucide-react'
import type { ProductAnalysis } from '../../types'
import { MSG } from '../../utils/messages'
import { send } from '../../utils/messaging'

const STATUS_COPY: Record<string, { label: string; tone: string; body: string }> = {
  'plastic-free': {
    label: 'Plastic-free',
    tone: 'bg-forest-tint text-forest-soft',
    body: 'The page describes this without plastic.',
  },
  'contains-plastic': {
    label: 'Contains plastic',
    tone: 'bg-clay/15 text-clay',
    body: 'The page describes plastic content or a plastic part.',
  },
  unknown: {
    label: 'Not stated',
    tone: 'bg-sand text-muted',
    body: 'The page does not say. TerraCart does not assume either way.',
  },
}

function Signal({
  title,
  status,
  evidence,
}: {
  title: string
  status: 'plastic-free' | 'contains-plastic' | 'unknown'
  evidence: string[]
}) {
  const copy = STATUS_COPY[status]
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{title}</h3>
        <span className={`chip ${copy.tone}`}>{copy.label}</span>
      </div>
      <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">{copy.body}</p>
      {evidence.length > 0 && (
        <ul className="mt-2 space-y-1">
          {evidence.slice(0, 4).map((item) => (
            <li key={item} className="text-[10px] leading-snug text-ink/80">
              · {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function PackagingTab({ analysis }: { analysis: ProductAnalysis }) {
  const { product, plastic, score, alternatives } = analysis
  const packagingCategory = score.categories.find((category) => category.key === 'packaging')
  const circularity = score.categories.find((category) => category.key === 'circularity')
  const plasticFreeSwaps = alternatives.filter((item) => item.plasticFree).slice(0, 3)

  return (
    <div className="space-y-3">
      <section className="card p-4">
        <h2 className="flex items-center gap-1.5 text-[12px] font-semibold tracking-tight">
          <Package className="h-3.5 w-3.5 text-forest-soft" /> Packaging assessment
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-ink/85">
          {product.packaging || 'This page does not describe the packaging.'}
        </p>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-alt p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">Packaging score</p>
            <p className="mt-0.5 text-[13px] font-semibold">
              {packagingCategory?.score === null || !packagingCategory ? 'Unknown' : `${packagingCategory.score} / 100`}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-muted">
              {packagingCategory?.evidence.length
                ? packagingCategory.evidence.slice(0, 2).join(' · ')
                : packagingCategory?.note}
            </p>
          </div>
          <div className="rounded-xl bg-surface-alt p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">Recyclability / circularity</p>
            <p className="mt-0.5 text-[13px] font-semibold">
              {circularity?.score === null || !circularity ? 'Unknown' : `${circularity.score} / 100`}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-muted">
              {circularity?.evidence.length ? circularity.evidence.slice(0, 2).join(' · ') : circularity?.note}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Signal title="Product plastic" status={plastic.product.status} evidence={plastic.product.evidence} />
        <Signal title="Packaging plastic" status={plastic.packaging.status} evidence={plastic.packaging.evidence} />
      </div>

      <section className="card p-4">
        <h2 className="flex items-center gap-1.5 text-[12px] font-semibold tracking-tight">
          <Recycle className="h-3.5 w-3.5 text-forest-soft" /> What would improve this
        </h2>
        <ul className="mt-2 space-y-1.5 text-[11px] leading-snug">
          {plastic.packaging.status === 'unknown' && (
            <li className="flex gap-1.5">
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber" />
              Packaging is not stated — ask the retailer before buying so the choice is informed.
            </li>
          )}
          {plastic.packaging.status === 'contains-plastic' && (
            <li className="flex gap-1.5">
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-clay" />
              Plastic packaging is described — request plastic-free delivery or buy in person where possible.
            </li>
          )}
          {circularity && (circularity.score === null || circularity.score < 60) && (
            <li className="flex gap-1.5">
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber" />
              No refill, reuse or take-back route is mentioned on the page.
            </li>
          )}
          {plastic.product.status !== 'plastic-free' && (
            <li className="flex gap-1.5">
              <Leaf className="mt-0.5 h-3 w-3 shrink-0 text-forest-soft" />
              A plastic-free material build scores better on the same evidence rules.
            </li>
          )}
          {plastic.product.status === 'plastic-free' && plastic.packaging.status === 'plastic-free' && (
            <li className="flex gap-1.5">
              <Leaf className="mt-0.5 h-3 w-3 shrink-0 text-forest-soft" />
              Both product and packaging are plastic-free as described — keep it that way at checkout.
            </li>
          )}
        </ul>
      </section>

      {plasticFreeSwaps.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 text-[12px] font-semibold tracking-tight">Plastic-free packaging directions</h2>
          <ul className="space-y-1.5">
            {plasticFreeSwaps.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    void send(MSG.RECORD_ALTERNATIVE_OPEN, { title: item.title }).catch(() => {})
                    window.open(item.searchUrl, '_blank', 'noopener,noreferrer')
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-line px-2.5 py-2 text-left transition-colors hover:border-forest-soft"
                >
                  <span className="min-w-0">
                    <span className="block text-[11px] font-medium leading-snug">{item.title}</span>
                    <span className="block text-[10px] text-muted">{item.material}</span>
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-forest-soft" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[9.5px] leading-relaxed text-muted">
            Link opens a live product search — TerraCart never shows invented products or prices.
          </p>
        </section>
      )}
    </div>
  )
}