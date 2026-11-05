import type { Classification } from '../../types'
import { CLASSIFICATION_COLOR } from '../../utils/format'

interface Props {
  score: number | null
  classification: Classification
  size?: number
  label?: string
}

export default function ScoreRing({ score, classification, size = 72, label }: Props) {
  const color = CLASSIFICATION_COLOR[classification]
  const stroke = size >= 64 ? 5.5 : 4.5
  const radius = size / 2 - stroke
  const circumference = 2 * Math.PI * radius
  const offset = score === null ? 0 : circumference - (score / 100) * circumference

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--sand)" strokeWidth={stroke} />
        {score !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset .7s ease' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold leading-none tracking-tight" style={{ color, fontSize: size * 0.3 }}>
          {score === null ? '—' : score}
        </span>
        {label && <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</span>}
      </div>
    </div>
  )
}