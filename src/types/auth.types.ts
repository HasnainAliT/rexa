export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: UserRole
  rollNumber?: string
}

export type UserRole = 'admin' | 'teacher' | 'student'

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface LoginCredentials {
  email: string
  password: string
  role: 'teacher' | 'student'
}

export interface RegisterCredentials {
  name: string
  email: string
  password: string
  confirmPassword: string
  role: 'teacher' | 'student'
  rollNumber?: string
  institutionCode?: string
}

export interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<User>
  logout: () => void
  register: (credentials: RegisterCredentials) => Promise<User>
}

export interface ManagedUser {
  id: string
  name: string
  email: string
  role: UserRole
  rollNumber?: string
  createdAt: string
}
