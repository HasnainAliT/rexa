import type { ApiError } from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    const token = this.getToken()
    if (token) {
      ;(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, { ...options, headers })

    if (!response.ok) {
      const error: ApiError = {
        message: response.statusText || 'Request failed',
        status: response.status,
      }

      try {
        const body = await response.json()
        error.message = body.message ?? error.message
        error.code = body.code
      } catch {
        // Response body is not JSON
      }

      const err = new Error(error.message) as Error & ApiError
      err.status = error.status
      err.code = error.code
      throw err
    }

    if (response.status === 204) {
      return undefined as T
    }

    return response.json() as Promise<T>
  }

  private getToken(): string | null {
    try {
      return localStorage.getItem('earas-token')
    } catch {
      return null
    }
  }

  get<T>(endpoint: string, options?: RequestInit) {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  post<T>(endpoint: string, data?: unknown, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  put<T>(endpoint: string, data?: unknown, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  patch<T>(endpoint: string, data?: unknown, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  delete<T>(endpoint: string, options?: RequestInit) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }
}

export const apiClient = new ApiClient(API_BASE_URL)
