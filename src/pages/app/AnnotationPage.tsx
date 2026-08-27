import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Inbox, Loader2, Star, Tags } from 'lucide-react'
import type {
  AnalysisResult,
  ConceptCoverage,
  SentenceRole,
  SentenceRoleLabel,
} from '@/types'
import { analysisService, annotationsService } from '@/services'
import { EmptyState, HighlightedAnswer, PageHeader, ROLE_LABELS } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils'
import { Badge } from '@/components/ui/badge'

const ROLE_OPTIONS = Object.keys(ROLE_LABELS) as SentenceRoleLabel[]

interface InteractiveStarsProps {
  value: number
  onChange: (value: number) => void
}

function InteractiveStars({ value, onChange }: InteractiveStarsProps) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, index) => {
        const starValue = index + 1
        const filled = starValue <= value
        return (
          <button
            key={starValue}
            type="button"
            onClick={() => onChange(starValue)}
            aria-label={`${starValue} star${starValue === 1 ? '' : 's'}`}
          >
            <Star
              className={cn(
                'h-6 w-6 transition-colors',
                filled
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-transparent text-muted-foreground/30 hover:text-amber-300',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}

export function AnnotationPage() {
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([])
  const [annotatedIds, setAnnotatedIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string>('')
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false)

  const [sentenceRoles, setSentenceRoles] = useState<SentenceRole[]>([])
  const [conceptCoverage, setConceptCoverage] = useState<ConceptCoverage[]>([])
  const [depthLevel, setDepthLevel] = useState(3)
  const [stars, setStars] = useState(3)
  const [notes, setNotes] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      analysisService.listAnalyses({ page: 1, pageSize: 50 }),
      annotationsService.listAnnotations({ page: 1, pageSize: 100 }).catch(() => ({
        data: [],
      })),
    ])
      .then(([analysisResponse, annotationResponse]) => {
        setAnalyses(analysisResponse.data)
        setAnnotatedIds(
          new Set(
            (annotationResponse.data ?? [])
              .map((item) => item.analysisId)
              .filter(Boolean),
          ),
        )
      })
      .catch(() => setAnalyses([]))
      .finally(() => setIsLoadingList(false))
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setIsLoadingAnalysis(true)
    setError(null)
    setSuccessMessage(null)

    analysisService
      .getAnalysis(selectedId)
      .then((analysis) => {
        setSentenceRoles(analysis.sentenceRoles)
        setConceptCoverage(analysis.conceptCoverage)
        setDepthLevel(analysis.reasoningDepth.level)
        setStars(Math.round(analysis.stars))
        setNotes('')
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : 'Failed to load analysis.',
        )
      })
      .finally(() => setIsLoadingAnalysis(false))
  }, [selectedId])

  const updateSentenceRole = (index: number, role: SentenceRoleLabel) => {
    setSentenceRoles((prev) =>
      prev.map((sentence) =>
        sentence.index === index ? { ...sentence, role } : sentence,
      ),
    )
  }

  const toggleConcept = (concept: string, covered: boolean) => {
    setConceptCoverage((prev) =>
      prev.map((item) =>
        item.concept === concept ? { ...item, covered } : item,
      ),
    )
  }

  const handleSubmit = async () => {
    if (!selectedId) return
    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      await annotationsService.createAnnotation({
        analysisId: selectedId,
        sentenceRoles,
        conceptCoverage,
        reasoningDepthLevel: depthLevel,
        stars,
        notes: notes.trim() || undefined,
      })
      setSuccessMessage('Annotation saved successfully.')
      setAnnotatedIds((prev) => new Set(prev).add(selectedId))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save annotation.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const pending = useMemo(
    () => analyses.filter((analysis) => !annotatedIds.has(analysis.id)),
    [analyses, annotatedIds],
  )

  return (
    <div>
      <PageHeader
        title="Annotation lab"
        description="Review RExA labels, correct sentence roles, and save gold annotations."
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Pending queue</CardTitle>
            <Badge variant="secondary">{pending.length} pending</Badge>
          </CardHeader>
          <CardContent>
            {isLoadingList ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading submissions…
              </div>
            ) : analyses.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No submissions in the queue"
                description="Run an analysis first. New results appear here so you can review sentence roles and concept coverage."
                className="border-0"
              />
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="submission">Or pick from all analyses</Label>
                  <Select
                    id="submission"
                    value={selectedId}
                    onChange={(event) => setSelectedId(event.target.value)}
                  >
                    <option value="">Select a submission…</option>
                    {analyses.map((analysis) => (
                      <option key={analysis.id} value={analysis.id}>
                        {annotatedIds.has(analysis.id) ? 'Reviewed · ' : 'Pending · '}
                        {analysis.questionText} — {formatDate(analysis.createdAt)}
                      </option>
                    ))}
                  </Select>
                </div>
                <ul className="divide-y rounded-md border">
                  {(pending.length ? pending : analyses).slice(0, 8).map((analysis) => {
                    const reviewed = annotatedIds.has(analysis.id)
                    return (
                      <li key={analysis.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(analysis.id)}
                          className={cn(
                            'flex w-full items-start justify-between gap-3 p-3 text-left text-sm hover:bg-muted/50',
                            selectedId === analysis.id && 'bg-primary/5',
                          )}
                        >
                          <span className="min-w-0">
                            <span className="line-clamp-2 font-medium">
                              {analysis.questionText}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {formatDate(analysis.createdAt)}
                              {analysis.studentName
                                ? ` · ${analysis.studentName}`
                                : ''}
                            </span>
                          </span>
                          <Badge variant={reviewed ? 'outline' : 'secondary'}>
                            {reviewed ? 'Reviewed' : 'Pending'}
                          </Badge>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {successMessage && (
          <Alert variant="success">
            <CheckCircle2 />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {isLoadingAnalysis && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!isLoadingAnalysis && !selectedId && analyses.length > 0 && (
          <EmptyState
            icon={Tags}
            title="Select a submission to review"
            description="Open an item from the pending queue. You can then correct sentence roles, mark concepts, and save a gold annotation."
          />
        )}

        {!isLoadingAnalysis && selectedId && sentenceRoles.length > 0 && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Color-coded preview</CardTitle>
              </CardHeader>
              <CardContent>
                <HighlightedAnswer sentences={sentenceRoles} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sentence roles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sentenceRoles.map((sentence) => (
                  <div
                    key={sentence.index}
                    className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center"
                  >
                    <p className="flex-1 text-sm">{sentence.text}</p>
                    <Select
                      className="sm:w-48"
                      value={sentence.role}
                      onChange={(event) =>
                        updateSentenceRole(
                          sentence.index,
                          event.target.value as SentenceRoleLabel,
                        )
                      }
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Concept coverage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {conceptCoverage.map((concept) => (
                  <label
                    key={concept.concept}
                    className="flex items-center gap-3 rounded-md border p-3 text-sm"
                  >
                    <Checkbox
                      checked={concept.covered}
                      onCheckedChange={(checked) =>
                        toggleConcept(concept.concept, checked)
                      }
                    />
                    {concept.concept}
                  </label>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Reasoning depth</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Label htmlFor="depthLevel">Depth level (1–5)</Label>
                  <Select
                    id="depthLevel"
                    value={String(depthLevel)}
                    onChange={(event) =>
                      setDepthLevel(Number(event.target.value))
                    }
                  >
                    {[1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Overall stars</CardTitle>
                </CardHeader>
                <CardContent>
                  <InteractiveStars value={stars} onChange={setStars} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Optional notes for other annotators or reviewers…"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
                <Button onClick={handleSubmit} disabled={isSaving}>
                  {isSaving && <Loader2 className="animate-spin" />}
                  Save annotation
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
