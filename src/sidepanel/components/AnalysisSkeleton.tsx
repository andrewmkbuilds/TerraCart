interface Props {
  message?: string
}

function Bar({ width }: { width: string }) {
  return <div className="h-2.5 animate-pulse rounded-full bg-sand" style={{ width }} />
}

export default function AnalysisSkeleton({ message }: Props) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <p className="text-[11px] font-medium text-muted">{message || 'Analysing this product…'}</p>

      <div className="card flex items-center gap-3 p-4">
        <div className="h-[86px] w-[86px] animate-pulse rounded-full bg-sand" />
        <div className="flex-1 space-y-2">
          <Bar width="70%" />
          <Bar width="45%" />
          <Bar width="85%" />
        </div>
      </div>

      <div className="card space-y-3 p-4">
        <Bar width="35%" />
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="space-y-1.5">
            <Bar width="55%" />
            <div className="h-1.5 animate-pulse rounded-full bg-sand" />
          </div>
        ))}
      </div>

      <div className="card space-y-2 p-4">
        <Bar width="30%" />
        <Bar width="90%" />
        <Bar width="75%" />
      </div>
    </div>
  )
}