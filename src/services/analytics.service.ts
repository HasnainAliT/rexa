import type { ApiResponse, DashboardData } from '@/types'
import { mapDashboard } from '@/lib/api-mappers'
import { apiClient } from './api'

export const analyticsService = {
  async getDashboard(): Promise<DashboardData> {
    const response = await apiClient.get<ApiResponse<unknown>>(
      '/analytics/dashboard',
    )
    return mapDashboard(response.data)
  },
}
