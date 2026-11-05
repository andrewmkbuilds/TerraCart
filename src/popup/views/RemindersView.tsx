import { useEffect, useState } from 'react'
import { Bell, BellOff, Plus, Trash2 } from 'lucide-react'
import type { PopupData } from '../../hooks/usePopupData'
import type { Reminder } from '../../types'
import ViewHeader from '../components/ViewHeader'
import { WEEKDAY_LABELS } from '../../services/reminders-service'
import { MSG } from '../../utils/messages'
import { send } from '../../utils/messaging'
import { storage } from '../../services/storage-service'

interface Props {
  data: PopupData
  onBack: () => void
}

export default function RemindersView({ data, onBack }: Props) {
  const [reminders, setReminders] = useState<Reminder[]>(data.reminders)
  const [dirty, setDirty] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ label: '', time: '09:00' })

  useEffect(() => {
    setReminders(data.reminders)
  }, [data.reminders])

  const update = (id: string, patch: Partial<Reminder>) => {
    setReminders((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    setDirty(true)
  }

  const toggleDay = (reminder: Reminder, day: number) => {
    const days = reminder.days.includes(day)
      ? reminder.days.filter((value) => value !== day)
      : [...reminder.days, day].sort()
    update(reminder.id, { days })
  }

  const save = async () => {
    await send(MSG.SAVE_REMINDERS, { reminders })
    setDirty(false)
    await data.refresh()
  }

  const add = async () => {
    if (!draft.label.trim()) return
    const next: Reminder[] = [
      ...reminders,
      {
        id: `custom_${Date.now()}`,
        label: draft.label.trim(),
        enabled: true,
        time: draft.time,
        days: [1, 2, 3, 4, 5],
        custom: true,
      },
    ]
    setReminders(next)
    setAdding(false)
    setDraft({ label: '', time: '09:00' })
    await send(MSG.SAVE_REMINDERS, { reminders: next })
    await data.refresh()
  }

  const remove = async (id: string) => {
    const next = reminders.filter((item) => item.id !== id)
    setReminders(next)
    await send(MSG.SAVE_REMINDERS, { reminders: next })
    await data.refresh()
  }

  const enableNotifications = async () => {
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      await Notification.requestPermission()
    }
    const preferences = { ...(await storage.getPreferences()), notificationsEnabled: true }
    await send(MSG.SAVE_PREFERENCES, { preferences })
    await data.refresh()
  }

  return (
    <div>
      <ViewHeader
        title="Reusable reminders"
        subtitle={`${reminders.filter((item) => item.enabled).length} active`}
        onBack={onBack}
        action={
          <button onClick={() => setAdding((value) => !value)} className="btn-ghost h-7 w-7" aria-label="Add reminder">
            <Plus className="h-4 w-4" />
          </button>
        }
      />

      <div className="px-4 pb-5">
        {!data.preferences.notificationsEnabled && (
          <button
            onClick={() => void enableNotifications()}
            className="mb-2.5 flex w-full items-center gap-2 rounded-xl border border-amber/40 bg-amber/10 px-3 py-2 text-left"
          >
            <BellOff className="h-3.5 w-3.5 shrink-0 text-amber" />
            <span className="text-[10.5px] leading-snug text-amber">
              Notifications are off. Tap to allow browser reminders for these nudges.
            </span>
          </button>
        )}

        {adding && (
          <div className="card animate-rise-in mb-2.5 space-y-2 p-3">
            <input
              autoFocus
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              placeholder="e.g. Take the tote bag"
              className="field"
            />
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={draft.time}
                onChange={(event) => setDraft({ ...draft, time: event.target.value })}
                className="field"
              />
              <button onClick={add} disabled={!draft.label.trim()} className="btn-primary flex-1">
                Add
              </button>
            </div>
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {reminders.map((reminder) => (
            <li key={reminder.id} className="card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11.5px] font-medium leading-snug">{reminder.label}</p>
                  <input
                    type="time"
                    value={reminder.time}
                    onChange={(event) => update(reminder.id, { time: event.target.value })}
                    className="mt-1 w-[92px] rounded-lg border border-line bg-surface px-1.5 py-1 text-[10.5px]"
                  />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => update(reminder.id, { enabled: !reminder.enabled })}
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      reminder.enabled ? 'bg-forest' : 'bg-sand'
                    }`}
                    aria-label={reminder.enabled ? 'Disable reminder' : 'Enable reminder'}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface transition-all ${
                        reminder.enabled ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => void remove(reminder.id)}
                    className="btn-ghost h-6 w-6 text-muted"
                    aria-label="Delete reminder"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex gap-1">
                {WEEKDAY_LABELS.map((label, index) => (
                  <button
                    key={label}
                    onClick={() => toggleDay(reminder, index)}
                    className={`h-6 flex-1 rounded-md text-[9px] font-semibold transition-colors ${
                      reminder.days.includes(index)
                        ? 'bg-forest-tint text-forest-soft'
                        : 'bg-surface-alt text-muted'
                    }`}
                  >
                    {label.slice(0, 1)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>

        {dirty && (
          <button onClick={() => void save()} className="btn-primary mt-3 w-full">
            <Bell className="h-3.5 w-3.5" /> Save reminder changes
          </button>
        )}

        <p className="mt-3 px-1 text-[9.5px] leading-relaxed text-muted">
          Reminders run while your browser is open. They nudge you to carry the reusables you already own.
        </p>
      </div>
    </div>
  )
}