import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import type { Question } from '@/types'
import { analysisService, batchService, questionsService } from '@/services'
import { ROUTES } from '@/routes/paths'
import { overallStatus, toPercent } from '@/lib/grading'
import { EmptyState, PageHeader, StarRating } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Row = Record<string, string>
type Step = 'upload' | 'map' | 'run' | 'done'

const FIELD_OPTIONS = [
  { id: 'ignore', label: 'Ignore' },
  { id: 'student_name', label: 'Student name' },
  { id: 'student_id', label: 'Student ID' },
  { id: 'question', label: 'Question / assignment' },
  { id: 'answer', label: 'Student answer' },
] as const

function guessMapping(columns: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const col of columns) {
    const n = col.toLowerCase()
    if (/name/.test(n) && !/file|file/.test(n)) map[col] = 'student_name'
    else if (/(student\s*id|sid|roll)/.test(n)) map[col] = 'student_id'
    else if (/(question|assignment|prompt)/.test(n)) map[col] = 'question'
    else if (/(answer|response|essay)/.test(n)) map[col] = 'answer'
    else map[col] = 'ignore'
  }
  return map
}

type ResultRow = {
  studentName: string
  studentId: string
  question: string
  stars: number
  coverage: number
  depth: number
  passed: boolean
  analysisId?: string
  error?: string
}

export function BatchPage() {
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionId, setQuestionId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState<ResultRow[]>([])
  const [running, setRunning] = useState(false)

  const selectedQuestion = questions.find((q) => q.id === questionId)

  const mapped = useMemo(() => {
    return rows
      .map((row) => {
        const get = (field: string) => {
          const col = Object.entries(mapping).find(([, v]) => v === field)?.[0]
          return col ? row[col] ?? '' : ''
        }
        return {
          studentName: get('student_name'),
          studentId: get('student_id'),
          question: get('question'),
          answer: get('answer'),
        }
      })
      .filter((row) => row.answer.trim())
  }, [rows, mapping])

  const onFile = async (file: File) => {
    setError(null)
    try {
      const parsed = await batchService.parseUpload(file)
      setFileName(parsed.filename)
      setColumns(parsed.columns)
      setRows(parsed.rows)
      setMapping(guessMapping(parsed.columns))
      questionsService.listQuestions({ pageSize: 100 }).then((res) => setQuestions(res.data))
      setStep('map')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not read this file. Use CSV or Excel (.xlsx).',
      )
    }
  }

  const runBatch = async () => {
    if (!selectedQuestion) {
      setError('Pick a question from the bank so every student is graded against the same reference.')
      return
    }
    setRunning(true)
    setStep('run')
    setResults([])
    setProgress({ done: 0, total: mapped.length })
    const next: ResultRow[] = []
    for (let i = 0; i < mapped.length; i += 1) {
      const row = mapped[i]
      try {
        const analysis = await analysisService.analyze({
          questionId: selectedQuestion.id,
          questionText: selectedQuestion.text,
          referenceAnswer: selectedQuestion.referenceAnswer,
          concepts: selectedQuestion.concepts,
          studentAnswer: row.answer,
          studentName: row.studentName || undefined,
          studentId: row.studentId || undefined,
        })
        const status = overallStatus(analysis)
        next.push({
          studentName: row.studentName || `Student ${i + 1}`,
          studentId: row.studentId,
          question: selectedQuestion.text,
          stars: analysis.stars,
          coverage: status.roles.percent,
          depth: toPercent(
            analysis.dimensions.find((d) => d.key === 'reasoning_depth')?.score ?? 0,
          ),
          passed: status.passed,
          analysisId: analysis.id,
        })
      } catch (err) {
        next.push({
          studentName: row.studentName || `Student ${i + 1}`,
          studentId: row.studentId,
          question: selectedQuestion.text,
          stars: 0,
          coverage: 0,
          depth: 0,
          passed: false,
          error: err instanceof Error ? err.message : 'Failed',
        })
      }
      setResults([...next])
      setProgress({ done: i + 1, total: mapped.length })
    }
    setRunning(false)
    setStep('done')
  }

  const retryFailed = async () => {
    const failed = results.filter((r) => r.error)
    if (!failed.length || !selectedQuestion) return
    setRunning(true)
    const updated = [...results]
    for (let i = 0; i < updated.length; i += 1) {
      if (!updated[i].error) continue
      const source = mapped[i]
      if (!source) continue
      try {
        const analysis = await analysisService.analyze({
          questionId: selectedQuestion.id,
          questionText: selectedQuestion.text,
          referenceAnswer: selectedQuestion.referenceAnswer,
          concepts: selectedQuestion.concepts,
          studentAnswer: source.answer,
          studentName: source.studentName || undefined,
          studentId: source.studentId || undefined,
        })
        const status = overallStatus(analysis)
        updated[i] = {
          ...updated[i],
          error: undefined,
          stars: analysis.stars,
          coverage: status.roles.percent,
          depth: toPercent(
            analysis.dimensions.find((d) => d.key === 'reasoning_depth')?.score ?? 0,
          ),
          passed: status.passed,
          analysisId: analysis.id,
        }
        setResults([...updated])
      } catch (err) {
        updated[i] = {
          ...updated[i],
          error: err instanceof Error ? err.message : 'Failed',
        }
        setResults([...updated])
      }
    }
    setRunning(false)
  }

  const exportCsv = () => {
    const header = 'Student name,Student ID,Stars,Coverage %,Depth %,Status\n'
    const body = results
      .map((r) =>
        [r.studentName, r.studentId, r.stars, r.coverage, r.depth, r.error ? 'Failed' : r.passed ? 'Pass' : 'Below threshold']
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rexa-class-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = {
    total: results.length,
    completed: results.filter((r) => !r.error).length,
    failed: results.filter((r) => r.error).length,
    processing: running ? progress.total - progress.done : 0,
  }

  return (
    <div>
      <PageHeader
        title="Batch upload"
        description="Grade many student answers at once from CSV or Excel, map columns, then review the class report."
      />
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 'upload' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload roster</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload CSV or Excel (.xlsx) with student name, student ID,
                question/assignment, and student answer columns. Document PDFs
                with question–answer pairs still use Analysis → Exam PDF.
              </p>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-sm hover:bg-muted/40">
                <Upload className="h-6 w-6 text-primary" />
                Choose CSV or Excel file
                <input
                  type="file"
                  accept=".csv,text/csv,.txt,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  aria-label="Upload CSV or Excel roster"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void onFile(file)
                  }}
                />
              </label>
            </CardContent>
          </Card>
        )}

        {step === 'map' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Map columns · {fileName} · {rows.length} submissions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {columns.map((col) => (
                  <div key={col} className="space-y-1">
                    <Label>{col}</Label>
                    <Select
                      value={mapping[col] ?? 'ignore'}
                      onChange={(event) =>
                        setMapping((prev) => ({ ...prev, [col]: event.target.value }))
                      }
                    >
                      {FIELD_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Question from bank</Label>
                <Select
                  value={questionId}
                  onChange={(event) => setQuestionId(event.target.value)}
                >
                  <option value="">Select question…</option>
                  {questions.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.text}
                    </option>
                  ))}
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                {mapped.length} valid answers after mapping.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Back
                </Button>
                <Button disabled={!mapped.length} onClick={() => void runBatch()}>
                  Start analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(step === 'run' || step === 'done') && (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total || mapped.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Processing</p>
                  <p className="text-2xl font-bold">{stats.processing}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold">{stats.failed}</p>
                </CardContent>
              </Card>
            </div>
            {running && (
              <Progress
                value={progress.total ? (progress.done / progress.total) * 100 : 0}
              />
            )}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Class results</CardTitle>
                <div className="flex gap-2">
                  {stats.failed > 0 && (
                    <Button variant="outline" size="sm" disabled={running} onClick={() => void retryFailed()}>
                      Retry failed
                    </Button>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link to={ROUTES.APP.REPORTS}>Class report</Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportCsv} disabled={!results.length}>
                    <FileSpreadsheet />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {results.length === 0 ? (
                  <EmptyState
                    icon={Loader2}
                    title={running ? 'Grading…' : 'No results'}
                    className="border-0"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Stars</TableHead>
                        <TableHead>Coverage</TableHead>
                        <TableHead>Depth</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((row, index) => (
                        <TableRow
                          key={`${row.studentId}-${index}`}
                          className={!row.passed && !row.error ? 'bg-orange-50 dark:bg-orange-500/10' : ''}
                        >
                          <TableCell>{row.studentName}</TableCell>
                          <TableCell>{row.studentId || '—'}</TableCell>
                          <TableCell>
                            <StarRating value={row.stars} size="sm" />
                          </TableCell>
                          <TableCell>{row.coverage}%</TableCell>
                          <TableCell>{row.depth}%</TableCell>
                          <TableCell>
                            {row.error ? (
                              <Badge variant="destructive">{row.error}</Badge>
                            ) : (
                              <Badge variant={row.passed ? 'default' : 'outline'}>
                                {row.passed ? 'Pass' : 'Below 50% threshold'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.analysisId && (
                              <Button variant="ghost" size="sm" asChild>
                                <Link to={`${ROUTES.APP.REASONING}?id=${row.analysisId}`}>
                                  Open
                                </Link>
                              </Button>
                            )}
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
