import { useEffect, useMemo, useState } from 'react'
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
  DialogDescription,
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

  const [search, setSearch] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'az' | 'difficulty'>('newest')
  const [page, setPage] = useState(1)
  const pageSize = 8
  const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null)

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

  const filteredQuestions = useMemo(() => {
    let rows = [...questions]
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (item) =>
          item.text.toLowerCase().includes(q) ||
          (item.subject ?? '').toLowerCase().includes(q),
      )
    }
    if (difficultyFilter !== 'all') {
      rows = rows.filter((item) => (item.difficulty ?? 'medium') === difficultyFilter)
    }
    rows.sort((a, b) => {
      if (sortBy === 'az') return a.text.localeCompare(b.text)
      if (sortBy === 'difficulty') {
        const order = { easy: 0, medium: 1, hard: 2 }
        return (order[a.difficulty ?? 'medium'] ?? 1) - (order[b.difficulty ?? 'medium'] ?? 1)
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    return rows
  }, [questions, search, difficultyFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / pageSize))
  const pagedQuestions = filteredQuestions.slice((page - 1) * pageSize, page * pageSize)

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

        <div className="grid gap-2 sm:grid-cols-3">
          <Input
            placeholder="Search questions…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            aria-label="Search questions"
          />
          <Select
            value={difficultyFilter}
            onChange={(event) => {
              setDifficultyFilter(event.target.value as typeof difficultyFilter)
              setPage(1)
            }}
            aria-label="Filter by difficulty"
          >
            <option value="all">All difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
          <Select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            aria-label="Sort questions"
          >
            <option value="newest">Newest</option>
            <option value="az">A–Z</option>
            <option value="difficulty">Difficulty</option>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <LoadingSpinner size="lg" label="Loading questions…" />
              </div>
            ) : filteredQuestions.length === 0 ? (
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
                  {pagedQuestions.map((question) => (
                    <TableRow key={question.id}>
                      <TableCell className="max-w-sm font-medium">
                        <button
                          type="button"
                          className="line-clamp-2 text-left hover:underline"
                          title={question.text}
                          onClick={() => setPreviewQuestion(question)}
                        >
                          {question.text}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {question.subject ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            DIFFICULTY_VARIANT[question.difficulty ?? 'medium']
                          }
                          className="capitalize"
                        >
                          {question.difficulty ?? 'medium'}
                        </Badge>
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

        {!isLoading && filteredQuestions.length > 0 && (
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              {filteredQuestions.length} question
              {filteredQuestions.length === 1 ? '' : 's'} · page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
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
        open={Boolean(previewQuestion)}
        onOpenChange={(open) => !open && setPreviewQuestion(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Question</DialogTitle>
            <DialogDescription>
              {previewQuestion?.subject ?? 'Bank question'} ·{' '}
              {previewQuestion?.difficulty ?? 'medium'}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">{previewQuestion?.text}</p>
          {previewQuestion?.concepts.length ? (
            <p className="text-xs text-muted-foreground">
              Concepts: {previewQuestion.concepts.join(', ')}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewQuestion(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingQuestion)}
        onOpenChange={(open) => !open && setDeletingQuestion(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this question?</DialogTitle>
            <DialogDescription>
              This permanently removes the question from the bank. Analyses
              already saved are not deleted.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            &ldquo;{deletingQuestion?.text}&rdquo;
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
