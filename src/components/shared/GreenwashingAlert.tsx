import React from 'react'
import type { GreenwashingAlert as GreenwashingAlertType } from '../../types'

interface GreenwashingAlertProps {
  alert: GreenwashingAlertType
}

export function GreenwashingAlert({ alert }: GreenwashingAlertProps) {
  if (!alert.detected) return null

  return (
    <div className="rounded-xl p-4 bg-amber-50 border border-amber-200">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-amber-600 text-lg mt-0.5">⚠️</span>
        <div>
          <div className="font-semibold text-amber-800 text-sm">Marketing claim detected</div>
          <p className="text-xs text-amber-700 mt-1 leading-relaxed">{alert.warning}</p>
        </div>
      </div>
      {alert.claims.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {alert.claims.map((claim, i) => (
            <span key={i} className="terra-badge bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
              "{claim}"
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
