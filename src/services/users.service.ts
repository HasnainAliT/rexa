import type { ApiResponse, ManagedUser, PaginatedResponse, PaginationParams, UserRole } from '@/types'
import { apiClient } from './api'

export const usersService = {
  async listUsers(params: PaginationParams = {}): Promise<PaginatedResponse<ManagedUser>> {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    const qs = query.toString()
    const response = await apiClient.get<
      ApiResponse<{
        data: Array<{
          id: string
          name: string
          email: string
          role: UserRole
          rollNumber?: string
          createdAt: string
        }>
        total: number
        page: number
        pageSize: number
        totalPages: number
      }>
    >(`/users${qs ? `?${qs}` : ''}`)
    const page = response.data
    return {
      data: page.data ?? [],
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      totalPages: page.totalPages,
    }
  },

  async updateRole(userId: string, role: UserRole): Promise<ManagedUser> {
    const response = await apiClient.patch<ApiResponse<ManagedUser>>(
      `/users/${userId}/role`,
      { role },
    )
    return response.data
  },
}
