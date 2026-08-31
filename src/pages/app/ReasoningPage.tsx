import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  MinusCircle,
  XCircle,
} from 'lucide-react'
import type { AnalysisResult, SupportRelation } from '@/types'
import { analysisService } from '@/services'
import { ROUTES } from '@/routes/paths'
import { overallStatus } from '@/lib/grading'
import {
  ConceptChips,
  DimensionBars,
  EmptyState,
  HighlightedAnswer,
  LoadingSpinner,
  PageHeader,
  StarRating,
  ThresholdPanel,
} from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils'

const RELATION_META: Record<
  SupportRelation,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  support: {
    label: 'Support',
    icon: CheckCircle2,
    className: 'text-emerald-700 dark:text-emerald-400',
  },
  contradiction: {
    label: 'Contradiction',
    icon: XCircle,
    className: 'text-rose-700 dark:text-rose-400',
  },
  neutral: {
    label: 'Neutral',
    icon: MinusCircle,
    className: 'text-muted-foreground',
  },
}

export function ReasoningPage() {
  const [searchParams] = useSearchParams()
  const id = searchParams.get('id')

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setIsLoading(true)
    setError(null)

    const load = id
      ? analysisService.getAnalysis(id)
      : analysisService
          .listAnalyses({ page: 1, pageSize: 1 })
          .then((response) => response.data[0] ?? null)

    load
      .then((result) => {
        if (mounted) setAnalysis(result)
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load analysis.',
          )
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [id])

  const status = analysis ? overallStatus(analysis) : null

  return (
    <div>
      <PageHeader
        title="Reasoning engine"
        description={
          analysis
            ? `Deep dive into "${analysis.questionText}"`
            : 'Deep dive into how REXA reasons about a submitted answer.'
        }
        actions={
          analysis && (
            <span className="text-sm text-muted-foreground">
              {formatDate(analysis.createdAt)}
            </span>
          )
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {isLoading && (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" label="Loading analysis…" />
          </div>
        )}

        {!isLoading && error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && !analysis && (
          <EmptyState
            icon={Brain}
            title="No analysis found"
            description="Run an analysis first to explore its reasoning breakdown."
            action={
              <Button asChild>
                <Link to={ROUTES.APP.ANALYSIS}>Run analysis</Link>
              </Button>
            }
          />
        )}

        {!isLoading && !error && analysis && status && (
          <>
            <div className="grid items-stretch gap-4 lg:grid-cols-3">
              <Card className="flex flex-col lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Dimension scores</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-5">
                  <div className="flex items-center gap-3">
                    <StarRating value={analysis.stars} size="lg" />
                    <span className="text-2xl font-bold">
                      {analysis.stars.toFixed(1)}
                    </span>
                    <Badge variant={status.passed ? 'default' : 'outline'}>
                      {status.passed ? 'Pass' : 'Needs work'}
                    </Badge>
                  </div>
                  <DimensionBars dimensions={analysis.dimensions} />
                </CardContent>
              </Card>

              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base">Reasoning depth</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">
                      {analysis.reasoningDepth.level}/5
                    </span>
                    <Badge variant="secondary">
                      {analysis.reasoningDepth.label}
                    </Badge>
                  </div>
                  <Progress
                    value={(analysis.reasoningDepth.level / 5) * 100}
                    indicatorClassName="bg-violet-500"
                  />
                  {analysis.reasoningDepth.description && (
                    <p className="text-sm text-muted-foreground">
                      {analysis.reasoningDepth.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Sentence-by-sentence breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <HighlightedAnswer sentences={analysis.sentenceRoles} />
              </CardContent>
            </Card>

            <div className="grid items-stretch gap-4 lg:grid-cols-2">
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base">
                    Thresholds &amp; review logic
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <ThresholdPanel analysis={analysis} />
                </CardContent>
              </Card>

              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base">Concept coverage</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <p className="text-xs text-muted-foreground">
                    Solid indigo chips are covered. Dashed orange chips are
                    missing from the answer.
                  </p>
                  <ConceptChips concepts={analysis.conceptCoverage} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Support &amp; contradiction
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analysis.supportPairs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No alignment pairs were detected for this answer.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {analysis.supportPairs.map((pair, index) => {
                      const meta = RELATION_META[pair.relation]
                      const Icon = meta.icon
                      return (
                        <li
                          key={index}
                          className="space-y-1.5 rounded-md border p-3 text-sm"
                        >
                          <div
                            className={cn(
                              'flex items-center gap-1.5 text-xs font-medium',
                              meta.className,
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {meta.label}
                          </div>
                          <p>{pair.studentText}</p>
                          <div className="flex items-start gap-1.5 text-muted-foreground">
                            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <p>{pair.referenceText}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {analysis.explanations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Explanations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {analysis.explanations.map((explanation) => (
                      <li key={explanation.id} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {explanation.message}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
