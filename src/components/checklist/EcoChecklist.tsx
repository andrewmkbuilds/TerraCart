import React, { useState } from 'react'
import type { ChecklistItem } from '../../types'

interface EcoChecklistProps {
  items: ChecklistItem[]
  onToggle?: (id: string, checked: boolean) => void
}

export function EcoChecklist({ items, onToggle }: EcoChecklistProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(
    new Set(items.filter(i => i.checked).map(i => i.id))
  )

  const toggle = (id: string) => {
    const newChecked = new Set(checkedItems)
    if (newChecked.has(id)) {
      newChecked.delete(id)
    } else {
      newChecked.add(id)
    }
    setCheckedItems(newChecked)
    onToggle?.(id, newChecked.has(id))
  }

  const completed = checkedItems.size
  const total = items.length
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="terra-label">✅ Eco Shopping Checklist</div>
        <span className="text-xs text-gray-500">
          {completed}/{total} · {percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-terra-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Items */}
      <div className="space-y-1">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex items-start gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
          >
            <input
              type="checkbox"
              className="terra-checkbox mt-0.5 shrink-0"
              checked={checkedItems.has(item.id)}
              onChange={() => toggle(item.id)}
            />
            <span
              className={`text-sm leading-snug transition-colors ${
                checkedItems.has(item.id)
                  ? 'text-gray-400 line-through'
                  : 'text-gray-700 group-hover:text-gray-900'
              }`}
            >
              {item.text}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
