import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { BookOpen, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Question } from '@/types'
import { questionsService } from '@/services'
import { EmptyState, FormField, LoadingSpinner, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const questionSchema = z.object({
  text: z.string().min(1, 'Question text is required'),
  referenceAnswer: z.string().min(1, 'Reference answer is required'),
  concepts: z.string().min(1, 'Add at least one concept'),
  subject: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
})

type QuestionFormValues = z.infer<typeof questionSchema>

const DIFFICULTY_VARIANT: Record<string, 'secondary' | 'outline' | 'default'> = {
  easy: 'secondary',
  medium: 'outline',
  hard: 'default',
}

export function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuestionFormValues>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      text: '',
      referenceAnswer: '',
      concepts: '',
      subject: '',
      difficulty: 'medium',
    },
  })

  const loadQuestions = () => {
    setIsLoading(true)
    setError(null)
    questionsService
      .listQuestions({ pageSize: 100 })
      .then((response) => setQuestions(response.data))
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : 'Failed to load questions.',
        )
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadQuestions()
  }, [])

  const openCreateDialog = () => {
    setEditingQuestion(null)
    reset({
      text: '',
      referenceAnswer: '',
      concepts: '',
      subject: '',
      difficulty: 'medium',
    })
    setIsDialogOpen(true)
  }

  const openEditDialog = (question: Question) => {
    setEditingQuestion(question)
    reset({
      text: question.text,
      referenceAnswer: question.referenceAnswer,
      concepts: question.concepts.join(', '),
      subject: question.subject ?? '',
      difficulty: question.difficulty ?? 'medium',
    })
    setIsDialogOpen(true)
  }

  const onSubmit = async (values: QuestionFormValues) => {
    setIsSaving(true)
    setError(null)

    const payload = {
      text: values.text.trim(),
      referenceAnswer: values.referenceAnswer.trim(),
      concepts: values.concepts
        .split(',')
        .map((concept) => concept.trim())
        .filter(Boolean),
      subject: values.subject?.trim() || undefined,
      difficulty: values.difficulty,
    }

    try {
      if (editingQuestion) {
        await questionsService.updateQuestion(editingQuestion.id, payload)
      } else {
        await questionsService.createQuestion(payload)
      }
      setIsDialogOpen(false)
      loadQuestions()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save question.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingQuestion) return
    setIsDeleting(true)
    try {
      await questionsService.deleteQuestion(deletingQuestion.id)
      setDeletingQuestion(null)
      loadQuestions()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete question.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Question bank"
        description="Manage the questions, reference answers, and concepts used across analyses."
        actions={
          <Button onClick={openCreateDialog}>
            <Plus />
            New question
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <LoadingSpinner size="lg" label="Loading questions…" />
              </div>
            ) : questions.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No questions yet"
                description="Create your first question to start running analyses."
                className="border-0"
                action={<Button onClick={openCreateDialog}>New question</Button>}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Concepts</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((question) => (
                    <TableRow key={question.id}>
                      <TableCell className="max-w-sm truncate font-medium">
                        {question.text}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {question.subject ?? '—'}
                      </TableCell>
                      <TableCell>
                        {question.difficulty && (
                          <Badge
                            variant={DIFFICULTY_VARIANT[question.difficulty]}
                            className="capitalize"
                          >
                            {question.difficulty}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {question.concepts.length} concept
                        {question.concepts.length === 1 ? '' : 's'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit question"
                            onClick={() => openEditDialog(question)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete question"
                            onClick={() => setDeletingQuestion(question)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? 'Edit question' : 'New question'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={control} name="text" label="Question">
              {(field) => (
                <Textarea
                  name={field.name}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  value={(field.value as string) ?? ''}
                  placeholder="What causes the seasons on Earth?"
                />
              )}
            </FormField>

            <FormField
              control={control}
              name="referenceAnswer"
              label="Reference answer"
            >
              {(field) => (
                <Textarea
                  name={field.name}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  value={(field.value as string) ?? ''}
                  placeholder="The tilt of Earth's axis…"
                />
              )}
            </FormField>

            <FormField
              control={control}
              name="concepts"
              label="Key concepts"
              description="Comma separated list of concepts to check coverage for."
            >
              {(field) => (
                <Input
                  name={field.name}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  value={(field.value as string) ?? ''}
                  placeholder="axial tilt, orbit, solar angle"
                />
              )}
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={control} name="subject" label="Subject">
                {(field) => (
                  <Input
                    name={field.name}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    value={(field.value as string) ?? ''}
                    placeholder="Earth science"
                  />
                )}
              </FormField>

              <FormField control={control} name="difficulty" label="Difficulty">
                {(field) => (
                  <Select
                    name={field.name}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    value={(field.value as string) ?? 'medium'}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </Select>
                )}
              </FormField>
            </div>

            {(errors.text || errors.referenceAnswer || errors.concepts) && (
              <Alert variant="destructive">
                <AlertDescription>
                  Please fix the highlighted fields above.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="animate-spin" />}
                {editingQuestion ? 'Save changes' : 'Create question'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingQuestion)}
        onOpenChange={(open) => !open && setDeletingQuestion(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete question?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently remove &ldquo;{deletingQuestion?.text}
            &rdquo; from the question bank. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingQuestion(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting && <Loader2 className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
