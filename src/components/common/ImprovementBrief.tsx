import { CheckCircle2, Lightbulb, ListOrdered } from 'lucide-react'
import type { AnalysisResult } from '@/types'
import { buildImprovementBrief } from '@/lib/improvement-brief'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const PRIORITY_LABEL = {
  high: 'Do this first',
  medium: 'Then',
  low: 'Optional',
} as const

interface ImprovementBriefCardProps {
  analysis: AnalysisResult
  className?: string
  omitStars?: boolean
}

export function ImprovementBriefCard({
  analysis,
  className,
  omitStars = false,
}: ImprovementBriefCardProps) {
  const brief = buildImprovementBrief(analysis, { omitStars })

  return (
    <Card className={cn('border-indigo-200 dark:border-indigo-900/60', className)}>
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-indigo-600" />
          <CardTitle className="text-base">
            How to make this answer better
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">{brief.summary}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {brief.strengths.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              What already works
            </p>
            <ul className="space-y-1.5">
              {brief.strengths.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm text-emerald-800 dark:text-emerald-300"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ListOrdered className="h-3.5 w-3.5" />
            What to change
          </p>
          <ol className="space-y-3">
            {brief.steps.map((step, index) => (
              <li key={step.title} className="flex gap-3 rounded-lg border p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{step.title}</p>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px]',
                        step.priority === 'high' &&
                          'bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-100',
                      )}
                    >
                      {PRIORITY_LABEL[step.priority]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
