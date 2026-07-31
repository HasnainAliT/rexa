import type {
  Annotation,
  AnnotationInput,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
} from '@/types'
import { apiClient } from './api'

function mapAnnotation(raw: unknown): Annotation {
  const a = raw as {
    id: string
    submission_id?: string
    analysisId?: string
    user_id?: string
    annotatorId?: string
    sentence_roles?: Annotation['sentenceRoles']
    sentenceRoles?: Annotation['sentenceRoles']
    concepts_present?: string[]
    conceptCoverage?: Annotation['conceptCoverage']
    depth_score?: number
    reasoningDepthLevel?: number
    star_label?: number
    stars?: number
    notes?: string
    created_at?: string
    createdAt?: string
  }

  return {
    id: a.id,
    analysisId: a.analysisId ?? a.submission_id ?? '',
    annotatorId: a.annotatorId ?? a.user_id ?? '',
    sentenceRoles: a.sentenceRoles ?? a.sentence_roles ?? [],
    conceptCoverage:
      a.conceptCoverage ??
      (a.concepts_present ?? []).map((concept) => ({
        concept,
        covered: true,
      })),
    reasoningDepthLevel: a.reasoningDepthLevel ?? a.depth_score ?? 0,
    stars: a.stars ?? a.star_label ?? 0,
    notes: a.notes,
    createdAt: a.createdAt ?? a.created_at ?? new Date().toISOString(),
  }
}

export const annotationsService = {
  async createAnnotation(payload: AnnotationInput): Promise<Annotation> {
    // Backend expects submission_id; analysisId from UI is mapped as submission
    // when Annotation Lab passes the analysis/submission identifier.
    const response = await apiClient.post<ApiResponse<unknown>>('/annotations', {
      analysis_id: payload.analysisId,
      sentence_roles: payload.sentenceRoles,
      concepts_present: payload.conceptCoverage
        .filter((c) => c.covered)
        .map((c) => c.concept),
      support_pairs: [],
      depth_score: payload.reasoningDepthLevel,
      star_label: Math.round(payload.stars),
      notes: payload.notes ?? null,
    })
    return mapAnnotation(response.data)
  },

  async listAnnotations(
    params: PaginationParams = {},
  ): Promise<PaginatedResponse<Annotation>> {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    const qs = query.toString()
    const response = await apiClient.get<
      ApiResponse<PaginatedResponse<unknown>>
    >(`/annotations${qs ? `?${qs}` : ''}`)

    const page = response.data
    return {
      data: (page.data ?? []).map((item) => mapAnnotation(item)),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      totalPages: page.totalPages,
    }
  },
}
