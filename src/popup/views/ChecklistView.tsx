import { useState } from 'react'
import { ClipboardList, Plus } from 'lucide-react'
import type { PopupData } from '../../hooks/usePopupData'
import type { ChecklistItem } from '../../types'
import ViewHeader from '../components/ViewHeader'
import EmptyState from '../components/EmptyState'
import ChecklistRow from '../components/ChecklistRow'
import { CHECKLIST_CATEGORIES } from '../../services/checklist-service'
import { MSG } from '../../utils/messages'
import { send } from '../../utils/messaging'

interface Props {
  data: PopupData
  onBack: () => void
}

export default function ChecklistView({ data, onBack }: Props) {
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'household', quantity: 1, reusable: false })

  const openItems = data.checklist.filter((item) => !item.purchased)
  const doneItems = data.checklist.filter((item) => item.purchased)

  const toggle = async (item: ChecklistItem) => {
    await send(MSG.UPDATE_CHECKLIST_ITEM, { id: item.id, patch: { purchased: !item.purchased } })
    await data.refresh()
  }

  const remove = async (item: ChecklistItem) => {
    await send(MSG.DELETE_CHECKLIST_ITEM, { id: item.id })
    await data.refresh()
  }

  const add = async () => {
    if (!form.name.trim() || busy) return
    setBusy(true)
    try {
      await send(MSG.ADD_CHECKLIST_ITEM, {
        name: form.name.trim(),
        category: form.category,
        quantity: form.quantity,
        reusable: form.reusable,
      })
      setForm({ name: '', category: form.category, quantity: 1, reusable: false })
      setAdding(false)
      await data.refresh()
    } finally {
      setBusy(false)
    }
  }

  const summary = data.summary

  return (
    <div>
      <ViewHeader
        title="Shopping checklist"
        subtitle={`${summary.count} item${summary.count === 1 ? '' : 's'} planned`}
        onBack={onBack}
        action={
          <button onClick={() => setAdding((value) => !value)} className="btn-ghost h-7 w-7" aria-label="Add item">
            <Plus className="h-4 w-4" />
          </button>
        }
      />

      <div className="px-4 pb-5">
        {summary.count > 0 && (
          <div className="card mb-2.5 grid grid-cols-3 divide-x divide-line p-2.5 text-center">
            <div>
              <p className="text-[13px] font-semibold">{summary.averageScore ?? '—'}</p>
              <p className="text-[9px] uppercase tracking-wide text-muted">avg score</p>
            </div>
            <div>
              <p className="text-[13px] font-semibold">{summary.reusableCount}</p>
              <p className="text-[9px] uppercase tracking-wide text-muted">reusable</p>
            </div>
            <div>
              <p className="text-[13px] font-semibold">{summary.missingInfoCount}</p>
              <p className="text-[9px] uppercase tracking-wide text-muted">needs info</p>
            </div>
          </div>
        )}

        {adding && (
          <div className="card animate-rise-in mb-2.5 space-y-2 p-3">
            <input
              autoFocus
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="What do you need to buy?"
              className="field"
            />
            <div className="flex gap-2">
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className="field flex-1"
              >
                {CHECKLIST_CATEGORIES.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })}
                className="field w-16"
                aria-label="Quantity"
              />
            </div>
            <label className="flex items-center gap-2 text-[11px] text-muted">
              <input
                type="checkbox"
                checked={form.reusable}
                onChange={(event) => setForm({ ...form, reusable: event.target.checked })}
                className="h-3.5 w-3.5 accent-[var(--forest)]"
              />
              This will be reusable
            </label>
            <div className="flex gap-2">
              <button onClick={add} disabled={busy || !form.name.trim()} className="btn-primary flex-1">
                {busy ? 'Adding…' : 'Add item'}
              </button>
              <button onClick={() => setAdding(false)} className="btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </div>
        )}

        {data.checklist.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Your checklist is empty"
            body="Add products from any store page, or plan what you need before you shop."
            action={
              <button onClick={() => setAdding(true)} className="btn-primary mt-1">
                Add your first item
              </button>
            }
          />
        ) : (
          <>
            <ul className="card divide-y divide-line">
              {openItems.map((item) => (
                <ChecklistRow key={item.id} item={item} onToggle={toggle} onDelete={remove} />
              ))}
              {openItems.length === 0 && (
                <li className="px-3 py-4 text-center text-[11px] text-muted">Everything on your list is checked off.</li>
              )}
            </ul>

            {doneItems.length > 0 && (
              <>
                <p className="eyebrow mt-3 mb-1.5">Purchased · {doneItems.length}</p>
                <ul className="card divide-y divide-line opacity-80">
                  {doneItems.map((item) => (
                    <ChecklistRow key={item.id} item={item} onToggle={toggle} onDelete={remove} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        <p className="mt-3 px-1 text-[9.5px] leading-relaxed text-muted">
          Checking off an item with no plastic packaging earns TerraPoints for a verified plastic-free purchase.
        </p>
      </div>
    </div>
  )
}