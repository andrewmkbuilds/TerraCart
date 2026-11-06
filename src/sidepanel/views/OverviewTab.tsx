import { useState } from 'react'
import { Check, Info, Leaf, Package, ShieldCheck, Sparkles, TriangleAlert, Wrench } from 'lucide-react'
import type { ProductAnalysis } from '../../types'
import ScoreRing from '../../components/analysis/ScoreRing'
import {
  CLASSIFICATION_COLOR,
  CLASSIFICATION_LABEL,
  CONFIDENCE_LABEL,
} from '../../utils/format'
import { MSG } from '../../utils/messages'
import { send } from '../../utils/messaging'

const EVIDENCE_LABEL: Record<string, string> = {
  verified: 'Stated on page',
  inferred: 'Inferred',
  unknown: 'Unknown',
}

const SOURCE_LABEL: Record<string, string> = {
  'json-ld': 'Structured product data',
  microdata: 'Microdata markup',
  opengraph: 'Open Graph tags',
  adapter: 'Retailer adapter',
  heuristic: 'Page heuristics',
  manual: 'Your corrections',
}

function barColor(score: number | null): string {
  if (score === null) return 'transparent'
  if (score >= 70) return '#2F6E4C'
  if (score >= 45) return '#B5822A'
  return '#B5543F'
}

export default function OverviewTab({ analysis }: { analysis: ProductAnalysis }) {
  const { product, score, plastic, insights } = analysis
  const [added, setAdded] = useState(false)
  const durability = score.categories.find((category) => category.key === 'durability')
  const packaging = score.categories.find((category) => category.key === 'packaging')
  const rating = CLASSIFICATION_LABEL[score.classification]

  const addToChecklist = async () => {
    await send(MSG.ADD_TO_CHECKLIST, { analysis })
    setAdded(true)
  }

  return (
    <div className="space-y-3">
      {/* Score */}
      <section className="card p-4">
        <div className="flex items-start gap-4">
          <ScoreRing score={score.overall} classification={score.classification} size={92} label="TerraScore" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Sustainability rating
            </p>
            <p className="mt-0.5 text-[16px] font-semibold leading-tight" style={{ color: CLASSIFICATION_COLOR[score.classification] }}>
              {rating}
              {score.overall !== null && (
                <span className="ml-1.5 text-[12px] font-medium text-muted">{score.overall} / 100</span>
              )}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {CONFIDENCE_LABEL[score.confidence]} confidence · {score.coverage}% of the weighted model had evidence
              on this page
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span
                className={`chip ${
                  plastic.product.status === 'contains-plastic'
                    ? 'bg-clay/15 text-clay'
                    : plastic.product.status === 'plastic-free'
                      ? 'bg-forest-tint text-forest-soft'
                      : 'bg-sand text-muted'
                }`}
              >
                <Leaf className="h-2.5 w-2.5" /> Product: {plastic.product.status.replace('-', ' ')}
              </span>
              <span
                className={`chip ${
                  plastic.packaging.status === 'contains-plastic'
                    ? 'bg-clay/15 text-clay'
                    : plastic.packaging.status === 'plastic-free'
                      ? 'bg-forest-tint text-forest-soft'
                      : 'bg-sand text-muted'
                }`}
              >
                <Package className="h-2.5 w-2.5" /> Packaging: {plastic.packaging.status.replace('-', ' ')}
              </span>
            </div>
          </div>
        </div>

        {score.overall === null && (
          <div className="mt-3 rounded-xl bg-amber-tint px-3 py-2">
            <p className="text-[11px] font-semibold text-amber">Not enough evidence for a score</p>
            <p className="mt-0.5 text-[10.5px] leading-relaxed text-amber/90">
              This page does not state anything TerraCart can score. Rather than guess, it shows what is missing.
              Add the details in the popup's correction form, or try another product page.
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => void addToChecklist()} disabled={added} className="btn-primary">
            {added ? (
              <>
                <Check className="h-3.5 w-3.5" /> Added to checklist
              </>
            ) : (
              'Add to checklist'
            )}
          </button>
        </div>
      </section>

      {/* Breakdown */}
      <section className="card p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-[12px] font-semibold tracking-tight">Score breakdown</h2>
          <span className="text-[9.5px] text-muted">weighted average</span>
        </div>
        <ul className="space-y-3">
          {score.categories.map((category) => (
            <li key={category.key}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11.5px] font-medium">{category.label}</span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[9px] uppercase tracking-wide text-muted">
                    {Math.round(category.weight * 100)}%
                  </span>
                  <span className="text-[11.5px] font-semibold">{category.score === null ? '—' : category.score}</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${category.score ?? 0}%`, background: barColor(category.score) }}
                />
              </div>
              <p className="mt-1 text-[10px] leading-snug text-muted">
                <span className="font-semibold">{EVIDENCE_LABEL[category.evidenceKind]}</span>
                {category.evidence.length > 0
                  ? ` · ${category.evidence.slice(0, 3).join(' · ')}`
                  : ` · ${category.note}`}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Strengths & concerns */}
      {(score.positives.length > 0 || score.concerns.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          <section className="card p-4">
            <h2 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-tight">
              <ShieldCheck className="h-3.5 w-3.5 text-forest-soft" /> Environmental strengths
            </h2>
            {score.positives.length === 0 ? (
              <p className="text-[10.5px] leading-relaxed text-muted">No strengths could be evidenced on this page.</p>
            ) : (
              <ul className="space-y-1.5">
                {score.positives.map((item) => (
                  <li key={item} className="flex gap-1.5 text-[11px] leading-snug">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-forest-soft" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-4">
            <h2 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-tight">
              <TriangleAlert className="h-3.5 w-3.5 text-clay" /> Sustainability concerns
            </h2>
            {score.concerns.length === 0 ? (
              <p className="text-[10.5px] leading-relaxed text-muted">
                Nothing on this page raises a concern at the evidence level TerraCart can verify.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {score.concerns.map((item) => (
                  <li key={item} className="flex gap-1.5 text-[11px] leading-snug">
                    <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-clay" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* Materials, packaging, durability */}
      <div className="grid gap-3 md:grid-cols-3">
        <section className="card p-4">
          <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Materials</h2>
          {product.materials.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {product.materials.map((material) => (
                <span key={material} className="chip bg-surface-alt text-[10px] text-ink">
                  {material}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[10.5px] leading-relaxed text-muted">Not stated on this page.</p>
          )}
        </section>

        <section className="card p-4">
          <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Durability</h2>
          <p className="text-[11px] font-medium">
            {durability?.score === null || !durability ? 'Unknown' : `${durability.score} / 100`}
          </p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
            {durability?.evidence.length ? durability.evidence.slice(0, 2).join(' · ') : durability?.note}
          </p>
        </section>

        <section className="card p-4">
          <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Packaging</h2>
          <p className="text-[11px] font-medium capitalize">{plastic.packaging.status.replace('-', ' ')}</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
            {product.packaging || packaging?.note || 'Packaging is not described on this page.'}
          </p>
        </section>
      </div>

      {/* Evidence */}
      <section className="card p-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-tight">
          <Info className="h-3.5 w-3.5 text-muted" /> Evidence & confidence
        </h2>
        <dl className="grid gap-x-4 gap-y-1.5 text-[10.5px] sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Detected via</dt>
            <dd className="text-right font-medium">{SOURCE_LABEL[product.detection.source] || 'Page heuristics'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Field completeness</dt>
            <dd className="text-right font-medium">{product.detection.confidence}%</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Score confidence</dt>
            <dd className="text-right font-medium">{CONFIDENCE_LABEL[score.confidence]}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Missing fields</dt>
            <dd className="text-right font-medium">
              {product.detection.missing.length ? product.detection.missing.join(', ') : 'None'}
            </dd>
          </div>
        </dl>

        {score.unverifiedClaims.length > 0 && (
          <p className="mt-2.5 rounded-lg bg-amber-tint px-2.5 py-2 text-[10.5px] leading-relaxed text-amber">
            Marketing claims without evidence: {score.unverifiedClaims.join(', ')}.
          </p>
        )}

        {score.unknowns.length > 0 && (
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            Not stated on this page: {score.unknowns.map((item) => item.toLowerCase()).join(' · ')}. Missing data is
            excluded from the score, never counted as harm.
          </p>
        )}
      </section>

      {/* Recommendations */}
      <section className="card p-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-tight">
          <Sparkles className="h-3.5 w-3.5 text-forest-soft" /> Practical recommendations
        </h2>
        {insights.length === 0 && score.concerns.length === 0 ? (
          <p className="text-[10.5px] leading-relaxed text-muted">
            Nothing specific to act on from this page — check the alternatives tab for lower-impact directions.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {insights.map((insight) => (
              <li key={insight} className="flex gap-1.5 text-[11px] leading-snug">
                <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-forest-soft" />
                {insight}
              </li>
            ))}
            {plastic.packaging.status === 'contains-plastic' && (
              <li className="flex gap-1.5 text-[11px] leading-snug">
                <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-forest-soft" />
                Ask the retailer for plastic-free packaging, or consolidate the order to reduce packaging per item.
              </li>
            )}
            {!product.certifications.length && (
              <li className="flex gap-1.5 text-[11px] leading-snug">
                <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-forest-soft" />
                No third-party certification is stated — look for FSC, GOTS or Cradle to Cradle on the listing.
              </li>
            )}
          </ul>
        )}
      </section>

      <p className="px-1 pb-1 text-[9.5px] leading-relaxed text-muted">{analysis.disclaimer}</p>
    </div>
  )
}