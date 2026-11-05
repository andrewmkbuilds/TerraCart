import type { Reminder } from '../types'
import { DEFAULT_REMINDERS, storage } from './storage-service'

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const hasChrome = () => typeof chrome !== 'undefined' && !!chrome.alarms

export function alarmName(id: string): string {
  return `terracart-reminder-${id}`
}

export function nextOccurrence(reminder: Reminder, from = new Date()): number | null {
  if (!reminder.enabled || !reminder.days.length) return null
  const [hours, minutes] = reminder.time.split(':').map((value) => Number(value))
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null

  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(from)
    candidate.setDate(from.getDate() + offset)
    candidate.setHours(hours, minutes, 0, 0)
    if (candidate.getTime() <= from.getTime()) continue
    if (reminder.days.includes(candidate.getDay())) return candidate.getTime()
  }
  return null
}

export async function saveReminder(reminder: Reminder): Promise<Reminder[]> {
  const reminders = await storage.getReminders()
  const existing = reminders.find((item) => item.id === reminder.id)
  const next = existing
    ? reminders.map((item) => (item.id === reminder.id ? reminder : item))
    : [...reminders, reminder]
  await storage.setReminders(next)
  await syncAlarms(next)
  return next
}

export async function deleteReminder(id: string): Promise<Reminder[]> {
  const reminders = await storage.getReminders()
  const next = reminders.filter((item) => item.id !== id)
  await storage.setReminders(next)
  if (hasChrome()) await chrome.alarms.clear(alarmName(id))
  return next
}

export async function syncAlarms(reminders?: Reminder[]): Promise<void> {
  if (!hasChrome()) return
  const list = reminders || (await storage.getReminders())
  for (const reminder of list) {
    const when = nextOccurrence(reminder)
    await chrome.alarms.clear(alarmName(reminder.id))
    if (when) {
      chrome.alarms.create(alarmName(reminder.id), { when })
    }
  }
  // Weekly nudge to review the checklist, also used as a heartbeat.
  if (!(await chrome.alarms.get('terracart-weekly-review'))) {
    chrome.alarms.create('terracart-weekly-review', { periodInMinutes: 60 * 24 })
  }
}

export async function handleAlarm(alarmNameValue: string): Promise<void> {
  const reminders = await storage.getReminders()
  const reminder = reminders.find((item) => alarmName(item.id) === alarmNameValue)
  if (reminder) {
    if (hasChrome() && chrome.notifications) {
      chrome.notifications.create(`terracart-notify-${reminder.id}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'TerraCart reminder',
        message: reminder.label,
        priority: 1,
      })
    }
    await storage.setReminders(
      reminders.map((item) => (item.id === reminder.id ? { ...item, lastNotified: Date.now() } : item))
    )
    await syncAlarms()
    return
  }

  if (alarmNameValue === 'terracart-weekly-review') {
    const checklist = await storage.getChecklist()
    if (!hasChrome() || !chrome.notifications) return
    const pending = checklist.filter((item) => !item.purchased).length
    chrome.notifications.create('terracart-weekly-review-note', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Your greener shopping list',
      message: pending
        ? `${pending} item${pending === 1 ? '' : 's'} still on your checklist.`
        : 'All caught up — analyse a product to keep your streak going.',
      priority: 0,
    })
  }
}

export function defaultReminders(): Reminder[] {
  return DEFAULT_REMINDERS.map((reminder) => ({ ...reminder }))
}