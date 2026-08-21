import React from 'react'

interface EcoScoreRingProps {
  score: number
  size?: number
  strokeWidth?: number
  confidence?: 'high' | 'medium' | 'low'
  showLabel?: boolean
}

export function EcoScoreRing({ score, size = 120, strokeWidth = 8, confidence, showLabel = true }: EcoScoreRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 10) * circumference
  
  const color = getScoreColor(score)
  const bgColor = getScoreBgColor(score)
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={strokeWidth}
          />
          {/* Score arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>
            {score.toFixed(1)}
          </span>
          <span className="text-[10px] text-gray-400 font-medium">/10</span>
        </div>
      </div>
      {showLabel && (
        <div className="text-center mt-1">
          <div className="text-xs font-semibold text-gray-600">TerraCart Eco Score</div>
          {confidence && (
            <div className={`terra-badge mt-1 confidence-${confidence}`}>
              {confidence === 'high' && '✓ High confidence'}
              {confidence === 'medium' && '~ Medium confidence'}
              {confidence === 'low' && '? Limited information'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function getScoreColor(score: number): string {
  if (score >= 8) return '#16a34a'
  if (score >= 6) return '#65a30d'
  if (score >= 4) return '#ca8a04'
  if (score >= 2) return '#ea580c'
  return '#dc2626'
}

function getScoreBgColor(score: number): string {
  if (score >= 8) return '#f0fdf4'
  if (score >= 6) return '#f7fee7'
  if (score >= 4) return '#fefce8'
  if (score >= 2) return '#fff7ed'
  return '#fef2f2'
}

interface ScoreBreakdownProps {
  breakdown: {
    reusability: number
    durability: number
    packaging: number
    repairability: number
    materialConsiderations: number
  }
}

export function ScoreBreakdown({ breakdown }: ScoreBreakdownProps) {
  const items = [
    { label: '♻️ Reusability', value: breakdown.reusability },
    { label: '🔧 Durability', value: breakdown.durability },
    { label: '📦 Packaging', value: breakdown.packaging },
    { label: '🛠 Repairability', value: breakdown.repairability },
    { label: '🌿 Materials', value: breakdown.materialConsiderations },
  ]

  return (
    <div className="space-y-2">
      <div className="terra-label mb-2">Why this score?</div>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-36 shrink-0">{item.label}</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${(item.value / 10) * 100}%`,
                backgroundColor: getScoreColor(item.value),
              }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-600 w-8 text-right">{item.value}/10</span>
        </div>
      ))}
    </div>
  )
}
