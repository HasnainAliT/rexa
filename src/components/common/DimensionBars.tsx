import type { DimensionScore } from '@/types'
import { toPercent } from '@/lib/grading'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface DimensionBarsProps {
  dimensions: DimensionScore[]
  className?: string
}

function scoreColor(percent: number): string {
  if (percent >= 75) return 'bg-indigo-500'
  if (percent >= 50) return 'bg-violet-500'
  return 'bg-orange-500'
}

export function DimensionBars({ dimensions, className }: DimensionBarsProps) {
  if (dimensions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Dimension scores are not available for this analysis.
      </p>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {dimensions.map((dimension) => {
        const percent = toPercent(dimension.score)
        return (
          <div key={dimension.key} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{dimension.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {percent}%
              </span>
            </div>
            <Progress
              value={percent}
              className="h-2.5"
              indicatorClassName={scoreColor(percent)}
              aria-label={`${dimension.label} ${percent} percent`}
            />
          </div>
        )
      })}
    </div>
  )
}
