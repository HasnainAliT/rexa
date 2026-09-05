import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import type { Question } from '@/types'
import { analysisService, batchService, questionsService } from '@/services'
import { ROUTES } from '@/routes/paths'
import { overallStatus, toPercent } from '@/lib/grading'
import { EmptyState, LoadingSpinner, PageHeader, StarRating } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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

type DraftRow = {
  studentName: string
  studentId: string
  question: string
  answer: string
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

function guessMapping(columns: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const col of columns) {
    const n = col.toLowerCase().trim()
    if (
      /(timestamp|start time|completion|duration|score|points|quiz feedback|feedback to respondent)/.test(
        n,
      )
    ) {
      map[col] = 'ignore'
    } else if (
      /(full\s*name|student\s*name|^name$|first name|last name)/.test(n) &&
      !/file|user name/.test(n)
    ) {
      map[col] = 'student_name'
    } else if (
      /(student\s*id|\bsid\b|roll|registration|reg\.?\s*no|email)/.test(n)
    ) {
      map[col] = 'student_id'
    } else if (
      /^(question|assignment|prompt)$/.test(n) ||
      n === 'question text'
    ) {
      map[col] = 'question'
    } else if (
      /(^answer$|student answer|response|essay|descriptive)/.test(n)
    ) {
      map[col] = 'answer'
    } else if (n.includes('?') || n.length >= 40) {
      // Online-test exports (Google / Microsoft Forms) use the question as the column header.
      map[col] = 'answer'
    } else {
      map[col] = 'ignore'
    }
  }
  return map
}

function matchQuestion(value: string, bank: Question[]): Question | undefined {
  const needle = value.trim().toLowerCase()
  if (!needle) return undefined
  return (
    bank.find((item) => item.id.toLowerCase() === needle) ||
    bank.find((item) => item.text.toLowerCase() === needle) ||
    bank.find(
      (item) =>
        item.text.toLowerCase().includes(needle) ||
        needle.includes(item.text.toLowerCase().slice(0, 48)),
    )
  )
}

function stemName(filename: string) {
  return filename.replace(/\.(pdf|txt|docx)$/i, '')
}

export function BatchPage() {
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionId, setQuestionId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState<ResultRow[]>([])
  const [running, setRunning] = useState(false)
  const [parsing, setParsing] = useState(false)

  const selectedQuestion = questions.find((q) => q.id === questionId)
  const answerMapped = Object.values(mapping).includes('answer')
  const questionMapped = Object.values(mapping).includes('question')
  const answerColumnCount = Object.values(mapping).filter(
    (value) => value === 'answer',
  ).length

  const rebuildDrafts = (nextRows: Row[], nextMapping: Record<string, string>) => {
    const colsFor = (field: string) =>
      Object.entries(nextMapping)
        .filter(([, value]) => value === field)
        .map(([col]) => col)
    const answerCols = colsFor('answer')
    const nameCols = colsFor('student_name')
    const idCols = colsFor('student_id')
    const questionCols = colsFor('question')

    const next: DraftRow[] = []
    for (const row of nextRows) {
      const studentName = nameCols
        .map((col) => row[col] ?? '')
        .filter(Boolean)
        .join(' ')
      const studentId = idCols.map((col) => row[col] ?? '').find(Boolean) ?? ''
      const mappedQuestion =
        questionCols.map((col) => row[col] ?? '').find(Boolean) ?? ''
      const targets = answerCols.length ? answerCols : []
      if (!targets.length) continue
      for (const answerCol of targets) {
        const answer = row[answerCol] ?? ''
        next.push({
          studentName,
          studentId,
          question: mappedQuestion || (targets.length > 1 ? answerCol : ''),
          answer,
        })
      }
    }
    setDrafts(next)
  }

  const validDrafts = useMemo(
    () => drafts.filter((row) => row.answer.trim()),
    [drafts],
  )
  const emptyAnswers = drafts.length - validDrafts.length
  const missingIds = validDrafts.filter((row) => !row.studentId.trim()).length
  const missingNames = validDrafts.filter((row) => !row.studentName.trim()).length
  const duplicateIds = useMemo(() => {
    const seen = new Map<string, number>()
    for (const row of validDrafts) {
      const id = row.studentId.trim().toLowerCase()
      if (!id) continue
      seen.set(id, (seen.get(id) ?? 0) + 1)
    }
    return [...seen.values()].filter((count) => count > 1).length
  }, [validDrafts])
  const unmatchedQuestions = useMemo(() => {
    if (!questionMapped) return 0
    return validDrafts.filter((row) => !matchQuestion(row.question, questions)).length
  }, [questionMapped, validDrafts, questions])

  const canStart =
    validDrafts.length > 0 &&
    answerMapped &&
    (Boolean(selectedQuestion) ||
      (questionMapped && unmatchedQuestions < validDrafts.length))

  const resolveQuestion = (row: DraftRow): Question | undefined => {
    return matchQuestion(row.question, questions) ?? selectedQuestion
  }

  const onFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (!files.length) return
    setError(null)
    setParsing(true)
    try {
      const documents = files.filter((file) =>
        /\.(pdf|txt|docx)$/i.test(file.name),
      )
      const tables = files.filter((file) =>
        /\.(csv|xlsx|xlsm)$/i.test(file.name),
      )
      if (!documents.length && !tables.length) {
        setError('Upload an Excel (.xlsx) or CSV file from your online test, or PDF / Word / TXT answers.')
        return
      }
      const bank = await questionsService.listQuestions({ pageSize: 100 })
      setQuestions(bank.data)

      if (documents.length) {
        const nextRows: Row[] = []
        for (const file of documents) {
          if (file.name.toLowerCase().endsWith('.txt')) {
            nextRows.push({
              'Student name': stemName(file.name),
              'Student ID': '',
              Answer: await file.text(),
            })
          } else {
            const extracted = await analysisService.extractDocument(file)
            nextRows.push({
              'Student name': stemName(file.name),
              'Student ID': '',
              Answer: extracted.text,
            })
          }
        }
        const nextColumns = ['Student name', 'Student ID', 'Answer']
        const nextMapping = guessMapping(nextColumns)
        setFileName(documents.map((file) => file.name).join(', '))
        setColumns(nextColumns)
        setRows(nextRows)
        setMapping(nextMapping)
        rebuildDrafts(nextRows, nextMapping)
        setStep('map')
        return
      }

      const parsed = await batchService.parseUpload(tables[0])
      const nextMapping = guessMapping(parsed.columns)
      setFileName(parsed.filename)
      setColumns(parsed.columns)
      setRows(parsed.rows)
      setMapping(nextMapping)
      rebuildDrafts(parsed.rows, nextMapping)
      setStep('map')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not read this file. Export the online test as .xlsx or CSV and try again.',
      )
    } finally {
      setParsing(false)
    }
  }

  const analyzeRow = async (row: DraftRow, index: number): Promise<ResultRow> => {
    const question = resolveQuestion(row)
    if (!question) {
      return {
        studentName: row.studentName || `Student ${index + 1}`,
        studentId: row.studentId,
        question: row.question,
        stars: 0,
        coverage: 0,
        depth: 0,
        passed: false,
        error: 'No matching question in the bank for this row.',
      }
    }
    const analysis = await analysisService.analyze({
      questionId: question.id,
      questionText: question.text,
      referenceAnswer: question.referenceAnswer ?? '',
      concepts: question.concepts,
      studentAnswer: row.answer,
      studentName: row.studentName || undefined,
      studentId: row.studentId || undefined,
    })
    const status = overallStatus(analysis)
    return {
      studentName: row.studentName || `Student ${index + 1}`,
      studentId: row.studentId,
      question: question.text,
      stars: analysis.stars,
      coverage: status.concepts.percent,
      depth: toPercent(
        analysis.dimensions.find((d) => d.key === 'reasoning_depth')?.score ?? 0,
      ),
      passed: status.passed,
      analysisId: analysis.id,
    }
  }

  const runBatch = async () => {
    if (!canStart) {
      setError(
        'Map the answer column and pick a fallback question, or map a question column that matches the bank.',
      )
      return
    }
    setError(null)
    setRunning(true)
    setStep('run')
    setResults([])
    setProgress({ done: 0, total: validDrafts.length })
    const next: ResultRow[] = []
    for (let i = 0; i < validDrafts.length; i += 1) {
      try {
        next.push(await analyzeRow(validDrafts[i], i))
      } catch (err) {
        const row = validDrafts[i]
        next.push({
          studentName: row.studentName || `Student ${i + 1}`,
          studentId: row.studentId,
          question: resolveQuestion(row)?.text || row.question,
          stars: 0,
          coverage: 0,
          depth: 0,
          passed: false,
          error: err instanceof Error ? err.message : 'Failed',
        })
      }
      setResults([...next])
      setProgress({ done: i + 1, total: validDrafts.length })
    }
    setRunning(false)
    setStep('done')
  }

  const retryFailed = async () => {
    if (!results.some((row) => row.error)) return
    setRunning(true)
    const updated = [...results]
    for (let i = 0; i < updated.length; i += 1) {
      if (!updated[i].error) continue
      const source = validDrafts[i]
      if (!source) continue
      try {
        updated[i] = await analyzeRow(source, i)
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
    const header = 'Student name,Student ID,Question,Stars,Coverage %,Depth %,Status\n'
    const body = results
      .map((r) =>
        [
          r.studentName,
          r.studentId,
          r.question,
          r.stars,
          r.coverage,
          r.depth,
          r.error ? 'Failed' : r.passed ? 'Pass' : 'Below threshold',
        ]
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

  const updateDraft = (index: number, field: keyof DraftRow, value: string) => {
    setDrafts((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    )
  }

  return (
    <div>
      <PageHeader
        title="Class Excel upload"
        description="Upload the Excel or CSV file from an online test. RExA analyses every student answer in that file and opens reasoning for each one."
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
              <CardTitle className="text-base">
                Upload answers from an online test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                After a Google Form, Microsoft Form, Moodle, or Canvas test,
                download the responses as Excel or CSV and drop that file here.
                One row per student is enough — if each question is its own
                column, RExA will analyse every question separately.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Student name and ID or email (optional but recommended)</li>
                <li>Each descriptive answer in its own column, or one Answer column</li>
              </ul>
              {parsing ? (
                <div className="flex justify-center py-10">
                  <LoadingSpinner label="Reading files…" />
                </div>
              ) : (
                <label
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-sm hover:bg-muted/40"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (event.dataTransfer.files.length) {
                      void onFiles(event.dataTransfer.files)
                    }
                  }}
                >
                  <Upload className="h-6 w-6 text-primary" />
                  Drop Excel here, or choose a file
                  <span className="text-xs text-muted-foreground">
                    .xlsx, .csv, PDF, Word, or TXT
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".csv,text/csv,.txt,.xlsx,.xls,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="sr-only"
                    aria-label="Upload Excel, CSV, PDF, Word, or TXT files"
                    onChange={(event) => {
                      if (event.target.files?.length) void onFiles(event.target.files)
                    }}
                  />
                </label>
              )}
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
              <p className="text-sm text-muted-foreground">
                Match each spreadsheet column. For an online test, map every
                question column to <span className="font-medium">Student answer</span>
                {answerColumnCount > 1
                  ? ` — ${answerColumnCount} question columns will become ${answerColumnCount} analyses per student.`
                  : '.'}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {columns.map((col) => (
                  <div key={col} className="space-y-1">
                    <Label>{col}</Label>
                    <Select
                      value={mapping[col] ?? 'ignore'}
                      onChange={(event) => {
                        const next = { ...mapping, [col]: event.target.value }
                        setMapping(next)
                        rebuildDrafts(rows, next)
                      }}
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
                <Label>Fallback question from bank</Label>
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
                <p className="text-xs text-muted-foreground">
                  Used when a row has no question column, or the mapped question
                  does not match the bank.
                </p>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  {validDrafts.length} answers ready to analyse
                  {emptyAnswers ? ` · ${emptyAnswers} empty cells skipped` : ''}
                  {answerColumnCount > 1
                    ? ` · ${answerColumnCount} questions from this file`
                    : ''}
                  .
                </p>
                {missingNames > 0 && <p>{missingNames} rows are missing a student name.</p>}
                {missingIds > 0 && <p>{missingIds} rows are missing a student ID.</p>}
                {duplicateIds > 0 && (
                  <p>{duplicateIds} student IDs appear more than once.</p>
                )}
                {questionMapped && unmatchedQuestions > 0 && (
                  <p>
                    {unmatchedQuestions} mapped questions do not match the bank
                    {selectedQuestion ? ' and will use the fallback question.' : '.'}
                  </p>
                )}
                {!answerMapped && (
                  <p className="text-destructive">
                    Map at least one column to Student answer. That is the text
                    RExA will evaluate.
                  </p>
                )}
              </div>
              {drafts.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student name</TableHead>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Question / assignment</TableHead>
                        <TableHead>Student answer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drafts.map((row, index) => (
                        <TableRow key={`${row.studentId}-${index}`}>
                          <TableCell className="min-w-36">
                            <Input
                              value={row.studentName}
                              aria-label={`Student name row ${index + 1}`}
                              onChange={(event) =>
                                updateDraft(index, 'studentName', event.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell className="min-w-28">
                            <Input
                              value={row.studentId}
                              aria-label={`Student ID row ${index + 1}`}
                              onChange={(event) =>
                                updateDraft(index, 'studentId', event.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell className="min-w-48">
                            <Input
                              value={row.question}
                              aria-label={`Question row ${index + 1}`}
                              onChange={(event) =>
                                updateDraft(index, 'question', event.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell className="min-w-64">
                            <Textarea
                              value={row.answer}
                              rows={2}
                              aria-label={`Answer row ${index + 1}`}
                              onChange={(event) =>
                                updateDraft(index, 'answer', event.target.value)
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Back
                </Button>
                <Button disabled={!canStart} onClick={() => void runBatch()}>
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
                  <p className="text-2xl font-bold">{stats.total || validDrafts.length}</p>
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
                <div className="flex flex-wrap gap-2">
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
                    title={running ? 'Analyzing…' : 'No results'}
                    className="border-0"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Question</TableHead>
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
                          <TableCell className="max-w-xs truncate" title={row.question}>
                            {row.question || '—'}
                          </TableCell>
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
                                  View reasoning
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
