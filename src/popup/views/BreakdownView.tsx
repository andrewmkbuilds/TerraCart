import { useState } from 'react'
import { Check, Compass, Info, Pencil, Save, TriangleAlert } from 'lucide-react'
import type { PopupData } from '../../hooks/usePopupData'
import type { ProductAnalysis } from '../../types'
import type { View } from '../types'
import ViewHeader from '../components/ViewHeader'
import ScoreRing from '../components/ScoreRing'
import ProductHeadline from '../components/ProductHeadline'
import EmptyState from '../components/EmptyState'
import { CLASSIFICATION_COLOR, CLASSIFICATION_LABEL, CONFIDENCE_LABEL } from '../../utils/format'
import { createAnalysis } from '../../services/product-service'
import { MSG } from '../../utils/messages'
import { send } from '../../utils/messaging'

interface Props {
  data: PopupData
  onBack: () => void
  onNavigate: (view: View) => void
}

const EVIDENCE_LABEL: Record<string, string> = {
  verified: 'Stated on page',
  inferred: 'Inferred',
  unknown: 'Unknown',
}

export default function BreakdownView({ data, onBack, onNavigate }: Props) {
  const initial = data.context?.analysis || null
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(initial)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [added, setAdded] = useState(false)
  const [form, setForm] = useState({
    name: initial?.product.name || '',
    brand: initial?.product.brand || '',
    price: initial?.product.price ? String(initial.product.price) : '',
    materials: initial?.product.materials.join(', ') || '',
    packaging: initial?.product.packaging || '',
    certifications: initial?.product.certifications.join(', ') || '',
  })

  if (!analysis) {
    return (
      <div>
        <ViewHeader title="Score breakdown" onBack={onBack} />
        <EmptyState
          icon={Compass}
          title="Nothing analysed yet"
          body="Open a product page and TerraCart will break the score down by materials, packaging, durability, circularity, certifications and sourcing."
        />
      </div>
    )
  }

  const { score, plastic } = analysis

  const recalculate = () => {
    const product = {
      ...analysis.product,
      name: form.name.trim() || analysis.product.name,
      brand: form.brand.trim() || undefined,
      price: form.price ? Number(form.price) : undefined,
      materials: form.materials
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
      packaging: form.packaging.trim() || undefined,
      certifications: form.certifications
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      detection: { ...analysis.product.detection, source: 'manual' as const },
    }
    const next = createAnalysis(product, data.preferences)
    setAnalysis(next)
    setEditing(false)
    setSaved(false)
    setAdded(false)
  }

  const persist = async (action: 'add' | 'save') => {
    if (action === 'add') {
      await send(MSG.ADD_TO_CHECKLIST, { analysis })
      setAdded(true)
    } else {
      await send(MSG.SAVE_PRODUCT, { analysis })
      setSaved(true)
    }
    await data.refresh()
  }

  return (
    <div>
      <ViewHeader
        title="Score breakdown"
        subtitle={`${analysis.product.retailer} · ${EVIDENCE_LABEL[analysis.product.detection.source] || 'Detected'}`}
        onBack={onBack}
        action={
          <button onClick={() => setEditing((value) => !value)} className="btn-ghost h-7 w-7" aria-label="Correct details">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        }
      />

      <div className="flex flex-col gap-3 px-4 pb-5">
        <div className="card p-3.5">
          <ProductHeadline product={analysis.product} />
          <div className="mt-3 flex items-center gap-3">
            <ScoreRing score={score.overall} classification={score.classification} size={72} label="TerraScore" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold" style={{ color: CLASSIFICATION_COLOR[score.classification] }}>
                {CLASSIFICATION_LABEL[score.classification]}
              </p>
              <p className="text-[10.5px] leading-snug text-muted">
                {CONFIDENCE_LABEL[score.confidence]} · {score.coverage}% of the weighted model had evidence
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className={`chip ${plastic.product.status === 'contains-plastic' ? 'bg-clay/15 text-clay' : plastic.product.status === 'plastic-free' ? 'bg-forest-tint text-forest-soft' : 'bg-sand text-muted'}`}>
                  Product: {plastic.product.status.replace('-', ' ')}
                </span>
                <span className={`chip ${plastic.packaging.status === 'contains-plastic' ? 'bg-clay/15 text-clay' : plastic.packaging.status === 'plastic-free' ? 'bg-forest-tint text-forest-soft' : 'bg-sand text-muted'}`}>
                  Packaging: {plastic.packaging.status.replace('-', ' ')}
                </span>
              </div>
            </div>
          </div>
          {score.overall === null && (
            <p className="mt-3 rounded-xl bg-amber/10 px-2.5 py-2 text-[10.5px] leading-relaxed text-amber">
              No score is shown because the page states nothing TerraCart can score. Correcting the details below
              recalculates it locally — nothing is guessed.
            </p>
          )}
        </div>

        {editing && (
          <div className="card animate-rise-in space-y-2 p-3.5">
            <p className="eyebrow">Correct product details</p>
            <p className="text-[10.5px] leading-relaxed text-muted">
              Only enter what the product page actually states. TerraCart recalculates instantly.
            </p>
            {[
              { key: 'name' as const, label: 'Product name', placeholder: 'e.g. Insulated steel bottle' },
              { key: 'brand' as const, label: 'Brand', placeholder: 'Optional' },
              { key: 'price' as const, label: 'Price', placeholder: 'e.g. 24.95', numeric: true },
              { key: 'materials' as const, label: 'Materials (comma separated)', placeholder: 'stainless steel, silicone' },
              { key: 'packaging' as const, label: 'Packaging', placeholder: 'e.g. recycled cardboard box' },
              { key: 'certifications' as const, label: 'Certifications', placeholder: 'e.g. FSC, GOTS' },
            ].map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-[10px] font-semibold text-muted">{field.label}</span>
                <input
                  value={form[field.key]}
                  inputMode={field.numeric ? 'decimal' : 'text'}
                  placeholder={field.placeholder}
                  onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                  className="field"
                />
              </label>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={recalculate} className="btn-primary flex-1">
                Recalculate score
              </button>
              <button onClick={() => setEditing(false)} className="btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </div>
        )}

        <section className="card p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow">How the score is built</span>
            <span className="text-[9.5px] text-muted">weighted</span>
          </div>
          <ul className="space-y-2.5">
            {score.categories.map((category) => (
              <li key={category.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11.5px] font-medium">{category.label}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[9px] uppercase tracking-wide text-muted">
                      {Math.round(category.weight * 100)}%
                    </span>
                    <span className="text-[11.5px] font-semibold" style={{ color: category.score === null ? undefined : 'var(--ink)' }}>
                      {category.score === null ? '—' : category.score}
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${category.score ?? 0}%`,
                      background:
                        category.score === null
                          ? 'transparent'
                          : category.score >= 70
                            ? '#2F6E4C'
                            : category.score >= 45
                              ? '#B5822A'
                              : '#B5543F',
                    }}
                  />
                </div>
                <p className="mt-1 text-[10px] leading-snug text-muted">
                  <span className="font-semibold">{EVIDENCE_LABEL[category.evidenceKind]}</span>
                  {category.evidence.length > 0 && ` · ${category.evidence.slice(0, 2).join(', ')}`}
                  {category.score === null && ` · ${category.note}`}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {(score.positives.length > 0 || score.concerns.length > 0) && (
          <section className="card space-y-2 p-3.5">
            {score.positives.length > 0 && (
              <div>
                <p className="eyebrow mb-1">Strengths</p>
                <ul className="space-y-1">
                  {score.positives.slice(0, 3).map((item) => (
                    <li key={item} className="flex gap-1.5 text-[10.5px] leading-snug">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-forest-soft" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {score.concerns.length > 0 && (
              <div>
                <p className="eyebrow mb-1">Concerns</p>
                <ul className="space-y-1">
                  {score.concerns.slice(0, 3).map((item) => (
                    <li key={item} className="flex gap-1.5 text-[10.5px] leading-snug">
                      <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-clay" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {score.unknowns.length > 0 && (
          <section className="card p-3.5">
            <p className="eyebrow mb-1">Not stated on the page</p>
            <p className="text-[10.5px] leading-relaxed text-muted">
              {score.unknowns.map((item) => item.toLowerCase()).join(' · ')}
            </p>
            <p className="mt-1 text-[9.5px] leading-relaxed text-muted">
              Missing data is excluded from the score rather than counted as harm.
            </p>
          </section>
        )}

        {score.unverifiedClaims.length > 0 && (
          <section className="rounded-2xl border border-amber/30 bg-amber/10 p-3">
            <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-amber">
              <Info className="h-3 w-3" /> Marketing claims without evidence
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-amber/90">
              {score.unverifiedClaims.join(', ')} — this wording is not backed by a certification on the page.
            </p>
          </section>
        )}

        <div className="flex gap-2">
          <button onClick={() => void persist('add')} disabled={added} className="btn-primary flex-1">
            {added ? 'Added to list' : 'Add to checklist'}
          </button>
          <button onClick={() => void persist('save')} disabled={saved} className="btn-secondary flex-1">
            <Save className="h-3.5 w-3.5" />
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>

        <button onClick={() => onNavigate('alternatives')} className="btn-secondary">
          See greener options
        </button>

        <p className="px-1 text-[9.5px] leading-relaxed text-muted">{analysis.disclaimer}</p>
      </div>
    </div>
  )
}