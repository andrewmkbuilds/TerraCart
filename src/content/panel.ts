import type { AlternativeSuggestion, ProductAnalysis } from '../types'
import { CLASSIFICATION_COLOR, CLASSIFICATION_LABEL, CONFIDENCE_LABEL, formatPrice, hostLabel } from '../utils/format'

export type PanelAction =
  | { type: 'add-checklist' }
  | { type: 'save' }
  | { type: 'open-alternative'; suggestion: AlternativeSuggestion }
  | { type: 'open-settings' }

const STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .wrap { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
  .launcher {
    display: inline-flex; align-items: center; gap: 9px; height: 48px; padding: 0 16px 0 12px;
    border: 1px solid rgba(18,48,38,.16); border-radius: 999px; cursor: pointer;
    background: #FAF8F2; color: #123026; box-shadow: 0 12px 30px -12px rgba(10,31,25,.45);
    transition: transform .18s ease, box-shadow .18s ease;
  }
  .launcher:hover { transform: translateY(-2px); box-shadow: 0 18px 36px -14px rgba(10,31,25,.5); }
  .launcher .mark { width: 26px; height: 26px; border-radius: 9px; background: #123026; display: grid; place-items: center; }
  .launcher .label { font-size: 13px; font-weight: 600; letter-spacing: -.01em; }
  .launcher .score { font-size: 12px; font-weight: 700; padding: 2px 7px; border-radius: 999px; color: #fff; }
  .panel {
    width: 360px; max-height: min(78vh, 620px); overflow-y: auto; background: #FAF8F2;
    border: 1px solid rgba(18,48,38,.14); border-radius: 20px;
    box-shadow: 0 30px 70px -30px rgba(10,31,25,.55); color: #16241D;
    animation: tc-in .22s ease-out;
  }
  @keyframes tc-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  .head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid rgba(18,48,38,.09); position: sticky; top: 0; background: #FAF8F2; z-index: 2; }
  .brand { display: flex; align-items: center; gap: 8px; }
  .brand .dot { width: 24px; height: 24px; border-radius: 8px; background: #123026; display: grid; place-items: center; }
  .brand strong { font-size: 13px; letter-spacing: -.01em; }
  .brand span { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: #6B7A72; }
  .icon-btn { width: 26px; height: 26px; border-radius: 8px; border: none; background: transparent; color: #6B7A72; cursor: pointer; font-size: 15px; line-height: 1; display: grid; place-items: center; }
  .icon-btn:hover { background: rgba(18,48,38,.07); color: #123026; }
  .body { padding: 14px 16px 18px; display: flex; flex-direction: column; gap: 14px; }
  .product { display: flex; gap: 10px; align-items: flex-start; }
  .product img { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; background: #EDEAE1; flex: none; }
  .product h1 { font-size: 13.5px; font-weight: 650; line-height: 1.32; letter-spacing: -.01em; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .product p { font-size: 11px; color: #6B7A72; margin-top: 3px; }
  .scoreRow { display: flex; gap: 12px; align-items: center; padding: 12px; border-radius: 14px; background: #fff; border: 1px solid rgba(18,48,38,.08); }
  .ring { flex: none; position: relative; width: 66px; height: 66px; }
  .ring svg { transform: rotate(-90deg); }
  .ring .value { position: absolute; inset: 0; display: grid; place-items: center; font-size: 18px; font-weight: 700; letter-spacing: -.03em; }
  .ring .value small { font-size: 9px; font-weight: 600; color: #6B7A72; display: block; text-align: center; letter-spacing: .04em; }
  .meta { min-width: 0; }
  .meta .class { font-size: 13px; font-weight: 700; letter-spacing: -.01em; }
  .meta .conf { font-size: 10.5px; color: #6B7A72; margin-top: 2px; }
  .bar { height: 4px; border-radius: 999px; background: #E6E2D6; margin-top: 8px; overflow: hidden; }
  .bar span { display: block; height: 100%; border-radius: 999px; background: #2F6E4C; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { font-size: 10px; font-weight: 600; padding: 4px 8px; border-radius: 999px; border: 1px solid transparent; letter-spacing: .01em; }
  .chip.good { background: #E3F2E8; color: #1F6B46; }
  .chip.warn { background: #FBEFDD; color: #8A5A16; }
  .chip.bad { background: #FBE6E2; color: #97392F; }
  .chip.muted { background: #EEECE4; color: #5C6B63; }
  h2 { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: #6B7A72; font-weight: 700; margin-bottom: 6px; }
  ul { list-style: none; display: flex; flex-direction: column; gap: 5px; }
  li { font-size: 11.5px; line-height: 1.45; color: #2C3B33; padding-left: 13px; position: relative; }
  li::before { content: ""; position: absolute; left: 0; top: 6px; width: 5px; height: 5px; border-radius: 999px; background: #9BB3A6; }
  li.pos::before { background: #2F6E4C; }
  li.neg::before { background: #B5543F; }
  .alt { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border-radius: 10px; background: #fff; border: 1px solid rgba(18,48,38,.08); text-decoration: none; color: inherit; }
  .alt:hover { border-color: rgba(47,110,76,.45); background: #F7FBF8; }
  .alt .t { font-size: 11.5px; font-weight: 600; }
  .alt .m { font-size: 10px; color: #6B7A72; margin-top: 1px; }
  .alt .go { font-size: 13px; color: #2F6E4C; }
  .actions { display: flex; gap: 8px; }
  button.primary, button.secondary { flex: 1; height: 36px; border-radius: 10px; font-size: 12px; font-weight: 650; cursor: pointer; border: 1px solid transparent; transition: background .15s ease, border-color .15s ease; }
  button.primary { background: #123026; color: #F3F7F2; }
  button.primary:hover { background: #1B4230; }
  button.secondary { background: transparent; color: #123026; border-color: rgba(18,48,38,.22); }
  button.secondary:hover { border-color: rgba(18,48,38,.45); }
  button:disabled { opacity: .6; cursor: default; }
  .note { font-size: 10px; line-height: 1.5; color: #7C8A82; }
  .empty { font-size: 12px; color: #6B7A72; line-height: 1.5; }
  .banner { font-size: 11px; line-height: 1.45; background: #FBEFDD; color: #7A5218; border-radius: 10px; padding: 8px 10px; }
  .link { background: none; border: none; color: #2F6E4C; font-size: 10.5px; font-weight: 600; cursor: pointer; padding: 0; text-decoration: underline; }
`

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const LEAF = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CFE8DA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`

export class TerraCartPanel {
  private host: HTMLDivElement
  private root: ShadowRoot
  private analysis: ProductAnalysis
  private open = false
  private state = { added: false, saved: false }
  private onAction: (action: PanelAction) => void
  private launcherVisible: boolean

  constructor(analysis: ProductAnalysis, onAction: (action: PanelAction) => void, launcherVisible = true) {
    this.analysis = analysis
    this.onAction = onAction
    this.launcherVisible = launcherVisible
    this.host = document.createElement('div')
    this.host.id = 'terracart-root'
    this.host.style.all = 'initial'
    this.root = this.host.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = STYLES
    this.root.appendChild(style)

    this.container = document.createElement('div')
    this.container.className = 'wrap'
    this.root.appendChild(this.container)

    this.container.addEventListener('click', this.handleClick)
    this.render()
  }

  private container: HTMLDivElement

  mount(): void {
    if (!document.getElementById('terracart-root')) document.documentElement.appendChild(this.host)
  }

  destroy(): void {
    this.container.removeEventListener('click', this.handleClick)
    this.host.remove()
  }

  update(analysis: ProductAnalysis): void {
    this.analysis = analysis
    this.render()
  }

  setLauncherVisible(visible: boolean): void {
    this.launcherVisible = visible
    this.render()
  }

  expand(): void {
    this.open = true
    this.render()
  }

  private handleClick = (event: Event) => {
    const target = (event.target as HTMLElement).closest('[data-action]') as HTMLElement | null
    if (!target) return
    const action = target.dataset.action

    if (action === 'toggle') {
      this.open = !this.open
      this.render()
      return
    }
    if (action === 'close') {
      this.open = false
      this.render()
      return
    }
    if (action === 'add-checklist') {
      if (this.state.added) return
      this.state.added = true
      this.onAction({ type: 'add-checklist' })
      this.render()
      return
    }
    if (action === 'save') {
      if (this.state.saved) return
      this.state.saved = true
      this.onAction({ type: 'save' })
      this.render()
      return
    }
    if (action === 'settings') {
      this.onAction({ type: 'open-settings' })
      return
    }
    if (action === 'alternative') {
      const id = target.dataset.id
      const suggestion = this.analysis.alternatives.find((item) => item.id === id)
      if (suggestion) {
        this.onAction({ type: 'open-alternative', suggestion })
        window.open(suggestion.searchUrl, '_blank', 'noopener,noreferrer')
      }
    }
  }

  private launcherMarkup(): string {
    if (!this.launcherVisible) return ''
    const score = this.analysis.score.overall
    const color = CLASSIFICATION_COLOR[this.analysis.score.classification]
    return `
      <button class="launcher" data-action="toggle" aria-label="Open TerraCart analysis">
        <span class="mark">${LEAF}</span>
        <span class="label">TerraCart</span>
        <span class="score" style="background:${color}">${score === null ? '?' : score}</span>
      </button>`
  }

  private ringMarkup(): string {
    const score = this.analysis.score.overall
    const color = CLASSIFICATION_COLOR[this.analysis.score.classification]
    const radius = 27
    const circumference = 2 * Math.PI * radius
    const progress = score === null ? 0 : (score / 100) * circumference
    return `
      <div class="ring">
        <svg width="66" height="66" viewBox="0 0 66 66">
          <circle cx="33" cy="33" r="${radius}" fill="none" stroke="#E6E2D6" stroke-width="5" />
          <circle cx="33" cy="33" r="${radius}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"
            stroke-dasharray="${circumference}" stroke-dashoffset="${circumference - progress}" />
        </svg>
        <div class="value" style="color:${color}">${score === null ? '—' : score}</div>
      </div>`
  }

  private panelMarkup(): string {
    const { product, score, plastic } = this.analysis
    const price = formatPrice(product.price, product.currency)
    const classification = CLASSIFICATION_LABEL[score.classification]
    const alternatives = this.analysis.alternatives.slice(0, 2)

    const plasticChip = (label: string, status: 'plastic-free' | 'contains-plastic' | 'unknown') => {
      const tone = status === 'plastic-free' ? 'good' : status === 'contains-plastic' ? 'bad' : 'muted'
      const text = status === 'plastic-free' ? 'plastic-free' : status === 'contains-plastic' ? 'contains plastic' : 'unclear'
      return `<span class="chip ${tone}">${label}: ${text}</span>`
    }

    const lowCoverage = score.overall === null

    return `
      <section class="panel" role="dialog" aria-label="TerraCart product analysis">
        <header class="head">
          <div class="brand">
            <span class="dot">${LEAF}</span>
            <div>
              <strong>TerraCart</strong>
              <span>${lowCoverage ? 'Limited data' : 'Sustainability analysis'}</span>
            </div>
          </div>
          <button class="icon-btn" data-action="close" aria-label="Close">✕</button>
        </header>
        <div class="body">
          <div class="product">
            ${product.image ? `<img src="${escapeHtml(product.image)}" alt="" />` : ''}
            <div>
              <h1>${escapeHtml(product.name)}</h1>
              <p>${escapeHtml(product.brand || hostLabel(product.hostname))}${price ? ` · ${price}` : ''}</p>
            </div>
          </div>

          ${
            lowCoverage
              ? `<div class="banner">This page has too little product detail for a score. TerraCart never guesses a number — check the details in the extension and add what is missing.</div>`
              : `<div class="scoreRow">
                  ${this.ringMarkup()}
                  <div class="meta">
                    <div class="class" style="color:${CLASSIFICATION_COLOR[score.classification]}">TerraScore ${score.overall} · ${classification}</div>
                    <div class="conf">${CONFIDENCE_LABEL[score.confidence]} · ${score.coverage}% of the model had evidence</div>
                    <div class="bar"><span style="width:${score.overall}%"></span></div>
                  </div>
                </div>`
          }

          <div class="chips">
            ${plasticChip('Product', plastic.product.status)}
            ${plasticChip('Packaging', plastic.packaging.status)}
          </div>

          ${
            score.positives.length
              ? `<div><h2>What we found</h2><ul>${score.positives
                  .slice(0, 3)
                  .map((item) => `<li class="pos">${escapeHtml(item)}</li>`)
                  .join('')}</ul></div>`
              : ''
          }

          ${
            score.concerns.length
              ? `<div><h2>Watch out for</h2><ul>${score.concerns
                  .slice(0, 3)
                  .map((item) => `<li class="neg">${escapeHtml(item)}</li>`)
                  .join('')}</ul></div>`
              : ''
          }

          ${
            score.unknowns.length
              ? `<div><h2>Not stated on this page</h2><p class="empty">${score.unknowns
                  .map((item) => escapeHtml(item.toLowerCase()))
                  .join(' · ')}</p></div>`
              : ''
          }

          ${
            alternatives.length
              ? `<div><h2>Greener directions</h2>
                  <ul style="gap:6px">
                    ${alternatives
                      .map(
                        (item) => `<li style="padding:0">
                          <a class="alt" href="${escapeHtml(item.searchUrl)}" target="_blank" rel="noopener noreferrer" data-action="alternative" data-id="${escapeHtml(item.id)}">
                            <span>
                              <span class="t">${escapeHtml(item.title)}</span>
                              <span class="m">${escapeHtml(item.material)} · search opens in a new tab</span>
                            </span>
                            <span class="go">↗</span>
                          </a>
                        </li>`
                      )
                      .join('')}
                  </ul>
                </div>`
              : ''
          }

          <div class="actions">
            <button class="primary" data-action="add-checklist" ${this.state.added ? 'disabled' : ''}>
              ${this.state.added ? 'Added ✓' : 'Add to checklist'}
            </button>
            <button class="secondary" data-action="save" ${this.state.saved ? 'disabled' : ''}>
              ${this.state.saved ? 'Saved ✓' : 'Save'}
            </button>
          </div>
          <button class="link" data-action="settings" style="align-self:flex-start">Open TerraCart settings</button>
          <p class="note">${escapeHtml(this.analysis.disclaimer)}</p>
        </div>
      </section>`
  }

  private render(): void {
    this.container.innerHTML = `${this.open ? this.panelMarkup() : ''}${this.launcherMarkup()}`
  }
}