import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, FileBarChart, Gauge, Target } from 'lucide-react'
import { CHART_SERIES } from '@/lib/chart-theme'
import type { DashboardData } from '@/types'
import { analyticsService } from '@/services'
import { ROUTES } from '@/routes/paths'
import {
  ChartContainer,
  EmptyState,
  LoadingSpinner,
  PageHeader,
  RoleBadge,
  ROLE_LABELS,
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
import { formatDate } from '@/utils'

const ROLE_COLORS = CHART_SERIES

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<'date' | 'stars' | 'question'>('date')

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

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="An overview of REXA reasoning analyses across your workspace."
        actions={
          <Button asChild>
            <Link to={ROUTES.APP.ANALYSIS}>Run analysis</Link>
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

        {!isLoading && !error && data && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total analyses
                  </CardTitle>
                  <FileBarChart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {data.stats.totalAnalyses.toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Average stars
                  </CardTitle>
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-3xl font-bold">
                    {data.stats.avgStars.toFixed(1)}
                  </div>
                  <StarRating value={data.stats.avgStars} size="sm" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Average concept coverage
                  </CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {Math.round(data.stats.avgCoverage)}%
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Coverage trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.coverageTrend.length === 0 ? (
                    <EmptyState
                      icon={BarChart3}
                      title="No trend data yet"
                      description="Run a few analyses to see coverage trends over time."
                    />
                  ) : (
                    <ChartContainer className="h-72">
                      <AreaChart data={data.coverageTrend}>
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
                              stopOpacity={0.4}
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
                          tickFormatter={(value) => formatDate(value)}
                          fontSize={12}
                        />
                        <YAxis
                          width={40}
                          fontSize={12}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip
                          labelFormatter={(value) => formatDate(value as string)}
                          formatter={(value) => [`${value}%`, 'Coverage']}
                        />
                        <Area
                          type="monotone"
                          dataKey="avgCoverage"
                          stroke="var(--color-chart-1)"
                          fill="url(#coverageFill)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ChartContainer>
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
                      <ChartContainer className="h-56">
                        <PieChart>
                          <Pie
                            data={data.roleDistribution}
                            dataKey="count"
                            nameKey="role"
                            innerRadius={48}
                            outerRadius={78}
                            paddingAngle={2}
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
                        {data.roleDistribution.map((entry) => (
                          <div
                            key={entry.role}
                            className="flex items-center gap-1.5 text-xs"
                          >
                            <RoleBadge role={entry.role} />
                            <span className="tabular-nums text-muted-foreground">
                              {entry.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
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
                    <option value="stars">Stars</option>
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
                        <TableHead>Stars</TableHead>
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
                          <TableCell>
                            <StarRating value={analysis.stars} size="sm" />
                          </TableCell>
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
