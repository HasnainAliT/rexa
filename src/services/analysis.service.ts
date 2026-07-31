import type {
  AnalysisResult,
  AnalyzeRequest,
  ApiResponse,
  CompareRequest,
  CompareResult,
  PaginatedResponse,
  PaginationParams,
} from '@/types'
import {
  mapAnalyzeResponse,
  mapRexaResultToAnalysis,
  toBackendAnalyzePayload,
} from '@/lib/api-mappers'
import { apiClient } from './api'

export const analysisService = {
  async analyze(payload: AnalyzeRequest): Promise<AnalysisResult> {
    const response = await apiClient.post<ApiResponse<unknown>>(
      '/analyze',
      toBackendAnalyzePayload(payload),
    )
    return mapAnalyzeResponse(response.data)
  },

  async getAnalysis(id: string): Promise<AnalysisResult> {
    const response = await apiClient.get<ApiResponse<unknown>>(
      `/analyses/${id}`,
    )
    return mapAnalyzeResponse(response.data)
  },

  async listAnalyses(
    params: PaginationParams = {},
  ): Promise<PaginatedResponse<AnalysisResult>> {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    const qs = query.toString()
    const response = await apiClient.get<
      ApiResponse<PaginatedResponse<unknown>>
    >(`/analyses${qs ? `?${qs}` : ''}`)

    const page = response.data
    return {
      data: (page.data ?? []).map((item) => mapAnalyzeResponse(item)),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      totalPages: page.totalPages,
    }
  },

  async compare(payload: CompareRequest): Promise<CompareResult> {
    const response = await apiClient.post<
      ApiResponse<{
        result_a: Record<string, unknown>
        result_b: Record<string, unknown>
        diff_summary?: string[]
      }>
    >('/compare', {
      question_id: payload.questionId ?? null,
      question_text: payload.questionText,
      reference_answer: payload.referenceAnswer,
      concepts: payload.concepts ?? [],
      answer_a: payload.answerA,
      answer_b: payload.answerB,
    })

    const data = response.data
    return {
      questionText: payload.questionText,
      resultA: mapRexaResultToAnalysis(data.result_a, { id: 'compare-a' }),
      resultB: mapRexaResultToAnalysis(data.result_b, { id: 'compare-b' }),
    }
  },
}
