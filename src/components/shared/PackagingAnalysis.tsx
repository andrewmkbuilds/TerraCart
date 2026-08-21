import React from 'react'
import type { PackagingAnalysis as PackagingAnalysisType } from '../../types'

interface PackagingAnalysisProps {
  analysis: PackagingAnalysisType
}

export function PackagingAnalysis({ analysis }: PackagingAnalysisProps) {
  return (
    <div className="space-y-3">
      <div className="terra-label">📦 Packaging Analysis</div>
      
      {/* Score */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${(analysis.packagingScore / 10) * 100}%`,
              backgroundColor: analysis.packagingScore >= 7 ? '#16a34a' : analysis.packagingScore >= 4 ? '#ca8a04' : '#dc2626',
            }}
          />
        </div>
        <span className="text-sm font-bold text-gray-700">{analysis.packagingScore}/10</span>
      </div>

      {/* Current packaging description */}
      <div className="text-sm text-gray-600">
        <span className="font-medium">Current:</span>{' '}
        {formatPackagingType(analysis.currentPackaging.type)}
        {analysis.currentPackaging.layers && analysis.currentPackaging.layers > 1 && (
          <span className="text-amber-600"> · {analysis.currentPackaging.layers} layers</span>
        )}
      </div>

      {/* Issues */}
      {analysis.issues.length > 0 && (
        <div className="space-y-1">
          {analysis.issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
              <span className="mt-0.5">⚠</span>
              <span>{issue}</span>
            </div>
          ))}
        </div>
      )}

      {/* Improvements */}
      {analysis.improvements.length > 0 && (
        <div className="mt-2">
          <div className="text-xs font-semibold text-gray-500 mb-1.5">Possible Improvements</div>
          <div className="space-y-1.5">
            {analysis.improvements.map((imp, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 ${imp.available ? 'text-green-600' : 'text-gray-400'}`}>
                  {imp.available ? '✓' : '○'}
                </span>
                <span className="text-gray-600">{imp.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Less packaging alternative */}
      {analysis.lessPackagingAlternative && (
        <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-100">
          <div className="text-xs font-semibold text-green-700 mb-1">
            📦 Less Packaging Alternative
          </div>
          <p className="text-xs text-green-600">{analysis.lessPackagingAlternative.description}</p>
        </div>
      )}
    </div>
  )
}

function formatPackagingType(types: string[]): string {
  return types
    .map(t => {
      switch (t) {
        case 'cardboard': return 'cardboard'
        case 'paper': return 'paper'
        case 'plastic-wrap': return 'plastic wrap'
        case 'plastic-container': return 'plastic container'
        case 'plastic-bag': return 'plastic bag'
        case 'glass': return 'glass'
        case 'metal': return 'metal'
        case 'compostable': return 'compostable'
        case 'none': return 'no packaging'
        case 'mixed': return 'mixed materials'
        case 'unknown': return 'unknown'
        default: return t
      }
    })
    .join(', ')
}
