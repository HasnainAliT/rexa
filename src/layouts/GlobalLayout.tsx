import { Outlet } from 'react-router-dom'
import { AuthProvider, ThemeProvider } from '@/context'
import { ErrorBoundary } from '@/components/common'
import { TooltipProvider } from '@/components/ui/tooltip'

export function GlobalLayout() {
  return (
    <ThemeProvider defaultTheme="system">
      <AuthProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <div className="relative min-h-svh bg-background">
              <Outlet />
            </div>
          </ErrorBoundary>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
