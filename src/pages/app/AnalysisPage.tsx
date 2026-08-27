import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, ArrowRight, FileUp, Loader2, Sparkles } from 'lucide-react'
import type { AnalysisResult, Question } from '@/types'
import { analysisService, questionsService } from '@/services'
import { ROUTES } from '@/routes/paths'
import {
  ConceptChips,
  DimensionBars,
  EmptyState,
  HighlightedAnswer,
  PageHeader,
  StarRating,
  TagInput,
  ThresholdPanel,
} from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const analysisSchema = z
  .object({
    mode: z.enum(['bank', 'custom', 'pdf']),
    questionId: z.string().optional(),
    questionText: z.string().optional(),
    referenceAnswer: z.string().optional(),
    concepts: z.string().optional(),
    studentAnswer: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'pdf') {
      return
    }
    if (!data.studentAnswer?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Student answer is required',
        path: ['studentAnswer'],
      })
    }
    if (data.mode === 'bank' && !data.questionId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select a question from the bank',
        path: ['questionId'],
      })
    }
    if (data.mode === 'custom') {
      if (!data.questionText?.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Question text is required',
          path: ['questionText'],
        })
      }
      if (!data.referenceAnswer?.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Reference answer is required',
          path: ['referenceAnswer'],
        })
      }
    }
  })

type AnalysisFormValues = z.infer<typeof analysisSchema>

type PdfExamView = {
  result: AnalysisResult
  questionText: string
  note?: string | null
}

const DRAFT_KEY = 'rexa-analysis-draft'

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

function Counter({ text }: { text: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      {countWords(text)} words · {text.length} characters
    </p>
  )
}

export function AnalysisPage() {
  const examPdfInputRef = useRef<HTMLInputElement>(null)
  const referenceAnswerRef = useRef<HTMLTextAreaElement>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExtractingPdf, setIsExtractingPdf] = useState(false)
  const [extractedPdfName, setExtractedPdfName] = useState<string | null>(null)
  const [pdfName, setPdfName] = useState<string | null>(null)
  const [pdfItems, setPdfItems] = useState<PdfExamView[]>([])
  const [activePdfIndex, setActivePdfIndex] = useState(0)
  const [conceptTags, setConceptTags] = useState<string[]>([])
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<AnalysisFormValues>({
    resolver: zodResolver(analysisSchema),
    defaultValues: {
      mode: 'bank',
      questionId: '',
      questionText: '',
      referenceAnswer: '',
      concepts: '',
      studentAnswer: '',
    },
  })

  const { ref: referenceRegisterRef, ...referenceRegister } =
    register('referenceAnswer')

  const mode = watch('mode')
  const questionId = watch('questionId')
  const questionText = watch('questionText') ?? ''
  const referenceAnswer = watch('referenceAnswer') ?? ''
  const studentAnswer = watch('studentAnswer') ?? ''

  useEffect(() => {
    questionsService
      .listQuestions({ pageSize: 100 })
      .then((response) => setQuestions(response.data))
      .catch(() => setQuestions([]))
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as Partial<AnalysisFormValues> & {
        conceptTags?: string[]
      }
      if (draft.mode) setValue('mode', draft.mode)
      if (draft.questionId) setValue('questionId', draft.questionId)
      if (draft.questionText) setValue('questionText', draft.questionText)
      if (draft.referenceAnswer) setValue('referenceAnswer', draft.referenceAnswer)
      if (draft.studentAnswer) setValue('studentAnswer', draft.studentAnswer)
      if (draft.concepts) setValue('concepts', draft.concepts)
      if (draft.conceptTags?.length) {
        setConceptTags(draft.conceptTags)
        setValue('concepts', draft.conceptTags.join(','))
      }
      setDraftStatus('saved')
    } catch {
      // ignore corrupt drafts
    }
  }, [setValue])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDraftStatus('saving')
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            mode,
            questionId,
            questionText,
            referenceAnswer,
            studentAnswer,
            concepts: conceptTags.join(','),
            conceptTags,
          }),
        )
        setDraftStatus('saved')
      } catch {
        setDraftStatus('idle')
      }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [mode, questionId, questionText, referenceAnswer, studentAnswer, conceptTags])

  useEffect(() => {
    if (referenceAnswerRef.current) {
      referenceAnswerRef.current.scrollTop = 0
    }
  }, [referenceAnswer, questionId])

  const selectedQuestion = useMemo(
    () => questions.find((question) => question.id === questionId) ?? null,
    [questions, questionId],
  )

  const shownResult = pdfItems[activePdfIndex]?.result ?? result
  const shownPdf = pdfItems[activePdfIndex]

  const onSubmit = async (values: AnalysisFormValues) => {
    if (values.mode === 'pdf') return

    setError(null)
    setResult(null)
    setPdfItems([])
    setExtractedPdfName(null)

    let payload: {
      questionId?: string
      questionText: string
      referenceAnswer: string
      concepts?: string[]
      studentAnswer: string
    }

    if (values.mode === 'bank') {
      const question = questions.find((q) => q.id === values.questionId)
      if (!question) {
        setError('Please select a valid question from the bank.')
        return
      }
      payload = {
        questionId: question.id,
        questionText: question.text,
        referenceAnswer: question.referenceAnswer,
        concepts: question.concepts,
        studentAnswer: values.studentAnswer ?? '',
      }
    } else {
      payload = {
        questionText: values.questionText!.trim(),
        referenceAnswer: values.referenceAnswer!.trim(),
        concepts: values.concepts
          ? values.concepts
              .split(',')
              .map((concept) => concept.trim())
              .filter(Boolean)
          : conceptTags,
        studentAnswer: values.studentAnswer ?? '',
      }
    }

    setIsAnalyzing(true)
    try {
      const analysis = await analysisService.analyze(payload)
      setResult(analysis)
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        // ignore
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to run analysis.',
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Run analysis"
        description="Paste an answer, or upload one exam PDF with questions and answers — RExA reads both and returns the same role, coverage, and explanation breakdown."
      />

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-2 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Question &amp; answer</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="relative space-y-5"
              aria-busy={isAnalyzing}
            >
              {isAnalyzing && (
                <div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/85 backdrop-blur-[1px]"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">Analyzing answer…</p>
                  <p className="text-xs text-muted-foreground">
                    Scoring roles, coverage, and depth.
                  </p>
                </div>
              )}
              <Tabs
                value={mode}
                onValueChange={(value) =>
                  setValue('mode', value as 'bank' | 'custom' | 'pdf')
                }
              >
                <TabsList className="w-full">
                  <TabsTrigger value="bank">Question bank</TabsTrigger>
                  <TabsTrigger value="custom">Custom</TabsTrigger>
                  <TabsTrigger value="pdf">Exam PDF</TabsTrigger>
                </TabsList>
              </Tabs>

              {mode === 'bank' && (
                <div className="space-y-2">
                  <Label htmlFor="questionId">Question</Label>
                  <Select id="questionId" {...register('questionId')}>
                    <option value="">Select a question…</option>
                    {questions.map((question) => (
                      <option key={question.id} value={question.id}>
                        {question.text}
                      </option>
                    ))}
                  </Select>
                  {errors.questionId && (
                    <p className="text-xs text-destructive" role="alert">
                      {errors.questionId.message}
                    </p>
                  )}
                  {selectedQuestion && (
                    <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                      <p className="mb-1 font-medium text-foreground">
                        Reference answer
                      </p>
                      <p className="line-clamp-3">
                        {selectedQuestion.referenceAnswer}
                      </p>
                      {selectedQuestion.concepts.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {selectedQuestion.concepts.map((concept) => (
                            <Badge key={concept} variant="outline">
                              {concept}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {questions.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No questions in the bank yet. Add one from the{' '}
                      <Link
                        to={ROUTES.APP.QUESTIONS}
                        className="font-medium text-primary hover:underline"
                      >
                        Questions
                      </Link>{' '}
                      page, or switch to a custom question.
                    </p>
                  )}
                </div>
              )}

              {mode === 'custom' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="questionText">Question</Label>
                    <Textarea
                      id="questionText"
                      placeholder="What causes the seasons on Earth?"
                      {...register('questionText')}
                    />
                    <Counter text={questionText} />
                    {errors.questionText && (
                      <p className="text-xs text-destructive" role="alert">
                        {errors.questionText.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="referenceAnswer">Reference answer</Label>
                    <Textarea
                      id="referenceAnswer"
                      placeholder="The tilt of Earth's axis relative to its orbit around the Sun…"
                      className="scroll-pt-0"
                      {...referenceRegister}
                      ref={(node) => {
                        referenceRegisterRef(node)
                        referenceAnswerRef.current = node
                        if (node) node.scrollTop = 0
                      }}
                    />
                    <Counter text={referenceAnswer} />
                    {errors.referenceAnswer && (
                      <p className="text-xs text-destructive" role="alert">
                        {errors.referenceAnswer.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="concepts">Key concepts</Label>
                    <TagInput
                      id="concepts"
                      value={conceptTags}
                      onChange={(tags) => {
                        setConceptTags(tags)
                        setValue('concepts', tags.join(','), {
                          shouldDirty: true,
                        })
                      }}
                      placeholder="Type a concept and press Enter"
                    />
                    <p className="text-xs text-muted-foreground">
                      Press Enter or comma to add a chip. These are checked
                      against the student answer.
                    </p>
                  </div>
                </div>
              )}

              {mode === 'pdf' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Drop in a typed PDF that includes the questions and the
                    student answers. Headings such as{' '}
                    <span className="font-medium text-foreground">Question:</span> /{' '}
                    <span className="font-medium text-foreground">Answer:</span>{' '}
                    or numbered items like{' '}
                    <span className="font-medium text-foreground">1. … ?</span> work
                    best. RExA splits each pair and runs the full analysis.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Answer-only PDFs are fine too — pick the question below first.
                    Scanned handwriting usually cannot be read.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="pdfQuestionId">Question (optional)</Label>
                    <Select id="pdfQuestionId" {...register('questionId')}>
                      <option value="">Detect from the PDF / question bank</option>
                      {questions.map((question) => (
                        <option key={question.id} value={question.id}>
                          {question.text}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    disabled={isAnalyzing}
                    onClick={() => examPdfInputRef.current?.click()}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <FileUp />
                    )}
                    Analyze exam PDF
                  </Button>
                  <input
                    ref={examPdfInputRef}
                    id="exam-pdf-input"
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (!file) return
                      setError(null)
                      setResult(null)
                      setPdfItems([])
                      setActivePdfIndex(0)
                      setIsAnalyzing(true)
                      try {
                        const data = await analysisService.analyzePdf(
                          file,
                          watch('questionId') || undefined,
                        )
                        const views: PdfExamView[] = data.items.map((item) => ({
                          result: item.result,
                          questionText: item.questionText,
                          note: item.note,
                        }))
                        setPdfName(data.filename)
                        setPdfItems(views)
                        setActivePdfIndex(0)
                        setResult(views[0].result)
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : 'Could not analyze this PDF.',
                        )
                      } finally {
                        setIsAnalyzing(false)
                      }
                    }}
                  />
                  <a
                    href="/samples/rexa-exam-sample.pdf"
                    download
                    className="block text-center text-xs font-medium text-primary hover:underline"
                  >
                    Download a sample exam PDF
                  </a>
                </div>
              )}

              {mode !== 'pdf' && (
                <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="studentAnswer">Student answer</Label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                    <FileUp className="h-3.5 w-3.5" />
                    {isExtractingPdf ? 'Reading PDF…' : 'Upload PDF'}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      disabled={isExtractingPdf || isAnalyzing}
                      onChange={async (event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (!file) return
                        setError(null)
                        setIsExtractingPdf(true)
                        try {
                          const extracted = await analysisService.extractPdf(file)
                          setValue('studentAnswer', extracted.text, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                          setExtractedPdfName(extracted.filename)
                        } catch (err) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : 'Could not read this PDF.',
                          )
                        } finally {
                          setIsExtractingPdf(false)
                        }
                      }}
                    />
                  </label>
                </div>
                {extractedPdfName && (
                  <p className="text-xs text-muted-foreground">
                    Loaded from {extractedPdfName}. You can edit the text before running
                    analysis. Typed PDFs work; scanned photos of handwriting may
                    not.
                  </p>
                )}
                <Textarea
                  id="studentAnswer"
                  rows={6}
                  placeholder="Paste the student's answer, or upload a PDF…"
                  {...register('studentAnswer')}
                />
                <div className="flex items-center justify-between gap-2">
                  <Counter text={studentAnswer} />
                  <p className="text-xs text-muted-foreground" aria-live="polite">
                    {draftStatus === 'saving'
                      ? 'Saving draft…'
                      : draftStatus === 'saved'
                        ? 'Draft saved'
                        : ''}
                  </p>
                </div>
                {errors.studentAnswer && (
                  <p className="text-xs text-destructive" role="alert">
                    {errors.studentAnswer.message}
                  </p>
                )}
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {mode !== 'pdf' && (
                <Button type="submit" className="w-full" disabled={isAnalyzing}>
                  {isAnalyzing ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Sparkles />
                  )}
                  Run analysis
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!shownResult && !isAnalyzing && (
            <EmptyState
              icon={Sparkles}
              title="No analysis yet"
              description="Paste an answer or upload an exam PDF to see roles, coverage, stars, and explanations here."
              className="h-full"
            />
          )}

          {isAnalyzing && (
            <EmptyState
              icon={Loader2}
              title="Analyzing…"
              description="REXA is reasoning through the answer. This usually takes a few seconds."
              className="h-full"
            />
          )}

          {shownResult && !isAnalyzing && (
            <>
              {pdfItems.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {pdfItems.length} questions in {pdfName ?? 'this PDF'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pdfItems.map((item, index) => (
                      <button
                        key={item.result.id}
                        type="button"
                        onClick={() => {
                          setActivePdfIndex(index)
                          setResult(item.result)
                        }}
                        className={`w-full rounded-md border p-2.5 text-left text-sm transition-colors ${
                          index === activePdfIndex
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">Q{index + 1}</span>
                          <StarRating value={item.result.stars} size="sm" />
                        </div>
                        <p className="mt-1 line-clamp-2 text-muted-foreground">
                          {item.questionText}
                        </p>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Result</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`${ROUTES.APP.REASONING}?id=${shownResult.id}`}>
                      Deep dive
                      <ArrowRight />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-5">
                  {(shownPdf?.questionText || shownResult.questionText) && (
                    <div className="rounded-md border bg-muted/40 p-3 text-sm">
                      <p className="mb-1 font-medium">Question</p>
                      <p className="text-muted-foreground">
                        {shownPdf?.questionText || shownResult.questionText}
                      </p>
                      {shownPdf?.note && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {shownPdf.note}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <StarRating value={shownResult.stars} size="lg" />
                    <span className="text-2xl font-bold">
                      {shownResult.stars.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      · {shownResult.reasoningDepth.label}
                    </span>
                  </div>

                  <DimensionBars dimensions={shownResult.dimensions} />
                  <ThresholdPanel analysis={shownResult} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sentence roles</CardTitle>
                </CardHeader>
                <CardContent>
                  <HighlightedAnswer sentences={shownResult.sentenceRoles} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Concept coverage</CardTitle>
                </CardHeader>
                <CardContent>
                  <ConceptChips concepts={shownResult.conceptCoverage} />
                </CardContent>
              </Card>

              {shownResult.explanations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Explanations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {shownResult.explanations.map((explanation) => (
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
    </div>
  )
}
