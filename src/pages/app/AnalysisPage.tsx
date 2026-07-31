import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, ArrowRight, Loader2, Sparkles } from 'lucide-react'
import type { AnalysisResult, Question } from '@/types'
import { analysisService, questionsService } from '@/services'
import { ROUTES } from '@/routes/paths'
import {
  DimensionBars,
  EmptyState,
  PageHeader,
  RoleBadge,
  StarRating,
} from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const analysisSchema = z
  .object({
    mode: z.enum(['bank', 'custom']),
    questionId: z.string().optional(),
    questionText: z.string().optional(),
    referenceAnswer: z.string().optional(),
    concepts: z.string().optional(),
    studentAnswer: z.string().min(1, 'Student answer is required'),
  })
  .superRefine((data, ctx) => {
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

export function AnalysisPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const mode = watch('mode')
  const questionId = watch('questionId')

  useEffect(() => {
    questionsService
      .listQuestions({ pageSize: 100 })
      .then((response) => setQuestions(response.data))
      .catch(() => setQuestions([]))
  }, [])

  const selectedQuestion = useMemo(
    () => questions.find((question) => question.id === questionId) ?? null,
    [questions, questionId],
  )

  const onSubmit = async (values: AnalysisFormValues) => {
    setError(null)
    setResult(null)

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
        studentAnswer: values.studentAnswer,
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
          : [],
        studentAnswer: values.studentAnswer,
      }
    }

    setIsAnalyzing(true)
    try {
      const analysis = await analysisService.analyze(payload)
      setResult(analysis)
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
        description="Evaluate a student answer against a question and reference answer using REXA."
      />

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-2 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Question &amp; answer</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <Tabs
                value={mode}
                onValueChange={(value) =>
                  setValue('mode', value as 'bank' | 'custom')
                }
              >
                <TabsList className="w-full">
                  <TabsTrigger value="bank">From question bank</TabsTrigger>
                  <TabsTrigger value="custom">Custom question</TabsTrigger>
                </TabsList>
              </Tabs>

              {mode === 'bank' ? (
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
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="questionText">Question</Label>
                    <Textarea
                      id="questionText"
                      placeholder="What causes the seasons on Earth?"
                      {...register('questionText')}
                    />
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
                      {...register('referenceAnswer')}
                    />
                    {errors.referenceAnswer && (
                      <p className="text-xs text-destructive" role="alert">
                        {errors.referenceAnswer.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="concepts">
                      Key concepts{' '}
                      <span className="font-normal text-muted-foreground">
                        (comma separated)
                      </span>
                    </Label>
                    <Input
                      id="concepts"
                      placeholder="axial tilt, orbit, solar angle"
                      {...register('concepts')}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="studentAnswer">Student answer</Label>
                <Textarea
                  id="studentAnswer"
                  rows={6}
                  placeholder="Paste the student's answer here…"
                  {...register('studentAnswer')}
                />
                {errors.studentAnswer && (
                  <p className="text-xs text-destructive" role="alert">
                    {errors.studentAnswer.message}
                  </p>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                Run analysis
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!result && !isAnalyzing && (
            <EmptyState
              icon={Sparkles}
              title="No analysis yet"
              description="Fill in the form and run an analysis to see the REXA breakdown here."
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

          {result && !isAnalyzing && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Result</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`${ROUTES.APP.REASONING}?id=${result.id}`}>
                      Deep dive
                      <ArrowRight />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center gap-3">
                    <StarRating value={result.stars} size="lg" />
                    <span className="text-2xl font-bold">
                      {result.stars.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      · {result.reasoningDepth.label}
                    </span>
                  </div>

                  <DimensionBars dimensions={result.dimensions} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sentence roles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.sentenceRoles.map((sentence) => (
                    <div
                      key={sentence.index}
                      className="flex items-start gap-3 rounded-md border p-2.5 text-sm"
                    >
                      <RoleBadge role={sentence.role} />
                      <p className="flex-1">{sentence.text}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Concept coverage</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {result.conceptCoverage.map((concept) => (
                    <Badge
                      key={concept.concept}
                      variant={concept.covered ? 'default' : 'outline'}
                      className={
                        concept.covered
                          ? ''
                          : 'border-dashed text-muted-foreground'
                      }
                    >
                      {concept.concept}
                    </Badge>
                  ))}
                </CardContent>
              </Card>

              {result.explanations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Explanations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {result.explanations.map((explanation) => (
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
