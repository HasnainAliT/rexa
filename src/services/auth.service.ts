import type {
  ApiResponse,
  LoginCredentials,
  RegisterCredentials,
  User,
} from '@/types'
import { apiClient } from './api'

const AUTH_TOKEN_KEY = 'earas-token'

export const authService = {
  async login(credentials: LoginCredentials): Promise<User> {
    const response = await apiClient.post<ApiResponse<{ user: User; token: string }>>(
      '/auth/login',
      credentials,
    )
    localStorage.setItem(AUTH_TOKEN_KEY, response.data.token)
    return response.data.user
  },

  async register(credentials: RegisterCredentials): Promise<User> {
    const response = await apiClient.post<ApiResponse<{ user: User; token: string }>>(
      '/auth/register',
      credentials,
    )
    localStorage.setItem(AUTH_TOKEN_KEY, response.data.token)
    return response.data.user
  },

  async getCurrentUser(): Promise<User | null> {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (!token) return null

    try {
      const response = await apiClient.get<ApiResponse<User>>('/auth/me')
      return response.data
    } catch {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      return null
    }
  },

  logout(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY)
  },

  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  },
}
