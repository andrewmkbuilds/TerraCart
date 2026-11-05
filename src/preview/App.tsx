import { useEffect, useState } from 'react'
import { Leaf, Settings, Puzzle, ArrowRight, ShieldCheck } from 'lucide-react'
import Popup from '../popup/Popup'
import OptionsApp from '../options/App'

type Tab = 'popup' | 'settings'

export default function PreviewApp() {
  const [tab, setTab] = useState<Tab>('popup')

  useEffect(() => {
    const openSettingsTab = () => setTab('settings')
    window.addEventListener('terracart:open-settings', openSettingsTab)
    return () => window.removeEventListener('terracart:open-settings', openSettingsTab)
  }, [])

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-canvas">
              <Leaf className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <div>
              <p className="text-[15px] font-semibold leading-none tracking-tight">TerraCart</p>
              <p className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted">
                Chrome extension
              </p>
            </div>
          </div>

          <div className="flex gap-1.5">
            {[
              { id: 'popup' as Tab, label: 'Extension popup', icon: Puzzle },
              { id: 'settings' as Tab, label: 'Settings', icon: Settings },
            ].map((entry) => (
              <button
                key={entry.id}
                onClick={() => setTab(entry.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11.5px] font-medium transition-colors ${
                  tab === entry.id ? 'bg-forest text-canvas' : 'border border-line text-muted hover:text-ink'
                }`}
              >
                <entry.icon className="h-3.5 w-3.5" strokeWidth={1.9} />
                {entry.label}
              </button>
            ))}
          </div>
        </header>

        <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <div>
            <p className="eyebrow">Live interface preview</p>
            <h1 className="mt-2 max-w-lg text-[30px] font-semibold leading-[1.1] tracking-tight sm:text-[38px]">
              Know what a product is really made of — before you add it to the cart.
            </h1>
            <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-muted">
              TerraCart reads the product page you are already on, extracts the sustainability evidence written
              there and turns it into a TerraScore with a plastic assessment and lower-impact directions. No account
              needed, nothing leaves your browser.
            </p>

            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {[
                { title: 'TerraScore', body: 'Six weighted categories, evidence shown per category.' },
                { title: 'Plastic check', body: 'Product and packaging scored separately.' },
                { title: 'Plastic-free finder', body: 'Swaps by category, searched live — never invented.' },
                { title: 'TerraPoints', body: 'Levels, streaks and weekly challenges.' },
              ].map((card) => (
                <div key={card.title} className="card p-3">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold">
                    <ArrowRight className="h-3 w-3 text-forest-soft" />
                    {card.title}
                  </p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{card.body}</p>
                </div>
              ))}
            </div>

            <p className="mt-4 flex items-start gap-2 text-[10.5px] leading-relaxed text-muted">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest-soft" />
              This page previews the real extension interface with a sample product page, so you can try every
              screen. Install the extension to analyse live retail pages.
            </p>
          </div>

          <div className="lg:sticky lg:top-8">
            {tab === 'popup' ? (
              <div className="mx-auto w-full max-w-[380px]">
                <div className="overflow-hidden rounded-[26px] border border-line bg-surface shadow-lift">
                  <div className="flex items-center gap-1.5 border-b border-line bg-surface-alt px-3 py-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-clay/60" />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber/60" />
                    <span className="h-1.5 w-1.5 rounded-full bg-forest-soft/60" />
                    <span className="mx-auto truncate rounded-full bg-surface px-2 py-0.5 text-[8.5px] text-muted">
                      demo.terracart.app/products/northwind-travel-mug
                    </span>
                  </div>
                  <Popup />
                </div>
                <p className="mt-2 text-center text-[9.5px] text-muted">
                  Popup · 380px wide. The floating launcher shows the same analysis in-page.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-line shadow-lift">
                <OptionsApp />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}