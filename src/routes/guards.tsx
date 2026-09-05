import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks'
import { homePathForRole } from '@/lib/roles'
import type { UserRole } from '@/types'
import { ROUTES } from './paths'
import { Skeleton } from '@/components/ui'

function AuthSkeleton() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  )
}

interface ProtectedRouteProps {
  children?: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <AuthSkeleton />
  }

  if (!isAuthenticated) {
    return (
      <Navigate to={ROUTES.AUTH.LOGIN} state={{ from: location }} replace />
    )
  }

  return children ?? <Outlet />
}

interface GuestRouteProps {
  children?: React.ReactNode
}

export function GuestRoute({ children }: GuestRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to={homePathForRole(user?.role)} replace />
  }

  return children ?? <Outlet />
}

interface RoleRouteProps {
  children?: React.ReactNode
  roles: UserRole[]
}

export function RoleRoute({ children, roles }: RoleRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <AuthSkeleton />
  }

  if (!isAuthenticated) {
    return (
      <Navigate to={ROUTES.AUTH.LOGIN} state={{ from: location }} replace />
    )
  }

  if (!user?.role || !roles.includes(user.role)) {
    return <Navigate to={homePathForRole(user?.role)} replace />
  }

  return children ?? <Outlet />
}

interface TeacherRouteProps {
  children?: React.ReactNode
}

export function TeacherRoute({ children }: TeacherRouteProps) {
  return <RoleRoute roles={['teacher', 'admin']}>{children}</RoleRoute>
}

export function HomeRedirect() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <AuthSkeleton />
  }

  return <Navigate to={homePathForRole(user?.role)} replace />
}
