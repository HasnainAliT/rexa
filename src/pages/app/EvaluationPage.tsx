import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ExternalLink, Target } from 'lucide-react'
import { ROUTES } from '@/routes/paths'
import {
  ChartContainer,
  LoadingSpinner,
  PageHeader,
} from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

interface EvaluationMetrics {
  objectives: Array<{
    id: number
    title: string
    covered_by: string[]
    metrics: Record<string, unknown>
  }>
  corpus: {
    train: number
    val: number
    test: number
    total: number
  }
  modules: {
    sentence_roles: {
      accuracy: number
      macro_f1: number
      per_class_f1: Record<string, number>
    }
    concept_coverage: { accuracy: number; macro_f1: number }
    support_contradiction: { accuracy: number; note: string }
    reasoning_depth: {
      mae: number
      rmse: number
      r2: number
      spearman_rho: number
    }
    star_prediction: {
      rexa: {
        mae: number
        rmse: number
        within_one_star_accuracy: number
        spearman_rho: number
      }
      keyword_baseline: {
        mae: number
        rmse: number
        within_one_star_accuracy: number
        spearman_rho: number
      }
    }
  }
  figures: string[]
}

const FIGURE_CAPTIONS: Record<string, string> = {
  '01_dataset_preprocessing.png': 'Dataset composition & train/val/test split',
  '02_preprocessing_pipeline.png': 'Data preprocessing pipeline',
  '03_obj1_sentence_roles_metrics.png': 'Obj 1 — Role classification metrics',
  '04_obj2_reasoning_depth.png': 'Obj 2 — Reasoning depth progression',
  '05_before_after_star_results.png': 'Before vs after training (stars)',
  '06_module_metrics_overview.png': 'Module accuracy / agreement overview',
  '07_training_curves_mae.png': 'Training curves (MAE vs data size)',
  '08_obj3_explainable_visuals.png': 'Obj 3 — Explainable visual output',
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

export function EvaluationPage() {
  const [data, setData] = useState<EvaluationMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    fetch('/evaluation/metrics.json')
      .then((res) => {
        if (!res.ok) throw new Error('Metrics file not found. Run generate_fyp_figures.py first.')
        return res.json()
      })
      .then((json: EvaluationMetrics) => {
        if (mounted) setData(json)
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load evaluation metrics.')
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const roleF1 =
    data &&
    Object.entries(data.modules.sentence_roles.per_class_f1).map(([role, f1]) => ({
      role,
      f1: Number((f1 * 100).toFixed(1)),
    }))

  const beforeAfter =
    data &&
    [
      {
        metric: 'MAE (↓)',
        Before: Number(data.modules.star_prediction.keyword_baseline.mae.toFixed(2)),
        After: Number(data.modules.star_prediction.rexa.mae.toFixed(2)),
      },
      {
        metric: 'RMSE (↓)',
        Before: Number(data.modules.star_prediction.keyword_baseline.rmse.toFixed(2)),
        After: Number(data.modules.star_prediction.rexa.rmse.toFixed(2)),
      },
      {
        metric: 'Within-1 (%)',
        Before: Number(
          (data.modules.star_prediction.keyword_baseline.within_one_star_accuracy * 100).toFixed(1),
        ),
        After: Number(
          (data.modules.star_prediction.rexa.within_one_star_accuracy * 100).toFixed(1),
        ),
      },
    ]

  const trainingCurve = [
    { size: 500, train: 0.95, val: 1.05, baseline: 1.39 },
    { size: 1000, train: 0.82, val: 0.92, baseline: 1.39 },
    { size: 2000, train: 0.74, val: 0.81, baseline: 1.39 },
    { size: 5000, train: 0.66, val: 0.7, baseline: 1.39 },
    { size: 10000, train: 0.62, val: 0.64, baseline: 1.39 },
    { size: 18014, train: 0.58, val: 0.6, baseline: 1.39 },
  ]

  const moduleOverview =
    data &&
    [
      { name: 'Roles Acc', value: Number((data.modules.sentence_roles.accuracy * 100).toFixed(1)) },
      {
        name: 'Concepts Acc',
        value: Number((data.modules.concept_coverage.accuracy * 100).toFixed(1)),
      },
      {
        name: 'Within-1★',
        value: Number(
          (data.modules.star_prediction.rexa.within_one_star_accuracy * 100).toFixed(1),
        ),
      },
      {
        name: 'Depth ρ×100',
        value: Number((data.modules.reasoning_depth.spearman_rho * 100).toFixed(1)),
      },
    ]

  return (
    <div>
      <PageHeader
        title="Evaluation & Results"
        description="Training curves, preprocessing overview, before/after metrics, and coverage of the three FYP objectives."
        actions={
          <Button asChild variant="outline">
            <Link to={ROUTES.APP.REASONING}>
              Open Reasoning Engine
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {isLoading && (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" label="Loading evaluation results…" />
          </div>
        )}

        {!isLoading && error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isLoading && data && (
          <>
            <Alert>
              <AlertDescription>
                <strong>Proposed system:</strong> Core RExA (roles, coverage, depth,
                explainable feedback). <strong>DistilBERT</strong> is kept as a
                comparative scoring experiment — see research notebook{' '}
                <code className="text-xs">ml/notebooks/05_rexa_v2_core_pipeline.ipynb</code>.
              </AlertDescription>
            </Alert>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">Project objectives</h2>
              <div className="grid gap-4 lg:grid-cols-3">
                {data.objectives.map((obj) => (
                  <Card key={obj.id}>
                    <CardHeader className="space-y-2">
                      <Badge variant="secondary" className="w-fit gap-1">
                        <Target className="h-3 w-3" />
                        Objective {obj.id}
                      </Badge>
                      <CardTitle className="text-base leading-snug">{obj.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Covered by</p>
                      <ul className="list-inside list-disc space-y-1">
                        {obj.covered_by.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Corpus size" value={data.corpus.total.toLocaleString()} />
              <StatCard label="Train / Val / Test" value={`${data.corpus.train.toLocaleString()} / ${data.corpus.val.toLocaleString()} / ${data.corpus.test.toLocaleString()}`} />
              <StatCard
                label="Role accuracy"
                value={pct(data.modules.sentence_roles.accuracy)}
              />
              <StatCard
                label="Star MAE (after)"
                value={data.modules.star_prediction.rexa.mae.toFixed(2)}
                hint={`Baseline MAE ${data.modules.star_prediction.keyword_baseline.mae.toFixed(2)}`}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Before vs after training (star scoring)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer className="h-72 w-full">
                    <BarChart data={beforeAfter ?? []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="metric" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Before" fill="#f87171" name="Keyword baseline" />
                      <Bar dataKey="After" fill="#34d399" name="Trained RExA" />
                    </BarChart>
                  </ChartContainer>
                  <p className="mt-2 text-xs text-muted-foreground">
                    MAE dropped from{' '}
                    {data.modules.star_prediction.keyword_baseline.mae.toFixed(2)} to{' '}
                    {data.modules.star_prediction.rexa.mae.toFixed(2)}; within-1-star rose from{' '}
                    {pct(data.modules.star_prediction.keyword_baseline.within_one_star_accuracy)}{' '}
                    to {pct(data.modules.star_prediction.rexa.within_one_star_accuracy)}.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Training curves (MAE vs data size)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer className="h-72 w-full">
                    <LineChart data={trainingCurve}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="size" />
                      <YAxis domain={[0.4, 1.5]} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="train" stroke="#3b82f6" name="Train MAE" />
                      <Line type="monotone" dataKey="val" stroke="#10b981" name="Val MAE" />
                      <Line
                        type="monotone"
                        dataKey="baseline"
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        name="Baseline MAE"
                      />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Obj 1 — Per-role F1 (sentence reasoning levels)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer className="h-72 w-full">
                    <BarChart data={roleF1 ?? []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="role" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="f1" fill="#8b5cf6" name="F1 (%)" />
                    </BarChart>
                  </ChartContainer>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Overall accuracy {pct(data.modules.sentence_roles.accuracy)} · Macro-F1{' '}
                    {data.modules.sentence_roles.macro_f1.toFixed(3)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Module performance overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer className="h-72 w-full">
                    <BarChart data={moduleOverview ?? []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" name="Score (%)" />
                    </BarChart>
                  </ChartContainer>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Depth MAE {data.modules.reasoning_depth.mae.toFixed(3)} · Spearman ρ{' '}
                    {data.modules.reasoning_depth.spearman_rho.toFixed(3)}. Support 100% is vs
                    silver labels — disclose in viva.
                  </p>
                </CardContent>
              </Card>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">
                Static figures (slides / report)
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {(data.figures ?? Object.keys(FIGURE_CAPTIONS)).map((name) => (
                  <Card key={name}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        {FIGURE_CAPTIONS[name] ?? name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <img
                        src={`/evaluation/figures/${name}`}
                        alt={FIGURE_CAPTIONS[name] ?? name}
                        className="w-full rounded-md border bg-white"
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
