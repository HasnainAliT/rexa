import type { ApiResponse, ModelVersion } from '@/types'
import { mapModelVersion } from '@/lib/api-mappers'
import { apiClient } from './api'

export const modelsService = {
  async listModels(): Promise<ModelVersion[]> {
    const response = await apiClient.get<ApiResponse<unknown[]>>('/models')
    return (response.data ?? []).map((item) => mapModelVersion(item))
  },

  async activateModel(id: string): Promise<ModelVersion> {
    const response = await apiClient.post<ApiResponse<unknown>>(
      `/models/${id}/activate`,
    )
    return mapModelVersion(response.data)
  },
}
