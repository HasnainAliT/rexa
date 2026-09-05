import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, GitCompare, Loader2 } from 'lucide-react'
import type { CompareResult, Question } from '@/types'
import { analysisService, questionsService } from '@/services'
import { DimensionBars, EmptyState, HighlightedAnswer, PageHeader, StarRating, ThresholdPanel } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

const compareSchema = z.object({
  questionId: z.string().min(1, 'Select a question'),
  answerA: z.string().min(1, 'Answer A is required'),
  answerB: z.string().min(1, 'Answer B is required'),
})

type CompareFormValues = z.infer<typeof compareSchema>

export function ComparePage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [result, setResult] = useState<CompareResult | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CompareFormValues>({
    resolver: zodResolver(compareSchema),
    defaultValues: { questionId: '', answerA: '', answerB: '' },
  })

  const questionId = watch('questionId')
  const selectedQuestion = questions.find((question) => question.id === questionId)
  const hasReference = Boolean(selectedQuestion?.referenceAnswer?.trim())

  useEffect(() => {
    questionsService
      .listQuestions({ pageSize: 100 })
      .then((response) => setQuestions(response.data))
      .catch(() => setQuestions([]))
  }, [])

  const onSubmit = async (values: CompareFormValues) => {
    setError(null)
    setResult(null)

    const question = questions.find((q) => q.id === values.questionId)
    if (!question) {
      setError('Please select a valid question.')
      return
    }
    if (!question.referenceAnswer?.trim()) {
      setError(
        'This question has no reference answer. Add one in the question bank to compare answers.',
      )
      return
    }

    setIsComparing(true)
    try {
      const compareResult = await analysisService.compare({
        questionId: question.id,
        questionText: question.text,
        referenceAnswer: question.referenceAnswer ?? '',
        concepts: question.concepts,
        answerA: values.answerA,
        answerB: values.answerB,
      })
      setResult(compareResult)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to compare answers.',
      )
    } finally {
      setIsComparing(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Compare answers"
        description="Run two answers to the same question side-by-side."
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Setup</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="answerA">Answer A</Label>
                  <Textarea
                    id="answerA"
                    rows={6}
                    placeholder="First student's answer…"
                    {...register('answerA')}
                  />
                  {errors.answerA && (
                    <p className="text-xs text-destructive" role="alert">
                      {errors.answerA.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="answerB">Answer B</Label>
                  <Textarea
                    id="answerB"
                    rows={6}
                    placeholder="Second student's answer…"
                    {...register('answerB')}
                  />
                  {errors.answerB && (
                    <p className="text-xs text-destructive" role="alert">
                      {errors.answerB.message}
                    </p>
                  )}
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={isComparing || Boolean(questionId && !hasReference)}>
                {isComparing ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <GitCompare />
                )}
                Compare answers
              </Button>
            </form>
          </CardContent>
        </Card>

        {questionId && !hasReference && !isComparing && (
          <EmptyState
            icon={GitCompare}
            title="No reference answer"
            description="This question has no model answer. Compare is available when a reference answer exists for baseline comparison."
          />
        )}

        {!result && !isComparing && !(questionId && !hasReference) && (
          <EmptyState
            icon={GitCompare}
            title="No comparison yet"
            description="Fill in both answers above and run a comparison."
          />
        )}

        {isComparing && (
          <EmptyState
            icon={Loader2}
            title="Comparing…"
            description="Scoring both answers sentence by sentence."
          />
        )}

        {result && !isComparing && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Which answer is stronger</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm font-medium">
                  {result.resultA.stars === result.resultB.stars
                    ? 'The two answers scored the same overall.'
                    : result.resultA.stars > result.resultB.stars
                      ? `Answer A is stronger (${result.resultA.stars.toFixed(1)} vs ${result.resultB.stars.toFixed(1)} stars).`
                      : `Answer B is stronger (${result.resultB.stars.toFixed(1)} vs ${result.resultA.stars.toFixed(1)} stars).`}
                </p>
                {result.summary.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {result.summary.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Answer A', data: result.resultA },
              { label: 'Answer B', data: result.resultB },
            ].map(({ label, data }) => {
              const isWinner =
                result.resultA.stars !== result.resultB.stars &&
                data.stars === Math.max(result.resultA.stars, result.resultB.stars)
              return (
              <Card
                key={label}
                className={`flex h-full flex-col ${isWinner ? 'border-indigo-500 ring-2 ring-indigo-500/20' : ''}`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>
                      {label}
                      {isWinner ? ' · stronger' : ''}
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {data.reasoningDepth.label}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col space-y-5">
                  <div className="flex items-center gap-3">
                    <StarRating value={data.stars} />
                    <span className="text-xl font-bold">
                      {data.stars.toFixed(1)}
                    </span>
                  </div>
                  <DimensionBars dimensions={data.dimensions} />
                  <HighlightedAnswer sentences={data.sentenceRoles} />
                  <ThresholdPanel analysis={data} />
                </CardContent>
              </Card>
              )
            })}
          </div>
          </>
        )}
      </div>
    </div>
  )
}
