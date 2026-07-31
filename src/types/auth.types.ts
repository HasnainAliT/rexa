export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: UserRole
}

export type UserRole = 'admin' | 'analyst' | 'viewer'

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  register: (credentials: RegisterCredentials) => Promise<void>
}
