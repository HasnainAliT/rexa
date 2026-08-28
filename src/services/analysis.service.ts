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

  async extractPdf(file: File): Promise<{ filename: string; page_count: number; text: string }> {
    return analysisService.extractDocument(file)
  },

  async extractDocument(
    file: File,
  ): Promise<{ filename: string; page_count: number; text: string }> {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.postForm<
      ApiResponse<{ filename: string; page_count: number; text: string }>
    >('/extract-document', form)
    if (!response.data?.text) {
      throw new Error('No text was found in this file.')
    }
    return response.data
  },

  async analyzePdf(
    file: File,
    questionId?: string,
  ): Promise<{
    filename: string
    items: Array<{
      questionText: string
      matchedFromBank: boolean
      note?: string | null
      result: AnalysisResult
    }>
  }> {
    const form = new FormData()
    form.append('file', file)
    if (questionId) form.append('question_id', questionId)
    const response = await apiClient.postForm<
      ApiResponse<{
        filename: string
        items: Array<{
          question_text: string
          matched_from_bank: boolean
          note?: string | null
          analysis: unknown
        }>
      }>
    >('/analyze-pdf', form)
    if (!response.data?.items?.length) {
      throw new Error('No answers were found in this PDF.')
    }
    return {
      filename: response.data.filename,
      items: response.data.items.map((item) => ({
        questionText: item.question_text,
        matchedFromBank: item.matched_from_bank,
        note: item.note,
        result: mapAnalyzeResponse(item.analysis),
      })),
    }
  },
}
