import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Layers, Loader2 } from 'lucide-react'
import type { BatchAnalyzeResult, Question } from '@/types'
import { batchService, questionsService } from '@/services'
import { ROUTES } from '@/routes/paths'
import { EmptyState, PageHeader, StarRating } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const batchSchema = z.object({
  questionId: z.string().min(1, 'Select a question'),
  answers: z.string().min(1, 'Add at least one student answer'),
})

type BatchFormValues = z.infer<typeof batchSchema>

export function BatchPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [result, setResult] = useState<BatchAnalyzeResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BatchFormValues>({
    resolver: zodResolver(batchSchema),
    defaultValues: { questionId: '', answers: '' },
  })

  useEffect(() => {
    questionsService
      .listQuestions({ pageSize: 100 })
      .then((response) => setQuestions(response.data))
      .catch(() => setQuestions([]))
  }, [])

  const onSubmit = async (values: BatchFormValues) => {
    setError(null)
    setResult(null)

    const question = questions.find((q) => q.id === values.questionId)
    if (!question) {
      setError('Please select a valid question.')
      return
    }

    const studentAnswers = values.answers
      .split('\n')
      .map((answer) => answer.trim())
      .filter(Boolean)

    if (studentAnswers.length === 0) {
      setError('Add at least one non-empty student answer.')
      return
    }

    setIsRunning(true)
    try {
      const batchResult = await batchService.runBatch({
        questionId: question.id,
        questionText: question.text,
        referenceAnswer: question.referenceAnswer,
        concepts: question.concepts,
        studentAnswers,
      })
      setResult(batchResult)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to run batch analysis.',
      )
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Batch evaluation"
        description="Analyze many student answers against a single question at once."
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Batch setup</CardTitle>
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

              <div className="space-y-2">
                <Label htmlFor="answers">Student answers</Label>
                <Textarea
                  id="answers"
                  rows={8}
                  placeholder={
                    'Paste one student answer per line…\nAnswer for student 1\nAnswer for student 2'
                  }
                  {...register('answers')}
                />
                {errors.answers && (
                  <p className="text-xs text-destructive" role="alert">
                    {errors.answers.message}
                  </p>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={isRunning}>
                {isRunning ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Layers />
                )}
                Run batch analysis
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Results</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isRunning ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !result ? (
              <EmptyState
                icon={Layers}
                title="No batch run yet"
                description="Configure a batch above and run it to see per-answer results."
                className="border-0"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Answer</TableHead>
                    <TableHead>Stars</TableHead>
                    <TableHead className="text-right">Reasoning</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((item) => (
                    <TableRow key={item.index}>
                      <TableCell className="text-muted-foreground">
                        {item.index + 1}
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {item.studentAnswer}
                      </TableCell>
                      <TableCell>
                        <StarRating value={item.stars} size="sm" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            to={`${ROUTES.APP.REASONING}?id=${item.analysisId}`}
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
      </div>
    </div>
  )
}
