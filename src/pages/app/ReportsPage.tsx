import { useEffect, useMemo, useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import type { AnalysisResult, Question } from '@/types'
import { analysisService, questionsService, reportsService } from '@/services'
import { ROUTES } from '@/routes/paths'
import { CORE_ROLES, overallStatus, toPercent } from '@/lib/grading'
import { CHART_COLORS } from '@/lib/chart-theme'
import {
  ChartContainer,
  EmptyState,
  LoadingSpinner,
  PageHeader,
  ROLE_LABELS,
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

export function ReportsPage() {
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([])
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [assignmentFilter, setAssignmentFilter] = useState('all')
  const [classFilter, setClassFilter] = useState('all')
  const [questions, setQuestions] = useState<Question[]>([])
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null)

  useEffect(() => {
    let mounted = true
    setIsLoading(true)
    setError(null)

    Promise.all([
      analysisService.listAnalyses({ page: 1, pageSize: 100 }),
      questionsService.listQuestions({ pageSize: 100 }).catch(() => ({ data: [] })),
    ])
      .then(([response, questionResponse]) => {
        if (!mounted) return
        setAnalyses(response.data)
        setQuestions(questionResponse.data ?? [])
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
    if (assignmentFilter !== 'all') {
      rows = rows.filter((row) => {
        const key = row.analysis.questionId || row.analysis.questionText
        return key === assignmentFilter
      })
    }
    const classOf = (analysis: AnalysisResult) => {
      const question = questions.find((item) => item.id === analysis.questionId)
      return question?.subject || 'Unassigned class'
    }
    if (classFilter !== 'all') {
      rows = rows.filter((row) => classOf(row.analysis) === classFilter)
    }
    rows.sort((a, b) => {
      const classCmp = classOf(a.analysis).localeCompare(classOf(b.analysis))
      if (classCmp !== 0) return classCmp
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
  }, [analyses, query, sortKey, statusFilter, assignmentFilter, classFilter, questions])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [query, statusFilter, sortKey, assignmentFilter, classFilter])

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

  const assignmentOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const question of questions) {
      map.set(question.id, question.text)
    }
    for (const analysis of analyses) {
      const key = analysis.questionId || analysis.questionText
      if (key && !map.has(key)) map.set(key, analysis.questionText)
    }
    return [...map.entries()]
  }, [analyses, questions])

  const classLabel = (analysis: AnalysisResult) => {
    const question = questions.find((item) => item.id === analysis.questionId)
    return question?.subject || 'Unassigned class'
  }

  const classOptions = useMemo(() => {
    const names = new Set(analyses.map((analysis) => classLabel(analysis)))
    return [...names].sort()
  }, [analyses, questions])

  const rolePattern = filtered.slice(0, 20).map((row, index) => {
    const point: Record<string, string | number> = {
      name: row.analysis.studentName || `S${index + 1}`,
    }
    for (const role of CORE_ROLES) {
      point[ROLE_LABELS[role]] = row.analysis.sentenceRoles.filter(
        (sentence) => sentence.role === role,
      ).length
    }
    return point
  })

  const comparison = filtered.slice(0, 20).map((row, index) => ({
    name: row.analysis.studentName || `S${index + 1}`,
    starsPct: Number((row.analysis.stars * 20).toFixed(1)),
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

  const exportRows = () =>
    filtered.map((row) => ({
      student_name: row.analysis.studentName ?? '',
      student_id: row.analysis.studentId ?? '',
      class_name: classLabel(row.analysis),
      question: row.analysis.questionText,
      role_coverage: row.coverage,
      concept_coverage: row.concepts,
      depth: row.depth,
      stars: Number(row.analysis.stars.toFixed(1)),
      overall: row.overall,
      status: row.status.passed ? 'Pass' : 'Below threshold',
    }))

  const exportXlsx = async () => {
    setExporting('xlsx')
    setError(null)
    try {
      await reportsService.downloadClassXlsx(exportRows())
    } catch {
      setError('Failed to export Excel. Please try again.')
    } finally {
      setExporting(null)
    }
  }

  const exportPdf = async () => {
    setExporting('pdf')
    setError(null)
    try {
      await reportsService.downloadClassPdf(exportRows())
    } catch {
      setError('Failed to export PDF. Please try again.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Class report"
        description="Compare analyzed submissions. Students below the 50% role/concept threshold are flagged for review."
        actions={
          !isLoading && analyses.length > 0 ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={exporting !== null}
                onClick={() => void exportXlsx()}
              >
                <FileSpreadsheet />
                {exporting === 'xlsx' ? 'Exporting…' : 'Excel'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={exporting !== null}
                onClick={() => void exportPdf()}
              >
                <Download />
                {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
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

            {rolePattern.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Reasoning pattern comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer className="h-64 w-full">
                    <BarChart data={rolePattern}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Claim" stackId="roles" fill={CHART_COLORS.indigo} />
                      <Bar dataKey="Evidence" stackId="roles" fill={CHART_COLORS.sky} />
                      <Bar dataKey="Reasoning" stackId="roles" fill={CHART_COLORS.violet} />
                      <Bar dataKey="Conclusion" stackId="roles" fill={CHART_COLORS.lavender} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

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
                      <Bar dataKey="starsPct" fill={CHART_COLORS.violet} name="Stars (×20)" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input
                placeholder="Search student, ID, or question…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search class report"
              />
              <Select
                value={classFilter}
                onChange={(event) => setClassFilter(event.target.value)}
                aria-label="Filter by class"
              >
                <option value="all">All classes</option>
                {classOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
              <Select
                value={assignmentFilter}
                onChange={(event) => setAssignmentFilter(event.target.value)}
                aria-label="Filter by assignment"
              >
                <option value="all">All assignments</option>
                {assignmentOptions.map(([id, text]) => (
                  <option key={id} value={id}>
                    {text}
                  </option>
                ))}
              </Select>
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
                        <TableHead>Class</TableHead>
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
                      {paged.map(({ analysis, status, coverage, depth, overall }, index) => {
                        const currentClass = classLabel(analysis)
                        const previousClass =
                          index === 0
                            ? undefined
                            : classLabel(paged[index - 1].analysis)
                        const showGroup = currentClass !== previousClass
                        return (
                          <Fragment key={analysis.id}>
                            {showGroup && (
                              <TableRow>
                                <TableCell
                                  colSpan={10}
                                  className="bg-indigo-50 text-sm font-semibold text-indigo-950 dark:bg-indigo-500/15 dark:text-indigo-100"
                                >
                                  {currentClass}
                                </TableCell>
                              </TableRow>
                            )}
                            <TableRow
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
                              <TableCell>{currentClass}</TableCell>
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
                          </Fragment>
                        )
                      })}
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
