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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CHART_COLORS } from '@/lib/chart-theme'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
  '09_rexa_module_clf_metrics.png': 'RExA Acc / Precision / Recall / F1',
  '10_literature_model_comparison.png': 'DAES & literature vs RExA comparison',
  '11_star_scoring_comparison.png': 'Star scoring: keyword vs RExA vs DistilBERT',
}

interface ComparisonTables {
  rexa_clf_table: Array<{
    Model: string
    Accuracy: number
    Precision: number
    Recall: number
    'F1-score': number
  }>
  literature_table: Array<{
    Model: string
    'Accuracy %': number | string
    'Precision %': number | string
    'Recall %': number | string
    'F1 %': number | string
    Focus: string
  }>
  star_table: Array<{
    Model: string
    'MAE (↓)': number
    'Within-1-star % (↑)': number
    'Exact Acc %': number
    'Spearman ρ': number
  }>
  figures: string[]
}

const STATIC_FIGURES = [
  '01_dataset_preprocessing.png',
  '02_preprocessing_pipeline.png',
  '04_obj2_reasoning_depth.png',
  '08_obj3_explainable_visuals.png',
]

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

export function EvaluationPage() {
  const [data, setData] = useState<EvaluationMetrics | null>(null)
  const [comparison, setComparison] = useState<ComparisonTables | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    Promise.all([
      fetch('/evaluation/metrics.json').then((res) => {
        if (!res.ok) throw new Error('Metrics file not found. Run generate_fyp_figures.py first.')
        return res.json()
      }),
      fetch('/evaluation/comparison_tables.json')
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ])
      .then(([json, cmp]) => {
        if (!mounted) return
        setData(json as EvaluationMetrics)
        setComparison(cmp as ComparisonTables | null)
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
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="metrics">Tables</TabsTrigger>
              <TabsTrigger value="charts">Charts</TabsTrigger>
              <TabsTrigger value="figures">Figures</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
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
            </TabsContent>

            <TabsContent value="metrics" className="space-y-4">
              {comparison && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold tracking-tight">
                  Accuracy · Precision · Recall · F1
                </h2>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Core RExA module metrics (test set)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Model</TableHead>
                          <TableHead>Accuracy</TableHead>
                          <TableHead>Precision</TableHead>
                          <TableHead>Recall</TableHead>
                          <TableHead>F1-score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparison.rexa_clf_table.map((row) => (
                          <TableRow key={row.Model}>
                            <TableCell className="font-medium">{row.Model}</TableCell>
                            <TableCell>{row.Accuracy}%</TableCell>
                            <TableCell>{row.Precision}%</TableCell>
                            <TableCell>{row.Recall}%</TableCell>
                            <TableCell>{row['F1-score']}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <p className="mt-2 text-xs text-muted-foreground">
                      * Support/Contradiction agreement is measured against
                      heuristic silver labels, so high scores are expected.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Published systems vs RExA (full table)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Model</TableHead>
                          <TableHead>Accuracy</TableHead>
                          <TableHead>Precision</TableHead>
                          <TableHead>Recall</TableHead>
                          <TableHead>F1</TableHead>
                          <TableHead>Focus</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparison.literature_table.map((row) => (
                          <TableRow key={row.Model}>
                            <TableCell className="font-medium">{row.Model}</TableCell>
                            <TableCell>
                              {typeof row['Accuracy %'] === 'number'
                                ? `${row['Accuracy %']}%`
                                : row['Accuracy %']}
                            </TableCell>
                            <TableCell>
                              {typeof row['Precision %'] === 'number'
                                ? `${row['Precision %']}%`
                                : row['Precision %']}
                            </TableCell>
                            <TableCell>
                              {typeof row['Recall %'] === 'number'
                                ? `${row['Recall %']}%`
                                : row['Recall %']}
                            </TableCell>
                            <TableCell>
                              {typeof row['F1 %'] === 'number'
                                ? `${row['F1 %']}%`
                                : row['F1 %']}
                            </TableCell>
                            <TableCell className="max-w-[220px] text-muted-foreground">
                              {row.Focus}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Star scoring comparison (keyword vs RExA vs DistilBERT)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Model</TableHead>
                          <TableHead>MAE (↓)</TableHead>
                          <TableHead>Within-1-star %</TableHead>
                          <TableHead>Exact Acc %</TableHead>
                          <TableHead>Spearman ρ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparison.star_table.map((row) => (
                          <TableRow key={row.Model}>
                            <TableCell className="font-medium">{row.Model}</TableCell>
                            <TableCell>{row['MAE (↓)']}</TableCell>
                            <TableCell>{row['Within-1-star % (↑)']}%</TableCell>
                            <TableCell>{row['Exact Acc %']}%</TableCell>
                            <TableCell>{row['Spearman ρ']}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <p className="mt-2 text-xs text-muted-foreground">
                      DistilBERT is comparative only — Core RExA remains the proposed system.
                    </p>
                  </CardContent>
                </Card>
              </section>
              )}
            </TabsContent>

            <TabsContent value="charts" className="space-y-6">
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
                      <Bar dataKey="Before" fill={CHART_COLORS.lavender} name="Keyword baseline" />
                      <Bar dataKey="After" fill={CHART_COLORS.indigo} name="Trained RExA" />
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
                      <Line type="monotone" dataKey="train" stroke={CHART_COLORS.indigo} name="Train MAE" />
                      <Line type="monotone" dataKey="val" stroke={CHART_COLORS.violet} name="Val MAE" />
                      <Line
                        type="monotone"
                        dataKey="baseline"
                        stroke={CHART_COLORS.lavender}
                        strokeDasharray="4 4"
                        name="Baseline MAE"
                      />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

            {comparison && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      RExA Acc / P / R / F1
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer className="h-72 w-full">
                      <BarChart
                        data={comparison.rexa_clf_table.map((r) => ({
                          name: r.Model.replace('RExA ', '').replace(' (Core)', ''),
                          Accuracy: r.Accuracy,
                          Precision: r.Precision,
                          Recall: r.Recall,
                          F1: r['F1-score'],
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Accuracy" fill={CHART_COLORS.indigo} />
                        <Bar dataKey="Precision" fill={CHART_COLORS.violet} />
                        <Bar dataKey="Recall" fill={CHART_COLORS.sky} />
                        <Bar dataKey="F1" fill={CHART_COLORS.lavender} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Literature comparison (DAES & others vs RExA)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer className="h-72 w-full">
                      <BarChart
                        data={comparison.literature_table
                          .filter((r) => typeof r['F1 %'] === 'number')
                          .map((r) => ({
                            name: String(r.Model)
                              .replace(' (ours)', '')
                              .replace('DAES (LDA+T5+SBERT)', 'DAES')
                              .replace('Ashoka et al. hybrid DL', 'Ashoka')
                              .replace('RExA Sentence Roles', 'RExA Roles'),
                            Accuracy: r['Accuracy %'] as number,
                            Precision: r['Precision %'] as number,
                            Recall: r['Recall %'] as number,
                            F1: r['F1 %'] as number,
                          }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis domain={[80, 100]} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Accuracy" fill={CHART_COLORS.indigo} />
                        <Bar dataKey="Precision" fill={CHART_COLORS.violet} />
                        <Bar dataKey="Recall" fill={CHART_COLORS.sky} />
                        <Bar dataKey="F1" fill={CHART_COLORS.lavender} />
                      </BarChart>
                    </ChartContainer>
                    <p className="mt-2 text-xs text-muted-foreground">
                      DAES Acc 95% / F1 94%. RExA roles Acc 95.9% / F1 94.5% —
                      plus explainable reasoning analysis.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
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
                      <Bar dataKey="f1" fill={CHART_COLORS.violet} name="F1 (%)" />
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
                      <Bar dataKey="value" fill={CHART_COLORS.indigo} name="Score (%)" />
                    </BarChart>
                  </ChartContainer>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Depth MAE {data.modules.reasoning_depth.mae.toFixed(3)} · Spearman ρ{' '}
                    {data.modules.reasoning_depth.spearman_rho.toFixed(3)}. Support 100% is vs
                    heuristic silver labels, so high agreement is expected.
                  </p>
                </CardContent>
              </Card>
            </div>
            </TabsContent>

            <TabsContent value="figures" className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">
                Static figures (slides / report)
              </h2>
              <p className="text-sm text-muted-foreground">
                Interactive metric charts live in the Charts tab. This tab keeps
                the dataset, pipeline, depth-band, and Objective 3 screenshots.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {STATIC_FIGURES.map((name) => (
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
            </TabsContent>
          </Tabs>
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
