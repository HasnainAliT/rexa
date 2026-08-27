import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react'
import type { AnalysisResult } from '@/types'
import { analysisService, reportsService } from '@/services'
import { ROUTES } from '@/routes/paths'
import { overallStatus, toPercent } from '@/lib/grading'
import { CHART_COLORS } from '@/lib/chart-theme'
import {
  ChartContainer,
  EmptyState,
  LoadingSpinner,
  PageHeader,
  StarRating,
} from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PAGE_SIZE = 10

type SortKey = 'student' | 'stars' | 'coverage' | 'depth' | 'date'
type StatusFilter = 'all' | 'pass' | 'below'

function rowMetrics(analysis: AnalysisResult) {
  const status = overallStatus(analysis)
  const depth =
    analysis.dimensions.find((d) => d.key === 'reasoning_depth')?.score ?? 0
  return {
    status,
    coverage: status.roles.percent,
    concepts: status.concepts.percent,
    depth: toPercent(depth),
    overall: Math.round(
      (status.roles.percent + status.concepts.percent + analysis.stars * 20) / 3,
    ),
  }
}

function csvEscape(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`
}

export function ReportsPage() {
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([])
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')

  useEffect(() => {
    let mounted = true
    setIsLoading(true)
    setError(null)

    analysisService
      .listAnalyses({ page: 1, pageSize: 100 })
      .then((response) => {
        if (!mounted) return
        setAnalyses(response.data)
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load reports.',
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = analyses.map((analysis) => ({
      analysis,
      ...rowMetrics(analysis),
    }))
    if (q) {
      rows = rows.filter(({ analysis }) =>
        [
          analysis.studentName,
          analysis.studentId,
          analysis.questionText,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q)),
      )
    }
    if (statusFilter === 'pass') rows = rows.filter((row) => row.status.passed)
    if (statusFilter === 'below') rows = rows.filter((row) => !row.status.passed)
    rows.sort((a, b) => {
      if (sortKey === 'student') {
        return (a.analysis.studentName ?? '').localeCompare(
          b.analysis.studentName ?? '',
        )
      }
      if (sortKey === 'stars') return b.analysis.stars - a.analysis.stars
      if (sortKey === 'coverage') return b.coverage - a.coverage
      if (sortKey === 'depth') return b.depth - a.depth
      return (
        new Date(b.analysis.createdAt).getTime() -
        new Date(a.analysis.createdAt).getTime()
      )
    })
    return rows
  }, [analyses, query, sortKey, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [query, statusFilter, sortKey])

  const summary = useMemo(() => {
    if (!filtered.length) {
      return { avgStars: 0, avgCoverage: 0, avgDepth: 0, below: 0 }
    }
    const avgStars =
      filtered.reduce((sum, row) => sum + row.analysis.stars, 0) / filtered.length
    const avgCoverage =
      filtered.reduce((sum, row) => sum + row.coverage, 0) / filtered.length
    const avgDepth =
      filtered.reduce((sum, row) => sum + row.depth, 0) / filtered.length
    return {
      avgStars,
      avgCoverage,
      avgDepth,
      below: filtered.filter((row) => !row.status.passed).length,
    }
  }, [filtered])

  const comparison = filtered.slice(0, 12).map((row, index) => ({
    name: row.analysis.studentName || `S${index + 1}`,
    stars: Number(row.analysis.stars.toFixed(1)),
    coverage: row.coverage,
  }))

  const handleDownload = async (id: string, format: 'markdown' | 'pdf') => {
    setDownloadingId(`${id}-${format}`)
    try {
      if (format === 'markdown') {
        await reportsService.downloadMarkdown(id)
      } else {
        await reportsService.downloadPdf(id)
      }
    } catch {
      setError('Failed to download report. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  const exportCsv = () => {
    const header = [
      'Student name',
      'Student ID',
      'Question',
      'Role coverage %',
      'Concept coverage %',
      'Depth %',
      'Stars',
      'Overall',
      'Status',
    ].join(',')
    const body = filtered
      .map((row) =>
        [
          row.analysis.studentName ?? '',
          row.analysis.studentId ?? '',
          row.analysis.questionText,
          row.coverage,
          row.concepts,
          row.depth,
          row.analysis.stars.toFixed(1),
          row.overall,
          row.status.passed ? 'Pass' : 'Below threshold',
        ]
          .map(csvEscape)
          .join(','),
      )
      .join('\n')
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rexa-class-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = () => {
    const html = `<!doctype html><html><head><title>RExA class report</title>
      <style>body{font-family:Inter,system-ui,sans-serif;padding:24px;color:#1e1b4b}
      table{border-collapse:collapse;width:100%;font-size:12px}
      th,td{border:1px solid #c7d2fe;padding:6px 8px;text-align:left}
      th{background:#eef2ff} .fail{background:#fff7ed}</style></head><body>
      <h1>RExA class report</h1>
      <p>Pass requires ≥50% role coverage, ≥50% concept coverage, and at least 3 stars.</p>
      <table><thead><tr><th>Student</th><th>ID</th><th>Question</th><th>Roles</th><th>Stars</th><th>Status</th></tr></thead>
      <tbody>${filtered
        .map(
          (row) =>
            `<tr class="${row.status.passed ? '' : 'fail'}"><td>${row.analysis.studentName ?? '—'}</td><td>${row.analysis.studentId ?? '—'}</td><td>${row.analysis.questionText}</td><td>${row.coverage}%</td><td>${row.analysis.stars.toFixed(1)}</td><td>${row.status.passed ? 'Pass' : 'Below threshold'}</td></tr>`,
        )
        .join('')}</tbody></table></body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div>
      <PageHeader
        title="Class report"
        description="Compare graded submissions. Students below the 50% role/concept threshold are highlighted."
        actions={
          !isLoading && analyses.length > 0 ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <FileSpreadsheet />
                Excel / CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportPdf}>
                <Download />
                PDF
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" label="Loading class report…" />
          </div>
        ) : analyses.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={FileText}
                title="No class results yet"
                description="Run a single analysis or a batch upload to generate the class report."
                className="border-0"
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild>
                      <Link to={ROUTES.APP.ANALYSIS}>Run analysis</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link to={ROUTES.APP.BATCH}>Batch upload</Link>
                    </Button>
                  </div>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Submissions</p>
                  <p className="text-2xl font-bold">{filtered.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Avg stars</p>
                  <p className="text-2xl font-bold">{summary.avgStars.toFixed(1)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Avg role coverage</p>
                  <p className="text-2xl font-bold">{Math.round(summary.avgCoverage)}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Below threshold</p>
                  <p className="text-2xl font-bold">{summary.below}</p>
                </CardContent>
              </Card>
            </div>

            {comparison.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Student comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer className="h-64 w-full">
                    <BarChart data={comparison}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="coverage" fill={CHART_COLORS.indigo} name="Role coverage %" />
                      <Bar dataKey="stars" fill={CHART_COLORS.violet} name="Stars (×1)" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                placeholder="Search student, ID, or question…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search class report"
              />
              <Select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                aria-label="Filter by threshold status"
              >
                <option value="all">All statuses</option>
                <option value="pass">Meets threshold</option>
                <option value="below">Below threshold</option>
              </Select>
              <Select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                aria-label="Sort class report"
              >
                <option value="date">Sort by date</option>
                <option value="student">Sort by student</option>
                <option value="stars">Sort by stars</option>
                <option value="coverage">Sort by role coverage</option>
                <option value="depth">Sort by depth</option>
              </Select>
            </div>

            <Card>
              <CardContent className="overflow-x-auto p-0">
                {paged.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No matching students"
                    description="Try a different search or filter."
                    className="border-0"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Question / assignment</TableHead>
                        <TableHead>Role coverage</TableHead>
                        <TableHead>Stars</TableHead>
                        <TableHead>Depth</TableHead>
                        <TableHead>Overall</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map(({ analysis, status, coverage, depth, overall }) => (
                        <TableRow
                          key={analysis.id}
                          className={
                            status.passed
                              ? undefined
                              : 'bg-orange-50 dark:bg-orange-500/10'
                          }
                        >
                          <TableCell className="font-medium">
                            {analysis.studentName || '—'}
                          </TableCell>
                          <TableCell>{analysis.studentId || '—'}</TableCell>
                          <TableCell className="max-w-xs truncate" title={analysis.questionText}>
                            {analysis.questionText}
                          </TableCell>
                          <TableCell>{coverage}%</TableCell>
                          <TableCell>
                            <StarRating value={analysis.stars} size="sm" />
                          </TableCell>
                          <TableCell>{depth}%</TableCell>
                          <TableCell>{overall}</TableCell>
                          <TableCell>
                            <Badge variant={status.passed ? 'default' : 'outline'}>
                              {status.passed ? 'Pass' : 'Below 50%'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" asChild>
                                <Link to={`${ROUTES.APP.REASONING}?id=${analysis.id}`}>
                                  Open
                                </Link>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={downloadingId === `${analysis.id}-pdf`}
                                onClick={() => handleDownload(analysis.id, 'pdf')}
                              >
                                PDF
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
