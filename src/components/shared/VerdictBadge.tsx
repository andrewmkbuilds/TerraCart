import React from 'react'
import type { AIVerdict } from '../../types'

interface VerdictBadgeProps {
  verdict: AIVerdict
  showExplanation?: boolean
}

export function VerdictBadge({ verdict, showExplanation = true }: VerdictBadgeProps) {
  const bgColor = getVerdictBg(verdict.level)
  const borderColor = getVerdictBorder(verdict.level)
  const textColor = getVerdictText(verdict.level)

  return (
    <div className={`rounded-xl p-4 border ${bgColor} ${borderColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{verdict.emoji}</span>
        <span className={`font-bold text-base ${textColor}`}>{verdict.label}</span>
      </div>
      {showExplanation && (
        <p className="text-sm text-gray-600 leading-relaxed">{verdict.explanation}</p>
      )}
      {verdict.factors && verdict.factors.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {verdict.factors.map((factor, i) => (
            <span key={i} className="terra-chip text-xs">{factor}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function getVerdictBg(level: AIVerdict['level']): string {
  switch (level) {
    case 'great-choice': return 'bg-green-50'
    case 'good-choice': return 'bg-lime-50'
    case 'consider-alternatives': return 'bg-amber-50'
    case 'limited-info': return 'bg-gray-50'
  }
}

function getVerdictBorder(level: AIVerdict['level']): string {
  switch (level) {
    case 'great-choice': return 'border-green-200'
    case 'good-choice': return 'border-lime-200'
    case 'consider-alternatives': return 'border-amber-200'
    case 'limited-info': return 'border-gray-200'
  }
}

function getVerdictText(level: AIVerdict['level']): string {
  switch (level) {
    case 'great-choice': return 'text-green-800'
    case 'good-choice': return 'text-lime-800'
    case 'consider-alternatives': return 'text-amber-800'
    case 'limited-info': return 'text-gray-600'
  }
}
