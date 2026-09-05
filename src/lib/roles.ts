import type { UserRole } from '@/types'
import { ROUTES } from '@/routes/paths'

export function isTeacherRole(role?: string | null): boolean {
  return role === 'admin' || role === 'teacher'
}

export function isAdminRole(role?: string | null): boolean {
  return role === 'admin'
}

export function isStudentRole(role?: string | null): boolean {
  return role === 'student'
}

export function homePathForRole(role?: string | null): string {
  if (isTeacherRole(role)) return ROUTES.APP.DASHBOARD
  return ROUTES.APP.DASHBOARD
}

const STUDENT_PATHS = [
  ROUTES.APP.DASHBOARD,
  ROUTES.APP.ANALYSIS,
  ROUTES.APP.REASONING,
  ROUTES.APP.SETTINGS,
]

const ADMIN_ONLY_PATHS = [ROUTES.APP.USERS]

export function canAccessPath(
  role: UserRole | string | undefined | null,
  pathname: string,
): boolean {
  if (isAdminRole(role)) return true
  if (ADMIN_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return false
  }
  if (isTeacherRole(role)) return true
  return STUDENT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

export function roleLabel(role?: string | null): string {
  if (role === 'student') return 'Student'
  if (role === 'admin') return 'Admin'
  if (role === 'teacher') return 'Instructor'
  return role ? role : 'User'
}
