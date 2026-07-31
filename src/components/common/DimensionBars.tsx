import type { DimensionScore } from '@/types'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface DimensionBarsProps {
  dimensions: DimensionScore[]
  className?: string
}

function scoreColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-rose-500'
}

export function DimensionBars({ dimensions, className }: DimensionBarsProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {dimensions.map((dimension) => (
        <div key={dimension.key} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{dimension.label}</span>
            <span className="text-muted-foreground">
              {Math.round(dimension.score)}%
            </span>
          </div>
          <Progress
            value={dimension.score}
            indicatorClassName={scoreColor(dimension.score)}
          />
        </div>
      ))}
    </div>
  )
}
