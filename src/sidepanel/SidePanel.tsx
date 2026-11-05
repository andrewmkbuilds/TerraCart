import { useEffect, useState } from 'react'
import { AlertTriangle, ExternalLink, Leaf, RefreshCw, Settings2, Store } from 'lucide-react'
import { usePopupData } from '../hooks/usePopupData'
import { openSettings } from '../utils/messaging'
import ErrorBoundary from '../components/ErrorBoundary'
import ProductHeadline from '../components/analysis/ProductHeadline'
import LoadingTab from './components/LoadingTab'
import OverviewTab from './views/OverviewTab'
import AlternativesTab from './views/AlternativesTab'
import PackagingTab from './views/PackagingTab'

type Tab = 'overview' | 'alternatives' | 'packaging'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'alternatives', label: 'Alternatives' },
  { id: 'packaging', label: 'Packaging' },
]

export default function SidePanel() {
  const data = usePopupData(true)
  const [tab, setTab] = useState<Tab>('overview')
  const analysis = data.context?.analysis || null
  const loading = data.status === 'loading' || !data.ready

  // Coming back to the panel re-reads the active tab so a product change
  // never leaves stale analysis on screen.
  useEffect(() => {
    const onFocus = () => void data.analyse()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [data.analyse])

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-forest text-canvas">
                <Leaf className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-[12.5px] font-semibold leading-none tracking-tight">TerraCart</p>
                <p className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {data.context?.hostname || 'Sustainable shopping'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => void data.analyse()}
                disabled={loading}
                className="btn-secondary h-8 gap-1 px-2.5 text-[10.5px]"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Scanning…' : 'Rescan page'}
              </button>
              <button
                onClick={openSettings}
                className="btn-ghost h-8 w-8 text-muted"
                aria-label="TerraCart settings"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {analysis && (
            <div className="mt-2.5 rounded-xl border border-line bg-surface p-2.5">
              <ProductHeadline product={analysis.product} />
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={analysis.product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary h-7 gap-1 px-2.5 text-[10.5px]"
                >
                  <Store className="h-3 w-3" /> View at {analysis.product.retailer || 'retailer'}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="mx-auto flex w-full max-w-3xl gap-1 px-4 pb-2">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setTab(entry.id)}
              aria-current={tab === entry.id}
              className={`flex-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                tab === entry.id ? 'bg-forest text-canvas' : 'text-muted hover:bg-sand hover:text-ink'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-3">
        <ErrorBoundary key={tab} label={`The ${tab} view could not be displayed`}>
          {loading && <LoadingTab />}

          {!loading && data.status === 'error' && (
            <div className="card flex flex-col items-center gap-2 p-6 text-center">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-clay/15 text-clay">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <p className="text-[12.5px] font-semibold">Analysis failed</p>
              <p className="max-w-[320px] text-[11px] leading-relaxed text-muted">
                {data.error || 'TerraCart could not read this page.'} Your detected product is kept — retrying only
                re-reads the page.
              </p>
              <button onClick={() => void data.analyse()} className="btn-primary mt-1">
                <RefreshCw className="h-3.5 w-3.5" /> Retry analysis
              </button>
            </div>
          )}

          {!loading && data.status !== 'error' && !analysis && (
            <div className="card flex flex-col items-center gap-2 p-6 text-center">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-forest-tint text-forest-soft">
                <Leaf className="h-5 w-5" />
              </div>
              <p className="text-[12.5px] font-semibold">No product detected on this page</p>
              <p className="max-w-[330px] text-[11px] leading-relaxed text-muted">
                Open a product listing on any online store and TerraCart will score the evidence written there. If
                the listing is already open, rescan the page.
              </p>
              <button onClick={() => void data.analyse()} className="btn-secondary mt-1">
                <RefreshCw className="h-3.5 w-3.5" /> Rescan page
              </button>
            </div>
          )}

          {!loading && data.status !== 'error' && analysis && (
            <>
              {tab === 'overview' && <OverviewTab analysis={analysis} />}
              {tab === 'alternatives' && (
                <AlternativesTab
                  analysis={analysis}
                  checklistNames={data.checklist.map((item) => item.name)}
                />
              )}
              {tab === 'packaging' && <PackagingTab analysis={analysis} />}
            </>
          )}
        </ErrorBoundary>
      </main>
    </div>
  )
}