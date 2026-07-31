import { useEffect, useState } from 'react'
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
import type { DashboardData } from '@/types'
import { analyticsService } from '@/services'
import { ROUTES } from '@/routes/paths'
import {
  ChartContainer,
  EmptyState,
  LoadingSpinner,
  PageHeader,
  RoleBadge,
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
import { formatDate } from '@/utils'

const ROLE_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  '#94a3b8',
  '#64748b',
]

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                          >
                            {data.roleDistribution.map((entry, index) => (
                              <Cell
                                key={entry.role}
                                fill={ROLE_COLORS[index % ROLE_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ChartContainer>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {data.roleDistribution.map((entry) => (
                          <RoleBadge key={entry.role} role={entry.role} />
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent analyses</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentAnalyses.length === 0 ? (
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
                      {data.recentAnalyses.map((analysis) => (
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
