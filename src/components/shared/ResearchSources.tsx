import React, { useState } from 'react'
import type { ResearchSource } from '../../types'

interface ResearchSourcesProps {
  sources: ResearchSource[]
}

export function ResearchSources({ sources }: ResearchSourcesProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="terra-section">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left group"
      >
        <span className="terra-label">Research Used</span>
        <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
          {expanded ? '▾ Hide' : '▸ Show'}
        </span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {sources.map((source, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={getSourceIcon(source.type)}>{getSourceEmoji(source.type)}</span>
              <span className="text-gray-600">{source.name}</span>
              <span className={`terra-badge text-[10px] ${getReliabilityClass(source.reliability)}`}>
                {source.reliability}
              </span>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-gray-50 text-[10px] text-gray-400 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span>✓</span> <span>Verified information</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>~</span> <span>AI inference based on available data</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>?</span> <span>Estimated — verify independently</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getSourceEmoji(type: ResearchSource['type']): string {
  switch (type) {
    case 'verified': return '✓'
    case 'manufacturer': return '🏭'
    case 'retailer': return '🏪'
    case 'independent': return '🔬'
    case 'ai-inference': return '~'
    case 'estimated': return '?'
    default: return '·'
  }
}

function getSourceIcon(type: ResearchSource['type']): string {
  return 'w-4 h-4 inline-flex items-center justify-center rounded text-[10px]'
}

function getReliabilityClass(reliability: ResearchSource['reliability']): string {
  switch (reliability) {
    case 'high': return 'bg-green-50 text-green-600 border-green-100'
    case 'medium': return 'bg-amber-50 text-amber-600 border-amber-100'
    case 'low': return 'bg-gray-50 text-gray-500 border-gray-100'
  }
}
