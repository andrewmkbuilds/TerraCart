import { useEffect, useState } from 'react'
import { Bell, Plus, Trash2 } from 'lucide-react'
import type { Preferences, Reminder } from '../../types'
import Panel, { Row } from '../components/Panel'
import Toggle from '../components/Toggle'
import { WEEKDAY_LABELS } from '../../services/reminders-service'
import { storage } from '../../services/storage-service'
import { MSG } from '../../utils/messages'
import { send } from '../../utils/messaging'

interface Props {
  preferences: Preferences
  save: (patch: Partial<Preferences>) => Promise<void>
  onPreferencesChange: (patch: Partial<Preferences>) => void
}

export default function NotificationsSection({ preferences, save, onPreferencesChange }: Props) {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [draft, setDraft] = useState({ label: '', time: '09:00' })

  useEffect(() => {
    void storage.getReminders().then(setReminders)
  }, [])

  const persist = async (next: Reminder[]) => {
    setReminders(next)
    await send(MSG.SAVE_REMINDERS, { reminders: next })
  }

  const enableNotifications = async () => {
    let granted = true
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      granted = (await Notification.requestPermission()) === 'granted'
    }
    await save({ notificationsEnabled: granted })
    onPreferencesChange({ notificationsEnabled: granted })
  }

  const update = (id: string, patch: Partial<Reminder>) => {
    void persist(reminders.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const toggleDay = (reminder: Reminder, day: number) => {
    const days = reminder.days.includes(day)
      ? reminder.days.filter((value) => value !== day)
      : [...reminder.days, day].sort()
    update(reminder.id, { days })
  }

  const add = () => {
    if (!draft.label.trim()) return
    void persist([
      ...reminders,
      {
        id: `custom_${Date.now()}`,
        label: draft.label.trim(),
        enabled: true,
        time: draft.time,
        days: [1, 2, 3, 4, 5],
        custom: true,
      },
    ])
    setDraft({ label: '', time: '09:00' })
  }

  return (
    <>
      <Panel title="Notifications" description="Gentle nudges to bring the reusables you already own.">
        <Row
          label="Browser reminders"
          hint={
            preferences.notificationsEnabled
              ? 'Enabled. Reminders fire while your browser is open.'
              : 'Off. TerraCart will ask your browser for permission when you switch this on.'
          }
        >
          <Toggle
            label="Browser reminders"
            checked={preferences.notificationsEnabled}
            onChange={() => void enableNotifications()}
          />
        </Row>
      </Panel>

      <Panel title="Reminder schedule" description="Pick the days and the time you want each nudge.">
        <ul className="space-y-2.5">
          {reminders.map((reminder) => (
            <li key={reminder.id} className="rounded-xl border border-line p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium leading-snug">{reminder.label}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="time"
                      value={reminder.time}
                      onChange={(event) => update(reminder.id, { time: event.target.value })}
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-[11px]"
                    />
                    <span className="text-[10px] text-muted">
                      {reminder.days.length === 0 ? 'No days selected' : `${reminder.days.length} day(s) a week`}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Toggle
                    label={`Enable ${reminder.label}`}
                    checked={reminder.enabled}
                    onChange={(value) => update(reminder.id, { enabled: value })}
                  />
                  <button
                    onClick={() => void persist(reminders.filter((item) => item.id !== reminder.id))}
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
                    className={`h-6 flex-1 rounded-md text-[9.5px] font-semibold transition-colors ${
                      reminder.days.includes(index) ? 'bg-forest-tint text-forest-soft' : 'bg-surface-alt text-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-end gap-2 rounded-xl border border-line p-3">
          <label className="flex-1">
            <span className="mb-1 block text-[10px] font-semibold text-muted">New reminder</span>
            <input
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              placeholder="e.g. Pack a lunch box"
              className="field"
            />
          </label>
          <input
            type="time"
            value={draft.time}
            onChange={(event) => setDraft({ ...draft, time: event.target.value })}
            className="rounded-xl border border-line bg-surface px-2 py-2 text-[11.5px]"
          />
          <button onClick={add} disabled={!draft.label.trim()} className="btn-primary">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted">
          <Bell className="h-3 w-3" /> Reminders pause when the browser is closed.
        </p>
      </Panel>
    </>
  )
}