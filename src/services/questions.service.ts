import type {
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  Question,
  QuestionInput,
} from '@/types'
import { mapQuestion, toBackendQuestionPayload } from '@/lib/api-mappers'
import { apiClient } from './api'

export const questionsService = {
  async listQuestions(
    params: PaginationParams = {},
  ): Promise<PaginatedResponse<Question>> {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    const qs = query.toString()
    const response = await apiClient.get<
      ApiResponse<PaginatedResponse<unknown>>
    >(`/questions${qs ? `?${qs}` : ''}`)

    const page = response.data
    return {
      data: (page.data ?? []).map((item) => mapQuestion(item)),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      totalPages: page.totalPages,
    }
  },

  async getQuestion(id: string): Promise<Question> {
    const response = await apiClient.get<ApiResponse<unknown>>(
      `/questions/${id}`,
    )
    return mapQuestion(response.data)
  },

  async createQuestion(payload: QuestionInput): Promise<Question> {
    const response = await apiClient.post<ApiResponse<unknown>>(
      '/questions',
      toBackendQuestionPayload(payload),
    )
    return mapQuestion(response.data)
  },

  async updateQuestion(id: string, payload: QuestionInput): Promise<Question> {
    const response = await apiClient.put<ApiResponse<unknown>>(
      `/questions/${id}`,
      toBackendQuestionPayload(payload),
    )
    return mapQuestion(response.data)
  },

  async deleteQuestion(id: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(`/questions/${id}`)
  },
}
