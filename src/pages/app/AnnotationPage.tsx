import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Star, Tags } from 'lucide-react'
import type {
  AnalysisResult,
  ConceptCoverage,
  SentenceRole,
  SentenceRoleLabel,
} from '@/types'
import { analysisService, annotationsService } from '@/services'
import { EmptyState, PageHeader, ROLE_LABELS } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils'

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
    analysisService
      .listAnalyses({ page: 1, pageSize: 50 })
      .then((response) => setAnalyses(response.data))
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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save annotation.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Annotation lab"
        description="Review and correct REXA's automated labels to improve the model."
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select a submission</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingList ? (
              <p className="text-sm text-muted-foreground">
                Loading submissions…
              </p>
            ) : analyses.length === 0 ? (
              <EmptyState
                icon={Tags}
                title="No submissions to annotate"
                description="Run an analysis first, then come back to annotate it."
                className="border-0"
              />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="submission">Analysis</Label>
                <Select
                  id="submission"
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  <option value="">Select a submission…</option>
                  {analyses.map((analysis) => (
                    <option key={analysis.id} value={analysis.id}>
                      {analysis.questionText} — {formatDate(analysis.createdAt)}
                    </option>
                  ))}
                </Select>
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

        {!isLoadingAnalysis && selectedId && sentenceRoles.length > 0 && (
          <>
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
