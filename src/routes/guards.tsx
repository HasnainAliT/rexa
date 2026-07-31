import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks'
import { ROUTES } from './paths'
import { Skeleton } from '@/components/ui'

interface ProtectedRouteProps {
  children?: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
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
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.APP.DASHBOARD} replace />
  }

  return children ?? <Outlet />
}
