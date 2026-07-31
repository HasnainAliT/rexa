import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, GitCompare, Loader2 } from 'lucide-react'
import type { CompareResult, Question } from '@/types'
import { analysisService, questionsService } from '@/services'
import { DimensionBars, EmptyState, PageHeader, StarRating } from '@/components/common'
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
    formState: { errors },
  } = useForm<CompareFormValues>({
    resolver: zodResolver(compareSchema),
    defaultValues: { questionId: '', answerA: '', answerB: '' },
  })

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

    setIsComparing(true)
    try {
      const compareResult = await analysisService.compare({
        questionId: question.id,
        questionText: question.text,
        referenceAnswer: question.referenceAnswer,
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

              <Button type="submit" disabled={isComparing}>
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

        {!result && !isComparing && (
          <EmptyState
            icon={GitCompare}
            title="No comparison yet"
            description="Fill in both answers above and run a comparison."
          />
        )}

        {result && (
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Answer A', data: result.resultA },
              { label: 'Answer B', data: result.resultB },
            ].map(({ label, data }) => (
              <Card key={label}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    {label}
                    <span className="text-sm font-normal text-muted-foreground">
                      {data.reasoningDepth.label}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center gap-3">
                    <StarRating value={data.stars} />
                    <span className="text-xl font-bold">
                      {data.stars.toFixed(1)}
                    </span>
                  </div>
                  <DimensionBars dimensions={data.dimensions} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
