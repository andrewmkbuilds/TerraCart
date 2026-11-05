import { useState } from 'react'
import { Download, RotateCcw, Trash2 } from 'lucide-react'
import Panel, { Row } from '../components/Panel'
import { exportSnapshot, storage } from '../../services/storage-service'
import { MSG } from '../../utils/messages'
import { send } from '../../utils/messaging'

export default function DataSection() {
  const [confirming, setConfirming] = useState<'activity' | 'points' | 'all' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const download = async () => {
    const snapshot = await exportSnapshot()
    const blob = new Blob([snapshot], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `terracart-export-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setNotice('Export downloaded.')
  }

  const run = async () => {
    if (confirming === 'activity') {
      await send(MSG.CLEAR_ACTIVITY)
      setNotice('History and saved products cleared.')
    }
    if (confirming === 'points') {
      await send(MSG.RESET_POINTS)
      setNotice('TerraPoints reset to zero.')
    }
    if (confirming === 'all') {
      await storage.clearEverything()
      setNotice('All TerraCart data on this device was removed.')
    }
    setConfirming(null)
  }

  const LABEL = {
    activity: { title: 'Clear activity', body: 'Deletes analysis history and saved products. Checklist, points and settings stay.', cta: 'Clear activity' },
    points: { title: 'Reset TerraPoints', body: 'Sets your points, streak, challenges and achievements back to zero.', cta: 'Reset points' },
    all: { title: 'Delete everything', body: 'Removes every TerraCart record stored in this browser, including settings.', cta: 'Delete all data' },
  }

  return (
    <Panel title="Your data" description="TerraCart stores everything locally in your browser. Nothing is uploaded unless you turn on cloud sync.">
      <Row label="Export a copy" hint="Download your checklist, saved products, points and settings as JSON.">
        <button onClick={() => void download()} className="btn-secondary">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </Row>
      <Row label="Clear activity" hint="Analysis history and saved products only.">
        <button onClick={() => setConfirming('activity')} className="btn-secondary">
          Clear
        </button>
      </Row>
      <Row label="Reset TerraPoints" hint="Start your streak and challenges fresh.">
        <button onClick={() => setConfirming('points')} className="btn-secondary">
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </Row>
      <Row label="Delete all TerraCart data" hint="Cannot be undone.">
        <button
          onClick={() => setConfirming('all')}
          className="btn h-9 px-3.5 text-clay"
          style={{ border: '1px solid var(--clay)' }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </Row>

      {notice && <p className="mt-3 rounded-xl bg-forest-tint px-3 py-2 text-[10.5px] text-forest-soft">{notice}</p>}

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-4">
            <p className="text-[13px] font-semibold">{LABEL[confirming].title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">{LABEL[confirming].body}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => void run()} className="btn-primary flex-1">
                {LABEL[confirming].cta}
              </button>
              <button onClick={() => setConfirming(null)} className="btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}