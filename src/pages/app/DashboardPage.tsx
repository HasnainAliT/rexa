import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  BarChart3,
  ChevronRight,
  FileBarChart,
  Gauge,
  Minus,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { CHART_SERIES } from '@/lib/chart-theme'
import { cn } from '@/lib/utils'
import type {
  CoverageTrendPoint,
  DashboardBand,
  DashboardData,
  RoleSentenceExample,
  SentenceRoleLabel,
} from '@/types'
import { analysisService, analyticsService } from '@/services'
import { mapRole } from '@/lib/api-mappers'
import { isStudentRole } from '@/lib/roles'
import { useAuth } from '@/hooks'
import { ROUTES } from '@/routes/paths'
import {
  ChartContainer,
  EmptyState,
  LoadingSpinner,
  PageHeader,
  RoleBadge,
  ROLE_LABELS,
  getRoleHighlightStyles,
  StarRating,
} from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { formatDate } from '@/utils'

const ROLE_COLORS = CHART_SERIES
const STRONG_COVERAGE = 80

type StatKey = 'analyses' | 'stars' | 'coverage' | 'depth'

function coverageInsight(trend: CoverageTrendPoint[]) {
  const latest = trend[trend.length - 1]
  const previous = trend[trend.length - 2]
  const latestPct = Math.round(latest?.avgCoverage ?? 0)
  const delta =
    latest && previous
      ? Math.round(latest.avgCoverage - previous.avgCoverage)
      : 0
  const strongDays = trend.filter(
    (point) => point.avgCoverage >= STRONG_COVERAGE,
  ).length
  const latestCount = latest?.count

  let headline = `Latest answers covered ${latestPct}% of the required concepts.`
  if (latestPct >= STRONG_COVERAGE) {
    headline = `Latest answers covered ${latestPct}% of required concepts — that is a strong result.`
  } else if (latestPct >= 50) {
    headline = `Latest answers covered ${latestPct}% of required concepts — some key ideas are still missing.`
  } else if (latest) {
    headline = `Latest answers covered only ${latestPct}% of required concepts — most required ideas were missed.`
  }

  let changeLabel = 'Same as the previous day'
  if (delta > 0) changeLabel = `Up ${delta} points from the previous day`
  if (delta < 0) changeLabel = `Down ${Math.abs(delta)} points from the previous day`

  return {
    latestPct,
    delta,
    strongDays,
    totalDays: trend.length,
    latestCount,
    headline,
    changeLabel,
    latestStars: latest?.avgStars,
    hasCounts: trend.some(
      (point) => typeof point.count === 'number' && point.count > 0,
    ),
  }
}

function CoverageTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload: CoverageTrendPoint }>
  label?: string
}) {
  if (!active || !payload?.length || !label) return null
  const point = payload[0].payload
  const answers = point.count
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{formatDate(label)}</p>
      <p className="mt-1">
        Concept coverage:{' '}
        <span className="font-medium">{Math.round(point.avgCoverage)}%</span>
      </p>
      {typeof point.avgStars === 'number' && (
        <p>
          Average stars:{' '}
          <span className="font-medium">{point.avgStars.toFixed(1)}</span>
        </p>
      )}
      {typeof answers === 'number' && (
        <p className="text-muted-foreground">
          {answers} {answers === 1 ? 'answer' : 'answers'} that day
        </p>
      )}
    </div>
  )
}

function BandList({ bands }: { bands: DashboardBand[] }) {
  if (bands.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No analyses yet — run a few answers to see this split.
      </p>
    )
  }
  return (
    <ul className="space-y-3">
      {bands.map((band) => (
        <li key={band.label} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>{band.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {band.count} · {band.percent}%
            </span>
          </div>
          <Progress value={band.percent} />
        </li>
      ))}
    </ul>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const isStudent = isStudentRole(user?.role)
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<'date' | 'stars' | 'question'>('date')
  const [openStat, setOpenStat] = useState<StatKey | null>(null)
  const [selectedRole, setSelectedRole] = useState<SentenceRoleLabel | null>(
    null,
  )
  const [fallbackSentences, setFallbackSentences] = useState<
    RoleSentenceExample[]
  >([])
  const [fallbackLoading, setFallbackLoading] = useState(false)

  const recent = useMemo(() => {
    const unique = new Map(
      (data?.recentAnalyses ?? []).map((item) => [item.id, item]),
    )
    let rows = [...unique.values()]
    if (query.trim()) {
      const q = query.toLowerCase()
      rows = rows.filter((row) => row.questionText.toLowerCase().includes(q))
    }
    rows.sort((a, b) => {
      if (sortKey === 'stars') return b.stars - a.stars
      if (sortKey === 'question') return a.questionText.localeCompare(b.questionText)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    return rows
  }, [data, query, sortKey])

  const roleSentences = useMemo(() => {
    const fromDashboard = data?.roleSentences ?? []
    return fromDashboard.length > 0 ? fromDashboard : fallbackSentences
  }, [data, fallbackSentences])

  const selectedRoleSentences = useMemo(() => {
    if (!selectedRole) return []
    return roleSentences.filter((item) => mapRole(item.role) === selectedRole)
  }, [roleSentences, selectedRole])

  const selectedRoleTotal =
    data?.roleDistribution.find((item) => item.role === selectedRole)?.count ??
    selectedRoleSentences.length

  const coverageStory = useMemo(
    () =>
      data?.coverageTrend.length
        ? coverageInsight(data.coverageTrend)
        : null,
    [data],
  )

  const toggleRole = (role: SentenceRoleLabel) => {
    setSelectedRole((current) => (current === role ? null : role))
  }

  useEffect(() => {
    if (!selectedRole) return
    document
      .getElementById('role-sentences')
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedRole])

  useEffect(() => {
    let mounted = true

    analyticsService
      .getDashboard()
      .then((result) => {
        if (mounted) setData(result)
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load dashboard data.',
          )
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!data || (data.roleSentences?.length ?? 0) > 0) return
    let mounted = true
    setFallbackLoading(true)
    analysisService
      .listAnalyses({ page: 1, pageSize: 100 })
      .then((page) => {
        if (!mounted) return
        setFallbackSentences(
          page.data.flatMap((analysis) =>
            analysis.sentenceRoles.map((sentence) => ({
              analysisId: analysis.id,
              questionTitle: analysis.questionText || 'Question',
              studentName: analysis.studentName,
              text: sentence.text,
              role: mapRole(sentence.role),
              confidence: sentence.confidence,
              reason: sentence.reason,
            })),
          ),
        )
      })
      .catch(() => {
        if (mounted) setFallbackSentences([])
      })
      .finally(() => {
        if (mounted) setFallbackLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [data])

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={
          isStudent
            ? 'Your answers, concept coverage, and reasoning depth. No star scores.'
            : 'An overview of REXA reasoning analyses across your workspace.'
        }
        actions={
          <Button asChild>
            <Link to={ROUTES.APP.ANALYSIS}>
              {isStudent ? 'Write an answer' : 'Run analysis'}
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {isLoading && (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" label="Loading dashboard…" />
          </div>
        )}

        {!isLoading && error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && data && isStudent && (data.stats.empty || data.stats.totalAnalyses === 0) && (
          <EmptyState
            icon={FileBarChart}
            title="No answers yet"
            description="Open the reasoning console, write an answer, and your coverage, depth, and sentence roles will appear here."
            action={
              <Button asChild>
                <Link to={ROUTES.APP.ANALYSIS}>Write an answer</Link>
              </Button>
            }
          />
        )}

        {!isLoading && !error && data && !(isStudent && (data.stats.empty || data.stats.totalAnalyses === 0)) && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  {
                    id: 'analyses' as const,
                    title: isStudent ? 'Your answers' : 'Total analyses',
                    icon: FileBarChart,
                    body: (
                      <div className="text-3xl font-bold">
                        {data.stats.totalAnalyses.toLocaleString()}
                      </div>
                    ),
                  },
                  ...(!isStudent
                    ? [
                        {
                          id: 'stars' as const,
                          title: 'Average stars',
                          icon: Gauge,
                          body: (
                            <div className="space-y-2">
                              <div className="text-3xl font-bold">
                                {(data.stats.avgStars ?? 0).toFixed(1)}
                              </div>
                              <StarRating value={data.stats.avgStars ?? 0} size="sm" />
                            </div>
                          ),
                        },
                      ]
                    : []),
                  {
                    id: 'coverage' as const,
                    title: 'Average concept coverage',
                    icon: Target,
                    body: (
                      <div className="text-3xl font-bold">
                        {Math.round(data.stats.avgCoverage)}%
                      </div>
                    ),
                  },
                  ...(isStudent
                    ? [
                        {
                          id: 'depth' as const,
                          title: 'Average reasoning depth',
                          icon: Gauge,
                          body: (
                            <div className="text-3xl font-bold">
                              {Math.round((data.stats.avgDepth ?? 0) * 100)}%
                            </div>
                          ),
                        },
                      ]
                    : []),
                ] as const
              ).map((stat) => {
                const Icon = stat.icon
                const selected = !isStudent && openStat === stat.id
                return (
                  <Card
                    key={stat.id}
                    role={isStudent ? undefined : 'button'}
                    tabIndex={isStudent ? undefined : 0}
                    aria-pressed={isStudent ? undefined : selected}
                    aria-expanded={isStudent ? undefined : selected}
                    onClick={
                      isStudent
                        ? undefined
                        : () =>
                            setOpenStat((current) =>
                              current === stat.id ? null : stat.id,
                            )
                    }
                    onKeyDown={
                      isStudent
                        ? undefined
                        : (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setOpenStat((current) =>
                                current === stat.id ? null : stat.id,
                              )
                            }
                          }
                    }
                    className={cn(
                      !isStudent &&
                        'cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                      selected && 'border-indigo-500 ring-2 ring-indigo-500/20',
                    )}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </CardTitle>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      {stat.body}
                      {!isStudent && (
                      <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                        {selected ? 'Hide breakdown' : 'Click for breakdown'}
                        <ChevronRight
                          className={cn(
                            'h-3.5 w-3.5 transition-transform',
                            selected && 'rotate-90',
                          )}
                        />
                      </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {openStat && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {openStat === 'analyses' && 'Where these analyses come from'}
                    {openStat === 'stars' && 'How the class is scoring'}
                    {openStat === 'coverage' && 'How well key concepts are covered'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {openStat === 'analyses' && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {data.stats.totalAnalyses} saved runs across{' '}
                        {data.stats.totalQuestions ?? 0} questions
                        {typeof data.stats.analysesThisWeek === 'number'
                          ? `, including ${data.stats.analysesThisWeek} in the last 7 days`
                          : ''}
                        .
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          document
                            .getElementById('recent-analyses')
                            ?.scrollIntoView({ behavior: 'smooth' })
                        }
                      >
                        Jump to recent list
                      </Button>
                    </>
                  )}
                  {openStat === 'stars' && !isStudent && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Average {(data.stats.avgStars ?? 0).toFixed(1)} / 5. This split
                        shows how many answers sit below, around, or above that
                        average — it does not change the score of any answer.
                      </p>
                      <BandList bands={data.stats.starBands ?? []} />
                    </>
                  )}
                  {openStat === 'coverage' && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Average {Math.round(data.stats.avgCoverage)}% of required
                        concepts mentioned. Use this to see how many answers are
                        still missing key ideas.
                      </p>
                      <BandList bands={data.stats.coverageBands ?? []} />
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-base">
                    Are answers covering the required concepts?
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Each point is the average share of required concepts mentioned
                    that day. The dashed line is the 80% strong mark.
                  </p>
                </CardHeader>
                <CardContent>
                  {data.coverageTrend.length === 0 || !coverageStory ? (
                    <EmptyState
                      icon={BarChart3}
                      title="No coverage history yet"
                      description="After a few analyses, this shows whether answers are mentioning the required concepts."
                    />
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm">{coverageStory.headline}</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-lg border bg-muted/30 px-3 py-2">
                          <p className="text-xs text-muted-foreground">
                            Latest coverage
                          </p>
                          <p className="mt-1 text-xl font-semibold tabular-nums">
                            {coverageStory.latestPct}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {typeof coverageStory.latestCount === 'number'
                              ? `${coverageStory.latestCount} ${
                                  coverageStory.latestCount === 1
                                    ? 'answer'
                                    : 'answers'
                                } that day`
                              : 'Required concepts mentioned'}
                            {!isStudent &&
                            typeof coverageStory.latestStars === 'number'
                              ? ` · ${coverageStory.latestStars.toFixed(1)} stars`
                              : ''}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/30 px-3 py-2">
                          <p className="text-xs text-muted-foreground">
                            Change
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-xl font-semibold tabular-nums">
                            {coverageStory.delta > 0 && (
                              <TrendingUp className="h-4 w-4 text-emerald-600" />
                            )}
                            {coverageStory.delta < 0 && (
                              <TrendingDown className="h-4 w-4 text-rose-600" />
                            )}
                            {coverageStory.delta === 0 && (
                              <Minus className="h-4 w-4 text-muted-foreground" />
                            )}
                            {coverageStory.delta > 0 ? '+' : ''}
                            {coverageStory.delta}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {coverageStory.changeLabel}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/30 px-3 py-2">
                          <p className="text-xs text-muted-foreground">
                            Strong days
                          </p>
                          <p className="mt-1 text-xl font-semibold tabular-nums">
                            {coverageStory.strongDays}
                            <span className="text-sm font-normal text-muted-foreground">
                              /{coverageStory.totalDays}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Days at {STRONG_COVERAGE}% or higher
                          </p>
                        </div>
                      </div>
                      <ChartContainer className="h-72">
                        <ComposedChart data={data.coverageTrend}>
                          <defs>
                            <linearGradient
                              id="coverageFill"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="var(--color-chart-1)"
                                stopOpacity={0.35}
                              />
                              <stop
                                offset="95%"
                                stopColor="var(--color-chart-1)"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value) =>
                              formatDate(value, {
                                month: 'short',
                                day: 'numeric',
                              })
                            }
                            fontSize={12}
                          />
                          <YAxis
                            yAxisId="coverage"
                            domain={[0, 100]}
                            width={40}
                            fontSize={12}
                            tickFormatter={(value) => `${value}%`}
                          />
                          {coverageStory.hasCounts && (
                            <YAxis
                              yAxisId="count"
                              orientation="right"
                              width={28}
                              fontSize={11}
                              allowDecimals={false}
                              tickFormatter={(value) => String(value)}
                            />
                          )}
                          <Tooltip content={<CoverageTooltip />} />
                          <Legend
                            wrapperStyle={{ fontSize: 12 }}
                            formatter={(value) =>
                              value === 'avgCoverage'
                                ? 'Concept coverage'
                                : 'Answers that day'
                            }
                          />
                          <ReferenceLine
                            yAxisId="coverage"
                            y={STRONG_COVERAGE}
                            stroke="hsl(var(--muted-foreground))"
                            strokeDasharray="4 4"
                            label={{
                              value: 'Strong 80%',
                              position: 'insideTopRight',
                              fontSize: 11,
                              fill: 'hsl(var(--muted-foreground))',
                            }}
                          />
                          {coverageStory.hasCounts && (
                            <Bar
                              yAxisId="count"
                              dataKey="count"
                              fill="var(--color-chart-2)"
                              opacity={0.28}
                              maxBarSize={28}
                              name="Answers that day"
                            />
                          )}
                          <Area
                            yAxisId="coverage"
                            type="monotone"
                            dataKey="avgCoverage"
                            stroke="var(--color-chart-1)"
                            fill="url(#coverageFill)"
                            strokeWidth={2}
                            dot={{ r: 3, strokeWidth: 1 }}
                            activeDot={{ r: 5 }}
                            name="Concept coverage"
                          />
                        </ComposedChart>
                      </ChartContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Role distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.roleDistribution.length === 0 ? (
                    <EmptyState
                      title="No role data yet"
                      description="Sentence roles will appear here after analyses run."
                    />
                  ) : (
                    <>
                      <p className="mb-3 text-sm text-muted-foreground">
                        Click a slice or a role tag to see those sentences.
                      </p>
                      <ChartContainer className="h-56">
                        <PieChart>
                          <Pie
                            data={data.roleDistribution}
                            dataKey="count"
                            nameKey="role"
                            innerRadius={48}
                            outerRadius={78}
                            paddingAngle={2}
                            cursor="pointer"
                            onClick={(_, index) => {
                              const role = data.roleDistribution[index]?.role
                              if (role) toggleRole(role)
                            }}
                            label={(props) => {
                              const role = String(props.name ?? '')
                              const count = Number(props.value ?? 0)
                              return `${ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role} ${count}`
                            }}
                            labelLine={false}
                          >
                            {data.roleDistribution.map((entry, index) => (
                              <Cell
                                key={entry.role}
                                fill={ROLE_COLORS[index % ROLE_COLORS.length]}
                                stroke={
                                  selectedRole === entry.role
                                    ? 'hsl(var(--foreground))'
                                    : undefined
                                }
                                strokeWidth={selectedRole === entry.role ? 2 : 0}
                                className="cursor-pointer outline-none"
                                opacity={
                                  selectedRole && selectedRole !== entry.role
                                    ? 0.45
                                    : 1
                                }
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name) => [
                              value,
                              ROLE_LABELS[name as keyof typeof ROLE_LABELS] ??
                                String(name),
                            ]}
                          />
                        </PieChart>
                      </ChartContainer>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {data.roleDistribution.map((entry) => {
                          const selected = selectedRole === entry.role
                          return (
                            <button
                              key={entry.role}
                              type="button"
                              onClick={() => toggleRole(entry.role)}
                              aria-pressed={selected}
                              className={cn(
                                'flex items-center gap-1.5 rounded-md text-xs outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-indigo-500',
                                selected &&
                                  'ring-2 ring-indigo-500 ring-offset-2',
                                !selected &&
                                  selectedRole &&
                                  'opacity-50 hover:opacity-100',
                              )}
                            >
                              <RoleBadge role={entry.role} />
                              <span className="tabular-nums text-muted-foreground">
                                {entry.count}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {selectedRole && (
              <Card id="role-sentences">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {ROLE_LABELS[selectedRole]} sentences
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedRoleSentences.length === 0
                        ? fallbackLoading
                          ? 'Loading sentences…'
                          : 'No saved sentences for this role yet.'
                        : selectedRoleTotal > selectedRoleSentences.length
                          ? `Showing ${selectedRoleSentences.length} of ${selectedRoleTotal} most recent.`
                          : `${selectedRoleSentences.length} ${
                              selectedRoleSentences.length === 1
                                ? 'sentence'
                                : 'sentences'
                            } labeled ${ROLE_LABELS[selectedRole].toLowerCase()}.`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRole(null)}
                  >
                    Clear
                  </Button>
                </CardHeader>
                <CardContent>
                  <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                    {selectedRoleSentences.map((item, index) => (
                      <li
                        key={`${item.analysisId}-${index}`}
                        className="rounded-md border p-3"
                      >
                        <p
                          className={cn(
                            'text-sm leading-relaxed',
                            getRoleHighlightStyles(item.role),
                            'rounded px-1.5 py-0.5',
                          )}
                        >
                          {item.text}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            {item.questionTitle}
                            {item.studentName ? ` · ${item.studentName}` : ''}
                          </p>
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              to={`${ROUTES.APP.REASONING}?id=${item.analysisId}`}
                            >
                              View analysis
                            </Link>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card id="recent-analyses">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Recent analyses</CardTitle>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Input
                    placeholder="Search questions…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label="Search recent analyses"
                    className="sm:w-56"
                  />
                  <Select
                    value={sortKey}
                    onChange={(event) =>
                      setSortKey(event.target.value as 'date' | 'stars' | 'question')
                    }
                    aria-label="Sort recent analyses"
                  >
                    <option value="date">Newest</option>
                    {!isStudent && <option value="stars">Stars</option>}
                    <option value="question">Question</option>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {recent.length === 0 ? (
                  <EmptyState
                    icon={FileBarChart}
                    title="No analyses yet"
                    description="Run your first analysis to see it appear here."
                    action={
                      <Button asChild>
                        <Link to={ROUTES.APP.ANALYSIS}>Run analysis</Link>
                      </Button>
                    }
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Question</TableHead>
                        {!isStudent && <TableHead>Stars</TableHead>}
                        {isStudent && <TableHead>Coverage</TableHead>}
                        <TableHead>Depth</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Reasoning</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recent.map((analysis) => (
                        <TableRow key={analysis.id}>
                          <TableCell className="max-w-xs truncate font-medium">
                            {analysis.questionText}
                          </TableCell>
                          {!isStudent && (
                          <TableCell>
                            <StarRating value={analysis.stars} size="sm" />
                          </TableCell>
                          )}
                          {isStudent && (
                          <TableCell className="text-muted-foreground">
                            {Math.round((analysis.dimensions[0]?.score ?? 0) * 100)}%
                          </TableCell>
                          )}
                          <TableCell className="text-muted-foreground">
                            {analysis.reasoningDepth.label}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(analysis.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link
                                to={`${ROUTES.APP.REASONING}?id=${analysis.id}`}
                              >
                                View
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
