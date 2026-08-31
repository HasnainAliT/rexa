import { CheckCircle2, XCircle } from 'lucide-react'
import type { AnalysisResult } from '@/types'
import {
  STAR_WEIGHTS,
  getReviewThresholds,
  overallStatus,
  toPercent,
} from '@/lib/grading'
import { ROLE_LABELS } from './RoleBadge'
import { MissingRolesList } from './HighlightedAnswer'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface ThresholdPanelProps {
  analysis: AnalysisResult
  className?: string
}

export function ThresholdPanel({ analysis, className }: ThresholdPanelProps) {
  const { roles, concepts, passed, minStars } = overallStatus(analysis)
  const thresholds = getReviewThresholds(analysis.questionId)

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={passed ? 'default' : 'outline'}
          className={
            passed
              ? 'bg-emerald-600 hover:bg-emerald-600'
              : 'border-orange-400 text-orange-800 dark:text-orange-200'
          }
        >
          {passed ? (
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
          ) : (
            <XCircle className="mr-1 h-3.5 w-3.5" />
          )}
          {passed ? 'Meets review thresholds' : 'Flagged for review'}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Flags for a closer look when below ≥{Math.round(thresholds.role * 100)}%
          role coverage, ≥{Math.round(thresholds.concept * 100)}% concept
          coverage, or {minStars} stars on the diagnostic indicator — this is a
          triage aid, not an automatic grade.
        </span>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Role coverage</span>
            <span className="text-muted-foreground">
              {roles.percent}% · {roles.covered.length}/4 core roles
            </span>
          </div>
          <Progress
            value={roles.percent}
            indicatorClassName={roles.passed ? 'bg-emerald-500' : 'bg-orange-500'}
          />
          <p className="text-xs text-muted-foreground">
            Threshold is {Math.round(thresholds.role * 100)}% (at least{' '}
            {Math.ceil(thresholds.role * 4)} of Claim, Evidence, Reasoning,
            Conclusion).
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Concept coverage</span>
            <span className="text-muted-foreground">
              {concepts.percent}% · {concepts.covered}/{concepts.total || 0}
            </span>
          </div>
          <Progress
            value={concepts.percent}
            indicatorClassName={
              concepts.passed ? 'bg-indigo-500' : 'bg-orange-500'
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {roles.covered.map((role) => (
          <Badge key={role} variant="secondary" className="capitalize">
            {ROLE_LABELS[role]} contributed
          </Badge>
        ))}
      </div>

      <MissingRolesList missing={roles.missing} />

      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <p className="mb-2 font-medium">How the diagnostic indicator is calculated</p>
        <ul className="space-y-1 text-muted-foreground">
          {STAR_WEIGHTS.map((item) => {
            const dim = analysis.dimensions.find((d) => d.key === item.key)
            const pct = dim ? toPercent(dim.score) : 0
            return (
              <li key={item.key} className="flex justify-between gap-3">
                <span>
                  {item.label} ({Math.round(item.weight * 100)}%)
                </span>
                <span className="tabular-nums text-foreground">{pct}%</span>
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Weighted mix is mapped to 1–5 stars. Contradictions slightly reduce
          the support component.
        </p>
      </div>
    </div>
  )
}
