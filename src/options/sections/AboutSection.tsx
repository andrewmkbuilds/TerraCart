import { Leaf, ShieldCheck } from 'lucide-react'
import Panel from '../components/Panel'

const WEIGHTS = [
  { label: 'Materials', value: '25%', note: 'What the product is made of, and whether that is stated or inferred' },
  { label: 'Packaging', value: '20%', note: 'Packaging described on the page, plastic-free signals first' },
  { label: 'Durability', value: '20%', note: 'Warranties, repairability, repairable parts and construction' },
  { label: 'Circularity', value: '15%', note: 'Reusability, refills and take-back or recycling routes' },
  { label: 'Certifications', value: '10%', note: 'Independent labels such as FSC, GOTS, Cradle to Cradle' },
  { label: 'Sourcing', value: '10%', note: 'Origin, supply-chain and ethical sourcing statements' },
]

export default function AboutSection() {
  return (
    <>
      <Panel title="TerraCart 1.0.0" description="A sustainable shopping copilot that reads the page in front of you.">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest text-canvas">
            <Leaf className="h-5 w-5" />
          </span>
          <p className="text-[11.5px] leading-relaxed text-muted">
            TerraCart detects products on retail pages, extracts the sustainability evidence that is actually
            written there, and turns it into a transparent TerraScore with a plastic assessment and lower-impact
            directions.
          </p>
        </div>
      </Panel>

      <Panel
        title="How TerraScore is calculated"
        description="Six weighted categories. Missing evidence is excluded and lowers confidence — it is never counted as harm."
      >
        <ul className="divide-y divide-line">
          {WEIGHTS.map((entry) => (
            <li key={entry.label} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
              <div>
                <p className="text-[11.5px] font-medium">{entry.label}</p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{entry.note}</p>
              </div>
              <span className="shrink-0 text-[11.5px] font-semibold text-forest-soft">{entry.value}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] leading-relaxed text-muted">
          TerraScore is an estimate from page evidence, not a life-cycle assessment. Where a page says nothing, the
          breakdown shows “unknown” instead of a guess.
        </p>
      </Panel>

      <Panel title="Privacy" description="Local-first by design.">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest-soft" />
          Browsing data, detected products and your checklist stay in this browser's extension storage. Cloud sync
          is opt-in and only sends the snapshot you can export yourself.
        </p>
      </Panel>
    </>
  )
}