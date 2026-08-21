import React from 'react'
import type { ResearchStep } from '../../types'

interface ResearchProgressProps {
  steps: ResearchStep[]
  isComplete?: boolean
}

export function ResearchProgress({ steps, isComplete = false }: ResearchProgressProps) {
  if (isComplete) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 bg-green-50 rounded-lg border border-green-100">
        <span className="text-green-600">✓</span>
        <span className="text-sm font-medium text-green-700">Research complete</span>
      </div>
    )
  }

  return (
    <div className="space-y-0 py-2">
      {steps.map((step, index) => (
        <div
          key={index}
          className={`terra-research-step ${
            step.status === 'complete'
              ? 'terra-research-step-complete'
              : step.status === 'in-progress'
              ? 'terra-research-step-active'
              : 'terra-research-step-pending'
          }`}
        >
          <span className="w-5 text-center shrink-0">
            {step.status === 'complete' && '✓'}
            {step.status === 'in-progress' && (
              <span className="inline-block w-2 h-2 bg-ocean-500 rounded-full animate-pulse-soft" />
            )}
            {step.status === 'pending' && (
              <span className="inline-block w-2 h-2 bg-gray-200 rounded-full" />
            )}
            {step.status === 'error' && '✗'}
          </span>
          <span className="text-sm">{step.label}</span>
          {step.detail && (
            <span className="text-xs text-gray-400 ml-1">— {step.detail}</span>
          )}
        </div>
      ))}
    </div>
  )
}

export const DEFAULT_RESEARCH_STEPS: ResearchStep[] = [
  { label: 'Understanding product', status: 'pending' },
  { label: 'Checking available information', status: 'pending' },
  { label: 'Looking for alternatives', status: 'pending' },
  { label: 'Comparing packaging', status: 'pending' },
  { label: 'Evaluating reusable options', status: 'pending' },
  { label: 'Personalizing recommendation', status: 'pending' },
]
